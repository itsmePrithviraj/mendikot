import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { resultOf, SUITS, tens } from "../../game/engine";
import type { PlayerGame } from "../../game/view";
import { CardFace } from "../cards";

/** Seen from the viewer's team (team 0). */
function headline(ours: boolean, coat: boolean, whitewash: boolean) {
  if (whitewash) return ours ? "Whitewash!" : "Whitewashed.";
  if (coat) return ours ? "Mendikot!" : "They made Mendikot.";
  return ours ? "You win." : "They win.";
}

export function ResultPanel({
  game,
  onAgain,
  onChangeMode,
  actions,
}: {
  game: PlayerGame;
  onAgain: () => void;
  onChangeMode: () => void;
  actions?: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);
  // The hand disappears with the last card; keep keyboard focus on the table.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active.closest(".hand"))
      panel.current?.focus();
  }, []);
  const result = resultOf(game);
  if (!result) return null;
  const won = tens(game, result.winner);
  const ours = result.winner === 0;
  const loser = result.winner === 0 ? 1 : 0;
  // With the tens split 2–2, the trick count decides the deal.
  const tied = won.length === 2;
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className={`panel result-panel ${ours ? "is-win" : "is-loss"}`}
      aria-live="polite"
    >
      <h2>{headline(ours, result.coat, result.whitewash)}</h2>
      <p className="result-line tnum">
        {tied
          ? `Tens split 2–2 · ${game.tricks[result.winner]}–${game.tricks[loser]} on tricks`
          : `${won.length} of 4 tens · ${game.tricks[result.winner]} tricks`}
      </p>
      <div
        className="result-tens"
        role="img"
        aria-label={`${ours ? "Your" : "Their"} team took ${won.length} of the four tens`}
      >
        {SUITS.map((s, i) => (
          <span
            key={s}
            className={`ten-card${won.some((c) => c.suit === s) ? " won" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            <CardFace card={{ id: `${s}-10`, rank: 10, suit: s }} />
          </span>
        ))}
      </div>
      <div className="result-actions">
        {actions ?? (
          <>
            <button className="btn btn-ghost" onClick={onChangeMode}>
              Change mode
            </button>
            <button className="btn btn-primary" onClick={onAgain}>
              Deal again
            </button>
          </>
        )}
      </div>
    </section>
  );
}
