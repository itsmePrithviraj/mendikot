import type { ReactNode } from "react";
import type { PlayerGame } from "../game/view";
import { History } from "lucide-react";
import type { Suit } from "../game/engine";
import { winnerOf } from "../game/engine";
import type { Stage, Status } from "../state/status";
import { useTableIdentity } from "../state/tableIdentity";
import { CardBack, Sheep, SuitGlyph } from "./cards";
import { ChoosePanel } from "./panels/ChoosePanel";
import { ResultPanel } from "./panels/ResultPanel";
import { Seat } from "./Seat";
import { Trick } from "./Trick";

export function Table({
  game,
  stage,
  status,
  onChoose,
  onAgain,
  onChangeMode,
  onLastTrick,
  resultActions,
  interactionDisabled = false,
}: {
  game: PlayerGame;
  stage: Stage;
  status: Status;
  onChoose: (suit: Suit) => void;
  onAgain: () => void;
  onChangeMode: () => void;
  onLastTrick: () => void;
  resultActions?: ReactNode;
  interactionDisabled?: boolean;
}) {
  const { names } = useTableIdentity();
  const ready = stage === "ready";
  const completeTrick = game.phase === "trick-complete";
  const winner = completeTrick ? winnerOf(game.trick, game.trump) : null;
  const done = game.tricks[0] + game.tricks[1];
  const choosing = game.phase === "choosing-trump" && ready;
  let centre;
  if (stage === "shuffle")
    centre = (
      <div className="shuffle-stack" aria-label="Shuffling">
        {[0, 1, 2].map((i) => (
          <CardBack key={i} />
        ))}
      </div>
    );
  else if (game.phase === "complete")
    centre = (
      <ResultPanel
        actions={resultActions}
        game={game}
        onAgain={onAgain}
        onChangeMode={onChangeMode}
      />
    );
  else if (choosing && game.turn === 0)
    centre = (
      <fieldset className="choose-controls" disabled={interactionDisabled}>
        <ChoosePanel onChoose={onChoose} />
      </fieldset>
    );
  else if (choosing)
    centre = (
      <p className="table-note">
        <Sheep />
        {names[game.turn]} is choosing hukum
        <br />
        from five cards…
      </p>
    );
  else if (game.trick.length)
    centre = <Trick plays={game.trick} winner={winner} />;
  else if (game.phase === "playing" && ready)
    centre = (
      <p className="table-note quiet">
        <Sheep />
        {done === 0 ? "Let’s begin." : "Next trick."}
      </p>
    );
  const panel = game.phase === "complete" || (choosing && game.turn === 0);
  return (
    <section className={`felt${panel ? " has-panel" : ""}`} aria-label="Table">
      {game.phase !== "complete" && game.phase !== "choosing-trump" && (
        <span className="trick-count tnum">
          <span className="trick-word">Trick </span>
          {Math.min(done + 1, 13)}
          <span> / 13</span>
        </span>
      )}
      {game.lastTrick && game.phase !== "complete" && (
        <button
          className="chip last-trick-btn"
          onClick={onLastTrick}
          aria-label="Last trick"
        >
          <History strokeWidth={1.75} />
          <span className="chip-label">Last trick</span>
        </button>
      )}
      {([2, 3, 1] as const).map((seat) => (
        <Seat
          key={seat}
          seat={seat}
          cards={game.handCounts[seat]}
          turn={
            ready &&
            game.turn === seat &&
            game.phase !== "complete" &&
            !completeTrick
          }
          winner={winner === seat}
        />
      ))}
      <div className="centre">{centre}</div>
      <div className="status">
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
      </div>
    </section>
  );
}
