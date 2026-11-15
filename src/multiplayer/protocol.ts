/** Messages and limits shared by the browser client and the room server. */
import type { Mode, Seat, Suit } from "../game/engine";
import type { PlayerGame } from "../game/view";

/** Eight characters from an alphabet without look-alikes (no I, O, 0 or 1). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
/** Rooms expire this long after their last accepted action. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** How long a disconnected player's seat is held. */
export const RECONNECT_MS = 120_000;

/** WebSocket close codes the server uses to tell the client why it was closed. */
export const CloseCode = {
  /** The same player opened the room in another tab. Do not reconnect. */
  replaced: 4001,
  /** The room no longer exists. Do not reconnect. */
  expired: 4004,
  /** Too many commands; the client may reconnect after a pause. */
  rateLimited: 4008,
} as const;

export interface RoomPlayer {
  id: string;
  name: string;
  seat: Seat;
  ready: boolean;
  connected: boolean;
}

/** One player's private view of the room, sent after every change. */
export interface RoomSnapshot {
  protocol: 1;
  code: string;
  revision: number;
  yourId: string;
  yourSeat: Seat;
  hostId: string;
  mode: Mode;
  players: RoomPlayer[];
  game: PlayerGame | null;
  /** The latest table event, such as who left or why a deal ended early. */
  notice: string | null;
  /** When the earliest disconnected seat will be released, if any. */
  reconnectDeadline: number | null;
}

export type RoomAction =
  | { type: "ready"; ready: boolean }
  | { type: "mode"; mode: Mode }
  | { type: "seat"; seat: Seat }
  | { type: "start" }
  | { type: "play"; cardId: string }
  | { type: "trump"; suit: Suit }
  | { type: "leave" };

/** A client request. `id` makes retries idempotent; `revision` is the snapshot it was made from. */
export interface Command {
  id: string;
  revision: number;
  action: RoomAction;
}

export type ServerMessage =
  | { type: "snapshot"; room: RoomSnapshot }
  | { type: "ack"; id: string }
  | { type: "error"; id?: string; message: string }
  | { type: "left" };
