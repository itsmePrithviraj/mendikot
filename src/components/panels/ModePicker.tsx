import type { Mode } from "../../game/engine";

const OPTIONS: { mode: Mode; title: string; detail: string }[] = [
  {
    mode: "cut",
    title: "Cut hukum",
    detail: "The first off-suit card played becomes hukum.",
  },
  {
    mode: "choose",
    title: "Choose hukum",
    detail: "Hukum is named after the first five cards.",
  },
];

/** Two-way segmented choice; only the selected mode's rule is spelled out. */
export function ModePicker({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  const detail = OPTIONS.find((o) => o.mode === mode)!.detail;
  return (
    <fieldset className="mode-picker">
      <legend className="sr-only">How hukum is set</legend>
      <div className="mode-options">
        {OPTIONS.map((o) => (
          <label
            key={o.mode}
            className={`mode-option${mode === o.mode ? " active" : ""}`}
          >
            <input
              type="radio"
              name="mode"
              value={o.mode}
              checked={mode === o.mode}
              onChange={() => onChange(o.mode)}
            />
            {o.title}
          </label>
        ))}
      </div>
      <p className="mode-detail">{detail}</p>
    </fieldset>
  );
}
