# Implementation plan

## Milestone 1 — playable PWA prototype

- [ ] Repository, lockfile, build/test CI, product and design documentation
- [ ] Pure rules engine: 52-card shuffle, legal play, cut hukum, trick winner, tens, ties
- [ ] One human + three bots; complete deals, results and rematches
- [ ] Portrait two-row hand, landscape single row, large-screen table
- [ ] Ivory card faces with 10 + suit + sheep; patterned backs
- [ ] Shuffle, distribution, selection, play and collection animations; reduced motion
- [ ] Local save/restore, accessible controls, rules and settings
- [ ] Installable PWA, offline practice, deferred app updates
- [ ] Automated game tests, responsive browser checks, refresh/rotation/offline checks

## Milestone 2 — play with friends

- [ ] Confirm house rules and implement chosen hukum variations
- [ ] Authoritative server, private room codes, player seats and teams
- [ ] Private per-player state, legal-command validation and idempotency
- [ ] Reconnection, turn timeout policy and abandoned-game handling
- [ ] Four-device end-to-end playtests and abuse controls

## Milestone 3 — mobile distribution and polish

- [ ] Generate Capacitor iOS and Android projects and configure app identifiers
- [ ] Native lifecycle, orientation, safe-area, haptics and audio testing
- [ ] Device accessibility and performance testing
- [ ] App icons, signing, store metadata and privacy declarations
- [ ] Public hosting decision, accounts, optional statistics and matchmaking

## GitHub tracking

- [Practice prototype and PWA foundation](https://github.com/itsmePrithviraj/mendikot/issues/4)
- [Private rooms and authoritative multiplayer](https://github.com/itsmePrithviraj/mendikot/issues/1)
- [iOS and Android distribution](https://github.com/itsmePrithviraj/mendikot/issues/2)
- [Device playtesting and reference-image refinement](https://github.com/itsmePrithviraj/mendikot/issues/3)
