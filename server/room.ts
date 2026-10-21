import { DurableObject } from "cloudflare:workers";
import { collectTrick } from "../src/game/engine";
import { RECONNECT_MS } from "../src/multiplayer/protocol";
import type { ServerMessage } from "../src/multiplayer/protocol";
import {
  applyCommand,
  createRoom,
  parseCommand,
  playerName,
  removePlayer,
  roomView,
} from "./room-model";
import type { Player, RoomState } from "./room-model";

const response = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const hash = async (token: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const secret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
interface Attachment {
  id: string;
  window: number;
  count: number;
}

export class GameRoom extends DurableObject<Env> {
  private room: RoomState | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>("room")) ?? null;
      if (this.room) {
        const live = this.connected();
        let changed = false;
        for (const player of this.room.players) {
          if (player && !live.has(player.id) && player.disconnectedAt === null) {
            player.disconnectedAt = Date.now();
            changed = true;
          }
        }
        if (changed) {
          this.room.revision++;
          await this.persist(this.room);
        }
      }
    });
  }

  // Serialize async handlers as well as synchronous engine moves.
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
        .map((s) => (s.deserializeAttachment() as Attachment).id),
    );
  }
  private async persist(room: RoomState) {
    const deadlines = [
      room.expiresAt,
      ...(room.collectAt ? [room.collectAt] : []),
      ...room.players.flatMap((p) =>
        p?.disconnectedAt != null ? [p.disconnectedAt + RECONNECT_MS] : [],
      ),
    ];
    await this.ctx.storage.transaction(async (txn) => {
      await txn.put("room", room);
      await txn.setAlarm(Math.max(Date.now() + 1, Math.min(...deadlines)));
    });
    this.room = room;
  }
  private send(socket: WebSocket, message: ServerMessage) {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      /* Close handler updates presence. */
    }
  }
  private broadcast() {
    if (!this.room) return;
    const connected = this.connected();
    for (const socket of this.ctx.getWebSockets()) {
      const { id } = socket.deserializeAttachment() as Attachment;
      if (this.room.players.some((p) => p?.id === id))
        this.send(socket, {
          type: "snapshot",
          room: roomView(this.room, id, connected),
        });
    }
  }
  private cookieName(code: string) {
    return `mendikot_${code}`;
  }
  private cookie(code: string, token: string, url: URL) {
    return `${this.cookieName(code)}=${token}; Path=/api/rooms/${code}; HttpOnly; SameSite=Strict; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`;
  }
  private async authenticate(request: Request): Promise<Player | null> {
    if (!this.room) return null;
    const name = this.cookieName(this.room.code) + "=";
    const token = request.headers
      .get("Cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(name))
      ?.slice(name.length);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const tokenHash = await hash(token);
    return this.room.players.find((p) => p?.tokenHash === tokenHash) ?? null;
  }
  private async body(request: Request): Promise<Record<string, unknown>> {
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      throw new Error("Expected JSON.");
    // Read with a hard cap rather than trusting Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing request body.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2048) {
        await reader.cancel();
        throw new Error("Request is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid request.");
    return body as Record<string, unknown>;
  }

  fetch(request: Request) {
    return this.exclusive(async () => {
      try {
        return await this.handle(request);
      } catch (error) {
        return response(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unable to open this room.",
          },
          400,
        );
      }
    });
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/rooms") {
      if (this.room)
        return response({ error: "Please try creating the room again." }, 409);
      const body = await this.body(request);
      const name = playerName(body.name);
      if (body.mode !== "cut" && body.mode !== "choose")
        throw new Error("Choose a hukum mode.");
      const code = request.headers.get("X-Room-Code")!;
      const token = secret();
      const player: Player = {
        id: crypto.randomUUID(),
        name,
        tokenHash: await hash(token),
        ready: false,
        disconnectedAt: Date.now(),
      };
      await this.persist(createRoom(code, body.mode, player, Date.now()));
      return response({ code }, 201, {
        "Set-Cookie": this.cookie(code, token, url),
      });
    }
    if (!this.room || this.room.expiresAt <= Date.now())
      return response(
        { error: "This room has expired or does not exist." },
        404,
      );
    const existing = await this.authenticate(request);
    if (request.method === "POST" && url.pathname.endsWith("/join")) {
      if (existing) return response({ code: this.room.code });
      if (this.room.game && this.room.game.phase !== "complete")
        return response({ error: "This deal has already started." }, 409);
      const seat = this.room.players.findIndex((p) => !p);
      if (seat < 0)
        return response({ error: "This room already has four players." }, 409);
      const body = await this.body(request);
      const token = secret();
      const next = structuredClone(this.room);
      next.players[seat] = {
        id: crypto.randomUUID(),
        name: playerName(body.name),
        tokenHash: await hash(token),
        ready: false,
        disconnectedAt: Date.now(),
      };
      if (!next.hostId) next.hostId = next.players[seat]!.id;
      next.revision++;
      await this.persist(next);
      this.broadcast();
      return response({ code: next.code }, 200, {
        "Set-Cookie": this.cookie(next.code, token, url),
      });
    }
    if (!existing)
      return response({ error: "Join this room to take a seat." }, 401);
    if (request.method === "GET" && url.pathname.endsWith("/socket")) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
        return response({ error: "WebSocket required." }, 426);
      const pair = new WebSocketPair();
      const client = pair[0],
        server = pair[1];
      for (const old of this.ctx.getWebSockets(existing.id))
        old.close(4001, "Your seat is open in another tab.");
      this.ctx.acceptWebSocket(server, [existing.id]);
      server.serializeAttachment({
        id: existing.id,
        window: Date.now(),
        count: 0,
      } satisfies Attachment);
      const next = structuredClone(this.room);
      next.players.find((p) => p?.id === existing.id)!.disconnectedAt = null;
      next.revision++;
      await this.persist(next);
      this.broadcast();
      return new Response(null, { status: 101, webSocket: client });
    }
    if (request.method === "GET" && !url.pathname.endsWith("/socket"))
      return response(roomView(this.room, existing.id, this.connected()));
    return response({ error: "Method not allowed." }, 405);
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    return this.exclusive(async () => {
      let id: string | undefined;
      try {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (!this.room || this.room.expiresAt <= Date.now()) {
          socket.close(4004, "Room expired.");
          return;
        }
        if (typeof message !== "string" || message.length > 2048)
          throw new Error("Invalid message.");
        const attachment = socket.deserializeAttachment() as Attachment;
        if (Date.now() - attachment.window > 10_000) {
          attachment.window = Date.now();
          attachment.count = 0;
        }
        attachment.count++;
        socket.serializeAttachment(attachment);
        if (attachment.count > 40) {
          socket.close(4008, "Too many actions. Reconnect in a moment.");
          return;
        }
        const command = parseCommand(JSON.parse(message));
        id = command.id;
        const next = applyCommand(
          this.room,
          attachment.id,
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
          id,
          message:
            error instanceof Error
              ? error.message
              : "Could not apply that action.",
        });
        this.broadcast();
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
      const { id } = socket.deserializeAttachment() as Attachment;
      if (this.connected().has(id)) return; // A replacement tab owns the seat.
      const next = structuredClone(this.room);
      const player = next.players.find((p) => p?.id === id);
      if (!player) return;
      player.disconnectedAt = Date.now();
      player.ready = false;
      next.revision++;
      await this.persist(next);
      this.broadcast();
    });
  }
  webSocketError(socket: WebSocket) {
    return this.webSocketClose(socket);
  }

  alarm() {
    return this.exclusive(async () => {
      if (!this.room) return;
      const now = Date.now();
      if (this.room.expiresAt <= now) {
        for (const socket of this.ctx.getWebSockets())
          socket.close(4004, "Room expired.");
        await this.ctx.storage.deleteAll();
        this.room = null;
        return;
      }
      const next = structuredClone(this.room);
      for (const player of next.players) {
        if (
          player?.disconnectedAt != null &&
          player.disconnectedAt + RECONNECT_MS <= now
        )
          removePlayer(
            next,
            player.id,
            `${player.name} did not reconnect within two minutes. This deal has ended without a winner.`,
          );
      }
      if (next.collectAt !== null && next.collectAt <= now) {
        if (next.game?.phase === "trick-complete")
          next.game = collectTrick(next.game);
        next.collectAt = null;
      }
      next.revision++;
      await this.persist(next);
      this.broadcast();
    });
  }
}
