# Multiplayer: how the pieces work

This branch adds four-human private tables using Cloudflare Workers, SQLite-backed Durable Objects, and native WebSockets. The React interface and existing Mendikot rules are shared with offline practice. No Socket.IO or Colyseus is involved.

## Run it on your computer

```sh
npm ci
npm run check:server
npm run dev:online
```

Open http://localhost:8787 and choose **Play with friends**. `dev:online` builds the frontend, then runs Cloudflare's local runtime through Wrangler. No Cloudflare login is needed for this local server. Wrangler watches backend changes; run `npm run build` after changing frontend files. `npm run dev` remains the hot-reloading offline-practice frontend on Vite.

For four players on one computer, use four separate browser profiles or isolated browser contexts. Tabs in the same browser profile share a session cookie and therefore represent the same player, not four players. Opening the same seat in another tab replaces its previous connection rather than creating a second player.

Local Durable Object storage lives in `.wrangler/`, which is ignored by Git. Restarting Wrangler with that directory intact preserves saved rooms. Clearing the directory deletes local test rooms. Local and deployed storage are separate.

## Stage 1: the Worker is the front door

`server/index.ts` receives requests:

- `GET /api/health`: a small health response.
- `POST /api/rooms`: generate a random room code and create a room.
- `POST /api/rooms/:code/join`: join an available seat or recover the existing session.
- `GET /api/rooms/:code`: the authenticated player's current snapshot.
- `GET /api/rooms/:code/socket`: upgrade to an authenticated WebSocket connection.

Everything outside `/api/` is served from the built React application. One deployed Worker serves both frontend files and backend requests on the same origin. The service worker explicitly excludes `/api/` from its navigation fallback; online snapshots must never come from an offline cache.

The Worker uses a **binding** named `ROOMS` to reach Durable Objects. A binding is a connection Cloudflare provides to a configured resource; it is not a public API key.

## Stage 2: a Durable Object owns each room

`server/room.ts` defines `GameRoom`. The Worker uses `env.ROOMS.getByName(code)` to find the object for that particular room code. Every player at that table reaches the same logical object.

The object stores the full authoritative state: player credentials, seats, readiness, game, revision, accepted-action IDs, and deadlines. Its storage is SQLite-backed; this implementation uses the typed key/value storage API on that SQLite storage. We do not need a separate database service for these room snapshots.

`wrangler.jsonc` declares:

- `main`: the Worker entry file.
- `assets`: where the built frontend files are located.
- `durable_objects.bindings`: the name and exported class for our rooms.
- `migrations`: the initial creation of the SQLite-backed object class. This is a Cloudflare class/storage migration, not a migration of local practice saves. Do not edit an already-deployed migration to rename or reset a class; add a new migration when needed.
- `ratelimits`: coarse guest room-creation and connection-attempt throttles.

`wrangler types` generates runtime and binding types in `worker-configuration.d.ts`. The generated file is ignored; `npm run check:server` regenerates it before checking the backend.

## Stage 3: identify players without accounts

Creating or joining a room gives the browser a random 256-bit token in a room-scoped, HttpOnly, SameSite=Strict cookie (also Secure on HTTPS). JavaScript cannot read that token. The server stores its SHA-256 hash, and derives the player's seat from that session. A client-supplied seat cannot impersonate another player.

The room code is an invitation, not a seat credential. It is safe to put in the invite URL. `sessionStorage` remembers only the room code for that tab. Clearing cookies loses the ability to reclaim a reserved seat; guest identity does not transfer automatically to another device.

Mutating requests and WebSocket upgrades must carry the same origin as the game. No credentials or private hands are put in URLs, public broadcasts, or frontend local saves.

## Stage 4: WebSockets carry requests and private snapshots

`src/multiplayer/useRoom.ts` opens the browser connection. The client submits a command:

```json
{
  "id": "unique-action-id",
  "revision": 12,
  "action": { "type": "play", "cardId": "hearts-10" }
}
```

`server/room-model.ts` validates the command against the current room. Actual card legality, trump selection, and scoring come from `src/game/engine.ts`.

The object serializes asynchronous changes, saves the new state and receipt before acknowledging the action, then sends each player a separate snapshot. The last 64 accepted IDs per player are retained. A retry of an accepted action is acknowledged without applying it again; an older action outside that window is rejected by its stale revision. An unaccepted action with a stale revision asks the player to retry against the new table.

`src/game/view.ts` builds that snapshot's game view. It includes only the viewer's hand, legal card IDs, the other hand counts, public trick/score information, and public turn/dealer information. Neither the other hands nor the undealt reserve leaves the backend. Seat positions and team scores are rotated so the viewer is always at the bottom, with their partner opposite and their team labeled **Us**.

The frontend never declares a move successful before the server accepts it. It does not upload a locally saved practice game as an online game.

## Stage 5: timers, disconnections, and storage

A **Durable Object alarm** is a persisted server-side wake-up time. It runs independently of whether a player's tab is visible. We use alarms to collect completed tricks after 1.7 seconds, release abandoned seats, and expire inactive rooms.

The next required deadline is saved atomically with the room snapshot. A retried alarm checks the persisted game phase and deadline, avoiding a second collection of the same trick.

The WebSocket hibernation API keeps connections on Cloudflare's network while allowing idle object execution to stop. A `ping`/`pong` auto-response maintains client health checks without waking the object for each heartbeat. The object reconstructs state from storage and connection attachments when it wakes. In-memory variables alone are never the durable save.

If a socket drops:

1. The seat is held for two minutes after disconnection is detected.
2. New card/trump moves pause while any player is away.
3. The returning browser authenticates, obtains a fresh snapshot, and reopens its socket.
4. If an action acknowledgement was lost, the browser resends the same action ID.
5. If a player does not return in time, an active deal ends without a winner; their seat is released and the remaining players can refill the table.

A hard network loss may take a heartbeat interval to detect. There is no human turn timer while everyone remains connected in this initial friends-only version. Explicitly leaving an active deal ends it immediately for all players. The host role moves to another remaining player when the host's seat is released.

Rooms expire after 24 hours without an accepted game/lobby action. This is short-lived room storage, not a permanent match history, account system, or leaderboard. Session cookies also have a 24-hour lifetime from issuance.

## Stage 6: interface

- `RoomLobby.tsx`: create/join forms, invitation sharing, team seats, readiness, and host start controls.
- `OnlineApp.tsx`: online table orchestration and connection state; it reuses the existing cards, table, score, sound, haptic, and settings components.
- `App.tsx`: selects practice or multiplayer. Local practice saving and bots remain separate.
- `TableIdentity`: supplies real player names and connection states instead of the practice bot names.

All four players must be connected and ready. Teams can change only by selecting an empty seat between deals, and changing teams or mode clears readiness. The host starts the deal. After the result, everyone returns to the room and readies again for a rematch; the dealer rotates.

## Verify

```sh
npm test
npm run check:server
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:online
```

The online browser suite uses four isolated cookie jars against the real local Workers/Durable Objects runtime. It exercises both full game modes, private views, refresh recovery, rematches, authentication, duplicate messages, replacement tabs, leaving, and responsive room screens. A separate test stops and restarts the runtime with persisted storage, then verifies player identities, hands, and action deduplication survive. It is separate from the offline/PWA browser suite. CI runs both.

## Deploy to your Cloudflare account

The first deployment needs the account owner's browser authorization:

```sh
npx wrangler login
npx wrangler whoami
npm run deploy
```

Wrangler prints the deployed HTTPS URL. If your login has access to multiple accounts, choose the intended account or set its `account_id` in the Wrangler configuration before deploying. No domain purchase is required to start with a `workers.dev` address.

This creates/updates the `mendikot-multiplayer` Worker and its resources. The GitHub branch alone does not deploy the game. This repository's GitHub Actions workflow runs checks; it does not contain a Cloudflare deployment token or automatic deployment job.

Before public promotion, review the account's usage and budget settings and run a real four-device playtest. Rate limiting is deliberately modest: guest creation is limited per IP to approximately 12/minute and join/socket attempts to 120/minute per Cloudflare location; users behind the same network share those counters. Each socket also permits at most 40 commands per 10 seconds, with a 2 KB message cap. These are basic abuse controls, not matchmaking, a global billing cap, or a solution to players sharing cards outside the application.

## Official references

- [Workers](https://developers.cloudflare.com/workers/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [WebSockets and hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [Rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
