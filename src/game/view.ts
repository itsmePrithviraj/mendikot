import { legalCards, teamOf } from "./engine";
import type { Card, Game, Play, Seat } from "./engine";

/** The only game shape sent over the network. Never includes reserve or other hands. */
export interface PlayerGame extends Pick<
  Game,
  | "id"
  | "mode"
  | "phase"
  | "trump"
  | "captured"
  | "tricks"
  | "lastTrick"
  | "trick"
  | "turn"
  | "dealer"
> {
  hand: Card[];
  handCounts: number[];
  legalCardIds: string[];
}

export const relativeSeat = (seat: Seat, viewer: Seat): Seat =>
  ((seat - viewer + 4) % 4) as Seat;

/** Rotate public seats and teams so every client's own seat is at the bottom. */
export function playerGame(game: Game, viewer: Seat): PlayerGame {
  const ours = teamOf(viewer),
    theirs = ours === 0 ? 1 : 0;
  const rotate = (play: Play): Play => ({
    ...play,
    seat: relativeSeat(play.seat, viewer),
  });
  return {
    id: game.id,
    mode: game.mode,
    phase: game.phase,
    trump: game.trump,
    turn: relativeSeat(game.turn, viewer),
    dealer: relativeSeat(game.dealer, viewer),
    hand: game.hands[viewer],
    handCounts: [0, 1, 2, 3].map((i) => game.hands[(viewer + i) % 4].length),
    legalCardIds: legalCards(game, viewer).map((card) => card.id),
    trick: game.trick.map(rotate),
    lastTrick: game.lastTrick
      ? {
          plays: game.lastTrick.plays.map(rotate),
          winner: relativeSeat(game.lastTrick.winner, viewer),
        }
      : null,
    captured: [game.captured[ours], game.captured[theirs]],
    tricks: [game.tricks[ours], game.tricks[theirs]],
  };
}
