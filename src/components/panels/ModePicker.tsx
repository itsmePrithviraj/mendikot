import type { Mode } from "../../game/engine";

const OPTIONS: { mode: Mode; title: string; detail: string }[] = [
  { mode: "cut", title: "Cut hukum", detail: "First off-suit card becomes trump" },
  { mode: "choose", title: "Choose hukum", detail: "Five cards each, then choose" },
];

export function ModePicker({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <fieldset className="mode-picker">
      <legend>How is hukum set?</legend>
      {OPTIONS.map((o) => (
        <label key={o.mode} className={`mode-option${mode === o.mode ? " active" : ""}`}>
          <input
            type="radio"
            name="mode"
            value={o.mode}
            checked={mode === o.mode}
            onChange={() => onChange(o.mode)}
          />
          <span className="mode-dot" aria-hidden="true" />
          <span className="mode-copy">
            <strong>{o.title}</strong>
            <small>{o.detail}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
