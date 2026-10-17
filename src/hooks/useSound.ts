import { useEffect } from "react";

/**
 * Recorded card foley from Kenney's "Casino Audio" (CC0), trimmed to the first
 * transient and levelled; see public/sounds. Several takes per sound so a run
 * of plays never repeats the same one.
 */
const SOUNDS = {
  select: { files: ["slide-1", "slide-2", "slide-3"], volume: 0.3 },
  place: { files: ["place-1", "place-2", "place-3", "place-4"], volume: 0.75 },
  collect: { files: ["shove-1", "shove-2"], volume: 0.5 },
  deal: { files: ["fan"], volume: 0.55 },
  shuffle: { files: ["shuffle"], volume: 0.6 },
} satisfies Record<string, { files: string[]; volume: number }>;
export type Sound = keyof typeof SOUNDS;

/** A sound still loading after this long would land late; skip it instead. */
const STALE_MS = 150;
const UNLOCK_EVENTS = ["pointerdown", "touchend", "keydown"] as const;

let audio: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const lastTake = new Map<Sound, number>();

const context = () => (audio ??= new AudioContext());

function load(file: string) {
  let buffer = buffers.get(file);
  if (!buffer) {
    buffer = fetch(`${import.meta.env.BASE_URL}sounds/${file}.m4a`)
      .then((response) => response.arrayBuffer())
      .then((data) => context().decodeAudioData(data))
      .catch(() => {
        buffers.delete(file);
        return null;
      });
    buffers.set(file, buffer);
  }
  return buffer;
}

function playSound(sound: Sound) {
  const { files, volume } = SOUNDS[sound];
  let take = Math.floor(Math.random() * files.length);
  if (files.length > 1 && take === lastTake.get(sound)) take = (take + 1) % files.length;
  lastTake.set(sound, take);
  const ctx = context();
  void ctx.resume().catch(() => {});
  const asked = performance.now();
  void load(files[take]).then((buffer) => {
    if (!buffer || performance.now() - asked > STALE_MS) return;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
  });
}

/** Real card sounds. Silent unless enabled; failures are ignored. */
export function useSound(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    try {
      for (const { files } of Object.values(SOUNDS)) files.forEach(load);
    } catch {
      /* Sound is optional. */
    }
    // Browsers (iOS above all) keep audio locked until a gesture resumes it,
    // and bot plays arrive on timers, so resume on the first touch anywhere.
    const unlock = () => {
      void audio
        ?.resume()
        .then(() => {
          if (audio?.state === "running") release();
        })
        .catch(() => {});
    };
    const release = () =>
      UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, unlock, true));
    UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, unlock, true));
    return release;
  }, [enabled]);
  return function sound(name: Sound) {
    if (!enabled) return;
    try {
      playSound(name);
    } catch {
      /* Sound is optional. */
    }
  };
}
