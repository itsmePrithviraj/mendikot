import {
  ArrowDownToLine,
  CircleHelp,
  Maximize2,
  Minimize2,
  RotateCcw,
  Vibrate,
  Volume2,
  Wind,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { canVibrate } from "../../hooks/useHaptics";
import type { Preferences } from "../../state/prefs";

function Switch({
  icon,
  label,
  detail,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="menu-row">
      <span className="menu-icon">{icon}</span>
      <span className="menu-copy">
        {label}
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function Action({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="menu-row menu-action"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="menu-icon">{icon}</span>
      <span className="menu-copy">{label}</span>
    </button>
  );
}

export function MenuSheet({
  prefs,
  setPrefs,
  haptics,
  fullscreen,
  canFullscreen,
  hasGame,
  onFullscreen,
  onInstall,
  onNewDeal,
  onRules,
  onVolumePreview,
}: {
  prefs: Preferences;
  setPrefs: (update: Partial<Preferences>) => void;
  haptics: boolean;
  fullscreen: boolean;
  canFullscreen: boolean;
  hasGame: boolean;
  onFullscreen: () => void;
  onInstall: () => void;
  onNewDeal: () => void;
  onRules: () => void;
  onVolumePreview: () => void;
}) {
  const s = 20;
  return (
    <>
      <div className="menu-group">
        <Switch
          icon={<Volume2 size={s} strokeWidth={1.75} />}
          label="Card sounds"
          detail="Cards slide, snap and shuffle"
          checked={prefs.sound}
          onChange={(sound) => setPrefs({ sound })}
        />
        {prefs.sound && (
          <label className="menu-row volume-row">
            <span className="menu-copy">
              Volume
              <small>{Math.round(prefs.volume * 100)}%</small>
            </span>
            <input
              type="range"
              className="volume"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              style={{ "--fill": `${prefs.volume * 100}%` } as CSSProperties}
              onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
              // Play a card once the level settles rather than on every step of a drag.
              onPointerUp={onVolumePreview}
              onKeyUp={onVolumePreview}
            />
          </label>
        )}
        {haptics && (
          <Switch
            icon={<Vibrate size={s} strokeWidth={1.75} />}
            label="Haptics"
            detail={
              canVibrate()
                ? "A light tap on play and capture"
                : "A light tap when you play"
            }
            checked={prefs.haptics}
            onChange={(on) => setPrefs({ haptics: on })}
          />
        )}
        <Switch
          icon={<Wind size={s} strokeWidth={1.75} />}
          label="Less motion"
          detail="Fades instead of flying cards"
          checked={prefs.reducedMotion}
          onChange={(reducedMotion) => setPrefs({ reducedMotion })}
        />
        <div className="menu-row pace-row">
          <span className="menu-copy">
            Table pace
            <small>Time between bot turns</small>
          </span>
          <div className="segmented" role="radiogroup" aria-label="Table pace">
            {(["relaxed", "quick"] as const).map((speed) => (
              <label
                key={speed}
                className={prefs.speed === speed ? "active" : ""}
              >
                <input
                  type="radio"
                  name="pace"
                  value={speed}
                  checked={prefs.speed === speed}
                  onChange={() => setPrefs({ speed })}
                />
                {speed === "relaxed" ? "Relaxed" : "Quick"}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="menu-group">
        <Action
          icon={<RotateCcw size={s} strokeWidth={1.75} />}
          label="New deal"
          onClick={onNewDeal}
          disabled={!hasGame}
        />
        <Action
          icon={<CircleHelp size={s} strokeWidth={1.75} />}
          label="How to play"
          onClick={onRules}
        />
        {canFullscreen && (
          <Action
            icon={
              fullscreen ? (
                <Minimize2 size={s} strokeWidth={1.75} />
              ) : (
                <Maximize2 size={s} strokeWidth={1.75} />
              )
            }
            label={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={onFullscreen}
          />
        )}
        <Action
          icon={<ArrowDownToLine size={s} strokeWidth={1.75} />}
          label="Install app"
          onClick={onInstall}
        />
      </div>
      <p className="small-print">
        Turn your phone any time. Your game stays exactly where it is. Device
        motion preferences are also respected.
      </p>
    </>
  );
}
