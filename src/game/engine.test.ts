import { describe, it, expect } from "vitest";
import {
  makeDeck,
  newGame,
  chooseTrump,
  botTrump,
  legalCards,
  playCard,
  winnerOf,
  collectTrick,
  chooseBotCard,
  resultOf,
  isGame,
  tens,
} from "./engine";
import type { Card, Game, Suit } from "./engine";
const card = (suit: Suit, rank: number): Card => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
});
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
describe("Mendikot rules", () => {
  it("deals every card exactly once in equal hands", () => {
    const g = newGame(seeded(8));
    expect(new Set(g.hands.flat().map((c) => c.id)).size).toBe(52);
    expect(g.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(makeDeck()).toHaveLength(52);
  });
  it("enforces turn and follow-suit without mutating state", () => {
    const g = newGame(seeded(2));
    const first = g.hands[0].find((c) =>
      g.hands[1].some((x) => x.suit === c.suit),
    )!;
    const next = playCard(g, 0, first.id);
    expect(g.hands[0]).toHaveLength(13);
    expect(legalCards(next, 1).every((c) => c.suit === first.suit)).toBe(true);
    expect(() => playCard(next, 0, g.hands[0][0].id)).toThrow();
    const off = next.hands[1].find((c) => c.suit !== first.suit)!;
    expect(() => playCard(next, 1, off.id)).toThrow();
  });
  it("the first legal cut becomes hukum and wins that trick", () => {
    const g = {
      ...newGame(seeded(1)),
      turn: 1,
      hands: [[], [card("clubs", 2)], [], []],
      trick: [{ seat: 0, card: card("hearts", 14) }],
    } as Game;
    const next = playCard(g, 1, "clubs-2");
    expect(next.trump).toBe("clubs");
    expect(winnerOf(next.trick, next.trump)).toBe(1);
  });
  it("off-suit aces lose; highest trump wins", () => {
    expect(
      winnerOf(
        [
          { seat: 0, card: card("hearts", 2) },
          { seat: 1, card: card("spades", 14) },
        ],
        null,
      ),
    ).toBe(0);
    expect(
      winnerOf(
        [
          { seat: 0, card: card("hearts", 14) },
          { seat: 1, card: card("clubs", 2) },
          { seat: 2, card: card("clubs", 3) },
        ],
        "clubs",
      ),
    ).toBe(2);
  });
  it("cannot collect an incomplete trick", () => {
    expect(() => collectTrick(newGame())).toThrow();
  });
  it("resolves 2–2 by tricks and identifies a coat", () => {
    const g = {
      ...newGame(),
      phase: "complete",
      captured: [
        [card("hearts", 10), card("spades", 10)],
        [card("clubs", 10), card("diamonds", 10)],
      ],
      tricks: [6, 7],
    } as Game;
    expect(resultOf(g)?.winner).toBe(1);
    g.captured = [makeDeck().filter((c) => c.rank === 10), []];
    expect(resultOf(g)).toMatchObject({ winner: 0, coat: true });
  });
  it("plays 100 complete seeded deals without losing cards or making illegal moves", () => {
    for (let seed = 0; seed < 100; seed++) {
      let g = newGame(seeded(seed));
      let plays = 0;
      while (g.phase !== "complete") {
        expect(isGame(g)).toBe(true);
        if (g.phase === "trick-complete") {
          g = collectTrick(g);
          expect(g.turn).toBe(g.lastTrick?.winner);
        } else {
          const c = chooseBotCard(g);
          expect(legalCards(g, g.turn)).toContainEqual(c);
          g = playCard(g, g.turn, c.id);
          plays++;
        }
      }
      expect(plays).toBe(52);
      expect(isGame(g)).toBe(true);
      expect(g.tricks[0] + g.tricks[1]).toBe(13);
      expect(tens(g, 0).length + tens(g, 1).length).toBe(4);
      expect(resultOf(g)).not.toBeNull();
    }
  });
  it("shows only five cards before chosen hukum, then deals the remaining eight", () => {
    const g = newGame(seeded(8), 3, "choose");
    expect(g.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(g.reserve).toHaveLength(32);
    expect(isGame(g)).toBe(true);
    expect(legalCards(g, 0)).toHaveLength(0);
    expect(() => chooseTrump(g, 1, "hearts")).toThrow();
    const next = chooseTrump(g, 0, "hearts");
    expect(next.trump).toBe("hearts");
    expect(next.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(next.reserve).toHaveLength(0);
    expect(isGame(next)).toBe(true);
    expect(g.hands[0]).toHaveLength(5);
  });
  it("completes chosen-hukum games with the selected suit preserved", () => {
    for (let seed = 0; seed < 20; seed++) {
      let g = newGame(seeded(seed), 3, "choose");
      const suit = botTrump(g.hands[g.turn]);
      g = chooseTrump(g, g.turn, suit);
      while (g.phase !== "complete") {
        g =
          g.phase === "trick-complete"
            ? collectTrick(g)
            : playCard(g, g.turn, chooseBotCard(g).id);
        expect(g.trump).toBe(suit);
        expect(isGame(g)).toBe(true);
      }
      expect(resultOf(g)).not.toBeNull();
    }
  });
  it("rejects corrupted local saves", () => {
    expect(isGame(null)).toBe(false);
    expect(isGame({ version: 1 })).toBe(false);
    const g = newGame();
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    g.hands[0][0] = g.hands[1][0];
    expect(isGame(g)).toBe(false);
  });
});
