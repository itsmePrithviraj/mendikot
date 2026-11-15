/**
 * Worker entry point. Serves the built app and routes `/api/rooms/*` to the
 * Durable Object that owns each room code.
 */
import { ROOM_CODE, ROOM_CODE_ALPHABET } from "../src/multiplayer/protocol";
import { HttpError, json, readCapped } from "./http";

export { GameRoom } from "./room";

const ROOM_ROUTE = /^\/api\/rooms\/([^/]+)(?:\/(join|socket))?$/;

/** A random room code. The alphabet has 32 letters, so `n & 31` is unbiased. */
function newRoomCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (n) => ROOM_CODE_ALPHABET[n & 31],
  ).join("");
}

/**
 * Coarse per-IP throttle. People behind one network share a counter; this is
 * basic abuse control, not a billing or security guarantee.
 */
async function throttled(limiter: RateLimit, request: Request) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  return !(await limiter.limit({ key: `mendikot:${ip}` })).success;
}

const tooMany = (message: string) =>
  json({ error: message }, 429, { "Retry-After": "60" });

/**
 * Copies a small POST body into memory before handing the request to a room,
 * so the room can answer early without leaving an unread stream behind.
 */
async function buffered(request: Request, headers = request.headers) {
  const body = await readCapped(request);
  return new Request(request.url, { method: "POST", headers, body });
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (url.pathname === "/api/health" && request.method === "GET")
    return json({ ok: true });

  // Session cookies authenticate both HTTP and WebSockets, so mutations and
  // socket upgrades must come from the game's own origin.
  const upgrade = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
  if (
    (request.method !== "GET" || upgrade) &&
    request.headers.get("Origin") !== url.origin
  )
    return json({ error: "Open this room from the game's own website." }, 403);

  if (url.pathname === "/api/rooms") {
    if (request.method !== "POST")
      return json({ error: "Method not allowed." }, 405);
    if (await throttled(env.CREATE_LIMIT, request))
      return tooMany("Too many rooms created. Wait a minute and try again.");
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return json({ error: "Expected JSON." }, 415);
    const code = newRoomCode();
    const headers = new Headers(request.headers);
    headers.set("X-Room-Code", code);
    return env.ROOMS.getByName(code).fetch(await buffered(request, headers));
  }

  const match = url.pathname.match(ROOM_ROUTE);
  if (!match || !ROOM_CODE.test(match[1]))
    return json(
      { error: "Room not found. Check the eight-character code." },
      404,
    );
  const [, code, endpoint] = match;
  if (request.method !== "GET" && request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);
  if (
    (request.method === "POST" || endpoint === "socket") &&
    (await throttled(env.CONNECT_LIMIT, request))
  )
    return tooMany(
      "Too many connection attempts. Wait a minute and try again.",
    );
  // A room only ever sees a buffered POST body, a WebSocket upgrade, or no body.
  return env.ROOMS.getByName(code).fetch(
    request.method === "POST"
      ? await buffered(request)
      : endpoint === "socket" && upgrade
        ? request
        : new Request(request.url, { headers: request.headers }),
  );
}
