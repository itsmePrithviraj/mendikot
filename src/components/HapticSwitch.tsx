// `switch` is WebKit-only and missing from React's input attribute types.
const SWITCH = { switch: "" } as Record<string, string>;

/**
 * An invisible native switch laid over its parent button so a real tap toggles
 * it and iOS plays its haptic tick. The click bubbles on to the button, so the
 * button's own handler still runs. The switch must keep its native appearance;
 * stripping it also strips the haptic.
 */
export function HapticSwitch({ disabled }: { disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      {...SWITCH}
      className="haptic-switch"
      tabIndex={-1}
      aria-hidden="true"
      disabled={disabled}
    />
  );
}
