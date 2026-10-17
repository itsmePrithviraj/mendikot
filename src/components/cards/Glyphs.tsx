import type { Suit } from "../../game/engine";

export function SuitGlyph({ suit, className = "" }: { suit: Suit; className?: string }) {
  return (
    <svg className={`glyph suit-glyph ${suit} ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <use href={`#s-${suit}`} />
    </svg>
  );
}

export function Sheep({ className = "" }: { className?: string }) {
  return (
    <svg className={`glyph sheep ${className}`} viewBox="0 0 64 56" aria-hidden="true" focusable="false">
      <use href="#sheep" />
    </svg>
  );
}
