# Mendikot

Four players. Two teams. Four very special tens.

A responsive, installable card game built with React and TypeScript. Play offline practice with three bots, or invite three friends to a private multiplayer table backed by Cloudflare Durable Objects, in portrait or landscape. The sheep decorates each **10**; the numeral and suit remain readable.

## Run locally

Requires Node 22.12+.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Use `npm run build` then `npm run preview` to test installation and offline behaviour; the service worker is generated for production builds only.

```sh
npm test       # rules, both modes, conservation, scoring, corrupt saves
npm run check # TypeScript
npm run build # production bundle + manifest + service worker
npx playwright install chromium
npm run test:e2e # production browser, rotation, persistence, offline and a 9-viewport layout matrix
npm run icons    # regenerate PNG icons from public/*.svg
```

## Play with friends locally

```sh
npm run check:server
npm run dev:online
```

Open http://localhost:8787 and choose **Play with friends**. Create a room, share the link, choose teams, and have all four players ready up. Use separate browser profiles to test separate players: tabs in one profile share a seat.

The online command builds the React app and runs the Worker and Durable Objects locally. Rebuild with `npm run build` after frontend edits; backend edits reload automatically. No Cloudflare account is needed for local development.

See [the multiplayer walkthrough](docs/MULTIPLAYER.md) for what a Worker does, how Durable Objects store rooms, the WebSocket protocol, reconnection policies, tests, and deployment instructions.

```sh
npm run test:online # real Workers runtime, four browser sessions
npx wrangler login # only needed to deploy to your account
npm run deploy     # build, check, and deploy frontend + backend
```

## Implemented

- Full 52-card game: offline practice with three bots and online private rooms for four humans; partners opposite, anticlockwise play.
- Cloudflare Worker routing, one Durable Object per room, private per-player snapshots, authenticated guest sessions, server-validated commands, and persistent room storage.
- Room codes/invites, seat selection, ready/start controls, rematches, refresh/reconnection, a two-minute disconnection grace period, and abandoned-deal handling.
- **Cut hukum:** 13 cards each; first legal off-suit card establishes trump immediately.
- **Choose hukum:** five cards each; the player after the dealer announces a suit; remaining eight dealt only after the choice. Bots choose using their first five cards only.
- Follow-suit enforcement, trick capture, tens scoring, 2–2 trick-count tie break, coat and whitewash.
- Both phone orientations, narrow-screen fallback, laptop/tablet layouts; rotation preserves play.
- Shuffle/deal/play motion, card selection and confirmation, patterned backs, optional sound and reduced motion.
- Device-local save/restore, game rules, settings, last-trick view, results and rematches.
- PWA manifest with unrestricted orientation, icons, offline asset cache, installation guidance and user-controlled updates.

## Prototype boundaries

Practice games run on this device. Bots do not inspect other hands, but use simple heuristics rather than expert partnership strategy. Online games run in a Durable Object: the full deck stays on the server and each client receives only its own hand and public information. The first online version requires four humans; it does not include bots filling seats, matchmaking, accounts, or permanent statistics.

Chosen hukum is public, not a hidden-card/reveal variation. The dealer rotates between prototype deals. House rules for the losing-side dealer and session scoring can be added after confirmation. Local practice saves are convenience storage and can be removed by browser data clearing. Online rooms use guest session cookies, expire after 24 hours without an accepted action, and reserve disconnected seats for two minutes. Clearing cookies loses your guest seat identity.

## PWA and native apps

Production hosting must use HTTPS (localhost also works). Visit online once, allow the service worker to finish installing, then the practice game can run offline. iOS installation uses Safari → Share → Add to Home Screen; other browsers expose their own install menu. Ordinary bookmarks also work. The cache contains this app's assets and bundled fonts.

`capacitor.config.ts` prepares the same frontend for native packaging. Native projects, signing, platform lifecycle testing and store submissions are **not implemented yet**. Before that milestone, confirm the application identifier, install matching Capacitor iOS/Android packages, add each platform and sync the production build. Use `npm run native:sync` after platform creation. The service worker should be disabled in native builds.

## Project structure

- `src/game/engine.ts` — immutable, UI-independent rules and bot decisions.
- `src/game/engine.test.ts` — deterministic rule tests and complete-deal simulations.
- `src/App.tsx` — practice orchestrator and practice/online entry point.
- `server/` — Worker routing, authoritative Durable Object room lifecycle, storage, alarms, and pure room command logic.
- `src/multiplayer/` — protocol types, WebSocket/session hook, room lobby, and online table.
- `src/game/view.ts` — safe per-player projection, with relative seats and team scores.
- `wrangler.jsonc` — Cloudflare assets, room binding, initial migration, and rate limits.
- `src/components/cards/` — one hidden SVG sprite (`CardDefs`) with suit glyphs, sheep, court crests and the woven back; `CardFace` composes full pip layouts (`cardLayouts.ts`) or a bold compact face, chosen by a container query on rendered width.
- `src/components/` — top bar, scoreboard, seats, trick, hand, action bar, toasts; `panels/` (home, mode picker, choose hukum, result) and `sheets/` (rules, menu, new deal, install, last trick — native `<dialog>` bottom sheets).
- `src/state/` — save/preference persistence (same keys and shapes as before) and the status line copy; `src/hooks/` — browser flags, install prompt, sound, haptics, dialogs.
- `src/styles/` — `tokens.css` (palette, type, spacing, motion, safe areas), `base.css`, `layout.css` (portrait, landscape-phone and wide modes), `table.css`, `cards.css`, `dialogs.css`.
- `public/icon.svg`, `icon-maskable.svg`, `favicon.svg` — vector icons; `npm run icons` rasterises the PNGs with Playwright Chromium.
- `public/sounds/` — card sounds (slide, place, shove, fan, shuffle) from Kenney's [Casino Audio](https://kenney.nl/assets/casino-audio) pack (CC0), with lead-in silence trimmed, loudness levelled and re-encoded as mono AAC so iOS can play them.
- `docs/TASKS.md` — milestones and remaining implementation tasks.
- `docs/IMAGE-PROMPTS.md` — concise prompts for AI reference images.
- `docs/orientation-reference.html` — the user-approved early layout exploration.

GitHub Actions runs the rules/room tests, frontend/backend type checks, production build, offline browser suite, and multiplayer browser suite. The workflow does not deploy automatically; a Cloudflare account login and `npm run deploy` are needed for public hosting. Native apps are not published by this setup.
