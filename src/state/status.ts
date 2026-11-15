import type { PlayerGame } from "../game/view";
import { resultOf, winnerOf } from "../game/engine";
import type { Suit } from "../game/engine";
import { NAMES } from "./names";

export type Stage = "ready" | "shuffle" | "deal";

export interface Status {
  text: string;
  /** Optional suit drawn as a glyph after the text. */
  suit?: Suit;
  /** Whether the human is expected to act. */
  mine: boolean;
}

/** One line of table status. "Your turn" must stay in human-turn copy. */
export function statusOf(
  game: PlayerGame | null,
  stage: Stage,
  names: readonly string[] = NAMES,
): Status {
  if (!game) return { text: "", mine: false };
  const choosing = game.phase === "choosing-trump";
  if (stage === "shuffle") return { text: "Shuffling…", mine: false };
  if (stage === "deal") return { text: "Dealing…", mine: false };
  const result = resultOf(game);
  if (result)
    return {
      text: result.winner === 0 ? "Your team wins" : "Their team wins",
      mine: false,
    };
  if (choosing)
    return game.turn === 0
      ? { text: "Eight more cards after hukum", mine: false }
      : { text: `${names[game.turn]} is choosing hukum…`, mine: false };
  if (game.phase === "trick-complete") {
    const winner = winnerOf(game.trick, game.trump);
    return {
      text:
        winner === 0
          ? "You take the sheep"
          : `${names[winner]} takes the sheep`,
      mine: false,
    };
  }
  if (game.turn !== 0)
    return { text: `${names[game.turn]}’s turn`, mine: false };
  if (!game.trick.length)
    return { text: "Your turn · lead any card", mine: true };
  const led = game.trick[0].card.suit;
  const follows = game.hand.some((c) => c.suit === led);
  return follows
    ? { text: "Your turn · follow", suit: led, mine: true }
    : { text: "Your turn · play any card", mine: true };
}
