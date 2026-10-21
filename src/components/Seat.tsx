import type { Seat as SeatId } from "../game/engine";
import { PARTNER } from "../state/names";
import { useTableIdentity } from "../state/tableIdentity";

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
  const { names, online, connected } = useTableIdentity();
  const name = names[seat];
  return (
    <div
      className={`seat seat-${seat}${turn ? " is-turn" : ""}${winner ? " is-winner" : ""}`}
    >
      <span className="avatar" aria-hidden="true">
        {name[0]}
      </span>
      <span className="seat-copy">
        <strong className="seat-name" title={online ? name : undefined}>
          {name}
        </strong>
        <span className="seat-meta">
          {seat === PARTNER ? "Partner" : "Opponent"}
          <span className="seat-bot">
            {online ? (connected[seat] ? "" : " · Away") : " · Bot"}
          </span>
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
