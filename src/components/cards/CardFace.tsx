import { memo } from "react";
import type { Card, Suit } from "../../game/engine";
import { cardLabel, rankLabel } from "../../game/engine";
import { PIP_LAYOUTS, PIP_SIZE } from "./cardLayouts";

const crest = (rank: number) => (rank === 13 ? "k" : rank === 12 ? "q" : "j");

function Index({ label, suit }: { label: string; suit: Suit }) {
  return (
    <>
      <text x="34" y="61" className={`rank ${label === "10" ? "ten" : ""}`} textAnchor="middle" fontSize="56">
        {label}
      </text>
      <use href={`#s-${suit}`} x="19" y="70" width="30" height="30" />
    </>
  );
}

function Pips({ card }: { card: Card }) {
  const href = `#s-${card.suit}`;
  const half = PIP_SIZE / 2;
  if (card.rank === 14) {
    const size = card.suit === "spades" ? 124 : 104;
    return (
      <g className="pip">
        {card.suit === "spades" && (
          <>
            <circle cx="125" cy="175" r="78" className="brass-line" />
            <circle cx="125" cy="175" r="72" className="ink-line" />
          </>
        )}
        <use href={href} x={125 - size / 2} y={175 - size / 2} width={size} height={size} />
      </g>
    );
  }
  if (card.rank > 10) {
    const id = `#crest-${crest(card.rank)}`;
    const side = (
      <>
        <use href={id} x="92" y="82" width="66" height="66" />
        <use href={href} x="113" y="146" width="24" height="24" />
      </>
    );
    return (
      <g className="court">
        <rect x="50" y="72" width="150" height="206" rx="10" className="court-panel" />
        <rect x="56" y="78" width="138" height="194" rx="6" className="ink-line faint" />
        <g className="pip">
          {side}
          <g transform="rotate(180 125 175)">{side}</g>
        </g>
        <path d="M64 175H112M138 175H186" className="brass-line" />
        <path d="M125 168 132 175 125 182 118 175Z" className="brass-fill" />
      </g>
    );
  }
  return (
    <g className="pip">
      {PIP_LAYOUTS[card.rank].map((p, i) => (
        <use
          key={i}
          href={href}
          x={p.x - half}
          y={p.y - half}
          width={PIP_SIZE}
          height={PIP_SIZE}
          transform={p.flip ? `rotate(180 ${p.x} ${p.y})` : undefined}
        />
      ))}
      {card.rank === 10 && (
        <g className="medallion">
          <circle cx="125" cy="175" r="28" className="brass-line" />
          <use href="#sheep" x="101" y="154" width="48" height="42" />
        </g>
      )}
    </g>
  );
}

function CompactCentre({ card }: { card: Card }) {
  if (card.rank === 10) return <use href="#sheep" x="84" y="192" width="148" height="130" />;
  if (card.rank > 10)
    return <use href={`#crest-${crest(card.rank)}`} x="104" y="190" width="128" height="128" />;
  return <use href={`#s-${card.suit}`} x="104" y="192" width="128" height="128" />;
}

/** A playing card drawn entirely from the shared sprite. Two compositions
 * live in one SVG; a container query picks full pips or a bold compact face
 * based on rendered width, so rotation never re-renders the hand. */
export const CardFace = memo(function CardFace({
  card,
  className = "",
}: {
  card: Card;
  className?: string;
}) {
  const label = rankLabel(card.rank);
  return (
    <span className={`card face ${card.suit} ${className}`} role="img" aria-label={cardLabel(card)}>
      <svg viewBox="0 0 250 350" aria-hidden="true" focusable="false">
        <rect width="250" height="350" rx="16" className="card-paper" />
        <rect x="9" y="9" width="232" height="332" rx="10" className="card-hairline" />
        <g className="face-full">
          <Index label={label} suit={card.suit} />
          <g transform="rotate(180 125 175)">
            <Index label={label} suit={card.suit} />
          </g>
          <Pips card={card} />
        </g>
        <g className="face-compact">
          <text x="62" y="104" className={`rank ${label === "10" ? "ten" : ""}`} textAnchor="middle" fontSize="104">
            {label}
          </text>
          <use href={`#s-${card.suit}`} x="30" y="120" width="62" height="62" />
          <g className="pip">
            <CompactCentre card={card} />
          </g>
        </g>
      </svg>
    </span>
  );
});

export const CardBack = memo(function CardBack({ className = "" }: { className?: string }) {
  return (
    <span className={`card back ${className}`} aria-hidden="true">
      <svg viewBox="0 0 250 350" focusable="false">
        <use href="#card-back" />
      </svg>
    </span>
  );
});
