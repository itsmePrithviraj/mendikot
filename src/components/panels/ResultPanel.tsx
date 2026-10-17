import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { resultOf, SUITS, tens } from "../../game/engine";
import type { Game } from "../../game/engine";
import { Sheep, SuitGlyph } from "../cards";

export function ResultPanel({
  game,
  onAgain,
  onChangeMode,
}: {
  game: Game;
  onAgain: () => void;
  onChangeMode: () => void;
}) {
  const result = resultOf(game);
  if (!result) return null;
  const won = tens(game, result.winner);
  const ours = result.winner === 0;
  return (
    <section className={`panel result-panel ${ours ? "is-win" : "is-loss"}`} aria-live="polite">
      <Sheep className="result-sheep" />
      <h2>
        {result.whitewash
          ? "A clean sweep."
          : result.coat
            ? "A Mendikot!"
            : ours
              ? "Beautifully played."
              : "The next one is yours."}
      </h2>
      <p className="result-line">
        {ours ? "Your team wins" : "Their team wins"} · {game.tricks[result.winner]} tricks
      </p>
      <div className="result-tens" aria-label={`${won.length} of four tens`}>
        {SUITS.map((s, i) => (
          <span
            key={s}
            className={`ten-chip ${s} ${won.some((c) => c.suit === s) ? "won" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            10
            <SuitGlyph suit={s} />
          </span>
        ))}
      </div>
      <div className="result-actions">
        <button className="btn btn-ghost" onClick={onChangeMode}>
          Change mode
        </button>
        <button className="btn btn-primary" onClick={onAgain}>
          Deal again <ArrowRight strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}
