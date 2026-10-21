import type { PlayerGame } from "../../game/view";

import { useTableIdentity } from "../../state/tableIdentity";
import { CardFace } from "../cards";

export function LastTrickSheet({ game }: { game: PlayerGame }) {
  const { names } = useTableIdentity();
  const last = game.lastTrick;
  if (!last) return <p>No trick has been collected yet.</p>;
  return (
    <>
      <p>
        <strong>{last.winner === 0 ? "You" : names[last.winner]}</strong> took
        it.
      </p>
      <ol className="last-trick">
        {last.plays.map((p) => (
          <li
            key={p.card.id}
            className={p.seat === last.winner ? "is-winner" : ""}
          >
            <CardFace card={p.card} />
            <span>{names[p.seat]}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
