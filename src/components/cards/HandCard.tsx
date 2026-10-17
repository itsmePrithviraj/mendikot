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
  shaking,
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
  shaking: boolean;
  haptic: boolean;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`hand-card${legal ? " legal" : ""}${dim ? " unplayable" : ""}${selected ? " selected" : ""}${shaking ? " shake" : ""}`}
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
