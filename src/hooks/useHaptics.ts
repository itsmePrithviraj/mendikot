export const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/** Short vibrations on supporting devices; a no-op everywhere else. */
export function useHaptics(enabled: boolean) {
  return function tap(pattern: number | number[] = 8) {
    if (!enabled || !canVibrate()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* Haptics are optional. */
    }
  };
}
