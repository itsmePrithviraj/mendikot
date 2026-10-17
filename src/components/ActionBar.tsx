import { ArrowRight } from "lucide-react";
import { HapticSwitch } from "./HapticSwitch";

export function ActionBar({
  phase,
  canPlay,
  haptic,
  onPlay,
}: {
  phase: "choosing" | "playing" | "complete";
  canPlay: boolean;
  haptic: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="actions">
      {phase === "playing" && (
        <button className="btn btn-primary play-btn" disabled={!canPlay} onClick={onPlay}>
          Play card <ArrowRight strokeWidth={2} />
          {haptic && <HapticSwitch disabled={!canPlay} />}
        </button>
      )}
      {phase === "choosing" && (
        <p className="actions-note">Five now · eight more after hukum</p>
      )}
    </div>
  );
}
