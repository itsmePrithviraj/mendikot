import { SUITS } from "../../game/engine";
import type { Suit } from "../../game/engine";
import { SuitGlyph } from "../cards";

export function ChoosePanel({ onChoose }: { onChoose: (suit: Suit) => void }) {
  return (
    <section className="panel choose-panel" aria-labelledby="choose-title">
      <h2 id="choose-title">Make it your suit.</h2>
      <p>Pick hukum from your first five cards.</p>
      <div className="suit-options">
        {SUITS.map((suit) => (
          <button
            key={suit}
            className={`suit-option ${suit}`}
            onClick={() => onChoose(suit)}
            aria-label={`Choose ${suit} as hukum`}
          >
            <SuitGlyph suit={suit} />
            <span>{suit}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
