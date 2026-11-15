import type { Card } from "../game/engine";
import { cardLabel, rankLabel } from "../game/engine";
import type { Status } from "../state/status";
import { SuitGlyph } from "./cards";
import { HapticSwitch } from "./HapticSwitch";

/** One row under the hand: the table status, or the Play button once a
 * playable card is picked. The status stays in the DOM for screen readers. */
export function ActionBar({
  status,
  card,
  canPlay,
  haptic,
  onPlay,
}: {
  status: Status;
  /** The selected card, when it can be played now. */
  card: Card | null;
  canPlay: boolean;
  haptic: boolean;
  onPlay: () => void;
}) {
  const ready = canPlay && !!card;
  return (
    <div className={`actions${ready ? " can-play" : ""}`}>
      <span
        className={`turn-status${status.mine ? " your-turn" : ""}`}
        role="status"
        aria-live="polite"
      >
        {status.text}
        {status.suit && (
          <>
            {" "}
            <SuitGlyph suit={status.suit} />
            <span className="status-suit">{status.suit}</span>
          </>
        )}
      </span>
      {ready && (
        <button
          className="btn btn-primary play-btn"
          onClick={onPlay}
          aria-label={`Play ${cardLabel(card)}`}
        >
          Play
          <span className={`play-card ${card.suit}`} aria-hidden="true">
            {rankLabel(card.rank)}
            <SuitGlyph suit={card.suit} />
          </span>
          {haptic && <HapticSwitch />}
        </button>
      )}
    </div>
  );
}
