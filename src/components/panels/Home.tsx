import type { Mode } from "../../game/engine";
import { CardBack, CardFace } from "../cards";
import { ModePicker } from "./ModePicker";

const HERO = { id: "hearts-10", rank: 10, suit: "hearts" } as const;

/** The start screen: play solo against bots, or create or join a room. */
export function Home({
  mode,
  resume,
  onMode,
  onSolo,
  onCreate,
  onJoin,
}: {
  mode: Mode;
  /** A solo deal is in progress on this device. */
  resume: boolean;
  onMode: (mode: Mode) => void;
  onSolo: () => void;
  onCreate: () => void;
  onJoin: () => void;
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
        <section className="home-group" aria-labelledby="solo-title">
          <h2 id="solo-title">Solo · you and 3 bots</h2>
          {!resume && <ModePicker mode={mode} onChange={onMode} />}
          <button className="btn btn-primary start-btn" onClick={onSolo}>
            {resume ? "Continue solo game" : "Play solo"}
          </button>
        </section>
        <section className="home-group" aria-labelledby="friends-title">
          <h2 id="friends-title">With friends</h2>
          <div className="home-rooms">
            <button className="btn btn-ghost" onClick={onCreate}>
              Create a room
            </button>
            <button className="btn btn-ghost" onClick={onJoin}>
              Join a room
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
