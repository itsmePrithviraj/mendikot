export const PREFS_KEY = "mendikot.preferences.v1";

export interface Preferences {
  sound: boolean;
  speed: "relaxed" | "quick";
  reducedMotion: boolean;
  /** Added in the revamp; older saves lack it and default to on. */
  haptics: boolean;
}

export const DEFAULT_PREFS: Preferences = {
  sound: false,
  speed: "relaxed",
  reducedMotion: false,
  haptics: true,
};

export function readPrefs(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return {
      sound: data.sound === true,
      speed: data.speed === "quick" ? "quick" : "relaxed",
      reducedMotion: data.reducedMotion === true,
      haptics: data.haptics !== false,
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
