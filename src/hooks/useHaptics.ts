export const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/**
 * iOS has no Vibration API. Its only web haptic is the tick a native
 * `<input type="checkbox" switch>` plays when a finger toggles it, and since
 * iOS 26.5 script-driven clicks no longer count — the tap must land on the
 * switch itself. See HapticSwitch.
 */
export const canSwitchTick = () =>
  !canVibrate() &&
  typeof HTMLInputElement !== "undefined" &&
  "switch" in HTMLInputElement.prototype &&
  matchMedia("(pointer: coarse)").matches;

export const canHaptic = () => canVibrate() || canSwitchTick();

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
