export const PREFS_KEY = "mendikot.preferences.v1";

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
  sound: false,
  speed: "relaxed",
  reducedMotion: false,
  haptics: true,
  volume: 1,
};

export function readPrefs(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return {
      sound: data.sound === true,
      speed: data.speed === "quick" ? "quick" : "relaxed",
      reducedMotion: data.reducedMotion === true,
      haptics: data.haptics !== false,
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
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Continue without persistence. */
  }
}
