export { GameRoom } from "./room";
import { ROOM_CODE } from "../src/multiplayer/protocol";

export function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname === "/api/health" && request.method === "GET")
      return json({ ok: true });
    // Cookies authenticate HTTP and WebSockets. Reject cross-origin mutation/upgrade requests.
    if (
      request.method !== "GET" ||
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      if (request.headers.get("Origin") !== url.origin)
        return json(
          { error: "Open this room from the game's own website." },
          403,
        );
    }
    if (request.method === "POST" && url.pathname === "/api/rooms") {
      // Guest creation has no account ID yet. This coarse IP throttle is shared by
      // people on the same network; it is not a global billing or abuse guarantee.
      const key = `mendikot:${request.headers.get("CF-Connecting-IP") ?? "local"}`;
      if (!(await env.CREATE_LIMIT.limit({ key })).success)
        return json(
          { error: "Too many rooms created. Wait a minute and try again." },
          429,
          { "Retry-After": "60" },
        );
      if (!request.headers.get("Content-Type")?.startsWith("application/json"))
        return json({ error: "Expected JSON." }, 415);
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(8)),
        (n) => alphabet[n & 31],
      ).join("");
      const headers = new Headers(request.headers);
      headers.set("X-Room-Code", code);
      return env.ROOMS.getByName(code).fetch(new Request(request, { headers }));
    }
    const match = url.pathname.match(
      /^\/api\/rooms\/([^/]+)(?:\/(join|socket))?$/,
    );
    if (!match || !ROOM_CODE.test(match[1]))
      return json(
        { error: "Room not found. Check the eight-character code." },
        404,
      );
    if (request.method === "POST" || match[2] === "socket") {
      const key = `mendikot:${request.headers.get("CF-Connecting-IP") ?? "local"}`;
      if (!(await env.CONNECT_LIMIT.limit({ key })).success)
        return json(
          {
            error: "Too many connection attempts. Wait a minute and try again.",
          },
          429,
          { "Retry-After": "60" },
        );
    }
    return env.ROOMS.getByName(match[1]).fetch(request);
  },
} satisfies ExportedHandler<Env>;
