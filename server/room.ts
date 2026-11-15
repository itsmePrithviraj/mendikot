/**
 * One Durable Object per room. It owns the authoritative state, persists every
 * accepted change before acknowledging it, and pushes each connected player
 * their own private snapshot. Rules live in `room-model.ts`.
 */
import { DurableObject } from "cloudflare:workers";
import { CloseCode } from "../src/multiplayer/protocol";
import type { ServerMessage } from "../src/multiplayer/protocol";
import {
  byteLength,
  HttpError,
  json,
  MAX_MESSAGE_BYTES,
  readJsonObject,
} from "./http";
import {
  advanceTimers,
  applyCommand,
  createRoom,
  isExpired,
  joinRoom,
  nextDeadline,
  parseCommand,
  playerName,
  reconcilePresence,
  roomView,
  RoomError,
  setConnected,
} from "./room-model";
import type { Player, RoomState } from "./room-model";
import { hashToken, newToken, sessionCookie, sessionToken } from "./session";

/** Per-socket command budget: at most COMMAND_LIMIT messages per window. */
const COMMAND_LIMIT = 40;
const COMMAND_WINDOW_MS = 10_000;

/** Stored on each hibernatable socket so it survives the object sleeping. */
interface Attachment {
  playerId: string;
  windowStart: number;
  count: number;
}
const attachmentOf = (socket: WebSocket) =>
  socket.deserializeAttachment() as Attachment;

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export class GameRoom extends DurableObject<Env> {
  /** In-memory copy of the stored room; storage is always written first. */
  private room: RoomState | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Heartbeats are answered without waking the object.
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
    ctx.blockConcurrencyWhile(async () => {
      const stored = (await ctx.storage.get<RoomState>("room")) ?? null;
      if (!stored) return;
      this.room = stored;
      const next = reconcilePresence(stored, this.connected(), Date.now());
      if (next !== stored) await this.persist(next);
    });
  }

  /**
   * Runs handlers one at a time. Durable Objects interleave async handlers at
   * every await, so without this two moves could read the same room.
   */
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next;
  }

  private connected() {
    return new Set(
      this.ctx
        .getWebSockets()
        .filter((s) => s.readyState === WebSocket.OPEN)
        .map((s) => attachmentOf(s).playerId),
    );
  }

  /** Saves the room and its next alarm atomically, then adopts it in memory. */
  private async persist(room: RoomState) {
    await this.ctx.storage.transaction(async (txn) => {
      await txn.put("room", room);
      await txn.setAlarm(Math.max(Date.now() + 1, nextDeadline(room)));
    });
    this.room = room;
  }

  private send(socket: WebSocket, message: ServerMessage) {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      /* The close handler updates presence. */
    }
  }

  /** Sends each socket (or just `only`) its owner's current private snapshot. */
  private broadcast(only?: WebSocket) {
    if (!this.room) return;
    const room = this.room;
    const connected = this.connected();
    for (const socket of only ? [only] : this.ctx.getWebSockets()) {
      const { playerId } = attachmentOf(socket);
      if (room.players.some((p) => p?.id === playerId))
        this.send(socket, {
          type: "snapshot",
          room: roomView(room, playerId, connected),
        });
    }
  }

  private async authenticate(request: Request): Promise<Player | null> {
    if (!this.room) return null;
    const token = sessionToken(request, this.room.code);
    if (!token) return null;
    const tokenHash = await hashToken(token);
    return this.room.players.find((p) => p?.tokenHash === tokenHash) ?? null;
  }

  /** A new player record plus the cookie that proves the player owns it. */
  private async newPlayer(name: unknown, code: string, url: URL) {
    const token = newToken();
    const player: Player = {
      id: crypto.randomUUID(),
      name: playerName(name),
      tokenHash: await hashToken(token),
      ready: false,
      // Counts as away until the first socket opens.
      disconnectedAt: Date.now(),
    };
    return { player, cookie: sessionCookie(code, token, url) };
  }

  fetch(request: Request) {
    return this.exclusive(async () => {
      try {
        return await this.handle(request);
      } catch (error) {
        return json(
          { error: errorMessage(error, "Unable to open this room.") },
          error instanceof HttpError ? error.status : 400,
        );
      } finally {
        // Never leave a request body unread behind an early response.
        if (request.body && !request.bodyUsed)
          await request.body.cancel().catch(() => {});
      }
    });
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/rooms")
      return this.create(request, url);
    if (!this.room || isExpired(this.room, Date.now()))
      return json({ error: "This room has expired or does not exist." }, 404);
    const room = this.room;
    const existing = await this.authenticate(request);

    if (request.method === "POST" && url.pathname.endsWith("/join")) {
      // Joining again from the same browser simply recovers the seat.
      if (existing) return json({ code: room.code });
      const body = await readJsonObject(request);
      const { player, cookie } = await this.newPlayer(
        body.name,
        room.code,
        url,
      );
      await this.persist(joinRoom(room, player));
      this.broadcast();
      return json({ code: room.code }, 200, { "Set-Cookie": cookie });
    }
    if (!existing)
      return json({ error: "Join this room to take a seat." }, 401);
    if (request.method !== "GET")
      return json({ error: "Method not allowed." }, 405);
    if (url.pathname.endsWith("/socket"))
      return this.openSocket(request, existing);
    return json(roomView(room, existing.id, this.connected()));
  }

  private async create(request: Request, url: URL) {
    // The Worker picked a random code; a collision means try again.
    if (this.room)
      return json({ error: "Please try creating the room again." }, 409);
    const body = await readJsonObject(request);
    if (body.mode !== "cut" && body.mode !== "choose")
      throw new RoomError("Choose a hukum mode.");
    const code = request.headers.get("X-Room-Code")!;
    const { player, cookie } = await this.newPlayer(body.name, code, url);
    await this.persist(createRoom(code, body.mode, player, Date.now()));
    return json({ code }, 201, { "Set-Cookie": cookie });
  }

  private async openSocket(request: Request, player: Player) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
      return json({ error: "WebSocket required." }, 426);
    // One live socket per player: a new tab takes over the seat.
    for (const old of this.ctx.getWebSockets(player.id))
      old.close(CloseCode.replaced, "Your seat is open in another tab.");
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [player.id]);
    server.serializeAttachment({
      playerId: player.id,
      windowStart: Date.now(),
      count: 0,
    } satisfies Attachment);
    await this.persist(setConnected(this.room!, player.id, true, Date.now()));
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Counts a message against the socket's budget. False means close it. */
  private withinBudget(socket: WebSocket, attachment: Attachment) {
    const now = Date.now();
    if (now - attachment.windowStart > COMMAND_WINDOW_MS) {
      attachment.windowStart = now;
      attachment.count = 0;
    }
    attachment.count++;
    socket.serializeAttachment(attachment);
    return attachment.count <= COMMAND_LIMIT;
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    return this.exclusive(async () => {
      let commandId: string | undefined;
      try {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (!this.room || isExpired(this.room, Date.now())) {
          socket.close(CloseCode.expired, "Room expired.");
          return;
        }
        // Every message counts against the budget, including invalid ones.
        const attachment = attachmentOf(socket);
        if (!this.withinBudget(socket, attachment)) {
          socket.close(
            CloseCode.rateLimited,
            "Too many actions. Reconnect in a moment.",
          );
          return;
        }
        if (
          typeof message !== "string" ||
          byteLength(message) > MAX_MESSAGE_BYTES
        )
          throw new RoomError("Invalid message.");
        let parsed: unknown;
        try {
          parsed = JSON.parse(message);
        } catch {
          throw new RoomError("Invalid action.");
        }
        const command = parseCommand(parsed);
        commandId = command.id;
        const next = applyCommand(
          this.room,
          attachment.playerId,
          command,
          this.connected(),
          Date.now(),
        );
        if (next !== this.room) await this.persist(next);
        this.send(socket, { type: "ack", id: command.id });
        if (command.action.type === "leave") {
          this.send(socket, { type: "left" });
          socket.close(1000, "Left room.");
        }
        this.broadcast();
      } catch (error) {
        this.send(socket, {
          type: "error",
          id: commandId,
          message: errorMessage(error, "Could not apply that action."),
        });
        // Resync the sender in case its snapshot was stale.
        this.broadcast(socket);
      }
    });
  }

  webSocketClose(socket: WebSocket) {
    return this.exclusive(async () => {
      try {
        socket.close(1000, "Connection closed.");
      } catch {
        /* Already closed. */
      }
      if (!this.room) return;
      const { playerId } = attachmentOf(socket);
      if (this.connected().has(playerId)) return; // A replacement tab owns the seat.
      const next = setConnected(this.room, playerId, false, Date.now());
      if (next === this.room) return;
      await this.persist(next);
      this.broadcast();
    });
  }

  webSocketError(socket: WebSocket) {
    return this.webSocketClose(socket);
  }

  /** Wakes for the earliest deadline: trick collection, a seat release or expiry. */
  alarm() {
    return this.exclusive(async () => {
      if (!this.room) return;
      const now = Date.now();
      if (isExpired(this.room, now)) {
        for (const socket of this.ctx.getWebSockets())
          socket.close(CloseCode.expired, "Room expired.");
        await this.ctx.storage.deleteAll();
        this.room = null;
        return;
      }
      const next = advanceTimers(this.room, now);
      const changed = next !== this.room;
      // Persisting also schedules the next alarm, even when nothing was due.
      await this.persist(next);
      if (changed) this.broadcast();
    });
  }
}
