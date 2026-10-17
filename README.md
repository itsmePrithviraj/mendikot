# Mendikot

Four players. Two teams. Four very special tens.

A responsive, installable card-game prototype built with React and TypeScript. Play a complete practice deal with three bots, in portrait or landscape. The sheep decorates each **10**; the numeral and suit remain readable.

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

## Implemented

- Full 52-card game: one human, three bots, partners opposite, anticlockwise play.
- **Cut hukum:** 13 cards each; first legal off-suit card establishes trump immediately.
- **Choose hukum:** five cards each; the player after the dealer announces a suit; remaining eight dealt only after the choice. Bots choose using their first five cards only.
- Follow-suit enforcement, trick capture, tens scoring, 2–2 trick-count tie break, coat and whitewash.
- Both phone orientations, narrow-screen fallback, laptop/tablet layouts; rotation preserves play.
- Shuffle/deal/play motion, card selection and confirmation, patterned backs, optional sound and reduced motion.
- Device-local save/restore, game rules, settings, last-trick view, results and rematches.
- PWA manifest with unrestricted orientation, icons, offline asset cache, installation guidance and user-controlled updates.

## Prototype boundaries

All games run on this device. Bots do not inspect other hands, but they use simple heuristics rather than expert partnership strategy. The local engine holds the full deck because this is offline practice; an online version must move authoritative dealing and validation to the server and expose only per-player views.

Chosen hukum is public, not a hidden-card/reveal variation. The dealer rotates between prototype deals. House rules for the losing-side dealer and session scoring can be added after confirmation. Local saves are convenience storage and can be removed by browser data clearing; no cloud account exists.

## PWA and native apps

Production hosting must use HTTPS (localhost also works). Visit online once, allow the service worker to finish installing, then the practice game can run offline. iOS installation uses Safari → Share → Add to Home Screen; other browsers expose their own install menu. Ordinary bookmarks also work. The cache contains this app's assets and bundled fonts.

`capacitor.config.ts` prepares the same frontend for native packaging. Native projects, signing, platform lifecycle testing and store submissions are **not implemented yet**. Before that milestone, confirm the application identifier, install matching Capacitor iOS/Android packages, add each platform and sync the production build. Use `npm run native:sync` after platform creation. The service worker should be disabled in native builds.

## Project structure

- `src/game/engine.ts` — immutable, UI-independent rules and bot decisions.
- `src/game/engine.test.ts` — deterministic rule tests and complete-deal simulations.
- `src/App.tsx` — orchestrator: game state, bot/collect timers, sheets.
- `src/components/cards/` — one hidden SVG sprite (`CardDefs`) with suit glyphs, sheep, court crests and the woven back; `CardFace` composes full pip layouts (`cardLayouts.ts`) or a bold compact face, chosen by a container query on rendered width.
- `src/components/` — top bar, scoreboard, seats, trick, hand, action bar, toasts; `panels/` (home, mode picker, choose hukum, result) and `sheets/` (rules, menu, new deal, install, last trick — native `<dialog>` bottom sheets).
- `src/state/` — save/preference persistence (same keys and shapes as before) and the status line copy; `src/hooks/` — browser flags, install prompt, sound, haptics, dialogs.
- `src/styles/` — `tokens.css` (palette, type, spacing, motion, safe areas), `base.css`, `layout.css` (portrait, landscape-phone and wide modes), `table.css`, `cards.css`, `dialogs.css`.
- `public/icon.svg`, `icon-maskable.svg`, `favicon.svg` — vector icons; `npm run icons` rasterises the PNGs with Playwright Chromium.
- `public/sounds/` — card sounds (slide, place, shove, fan, shuffle) from Kenney's [Casino Audio](https://kenney.nl/assets/casino-audio) pack (CC0), with lead-in silence trimmed, loudness levelled and re-encoded as mono AAC so iOS can play them.
- `docs/TASKS.md` — milestones and remaining implementation tasks.
- `docs/IMAGE-PROMPTS.md` — concise prompts for AI reference images.
- `docs/orientation-reference.html` — the user-approved early layout exploration.

GitHub Actions runs the rules tests and production build on pushes and pull requests. No production site or native app is published by this repository setup.
