import { ArrowRight } from "lucide-react";
import type { Mode } from "../../game/engine";
import { CardBack, CardFace } from "../cards";
import { ModePicker } from "./ModePicker";

const HERO = { id: "hearts-10", rank: 10, suit: "hearts" } as const;

export function Home({
  mode,
  onMode,
  onStart,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  onStart: () => void;
}) {
  return (
    <section className="home" aria-labelledby="home-title">
      <div className="home-hero">
        <div className="hero-cards" aria-hidden="true">
          <CardBack />
          <CardFace card={HERO} />
          <CardBack />
        </div>
        <div className="home-copy">
          <h1 id="home-title">
            Four tens.
            <br />
            <em>One lovely rivalry.</em>
          </h1>
          <p>Follow suit, trust your partner, bring the sheep home.</p>
        </div>
      </div>
      <div className="home-controls">
        <ModePicker mode={mode} onChange={onMode} />
        <button className="btn btn-primary start-btn" onClick={onStart}>
          Take your seat <ArrowRight strokeWidth={2} />
        </button>
        <p className="home-note">Practice table · you + 3 bots · nothing to sign up for</p>
      </div>
    </section>
  );
}
