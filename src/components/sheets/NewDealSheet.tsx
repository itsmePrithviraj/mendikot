import type { Mode } from "../../game/engine";
import { ModePicker } from "../panels/ModePicker";

export function NewDealSheet({
  mode,
  finished,
  onMode,
  onKeep,
  onDeal,
}: {
  mode: Mode;
  /** The current deal is over, so a new one ends nothing. */
  finished: boolean;
  onMode: (mode: Mode) => void;
  onKeep: () => void;
  onDeal: () => void;
}) {
  return (
    <>
      {!finished && <p>This ends the current deal.</p>}
      <ModePicker mode={mode} onChange={onMode} />
      <div className="sheet-actions">
        <button className="btn btn-quiet" onClick={onKeep}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={onDeal}>
          Deal
        </button>
      </div>
    </>
  );
}
