export const PREFS_KEY = "mendikot.preferences.v1";

/**
 * Bumped when a default changes for everyone. Saves from an older version
 * take the new defaults for `sound` and `haptics`; other choices are kept.
 */
const DEFAULTS_VERSION = 2;

export interface Preferences {
  sound: boolean;
  speed: "relaxed" | "quick";
  reducedMotion: boolean;
  /** Added in the revamp; older saves lack it and default to on. */
  haptics: boolean;
  /** Master sound level, 0–1. Older saves lack it and play at full level. */
  volume: number;
}

export const DEFAULT_PREFS: Preferences = {
  sound: true,
  speed: "relaxed",
  reducedMotion: false,
  haptics: true,
  volume: 1,
};

export function readPrefs(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    // Version 1 wrote sound: false for everyone who never touched it.
    const current = data.defaults === DEFAULTS_VERSION;
    return {
      sound: current ? data.sound !== false : true,
      speed: data.speed === "quick" ? "quick" : "relaxed",
      reducedMotion: data.reducedMotion === true,
      haptics: current ? data.haptics !== false : true,
      volume:
        typeof data.volume === "number" && data.volume >= 0 && data.volume <= 1
          ? data.volume
          : 1,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs: Preferences) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...prefs, defaults: DEFAULTS_VERSION }),
    );
  } catch {
    /* Continue without persistence. */
  }
}
