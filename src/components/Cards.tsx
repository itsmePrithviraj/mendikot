import type { CSSProperties } from "react";
import { Club, Diamond, Heart, Spade } from "lucide-react";
import type { Card, Suit } from "../game/engine";
import { cardLabel, rankLabel } from "../game/engine";
export function SuitMark({
  suit,
  className = "",
}: {
  suit: Suit;
  className?: string;
}) {
  const Icon = { spades: Spade, hearts: Heart, clubs: Club, diamonds: Diamond }[
    suit
  ];
  return (
    <Icon
      className={`suit-mark ${suit} ${className}`}
      aria-hidden="true"
      fill="currentColor"
      strokeWidth={1.1}
    />
  );
}
export function Sheep({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`sheep ${className}`}
      viewBox="0 0 32 28"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 20v4m13-4v4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M6 17a4 4 0 0 1-1-7 4 4 0 0 1 5-5 4 4 0 0 1 7-1 4 4 0 0 1 6 4 4 4 0 0 1 3 6 5 5 0 0 1-5 7H10a5 5 0 0 1-4-4Z"
        fill="currentColor"
        opacity=".16"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M24 9c4-1 6 1 5 5l-2 5c-1 2-5 1-5-1v-6c0-2 0-3 2-3Z"
        fill="currentColor"
      />
      <path
        d="m23 10-3-2m7 2 3-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="27" cy="12" r=".8" fill="#fff8e8" />
    </svg>
  );
}
export function CardFace({
  card,
  small = false,
}: {
  card: Card;
  small?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={cardLabel(card)}
      className={`card-face ${card.suit} ${small ? "small" : ""}`}
    >
      <span className="card-corner">
        <span>{rankLabel(card.rank)}</span>
        <SuitMark suit={card.suit} />
      </span>
      <span className="card-centre">
        {card.rank === 10 ? <Sheep /> : <SuitMark suit={card.suit} />}
      </span>
      <span className="card-corner corner-bottom">
        <span>{rankLabel(card.rank)}</span>
        <SuitMark suit={card.suit} />
      </span>
    </span>
  );
}
export function HandCard({
  card,
  selected,
  legal,
  disabled,
  index,
  onSelect,
}: {
  card: Card;
  selected: boolean;
  legal: boolean;
  disabled: boolean;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`hand-card ${selected ? "selected" : ""} ${legal ? "legal" : "unplayable"}`}
      style={{ "--card-index": index } as CSSProperties}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${cardLabel(card)}${legal ? "" : ", cannot play now"}`}
      data-card={card.id}
    >
      <CardFace card={card} />
    </button>
  );
}
export function CardBack({ className = "" }: { className?: string }) {
  return (
    <img
      className={`card-back ${className}`}
      src="/card-back.svg"
      alt=""
      draggable="false"
    />
  );
}
