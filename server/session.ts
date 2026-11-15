/**
 * Guest sessions. Joining a room issues a random token in an HttpOnly cookie
 * scoped to that room's API path; the room stores only the token's hash.
 */

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const cookieName = (code: string) => `mendikot_${code}`;

/** A new 256-bit session token, hex encoded. */
export const newToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return hex(new Uint8Array(digest));
}

export function sessionCookie(code: string, token: string, url: URL) {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${cookieName(code)}=${token}; Path=/api/rooms/${code}; HttpOnly; SameSite=Strict; Max-Age=86400${secure}`;
}

/** The well-formed session token for this room in the request's cookies, if any. */
export function sessionToken(request: Request, code: string): string | null {
  const prefix = `${cookieName(code)}=`;
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
