import { useCallback, useEffect, useRef, useState } from "react";
import type { Mode } from "../game/engine";
import { CloseCode, ROOM_CODE } from "./protocol";
import type {
  Command,
  RoomAction,
  RoomSnapshot,
  ServerMessage,
} from "./protocol";

/**
 * Browser side of a room: joins over HTTP, then keeps one WebSocket open with
 * reconnection, heartbeats and at most one unacknowledged command.
 */

/** Per-tab memory of the open room. The seat itself is proven by an HttpOnly cookie. */
const STORAGE_KEY = "mendikot.room.v1";
const REQUEST_TIMEOUT_MS = 15_000;
const HEARTBEAT_MS = 10_000;
/** No pong for this long means the connection is dead. */
const PONG_TIMEOUT_MS = 35_000;
/** An unacknowledged command for this long forces a reconnect and resend. */
const ACK_TIMEOUT_MS = 10_000;
const MAX_RETRY_MS = 10_000;

export function rememberedRoom(): string | null {
  try {
    const code = sessionStorage.getItem(STORAGE_KEY);
    return code && ROOM_CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}
/** The room code from an invite link (`?room=CODE`), or "". */
export function invitedRoom(): string {
  return new URL(location.href).searchParams.get("room")?.toUpperCase() ?? "";
}
/** Remembers the room for this tab and mirrors it in the URL so reloads and shares work. */
function remember(code: string | null) {
  try {
    if (code) sessionStorage.setItem(STORAGE_KEY, code);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Cookie still lets the player rejoin. */
  }
  const url = new URL(location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  history.replaceState(null, "", url);
}
export type Connection =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  /** Another tab took over this seat; this view stops reconnecting. */
  | "replaced";

/** An entry failure whose message is written for players. */
class RoomEntryError extends Error {}

const socketUrl = (code: string) => {
  const url = new URL(`/api/rooms/${code}/socket`, location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return url;
};

export function useRoom() {
  const [code, setCode] = useState<string | null>(() => {
    const saved = rememberedRoom(),
      invite = invitedRoom();
    return saved && (!invite || invite === saved) ? saved : null;
  });
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [connection, setConnection] = useState<Connection>("idle");
  const [error, setError] = useState("");
  /** A non-error message for the entry screen, such as "You left the room." */
  const [notice, setNotice] = useState("");
  /** Bumped to reopen the connection after another tab took the seat. */
  const [session, setSession] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const currentRoom = useRef(room);
  currentRoom.current = room;
  /** The one command awaiting acknowledgement. */
  const inflight = useRef<Command | null>(null);
  /** When `inflight` was last sent on the current socket; 0 if not yet resent. */
  const pendingSince = useRef(0);
  const busyRef = useRef(false);

  const forget = useCallback(() => {
    remember(null);
    inflight.current = null;
    setPending(false);
    setRoom(null);
    setCode(null);
    setConnection("idle");
  }, []);

  useEffect(() => {
    if (!code) return;
    const roomCode = code;
    let stopped = false,
      retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0,
      lastPong = Date.now();
    let active: WebSocket | null = null;
    const controller = new AbortController();
    function schedule() {
      if (stopped) return;
      setConnection("reconnecting");
      retry = setTimeout(
        connect,
        Math.min(1000 * 2 ** attempt++, MAX_RETRY_MS),
      );
    }
    async function connect() {
      if (stopped) return;
      try {
        const res = await fetch(`/api/rooms/${roomCode}`, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          ]),
        });
        if (stopped) return;
        if (res.status === 401 || res.status === 404) {
          const body = await res.json();
          setError(body.error ?? "Please join the room again.");
          forget();
          return;
        }
        if (!res.ok) throw new Error("Room unavailable.");
        const snapshot = (await res.json()) as RoomSnapshot;
        if (stopped) return;
        setRoom(snapshot);
        active = new WebSocket(socketUrl(roomCode));
        socket.current = active;
        const ws = active;
        ws.onopen = () => {
          lastPong = Date.now();
          ws.send("ping");
        };
        ws.onmessage = (event) => {
          if (stopped || socket.current !== ws) return;
          if (event.data === "pong") {
            lastPong = Date.now();
            return;
          }
          try {
            const message = JSON.parse(event.data) as ServerMessage;
            if (message.type === "snapshot") {
              setRoom((previous) =>
                !previous || message.room.revision >= previous.revision
                  ? message.room
                  : previous,
              );
              setConnection("connected");
              attempt = 0;
              // A move may have been accepted before its acknowledgement was lost.
              // Resend its SAME ID once per new connection; the server deduplicates it.
              if (inflight.current && pendingSince.current === 0) {
                pendingSince.current = Date.now();
                ws.send(JSON.stringify(inflight.current));
              }
            } else if (message.type === "left") {
              forget();
              setNotice(`You left room ${roomCode}.`);
            } else if (message.type === "ack" || message.type === "error") {
              if (message.id === inflight.current?.id) {
                inflight.current = null;
                setPending(false);
              }
              if (message.type === "error") setError(message.message);
            }
          } catch {
            setError("Could not read the server update. Reconnecting…");
            ws.close();
          }
        };
        ws.onclose = (event) => {
          if (stopped || socket.current !== ws) return;
          socket.current = null;
          pendingSince.current = 0;
          if (event.code === CloseCode.replaced) {
            setConnection("replaced");
            inflight.current = null;
            setPending(false);
          } else if (event.code === CloseCode.expired) {
            setError("This room has expired. Create a new room to play again.");
            forget();
          } else schedule();
        };
        ws.onerror = () => ws.close();
      } catch {
        if (!stopped) schedule();
      }
    }
    setConnection("connecting");
    void connect();
    const heartbeat = setInterval(() => {
      if (!active || active.readyState !== WebSocket.OPEN) return;
      if (
        Date.now() - lastPong > PONG_TIMEOUT_MS ||
        (inflight.current &&
          pendingSince.current &&
          Date.now() - pendingSince.current > ACK_TIMEOUT_MS)
      ) {
        active.close();
      } else active.send("ping");
    }, HEARTBEAT_MS);
    // Phones suspend background tabs; check the connection as soon as we return.
    function wake() {
      if (document.visibilityState !== "visible") return;
      if (active?.readyState === WebSocket.OPEN) active.send("ping");
    }
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(retry);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", wake);
      if (socket.current === active) socket.current = null;
      active?.close(1000, "View closed.");
    };
  }, [code, forget, session]);

  // An invite link opened in a new tab or after a restart: if this browser
  // already holds a seat in that room, go straight back to it.
  useEffect(() => {
    const invite = invitedRoom();
    if (code || !ROOM_CODE.test(invite)) return;
    const controller = new AbortController();
    fetch(`/api/rooms/${invite}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) return;
        remember(invite);
        setCode(invite);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [code]);

  /** Takes the seat back after another tab replaced this one. */
  const reclaim = useCallback(() => {
    setError("");
    setSession((n) => n + 1);
  }, []);

  /** Creates a room, or joins `joinCode` when given. */
  async function enter(name: string, mode: Mode, joinCode?: string) {
    if (busyRef.current) return;
    const normalized = joinCode?.trim().toUpperCase();
    if (joinCode !== undefined && !ROOM_CODE.test(normalized ?? "")) {
      setError("Enter the eight-character room code.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!navigator.onLine)
        throw new RoomEntryError(
          "You're offline. Connect to the internet to play with friends.",
        );
      const res = await fetch(
        normalized ? `/api/rooms/${normalized}/join` : "/api/rooms",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, mode }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      // Without the Worker (e.g. `npm run dev`), the request falls through to the app.
      if (!res.headers.get("Content-Type")?.includes("application/json"))
        throw new RoomEntryError(
          "Online play isn't available on this copy of the game. Open the hosted game to play with friends.",
        );
      const data = await res.json();
      if (!res.ok)
        throw new RoomEntryError(data.error ?? "Could not join the room.");
      remember(data.code);
      setRoom(null);
      setCode(data.code);
    } catch (error) {
      setError(
        error instanceof RoomEntryError
          ? error.message
          : "Could not reach the game. Check your connection and try again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  /** Sends an action against the current snapshot. Ignored while another is unacknowledged. */
  function send(action: RoomAction) {
    const view = currentRoom.current,
      ws = socket.current;
    if (
      !view ||
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      connection !== "connected" ||
      inflight.current
    )
      return;
    const command: Command = {
      id: crypto.randomUUID(),
      revision: view.revision,
      action,
    };
    inflight.current = command;
    pendingSince.current = Date.now();
    setPending(true);
    setError("");
    ws.send(JSON.stringify(command));
  }
  return {
    room,
    code,
    connection,
    error,
    setError,
    notice,
    busy,
    pending,
    enter,
    send,
    forget,
    reclaim,
  };
}
