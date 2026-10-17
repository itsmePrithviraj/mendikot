import type { Mode } from "../../game/engine";
import { ModePicker } from "../panels/ModePicker";

export function NewDealSheet({
  mode,
  onMode,
  onKeep,
  onDeal,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  onKeep: () => void;
  onDeal: () => void;
}) {
  return (
    <>
      <p>This ends the current practice deal.</p>
      <ModePicker mode={mode} onChange={onMode} />
      <div className="sheet-actions">
        <button className="btn btn-quiet" onClick={onKeep}>
          Keep playing
        </button>
        <button className="btn btn-primary" onClick={onDeal}>
          Shuffle &amp; deal
        </button>
      </div>
    </>
  );
}
