import type { Seat as SeatId } from "../game/engine";
import { nameOf, PARTNER } from "../state/names";

export function Seat({
  seat,
  cards,
  turn,
  winner,
}: {
  seat: SeatId;
  cards: number;
  turn: boolean;
  winner: boolean;
}) {
  const name = nameOf(seat);
  return (
    <div className={`seat seat-${seat}${turn ? " is-turn" : ""}${winner ? " is-winner" : ""}`}>
      <span className="avatar" aria-hidden="true">
        {name[0]}
      </span>
      <span className="seat-copy">
        <strong className="seat-name">{name}</strong>
        <span className="seat-meta">
          {seat === PARTNER ? "Partner" : "Opponent"}
          <span className="seat-bot"> · Bot</span>
        </span>
      </span>
      <span className="seat-cards tnum" aria-label={`${cards} cards`}>
        <span className="mini-back" aria-hidden="true" />
        {cards}
      </span>
      {turn && <span className="sr-only">{name}’s turn</span>}
    </div>
  );
}
