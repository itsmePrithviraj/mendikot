import {
  chooseTrump,
  newGame,
  nextSeat,
  playCard,
  SUITS,
} from "../src/game/engine";
import type { Game, Mode, Seat } from "../src/game/engine";
import { playerGame } from "../src/game/view";
import { RECONNECT_MS, ROOM_TTL_MS } from "../src/multiplayer/protocol";
import type { Command, RoomSnapshot } from "../src/multiplayer/protocol";

export interface Player {
  id: string;
  name: string;
  tokenHash: string;
  ready: boolean;
  disconnectedAt: number | null;
}
export interface RoomState {
  version: 1;
  code: string;
  hostId: string;
  mode: Mode;
  players: (Player | null)[];
  game: Game | null;
  revision: number;
  expiresAt: number;
  collectAt: number | null;
  endedReason: string | null;
  receipts: Record<string, string[]>;
}

export function playerName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter your name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 24 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new Error(
      "Use a name between 1 and 24 characters, without control characters.",
    );
  return name;
}

export function createRoom(
  code: string,
  mode: Mode,
  player: Player,
  now: number,
): RoomState {
  return {
    version: 1,
    code,
    mode,
    hostId: player.id,
    players: [player, null, null, null],
    game: null,
    revision: 1,
    expiresAt: now + ROOM_TTL_MS,
    collectAt: null,
    endedReason: null,
    receipts: {},
  };
}

export function roomView(
  room: RoomState,
  playerId: string,
  connected: Set<string>,
): RoomSnapshot {
  const seat = room.players.findIndex((p) => p?.id === playerId);
  if (seat < 0) throw new Error("Your seat is no longer in this room.");
  const deadlines = room.players.flatMap((p) =>
    p?.disconnectedAt != null ? [p.disconnectedAt + RECONNECT_MS] : [],
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
              connected: connected.has(p.id),
            },
          ]
        : [],
    ),
    game: room.game ? playerGame(room.game, seat as Seat) : null,
    endedReason: room.endedReason,
    reconnectDeadline: deadlines.length ? Math.min(...deadlines) : null,
  };
}

export function parseCommand(value: unknown): Command {
  if (!value || typeof value !== "object") throw new Error("Invalid action.");
  const c = value as Command;
  if (
    typeof c.id !== "string" ||
    !/^[\w-]{8,80}$/.test(c.id) ||
    !Number.isSafeInteger(c.revision) ||
    c.revision < 0 ||
    !c.action ||
    typeof c.action !== "object"
  )
    throw new Error("Invalid action.");
  const a = c.action;
  switch (a.type) {
    case "ready":
      if (typeof a.ready === "boolean") return c;
      break;
    case "mode":
      if (a.mode === "cut" || a.mode === "choose") return c;
      break;
    case "seat":
      if ([0, 1, 2, 3].includes(a.seat)) return c;
      break;
    case "play":
      if (
        typeof a.cardId === "string" &&
        /^(spades|hearts|clubs|diamonds)-(?:[2-9]|1[0-4])$/.test(a.cardId)
      )
        return c;
      break;
    case "trump":
      if (SUITS.includes(a.suit)) return c;
      break;
    case "start":
    case "leave":
      return c;
  }
  throw new Error("Invalid action.");
}

export function removePlayer(room: RoomState, id: string, reason: string) {
  if (room.game && room.game.phase !== "complete") {
    room.game = null;
    room.collectAt = null;
    room.endedReason = reason;
  }
  room.players = room.players.map((p) => (p?.id === id ? null : p));
  delete room.receipts[id];
  room.players.forEach((p) => {
    if (p) p.ready = false;
  });
  if (room.hostId === id) room.hostId = room.players.find((p) => p)?.id ?? "";
}

/** Applies a command once. Never mutates the previous persisted snapshot. */
export function applyCommand(
  room: RoomState,
  id: string,
  command: Command,
  connected: Set<string>,
  now: number,
): RoomState {
  const seat = room.players.findIndex((p) => p?.id === id) as Seat;
  if (seat < 0) throw new Error("Your seat is no longer in this room.");
  if (room.receipts[id]?.includes(command.id)) return room;
  if (command.revision !== room.revision)
    throw new Error("The table changed. Please try your action again.");
  const next = structuredClone(room);
  const player = next.players[seat]!;
  const action = command.action;
  const active = !!next.game && next.game.phase !== "complete";
  switch (action.type) {
    case "ready":
      if (active) throw new Error("Finish this deal first.");
      player.ready = action.ready;
      break;
    case "mode":
      if (active || id !== next.hostId)
        throw new Error("Only the host can change the mode between deals.");
      next.mode = action.mode;
      next.players.forEach((p) => {
        if (p) p.ready = false;
      });
      break;
    case "seat":
      if (active || next.players[action.seat])
        throw new Error("Choose an empty seat before the deal starts.");
      next.players[action.seat] = player;
      next.players[seat] = null;
      next.players.forEach((p) => {
        if (p) p.ready = false;
      });
      break;
    case "start":
      if (active || id !== next.hostId)
        throw new Error("Only the host can start a new deal.");
      if (!next.players.every((p) => p && p.ready && connected.has(p.id)))
        throw new Error("All four players must be connected and ready.");
      next.game = newGame(
        undefined,
        next.game ? nextSeat(next.game.dealer) : 3,
        next.mode,
      );
      next.endedReason = null;
      next.collectAt = null;
      next.players.forEach((p) => {
        if (p) p.ready = false;
      });
      break;
    case "play":
    case "trump":
      if (!next.game || !next.players.every((p) => p && connected.has(p.id)))
        throw new Error("Waiting for all four players to reconnect.");
      next.game =
        action.type === "play"
          ? playCard(next.game, seat, action.cardId)
          : chooseTrump(next.game, seat, action.suit);
      next.collectAt = next.game.phase === "trick-complete" ? now + 1700 : null;
      break;
    case "leave":
      removePlayer(
        next,
        id,
        `${player.name} left. This deal has ended without a winner.`,
      );
      break;
  }
  if (action.type !== "leave")
    next.receipts[id] = [...(next.receipts[id] ?? []), command.id].slice(-64);
  next.revision++;
  next.expiresAt = now + ROOM_TTL_MS;
  return next;
}
