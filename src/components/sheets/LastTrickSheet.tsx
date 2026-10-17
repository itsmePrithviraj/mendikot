import type { Game } from "../../game/engine";
import { nameOf } from "../../state/names";
import { CardFace } from "../cards";

export function LastTrickSheet({ game }: { game: Game }) {
  const last = game.lastTrick;
  if (!last) return <p>No trick has been collected yet.</p>;
  return (
    <>
      <p>
        <strong>{last.winner === 0 ? "You" : nameOf(last.winner)}</strong> took it.
      </p>
      <ol className="last-trick">
        {last.plays.map((p) => (
          <li key={p.card.id} className={p.seat === last.winner ? "is-winner" : ""}>
            <CardFace card={p.card} />
            <span>{nameOf(p.seat)}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
