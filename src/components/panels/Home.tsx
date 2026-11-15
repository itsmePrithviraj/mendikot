import type { Mode } from "../../game/engine";
import { CardBack, CardFace } from "../cards";
import { ModePicker } from "./ModePicker";

const HERO = { id: "hearts-10", rank: 10, suit: "hearts" } as const;

export function Home({
  mode,
  onMode,
  onStart,
  onOnline,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  onStart: () => void;
  onOnline: () => void;
}) {
  return (
    <section className="home" aria-labelledby="home-title">
      <div className="home-hero">
        <div className="hero-cards" aria-hidden="true">
          <CardBack />
          <CardFace card={HERO} />
          <CardBack />
        </div>
        <h1 id="home-title">Capture the tens.</h1>
      </div>
      <div className="home-controls">
        <ModePicker mode={mode} onChange={onMode} />
        <button className="btn btn-primary start-btn" onClick={onStart}>
          Practice with bots
        </button>
        <button className="btn btn-ghost online-entry-btn" onClick={onOnline}>
          Play with friends
        </button>
      </div>
    </section>
  );
}
