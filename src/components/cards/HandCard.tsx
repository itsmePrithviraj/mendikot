import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { Card } from "../../game/engine";
import { cardLabel } from "../../game/engine";
import { HapticSwitch } from "../HapticSwitch";
import { CardFace } from "./CardFace";

export function HandCard({
  card,
  index,
  legal,
  dim,
  selected,
  disabled,
  shake,
  haptic,
  onSelect,
  onKeyDown,
}: {
  card: Card;
  index: number;
  legal: boolean;
  dim: boolean;
  selected: boolean;
  disabled: boolean;
  /** Shakes the card whenever this number changes to a non-zero value. */
  shake: number;
  haptic: boolean;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Web Animations rather than a class, so a second refused tap replays it.
  useEffect(() => {
    const el = ref.current;
    if (!shake || !el || el.closest(".reduce-motion") || !el.animate) return;
    el.animate(
      [
        { translate: "0 0" },
        { translate: "-5px 0" },
        { translate: "5px 0" },
        { translate: "-3px 0" },
        { translate: "0 0" },
      ],
      { duration: 240, easing: "ease-out" },
    );
  }, [shake]);
  return (
    <button
      ref={ref}
      type="button"
      className={`hand-card${legal ? " legal" : ""}${dim ? " unplayable" : ""}${selected ? " selected" : ""}`}
      style={{ "--i": index } as CSSProperties}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${cardLabel(card)}${dim ? ", cannot play now" : ""}`}
      data-card={card.id}
    >
      <CardFace card={card} />
      {haptic && <HapticSwitch disabled={disabled} />}
    </button>
  );
}
