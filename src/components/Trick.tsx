import type { CSSProperties } from "react";
import type { Play, Seat } from "../game/engine";
import { nameOf } from "../state/names";
import { CardFace } from "./cards";

export function Trick({ plays, winner }: { plays: Play[]; winner: Seat | null }) {
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
          <span className="sr-only">played by {nameOf(p.seat)}</span>
        </div>
      ))}
    </div>
  );
}
