import type { Seat as SeatId } from "../game/engine";
import { PARTNER } from "../state/names";
import { useTableIdentity } from "../state/tableIdentity";

export function Seat({
  seat,
  turn,
  winner,
}: {
  seat: SeatId;
  turn: boolean;
  winner: boolean;
}) {
  const { names, online, connected, bots } = useTableIdentity();
  const name = names[seat];
  const away = online && !connected[seat];
  const bot = bots[seat];
  return (
    <div
      className={`seat seat-${seat}${turn ? " is-turn" : ""}${winner ? " is-winner" : ""}${away ? " is-away" : ""}`}
    >
      <span className="avatar" aria-hidden="true">
        {name[0]}
      </span>
      <span className="seat-copy">
        <strong className="seat-name" title={online ? name : undefined}>
          {name}
        </strong>
        <span className="seat-meta">
          <span className="seat-role">
            {seat === PARTNER ? "Partner" : "Opponent"}
          </span>
          {(away || bot) && (
            <span className="seat-bot">{away ? "Away" : "Bot"}</span>
          )}
        </span>
      </span>
      {turn && <span className="sr-only">{name}’s turn</span>}
    </div>
  );
}
