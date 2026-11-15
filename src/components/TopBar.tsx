import { CircleHelp, Menu, Users } from "lucide-react";
import { Sheep } from "./cards";

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Mendikot">
      <Sheep />
      <span aria-hidden="true">Mendikot</span>
    </span>
  );
}

export function TopBar({
  offline,
  onHelp,
  onMenu,
  onOnline,
}: {
  offline: boolean;
  onHelp: () => void;
  onMenu: () => void;
  onOnline?: () => void;
}) {
  return (
    <header className="bar">
      <Wordmark />
      <nav className="table-tools" aria-label="Game controls">
        {onOnline && (
          <button
            className="icon-btn"
            onClick={onOnline}
            aria-label="Play with friends"
          >
            <Users strokeWidth={1.75} />
          </button>
        )}
        {offline && <span className="offline-pill">Offline</span>}
        <button className="icon-btn" onClick={onHelp} aria-label="How to play">
          <CircleHelp strokeWidth={1.75} />
        </button>
        <button className="icon-btn" onClick={onMenu} aria-label="Menu">
          <Menu strokeWidth={1.75} />
        </button>
      </nav>
    </header>
  );
}
