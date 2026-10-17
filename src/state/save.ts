import { isGame } from "../game/engine";
import type { Game } from "../game/engine";

export const SAVE_KEY = "mendikot.game.v1";

export function readGame(): Game | null {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    return isGame(data) ? data : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refuses to store the game. */
export function writeGame(game: Game): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    return true;
  } catch {
    return false;
  }
}
