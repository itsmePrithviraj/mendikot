import { Menu, WifiOff } from "lucide-react";
import { Sheep } from "./cards";

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Mendikot">
      <Sheep />
      <span aria-hidden="true">Mendikot</span>
    </span>
  );
}

/** Brand and the one menu button. In a portrait game the wordmark hides and
 * the menu button floats over the scoreboard row (layout.css). */
export function TopBar({
  offline,
  onMenu,
}: {
  offline: boolean;
  onMenu: () => void;
}) {
  return (
    <header className="bar">
      <Wordmark />
      <nav className="table-tools" aria-label="Game controls">
        {offline && (
          <span className="offline-pill" title="Offline">
            <WifiOff strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">Offline</span>
          </span>
        )}
        <button className="icon-btn" onClick={onMenu} aria-label="Menu">
          <Menu strokeWidth={1.75} />
        </button>
      </nav>
    </header>
  );
}
