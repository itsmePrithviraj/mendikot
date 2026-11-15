import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { Card } from "../game/engine";
import { HandCard } from "./cards";

export function Hand({
  cards,
  legal,
  myTurn,
  selected,
  disabled,
  dealing,
  shaking,
  canPlay,
  haptic,
  onSelect,
  onPlay,
}: {
  cards: Card[];
  legal: Set<string>;
  myTurn: boolean;
  selected: string | null;
  disabled: boolean;
  dealing: boolean;
  shaking: string | null;
  canPlay: boolean;
  haptic: boolean;
  onSelect: (card: Card) => void;
  onPlay: () => void;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  // After a keyboard play the hand itself holds focus (the played card is gone
  // and the rest are disabled). Give it back to a card when it is our turn.
  useEffect(() => {
    const hand = handRef.current;
    if (disabled || !hand || document.activeElement !== hand) return;
    const first =
      hand.querySelector<HTMLButtonElement>("button.legal:not(:disabled)") ??
      hand.querySelector<HTMLButtonElement>("button:not(:disabled)");
    first?.focus();
  }, [disabled]);

  function onKeyDown(card: Card, e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" && selected === card.id && canPlay) {
      e.preventDefault();
      onPlay();
      handRef.current?.focus();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const buttons = [
      ...(e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? []),
    ];
    const at = buttons.indexOf(e.currentTarget);
    const next = buttons[at + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }
  return (
    <div
      className={`hand${dealing ? " dealing" : ""}${cards.length <= 5 ? " five-cards" : ""}`}
      ref={handRef}
      role="group"
      aria-label="Your cards"
      tabIndex={-1}
      style={{ "--count": cards.length } as CSSProperties}
    >
      {cards.map((card, index) => {
        const isLegal = legal.has(card.id);
        return (
          <HandCard
            key={card.id}
            card={card}
            index={index}
            legal={isLegal}
            dim={myTurn && !isLegal}
            selected={selected === card.id}
            disabled={disabled}
            shaking={shaking === card.id}
            // Matches the vibration on a refused card in App's select().
            haptic={haptic && myTurn && !isLegal}
            onSelect={() => onSelect(card)}
            onKeyDown={(e) => onKeyDown(card, e)}
          />
        );
      })}
    </div>
  );
}
