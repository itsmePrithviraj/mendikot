/**
 * Pure room logic: every function here is deterministic given its inputs and
 * never touches storage, sockets or the clock. `room.ts` wires it to a Durable
 * Object; `room-model.test.ts` exercises it directly.
 */
import {
  botTrump,
  chooseBotCard,
  chooseTrump,
  collectTrick,
  newGame,
  nextSeat,
  playCard,
  SUITS,
} from "../src/game/engine";
import type { Game, Mode, Seat } from "../src/game/engine";
import { playerGame } from "../src/game/view";
import { RECONNECT_MS, ROOM_TTL_MS } from "../src/multiplayer/protocol";
import type { Command, RoomSnapshot } from "../src/multiplayer/protocol";
import { HttpError } from "./http";

/** How long a completed trick stays on the table before it is collected. */
export const TRICK_COLLECT_MS = 1700;
/** How long a bot waits before playing, so humans can follow the table. */
export const BOT_MOVE_MS = 1000;
/** A bot's first move after cards are dealt waits for the deal animation. */
export const BOT_AFTER_DEAL_MS = 1800;
/** Names for bots, skipping any a person at the table already uses. */
export const BOT_NAMES = ["Kavya", "Rohan", "Meera", "Arjun", "Dev"];
/** Accepted command IDs remembered per player, so a retried command applies once. */
export const RECEIPT_LIMIT = 64;
export const MAX_NAME_LENGTH = 24;

export interface Player {
  id: string;
  name: string;
  /** SHA-256 of the player's session token. The token itself is never stored. */
  tokenHash: string;
  ready: boolean;
  /** When the player's last socket closed, or null while connected. */
  disconnectedAt: number | null;
  /** A server-run seat filler. Always ready and present; never signs in. */
  bot?: boolean;
}

/** Everything the Durable Object persists for one room. Never sent to clients as-is. */
export interface RoomState {
  version: 1;
  code: string;
  /** Empty only while the room has no players. */
  hostId: string;
  mode: Mode;
  /** Indexed by seat. Partners sit opposite: seats 0 + 2 and 1 + 3. */
  players: (Player | null)[];
  game: Game | null;
  /** Increments on every persisted change. Clients send it with each command. */
  revision: number;
  /** Revision of the last roster, team, mode or deal change. */
  setupRevision: number;
  expiresAt: number;
  /** When the completed trick on the table should be collected. */
  collectAt: number | null;
  /** When the bot whose turn it is should move. Absent in rooms saved before bots. */
  botAt?: number | null;
  /** The latest table event for the lobby: who left, or why a deal ended early. */
  notice: string | null;
  /** Dealer of the most recent deal, so rotation survives abandoned deals. */
  lastDealer?: Seat;
  /** Recent accepted command IDs per player ID. */
  receipts: Record<string, string[]>;
}

/** A rejected room request. `status` is the HTTP status used outside WebSockets. */
export class RoomError extends HttpError {}

export function playerName(value: unknown): string {
  if (typeof value !== "string") throw new RoomError("Enter your name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_NAME_LENGTH || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new RoomError(
      `Use a name between 1 and ${MAX_NAME_LENGTH} characters, without control characters.`,
    );
  return name;
}

export function createRoom(
  code: string,
  mode: Mode,
  host: Player,
  now: number,
): RoomState {
  return {
    version: 1,
    code,
    mode,
    hostId: host.id,
    players: [host, null, null, null],
    game: null,
    revision: 1,
    setupRevision: 1,
    expiresAt: now + ROOM_TTL_MS,
    collectAt: null,
    notice: null,
    receipts: {},
  };
}

export const isExpired = (room: RoomState, now: number) =>
  room.expiresAt <= now;
export const isDealActive = (room: RoomState) =>
  !!room.game && room.game.phase !== "complete";
const seatOf = (room: RoomState, id: string) =>
  room.players.findIndex((p) => p?.id === id);
/** Bots are always at the table; people are present while a socket is open. */
const present = (p: Player, connected: Set<string>) =>
  !!p.bot || connected.has(p.id);
const humans = (room: RoomState) =>
  room.players.filter((p): p is Player => !!p && !p.bot);

/** A bot for an empty seat, named after no one already in the room. */
export function newBot(room: RoomState, seat: Seat): Player {
  const taken = new Set(
    room.players.flatMap((p) => (p ? [p.name.toLowerCase()] : [])),
  );
  const name =
    BOT_NAMES.find((n) => !taken.has(n.toLowerCase())) ?? `Bot ${seat + 1}`;
  return {
    id: `bot-${seat}-${name.toLowerCase()}`,
    name,
    tokenHash: "",
    ready: true,
    disconnectedAt: null,
    bot: true,
  };
}

/**
 * Keeps `botAt` in step with the table: set when a bot is due to act and every
 * person is connected, cleared otherwise. An existing deadline is kept.
 */
function scheduleBot(draft: RoomState, now: number, delay = BOT_MOVE_MS) {
  const game = draft.game;
  const due =
    !!game &&
    (game.phase === "playing" || game.phase === "choosing-trump") &&
    !!draft.players[game.turn]?.bot &&
    humans(draft).every((p) => p.disconnectedAt === null);
  draft.botAt = due ? (draft.botAt ?? now + delay) : null;
}

/** The earliest time the room needs an alarm: expiry, trick collection or a seat release. */
export function nextDeadline(room: RoomState): number {
  return Math.min(
    room.expiresAt,
    room.collectAt ?? Infinity,
    room.botAt ?? Infinity,
    ...room.players.map((p) =>
      p?.disconnectedAt != null ? p.disconnectedAt + RECONNECT_MS : Infinity,
    ),
  );
}

/**
 * Finishes a change to a draft with one revision step. A roster, team, mode
 * or deal change also becomes the new baseline for stale readiness requests.
 */
function commit(draft: RoomState, setupChanged: boolean): RoomState {
  draft.revision++;
  if (setupChanged) draft.setupRevision = draft.revision;
  return draft;
}

function clearReadiness(draft: RoomState) {
  for (const p of draft.players) if (p && !p.bot) p.ready = false;
}

/**
 * A finished deal's result belongs to the players who played it. Those who
 * stay may keep looking at it; a newcomer starts in the lobby instead.
 */
function discardFinishedDeal(draft: RoomState) {
  if (draft.game?.phase === "complete") draft.game = null;
}

/** Releases a player's seat on a draft. An unfinished deal ends without a winner. */
function release(draft: RoomState, player: Player, why: "left" | "timeout") {
  const what =
    why === "left"
      ? `${player.name} left`
      : `${player.name} did not reconnect within two minutes`;
  if (isDealActive(draft)) {
    draft.game = null;
    draft.collectAt = null;
    draft.notice = `${what}. This deal has ended without a winner.`;
  } else {
    draft.notice = `${what} and gave up their seat.`;
  }
  const id = player.id;
  draft.players = draft.players.map((p) => (p?.id === id ? null : p));
  delete draft.receipts[id];
  clearReadiness(draft);
  // Bots never sit alone: the last person to go takes them along.
  if (!humans(draft).length) draft.players = [null, null, null, null];
  draft.botAt = null;
  if (draft.hostId === id) draft.hostId = humans(draft)[0]?.id ?? "";
}

/**
 * Seats a new player in the first empty seat, or else takes over the first
 * bot's seat. Others keep their readiness.
 */
export function joinRoom(room: RoomState, player: Player): RoomState {
  if (isDealActive(room))
    throw new RoomError("This deal has already started.", 409);
  let seat = room.players.findIndex((p) => !p);
  if (seat < 0) seat = room.players.findIndex((p) => p?.bot);
  if (seat < 0) throw new RoomError("This room already has four players.", 409);
  const draft = structuredClone(room);
  draft.players[seat] = player;
  draft.hostId ||= player.id;
  // The newcomer was not part of whatever happened before.
  discardFinishedDeal(draft);
  draft.notice = null;
  return commit(draft, true);
}

/**
 * Records a socket opening or closing. Readiness survives a refresh; a deal
 * still cannot start until everyone is connected.
 */
export function setConnected(
  room: RoomState,
  id: string,
  connected: boolean,
  now: number,
): RoomState {
  const seat = seatOf(room, id);
  if (seat < 0) return room;
  const draft = structuredClone(room);
  const player = draft.players[seat]!;
  player.disconnectedAt = connected ? null : now;
  // Bots wait while anyone is away and pick up again on their return.
  scheduleBot(draft, now);
  return commit(draft, false);
}

/**
 * After the object restarts, anyone without a live socket starts their
 * reconnection countdown now.
 */
export function reconcilePresence(
  room: RoomState,
  live: Set<string>,
  now: number,
): RoomState {
  const away = (p: Player | null): p is Player =>
    !!p && !p.bot && !live.has(p.id) && p.disconnectedAt === null;
  if (!room.players.some(away)) return room;
  const draft = structuredClone(room);
  for (const p of draft.players) if (away(p)) p.disconnectedAt = now;
  scheduleBot(draft, now);
  return commit(draft, false);
}

/** Applies due timers: releases seats past the reconnection window and collects a finished trick. */
export function advanceTimers(room: RoomState, now: number): RoomState {
  const draft = structuredClone(room);
  let changed = false,
    setupChanged = false;
  for (const p of room.players) {
    if (p?.disconnectedAt != null && p.disconnectedAt + RECONNECT_MS <= now) {
      release(draft, p, "timeout");
      changed = setupChanged = true;
    }
  }
  if (draft.collectAt !== null && draft.collectAt <= now) {
    if (draft.game?.phase === "trick-complete")
      draft.game = collectTrick(draft.game);
    draft.collectAt = null;
    changed = true;
  }
  if (draft.botAt != null && draft.botAt <= now) {
    const game = draft.game;
    draft.botAt = null;
    if (game && draft.players[game.turn]?.bot) {
      draft.game =
        game.phase === "choosing-trump"
          ? chooseTrump(game, game.turn, botTrump(game.hands[game.turn]))
          : playCard(game, game.turn, chooseBotCard(game).id);
      if (draft.game.phase === "trick-complete")
        draft.collectAt = now + TRICK_COLLECT_MS;
    }
    changed = true;
  }
  if (changed) scheduleBot(draft, now);
  return changed ? commit(draft, setupChanged) : room;
}

/** The private snapshot one player receives. Other hands never leave the server. */
export function roomView(
  room: RoomState,
  playerId: string,
  connected: Set<string>,
): RoomSnapshot {
  const seat = seatOf(room, playerId);
  if (seat < 0) throw new RoomError("Your seat is no longer in this room.");
  const deadline = Math.min(
    ...room.players.map((p) =>
      p?.disconnectedAt != null ? p.disconnectedAt + RECONNECT_MS : Infinity,
    ),
  );
  return {
    protocol: 1,
    code: room.code,
    revision: room.revision,
    yourId: playerId,
    yourSeat: seat as Seat,
    hostId: room.hostId,
    mode: room.mode,
    players: room.players.flatMap((p, i) =>
      p
        ? [
            {
              id: p.id,
              name: p.name,
              seat: i as Seat,
              ready: p.ready,
              connected: present(p, connected),
              bot: !!p.bot,
            },
          ]
        : [],
    ),
    game: room.game ? playerGame(room.game, seat as Seat) : null,
    notice: room.notice ?? null,
    reconnectDeadline: Number.isFinite(deadline) ? deadline : null,
  };
}

const CARD_ID = /^(spades|hearts|clubs|diamonds)-(?:[2-9]|1[0-4])$/;

/** Validates the shape of an untrusted client message. Game legality is checked later. */
export function parseCommand(value: unknown): Command {
  const invalid = () => new RoomError("Invalid action.");
  if (!value || typeof value !== "object") throw invalid();
  const command = value as Command;
  if (
    typeof command.id !== "string" ||
    !/^[\w-]{8,80}$/.test(command.id) ||
    !Number.isSafeInteger(command.revision) ||
    command.revision < 0 ||
    !command.action ||
    typeof command.action !== "object"
  )
    throw invalid();
  const action = command.action;
  const valid = (() => {
    switch (action.type) {
      case "ready":
        return typeof action.ready === "boolean";
      case "mode":
        return action.mode === "cut" || action.mode === "choose";
      case "seat":
        return [0, 1, 2, 3].includes(action.seat);
      case "bot":
        return (
          typeof action.add === "boolean" &&
          (action.seat === undefined
            ? action.add
            : [0, 1, 2, 3].includes(action.seat))
        );
      case "play":
        return typeof action.cardId === "string" && CARD_ID.test(action.cardId);
      case "trump":
        return SUITS.includes(action.suit);
      case "start":
      case "leave":
        return true;
      default:
        return false;
    }
  })();
  if (!valid) throw invalid();
  return command;
}

/**
 * Moves must be made against the latest revision. Two commands are allowed to
 * arrive from an older snapshot because they cannot conflict with what changed:
 * - readiness, until the roster, teams, mode or deal changes;
 * - leaving, which only releases the sender's own seat.
 */
function acceptsRevision(room: RoomState, command: Command) {
  const { revision, action } = command;
  if (revision === room.revision) return true;
  if (revision > room.revision) return false;
  if (action.type === "ready") return revision >= room.setupRevision;
  return action.type === "leave";
}

/**
 * Applies one command from an authenticated player and returns the next room.
 * Never mutates `room`; returns it unchanged for a retry of an accepted command.
 */
export function applyCommand(
  room: RoomState,
  id: string,
  command: Command,
  connected: Set<string>,
  now: number,
): RoomState {
  const seat = seatOf(room, id) as Seat;
  if (seat < 0) throw new RoomError("Your seat is no longer in this room.");
  if (room.receipts[id]?.includes(command.id)) return room;
  if (!acceptsRevision(room, command))
    throw new RoomError("The table changed. Please try your action again.");

  const draft = structuredClone(room);
  const player = draft.players[seat]!;
  const action = command.action;
  const active = isDealActive(draft);
  const host = id === draft.hostId;
  let setupChanged = false;

  switch (action.type) {
    case "ready":
      if (active) throw new RoomError("Finish this deal first.");
      player.ready = action.ready;
      break;
    case "mode":
      if (!host) throw new RoomError("Only the host can change the mode.");
      if (active) throw new RoomError("Change the mode between deals.");
      draft.mode = action.mode;
      clearReadiness(draft);
      setupChanged = true;
      break;
    case "seat": {
      const there = draft.players[action.seat];
      if (active || (there && !there.bot))
        throw new RoomError("Choose an empty seat before the deal starts.");
      // Taking a bot's seat swaps: the bot moves to the seat you left.
      draft.players[action.seat] = player;
      draft.players[seat] = there;
      clearReadiness(draft);
      setupChanged = true;
      break;
    }
    case "bot": {
      if (!host) throw new RoomError("Only the host can add or remove bots.");
      if (active) throw new RoomError("Change seats between deals.");
      if (action.seat === undefined) {
        const empty = draft.players.flatMap((p, i) => (p ? [] : [i as Seat]));
        if (!empty.length) throw new RoomError("Every seat is already taken.");
        for (const seat of empty) draft.players[seat] = newBot(draft, seat);
      } else if (action.add) {
        if (draft.players[action.seat])
          throw new RoomError("That seat is taken.");
        draft.players[action.seat] = newBot(draft, action.seat);
      } else {
        if (!draft.players[action.seat]?.bot)
          throw new RoomError("There is no bot in that seat.");
        draft.players[action.seat] = null;
      }
      discardFinishedDeal(draft);
      clearReadiness(draft);
      setupChanged = true;
      break;
    }
    case "start": {
      if (!host) throw new RoomError("Only the host can start a new deal.");
      if (active) throw new RoomError("Finish this deal first.");
      // Starting is the host's own "ready".
      if (
        !draft.players.every(
          (p) => p && (p.ready || p.id === id) && present(p, connected),
        )
      )
        throw new RoomError("Every seat needs a ready player or a bot.");
      // Seat 3 deals first, so seat 0 leads; after that the dealer rotates.
      const previous = draft.lastDealer ?? draft.game?.dealer;
      draft.game = newGame(
        undefined,
        previous === undefined ? 3 : nextSeat(previous),
        draft.mode,
      );
      draft.lastDealer = draft.game.dealer;
      draft.notice = null;
      draft.collectAt = null;
      clearReadiness(draft);
      setupChanged = true;
      break;
    }
    case "play":
    case "trump":
      if (
        !draft.game ||
        !draft.players.every((p) => p && present(p, connected))
      )
        throw new RoomError("Waiting for everyone to reconnect.");
      draft.game =
        action.type === "play"
          ? playCard(draft.game, seat, action.cardId)
          : chooseTrump(draft.game, seat, action.suit);
      draft.collectAt =
        draft.game.phase === "trick-complete" ? now + TRICK_COLLECT_MS : null;
      break;
    case "leave":
      release(draft, player, "left");
      setupChanged = true;
      break;
  }
  // After a deal the cards fly in first, so a bot's first move waits longer.
  scheduleBot(
    draft,
    now,
    action.type === "start" || action.type === "trump"
      ? BOT_AFTER_DEAL_MS
      : BOT_MOVE_MS,
  );
  // A departed player has no receipts to keep.
  if (action.type !== "leave")
    draft.receipts[id] = [...(draft.receipts[id] ?? []), command.id].slice(
      -RECEIPT_LIMIT,
    );
  draft.expiresAt = now + ROOM_TTL_MS;
  return commit(draft, setupChanged);
}
