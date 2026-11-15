# Mendikot

Four players. Two teams. Four very special tens.

A responsive, installable card game built with React and TypeScript. Practise offline against three bots, or invite three friends to a private online table. It works in portrait and landscape on phones, tablets and laptops. The sheep decorates each **10**; the numeral and suit stay readable.

[Play Mendikot online](https://mendikot-multiplayer.prithvirajgokule0607.workers.dev): choose **Play with friends**, create a room and share the invitation.

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
- Follow suit, trick capture, tens scoring, trick-count tie break at 2–2, coat and whitewash.
- Shuffle, deal, play and collect motion; card selection and confirmation; sound, haptics and reduced motion.
- Last-trick view, results and rematches; practice games are saved on the device.
- Installable PWA with an offline cache and user-controlled updates.

**Online tables** are private rooms for exactly four people. A Cloudflare Durable Object holds the deck and validates every move; each browser receives only its own hand. Players join with a room code or link, pick seats (and so teams), ready up, and the host deals. A dropped player has two minutes to return before their seat is released. See [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md) for how it works.

## Limits

- Bots do not see other hands but play simple heuristics, not expert partnership strategy.
- Online play has no bots filling seats, matchmaking, accounts or match history. Rooms expire 24 hours after their last action. Clearing cookies loses your guest seat.
- Chosen hukum is public; hidden/reveal variants are not implemented. The dealer simply rotates between deals.
- Practice saves live in browser storage and disappear if site data is cleared.

## PWA and native apps

Hosting must use HTTPS (localhost also works). After one online visit the service worker caches the app and practice works offline. On iOS, install with Safari → Share → Add to Home Screen; other browsers have their own install menu.

`capacitor.config.ts` prepares the frontend for native packaging, but native projects, signing and store submissions are **not set up yet**. When they are: confirm the app identifier, add the Capacitor iOS/Android packages and platforms, run `npm run native:sync`, and disable the service worker in native builds.

## Project structure

| Path                                  | Contents                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/game/engine.ts`                  | Immutable, UI-independent rules and bot decisions (tests in `engine.test.ts`)                              |
| `src/game/view.ts`                    | A player's view of a game: own hand only, seats rotated so the viewer sits at the bottom                   |
| `src/App.tsx`                         | Chooses practice or online; `PracticeApp.tsx` runs the offline game, bots and timers                       |
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
