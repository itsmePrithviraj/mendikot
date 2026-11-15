# Mendikot

Four players. Two teams. Four very special tens.

A responsive, installable card game built with React and TypeScript. The start screen offers three ways in: play solo against three bots, create a private online room, or join one with a code. A host can fill empty seats with bots. It works in portrait and landscape on phones, tablets and laptops. The sheep decorates each **10**; the numeral and suit stay readable.

[Play Mendikot online](https://mendikot-multiplayer.prithvirajgokule0607.workers.dev): choose **Create a room** and share the invitation.

## Quick start

Requires Node 22.12+.

```sh
npm ci
npm run dev          # offline practice with hot reload (Vite)
npm run dev:online   # practice + multiplayer at http://localhost:8787 (Wrangler)
```

`dev:online` builds the frontend once and runs the Worker and Durable Objects in Cloudflare's local runtime; no Cloudflare account is needed. Backend edits reload automatically; run `npm run build` after frontend edits. To be four players on one computer, use four browser profiles: tabs in one profile share a seat.

## Commands

| Command                           | What it does                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `npm test`                        | Rules engine and room logic unit tests (Vitest)                          |
| `npm run check`                   | TypeScript for the frontend and the Worker                               |
| `npm run format` / `format:check` | Prettier                                                                 |
| `npm run build`                   | Production bundle, manifest and service worker                           |
| `npm run test:e2e`                | Offline browser suite: play, rotation, persistence, offline, 9 viewports |
| `npm run test:online`             | Multiplayer browser suite: four isolated players on the local runtime    |
| `npm run deploy`                  | Build, check and deploy to your Cloudflare account                       |
| `npm run icons`                   | Rasterise `public/*.svg` icons with Playwright                           |

Run `npx playwright install chromium` once before the browser suites. GitHub Actions runs everything except `deploy` and `icons` on every push and pull request.

## The game

- Full 52-card game, partners opposite, anticlockwise play.
- **Cut hukum:** 13 cards each; the first off-suit card played sets trump.
- **Choose hukum:** five cards each; the player after the dealer names trump, then the other eight are dealt. Bots choose from their first five cards only.
- Follow suit, tens scoring, coat and whitewash. Tricks are called **sheep** here ("1 sheep", "4 sheeps"); the sheep count breaks a 2–2 tie on tens.
- Shuffle, deal, play and collect motion; card selection and confirmation; sound, haptics and reduced motion.
- Last-sheep view, results and rematches; solo games are saved on the device. A reload in the same tab returns to the table; a fresh visit opens on the start screen with **Continue solo game**.
- Sound and haptics are on by default; a refused card shakes and buzzes on every tap.
- Installable PWA with an offline cache and user-controlled updates.

**Online tables** are private rooms for exactly four people. A Cloudflare Durable Object holds the deck and validates every move; each browser receives only its own hand. Players join with a room code or link, pick seats (and so teams), ready up, and the host deals. A dropped player has two minutes to return before their seat is released. See [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md) for how it works.

## Limits

- Bots do not see other hands but play simple heuristics, not expert partnership strategy.
- Online bots are the same simple players as solo bots. A host fills empty seats with them; a friend who joins later takes a bot's seat. There is no matchmaking, accounts or match history. Rooms expire 24 hours after their last action. Clearing cookies loses your guest seat.
- Chosen hukum is public; hidden/reveal variants are not implemented. The dealer simply rotates between deals.
- Solo saves live in browser storage and disappear if site data is cleared.

## PWA and native apps

Hosting must use HTTPS (localhost also works). After one online visit the service worker caches the app and solo play works offline. On iOS, install with Safari → Share → Add to Home Screen; other browsers have their own install menu.

`capacitor.config.ts` prepares the frontend for native packaging, but native projects, signing and store submissions are **not set up yet**. When they are: confirm the app identifier, add the Capacitor iOS/Android packages and platforms, run `npm run native:sync`, and disable the service worker in native builds.

## Project structure

| Path                                  | Contents                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/game/engine.ts`                  | Immutable, UI-independent rules and bot decisions (tests in `engine.test.ts`)                              |
| `src/game/view.ts`                    | A player's view of a game: own hand only, seats rotated so the viewer sits at the bottom                   |
| `src/App.tsx`                         | Chooses the start screen/solo or online; `PracticeApp.tsx` runs the start screen and the solo game         |
| `src/multiplayer/`                    | Protocol types, the `useRoom` connection hook, the lobby and the online table                              |
| `server/index.ts`                     | Worker: serves the app, checks origin and rate limits, routes `/api/rooms/*` to a room                     |
| `server/room.ts`                      | `GameRoom` Durable Object: storage, sockets, alarms                                                        |
| `server/room-model.ts`                | Pure room logic: joining, commands, timers, private snapshots (tests in `room-model.test.ts`)              |
| `server/session.ts`, `server/http.ts` | Guest session cookies; JSON responses and capped body reading                                              |
| `src/components/`                     | Table pieces; `cards/` (SVG sprite and faces), `panels/` (home, mode, choose, result), `sheets/` (dialogs) |
| `src/state/`, `src/hooks/`            | Saves, preferences, status copy, seat names; browser flags, install, sound, haptics                        |
| `src/styles/`                         | Tokens, base, layout modes, table, cards, dialogs, multiplayer                                             |
| `tests/`                              | Playwright suites: `game.spec.ts` (offline) and `online/` (multiplayer, runtime restart)                   |
| `public/`                             | Icons (SVG sources and rendered PNGs) and card sounds                                                      |
| `docs/`                               | [Multiplayer guide](docs/MULTIPLAYER.md), [task list](docs/TASKS.md), image prompts, layout reference      |

Card sounds are from Kenney's [Casino Audio](https://kenney.nl/assets/casino-audio) pack (CC0), trimmed, levelled and re-encoded as mono AAC for iOS.
