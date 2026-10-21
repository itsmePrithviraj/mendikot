# Mendikot

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Implementation delegated by the user after discussion of React options. React + TypeScript + Vite PWA; Capacitor configuration preserves a route to iOS and Android. Shared pure game engine remains separate from UI. Cloudflare Workers and SQLite-backed Durable Objects provide private online multiplayer; native packaging remains a subsequent milestone.

## Users

Friends playing the four-player partnership game Mendikot, also called Mendicot locally. Phone-first, with tablet and laptop support.

## Product Purpose

Capture the four tens with a partner. Make the traditional game readable, tactile, and comfortable on any screen.

## Operating Context

Portrait and landscape must both work. Device rotation changes layout without resetting play. Users can bookmark and install the PWA. Offline practice uses one human and three explicitly labeled bots. Online private rooms use four humans, invite links/codes, guest sessions, and a readiness lobby.

## Capabilities and Constraints

52 cards, 13 per player; partners opposite; follow suit when possible; highest trump otherwise highest led suit wins. Tens determine winner, tricks break a 2–2 tie. Confirmed modes: cut hukum (first off-suit card establishes trump), and choose hukum (deal five cards per player, designated player announces trump, then distribute eight remaining cards per player). Chosen hukum is public; hidden/reveal variants are not requested. No wagers or invented online players. Online rooms have guest session authentication, private hands, persisted room snapshots, and a two-minute reconnection grace period. Native binaries, account login, matchmaking, bot-filled online seats, and permanent match history are not included.

## Brand Commitments

Preserve the approved landscape single-row and portrait two-row table concepts. Card ranks remain numeric 10 with ordinary suit marks; small sheep motif supplements the tens. Never write TEN on a card. Beautiful card backs, shuffling, dealing, card selection, and trick collection motion are requested.

## Evidence on Hand

User-approved interactive orientation comparison copied into docs/orientation-reference.html. Reference generation descriptions live in docs/IMAGE-PROMPTS.md. No raster mockup is the visual authority.

## Product Principles

- Read cards before decoration.
- Preserve the match through rotation and refresh.
- Tell the truth about bots and online capabilities.
- Reduce motion without reducing information.
