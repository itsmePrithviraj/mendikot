import type { ReactNode } from "react";
import type { PlayerGame } from "../game/view";
import { History } from "lucide-react";
import type { Suit } from "../game/engine";
import { winnerOf } from "../game/engine";
import type { Stage } from "../state/status";
import { CardBack } from "./cards";
import { ChoosePanel } from "./panels/ChoosePanel";
import { ResultPanel } from "./panels/ResultPanel";
import { Seat } from "./Seat";
import { Trick } from "./Trick";

export function Table({
  game,
  stage,
  onChoose,
  onAgain,
  onChangeMode,
  onLastTrick,
  resultActions,
  interactionDisabled = false,
}: {
  game: PlayerGame;
  stage: Stage;
  onChoose: (suit: Suit) => void;
  onAgain: () => void;
  onChangeMode: () => void;
  onLastTrick: () => void;
  resultActions?: ReactNode;
  interactionDisabled?: boolean;
}) {
  const ready = stage === "ready";
  const completeTrick = game.phase === "trick-complete";
  const winner = completeTrick ? winnerOf(game.trick, game.trump) : null;
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
  else if (game.trick.length)
    centre = <Trick plays={game.trick} winner={winner} />;
  const panel = game.phase === "complete" || (choosing && game.turn === 0);
  return (
    <section
      className={`felt${panel ? " has-panel" : ""}${choosing && game.turn === 0 ? " is-choosing" : ""}`}
      aria-label="Table"
    >
      {game.lastTrick && game.phase !== "complete" && (
        <button
          className="chip last-trick-btn"
          onClick={onLastTrick}
          aria-label="Last sheep"
        >
          <History strokeWidth={1.75} />
        </button>
      )}
      {([2, 3, 1] as const).map((seat) => (
        <Seat
          key={seat}
          seat={seat}
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
    </section>
  );
}
