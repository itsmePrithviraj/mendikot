import type { CSSProperties } from "react";
import type { Play, Seat } from "../game/engine";
import { useTableIdentity } from "../state/tableIdentity";
import { CardFace } from "./cards";

export function Trick({
  plays,
  winner,
}: {
  plays: Play[];
  winner: Seat | null;
}) {
  const { names } = useTableIdentity();
  return (
    <div
      className={`trick${winner !== null ? ` is-complete to-${winner}` : ""}`}
      aria-label="Current trick"
    >
      {plays.map((p, i) => (
        <div
          key={p.card.id}
          className={`played-card from-${p.seat}${winner === p.seat ? " is-winner" : ""}`}
          style={{ "--order": i } as CSSProperties}
        >
          <CardFace card={p.card} />
          <span className="sr-only">played by {names[p.seat]}</span>
        </div>
      ))}
    </div>
  );
}
