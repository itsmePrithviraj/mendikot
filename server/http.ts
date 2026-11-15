/** Small HTTP helpers shared by the Worker and the room Durable Object. */

/** Largest accepted JSON request body or WebSocket message, in bytes. */
export const MAX_MESSAGE_BYTES = 2048;

/** A JSON response that browsers and the service worker must never cache. */
export function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

/** A rejected request with a player-facing message and an HTTP status. */
export class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Reads a request body with a hard size cap, without trusting Content-Length. */
export async function readCapped(request: Request): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_MESSAGE_BYTES) {
      await reader.cancel();
      throw new HttpError("Request is too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Parses a small JSON object body. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new HttpError("Expected JSON.", 415);
  const bytes = await readCapped(request);
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError("Invalid request.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError("Invalid request.");
  return body as Record<string, unknown>;
}

/** UTF-8 size of a WebSocket text message. */
export const byteLength = (text: string) =>
  new TextEncoder().encode(text).byteLength;
