import { useCallback, useEffect, useRef, useState } from "react";
import type { Mode } from "../game/engine";
import { ROOM_CODE } from "./protocol";
import type {
  Command,
  RoomAction,
  RoomSnapshot,
  ServerMessage,
} from "./protocol";

const STORAGE_KEY = "mendikot.room.v1";
export function rememberedRoom(): string | null {
  try {
    const code = sessionStorage.getItem(STORAGE_KEY);
    return code && ROOM_CODE.test(code) ? code : null;
  } catch {
    return null;
  }
}
export function invitedRoom(): string {
  return new URL(location.href).searchParams.get("room")?.toUpperCase() ?? "";
}
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
  "connecting" | "connected" | "reconnecting" | "replaced" | "idle";

export function useRoom() {
  const [code, setCode] = useState<string | null>(() => {
    const saved = rememberedRoom(),
      invite = invitedRoom();
    return saved && (!invite || invite === saved) ? saved : null;
  });
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [connection, setConnection] = useState<Connection>("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const currentRoom = useRef(room);
  currentRoom.current = room;
  const inflight = useRef<Command | null>(null);
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
    let stopped = false,
      retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0,
      lastPong = Date.now();
    let active: WebSocket | null = null;
    const controller = new AbortController();
    function schedule() {
      if (stopped) return;
      setConnection("reconnecting");
      retry = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 10_000));
    }
    async function connect() {
      if (stopped) return;
      try {
        const res = await fetch(`/api/rooms/${code}`, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
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
        const url = new URL(`/api/rooms/${code}/socket`, location.href);
        url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
        active = new WebSocket(url);
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
          if (event.code === 4001) {
            setConnection("replaced");
            setError(
              "Your seat is open in another tab. Close this view or return there.",
            );
            inflight.current = null;
            setPending(false);
          } else if (event.code === 4004) {
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
        Date.now() - lastPong > 35_000 ||
        (inflight.current &&
          pendingSince.current &&
          Date.now() - pendingSince.current > 10_000)
      ) {
        active.close();
      } else active.send("ping");
    }, 10_000);
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
  }, [code, forget]);

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
    try {
      const res = await fetch(
        normalized ? `/api/rooms/${normalized}/join` : "/api/rooms",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, mode }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.headers.get("Content-Type")?.includes("application/json"))
        throw new Error(
          "Multiplayer is unavailable here. Start the online server or open the hosted game.",
        );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join the room.");
      remember(data.code);
      setRoom(null);
      setCode(data.code);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not connect. Check your connection and try again.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

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
    busy,
    pending,
    enter,
    send,
    forget,
  };
}
