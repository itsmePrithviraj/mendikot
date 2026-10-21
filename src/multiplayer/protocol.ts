import type { Mode, Seat, Suit } from "../game/engine";
import type { PlayerGame } from "../game/view";

export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{8}$/;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const RECONNECT_MS = 120_000;

export interface RoomPlayer {
  id: string;
  name: string;
  seat: Seat;
  ready: boolean;
  connected: boolean;
}
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
  endedReason: string | null;
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
