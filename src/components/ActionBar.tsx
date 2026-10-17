import { ArrowRight } from "lucide-react";

export function ActionBar({
  phase,
  canPlay,
  onPlay,
}: {
  phase: "choosing" | "playing" | "complete";
  canPlay: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="actions">
      {phase === "playing" && (
        <button className="btn btn-primary play-btn" disabled={!canPlay} onClick={onPlay}>
          Play card <ArrowRight strokeWidth={2} />
        </button>
      )}
      {phase === "choosing" && (
        <p className="actions-note">Five now · eight more after hukum</p>
      )}
    </div>
  );
}
