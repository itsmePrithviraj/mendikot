export const SUITS = ["spades", "hearts", "clubs", "diamonds"] as const;
export type Suit = (typeof SUITS)[number];
export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;
export type Mode = "cut" | "choose";
export interface Card {
  id: string;
  suit: Suit;
  rank: number;
}
export interface Play {
  seat: Seat;
  card: Card;
}
export interface Game {
  version: 1;
  id: string;
  mode: Mode;
  reserve: Card[];
  hands: Card[][];
  turn: Seat;
  dealer: Seat;
  trump: Suit | null;
  trick: Play[];
  captured: [Card[], Card[]];
  tricks: [number, number];
  phase: "choosing-trump" | "playing" | "trick-complete" | "complete";
  lastTrick: { plays: Play[]; winner: Seat } | null;
}
export const teamOf = (seat: Seat): Team => (seat % 2) as Team;
export const nextSeat = (seat: Seat): Seat => ((seat + 1) % 4) as Seat;
export const rankLabel = (rank: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[rank] ?? String(rank);
export const cardLabel = (card: Card) =>
  `${{ 11: "Jack", 12: "Queen", 13: "King", 14: "Ace" }[card.rank] ?? card.rank} of ${card.suit}`;
export const makeDeck = (): Card[] =>
  SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({
      id: `${suit}-${i + 2}`,
      suit,
      rank: i + 2,
    })),
  );
export function shuffle(
  deck: Card[],
  random: () => number = () =>
    crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32,
): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const sortHand = (hand: Card[]) =>
  [...hand].sort(
    (a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || b.rank - a.rank,
  );
export function newGame(
  random?: () => number,
  dealer: Seat = 3,
  mode: Mode = "cut",
): Game {
  const deck = shuffle(makeDeck(), random);
  const first = mode === "choose" ? deck.slice(0, 20) : deck;
  return {
    version: 1,
    id: crypto.randomUUID(),
    mode,
    reserve: mode === "choose" ? deck.slice(20) : [],
    hands: [0, 1, 2, 3].map((seat) =>
      sortHand(first.filter((_, i) => i % 4 === seat)),
    ),
    turn: nextSeat(dealer),
    dealer,
    trump: null,
    trick: [],
    captured: [[], []],
    tricks: [0, 0],
    phase: mode === "choose" ? "choosing-trump" : "playing",
    lastTrick: null,
  };
}
export function chooseTrump(game: Game, seat: Seat, suit: Suit): Game {
  if (
    game.phase !== "choosing-trump" ||
    game.turn !== seat ||
    !SUITS.includes(suit)
  )
    throw new Error("Only the chosen player may select hukum now.");
  return {
    ...game,
    trump: suit,
    reserve: [],
    hands: game.hands.map((hand, i) =>
      sortHand([...hand, ...game.reserve.filter((_, j) => j % 4 === i)]),
    ),
    phase: "playing",
  };
}
export function botTrump(hand: Card[]): Suit {
  return [...SUITS].sort(
    (a, b) =>
      hand.filter((c) => c.suit === b).reduce((n, c) => n + 20 + c.rank, 0) -
      hand.filter((c) => c.suit === a).reduce((n, c) => n + 20 + c.rank, 0),
  )[0];
}
export function legalCards(game: Game, seat: Seat): Card[] {
  if (game.phase !== "playing" || game.turn !== seat) return [];
  const led = game.trick[0]?.card.suit,
    hand = game.hands[seat];
  const matching = hand.filter((c) => c.suit === led);
  return matching.length ? matching : hand;
}
export function winnerOf(trick: Play[], trump: Suit | null): Seat {
  if (!trick.length) throw new Error("A trick must contain a card.");
  const led = trick[0].card.suit;
  const strength = (card: Card) =>
    (card.suit === trump ? 100 : card.suit === led ? 50 : 0) + card.rank;
  return trick.reduce((best, p) =>
    strength(p.card) > strength(best.card) ? p : best,
  ).seat;
}
export function playCard(game: Game, seat: Seat, cardId: string): Game {
  const card = legalCards(game, seat).find((c) => c.id === cardId);
  if (!card) throw new Error("That card cannot be played on this turn.");
  const trump =
    game.trump ??
    (game.trick.length && game.trick[0].card.suit !== card.suit
      ? card.suit
      : null);
  const trick = [...game.trick, { seat, card }];
  return {
    ...game,
    hands: game.hands.map((hand, i) =>
      i === seat ? hand.filter((c) => c.id !== card.id) : hand,
    ),
    trump,
    trick,
    turn: nextSeat(seat),
    phase: trick.length === 4 ? "trick-complete" : "playing",
  };
}
export function collectTrick(game: Game): Game {
  if (game.phase !== "trick-complete" || game.trick.length !== 4)
    throw new Error("Finish the trick before collecting it.");
  const winner = winnerOf(game.trick, game.trump),
    team = teamOf(winner);
  const captured: [Card[], Card[]] = [...game.captured] as [Card[], Card[]];
  captured[team] = [...captured[team], ...game.trick.map((p) => p.card)];
  const tricks: [number, number] = [...game.tricks];
  tricks[team]++;
  return {
    ...game,
    captured,
    tricks,
    lastTrick: { plays: game.trick, winner },
    trick: [],
    turn: winner,
    phase: game.hands.every((h) => h.length === 0) ? "complete" : "playing",
  };
}
export const tens = (game: Game, team: Team) =>
  game.captured[team].filter((c) => c.rank === 10);
export function resultOf(
  game: Game,
): { winner: Team; coat: boolean; whitewash: boolean } | null {
  if (game.phase !== "complete") return null;
  const ours = tens(game, 0).length,
    theirs = tens(game, 1).length;
  const winner: Team =
    ours === theirs
      ? game.tricks[0] > game.tricks[1]
        ? 0
        : 1
      : ours > theirs
        ? 0
        : 1;
  return {
    winner,
    coat: tens(game, winner).length === 4,
    whitewash: game.tricks[winner] === 13,
  };
}
// Uses only the bot's own legal hand, public cards, and the current trick.
export function chooseBotCard(game: Game): Card {
  const legal = legalCards(game, game.turn).sort((a, b) => a.rank - b.rank);
  if (!legal.length) throw new Error("There is no legal bot move.");
  if (!game.trick.length) return legal.find((c) => c.rank !== 10) ?? legal[0];
  const partnerWinning =
    teamOf(winnerOf(game.trick, game.trump)) === teamOf(game.turn);
  if (partnerWinning && game.trick.length === 3)
    return legal.find((c) => c.rank === 10) ?? legal[0];
  const winning = legal.filter((card) => {
    const trump =
      game.trump ?? (card.suit !== game.trick[0].card.suit ? card.suit : null);
    return (
      winnerOf([...game.trick, { seat: game.turn, card }], trump) === game.turn
    );
  });
  if (game.trick.some((p) => p.card.rank === 10) || game.trick.length === 3)
    return (
      winning.find((c) => c.rank !== 10) ??
      winning[0] ??
      legal.find((c) => c.rank !== 10) ??
      legal[0]
    );
  return legal.find((c) => c.rank !== 10) ?? legal[0];
}
// Local saves are untrusted. Reject incomplete, incompatible or corrupt snapshots.
export function isGame(value: unknown): value is Game {
  try {
    const g = value as Game;
    if (
      !g ||
      g.version !== 1 ||
      typeof g.id !== "string" ||
      !["choosing-trump", "playing", "trick-complete", "complete"].includes(
        g.phase,
      )
    )
      return false;
    if (
      ![0, 1, 2, 3].includes(g.turn) ||
      ![0, 1, 2, 3].includes(g.dealer) ||
      (g.trump !== null && !SUITS.includes(g.trump))
    )
      return false;
    if (
      !Array.isArray(g.hands) ||
      g.hands.length !== 4 ||
      g.hands.some((h) => !Array.isArray(h) || h.length > 13)
    )
      return false;
    if (
      !Array.isArray(g.captured) ||
      g.captured.length !== 2 ||
      g.captured.some((h) => !Array.isArray(h))
    )
      return false;
    if (
      !Array.isArray(g.trick) ||
      g.trick.length > 4 ||
      g.trick.some((p) => !p || ![0, 1, 2, 3].includes(p.seat))
    )
      return false;
    if (new Set(g.trick.map((p) => p.seat)).size !== g.trick.length)
      return false;
    if (!["cut", "choose"].includes(g.mode) || !Array.isArray(g.reserve))
      return false;
    if (
      g.phase === "choosing-trump"
        ? g.mode !== "choose" ||
          g.reserve.length !== 32 ||
          g.hands.some((h) => h.length !== 5) ||
          g.trump !== null ||
          g.trick.length !== 0
        : g.reserve.length !== 0
    )
      return false;
    const deck = [
      ...g.reserve,
      ...g.hands.flat(),
      ...g.captured.flat(),
      ...g.trick.map((p) => p.card),
    ];
    if (
      deck.length !== 52 ||
      new Set(deck.map((c) => c.id)).size !== 52 ||
      deck.some(
        (c) =>
          !SUITS.includes(c.suit) ||
          !Number.isInteger(c.rank) ||
          c.rank < 2 ||
          c.rank > 14 ||
          c.id !== `${c.suit}-${c.rank}`,
      )
    )
      return false;
    if (
      !Array.isArray(g.tricks) ||
      g.tricks.length !== 2 ||
      g.tricks.some(
        (n, i) =>
          !Number.isInteger(n) ||
          n < 0 ||
          n > 13 ||
          n * 4 !== g.captured[i].length,
      )
    )
      return false;
    if (
      (g.phase === "trick-complete" && g.trick.length !== 4) ||
      (g.phase === "playing" && g.trick.length > 3)
    )
      return false;
    if (
      g.phase === "complete" &&
      (g.hands.flat().length !== 0 ||
        g.trick.length !== 0 ||
        g.tricks[0] + g.tricks[1] !== 13)
    )
      return false;
    if (
      g.phase !== "complete" &&
      g.hands.flat().length === 0 &&
      g.phase !== "trick-complete"
    )
      return false;
    if (
      g.lastTrick !== null &&
      (!g.lastTrick ||
        !Array.isArray(g.lastTrick.plays) ||
        g.lastTrick.plays.length !== 4 ||
        ![0, 1, 2, 3].includes(g.lastTrick.winner) ||
        g.lastTrick.plays.some(
          (p) => !p || !deck.some((c) => c.id === p.card?.id),
        ))
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
