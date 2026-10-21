import type { PlayerGame } from "../game/view";
import type { Team } from "../game/engine";
import { tens } from "../game/engine";
import { SuitGlyph } from "./cards";

function TeamScore({ game, team }: { game: PlayerGame; team: Team }) {
  const won = tens(game, team);
  const tricks = game.tricks[team];
  return (
    <div className={`team ${team === 0 ? "us" : "them"}`}>
      <span className="team-name">{team === 0 ? "Us" : "Them"}</span>
      <span
        className="ten-slots"
        role="img"
        aria-label={`${won.length} tens captured`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`ten-slot ${won[i] ? "filled" : ""}`}>
            {won[i] && <SuitGlyph suit={won[i].suit} />}
          </span>
        ))}
      </span>
      <span className="team-tricks tnum" aria-label={`${tricks} tricks`}>
        {tricks}
        <small aria-hidden="true"> {tricks === 1 ? "trick" : "tricks"}</small>
      </span>
    </div>
  );
}

export function HukumChip({ game }: { game: PlayerGame }) {
  return (
    <div
      className={`hukum-chip ${game.trump ? "is-set" : "is-open"}`}
      key={game.trump ?? "open"}
      aria-label={game.trump ? `Hukum: ${game.trump}` : "Hukum not yet set"}
    >
      {game.trump ? (
        <SuitGlyph suit={game.trump} />
      ) : (
        <span className="hukum-empty" aria-hidden="true" />
      )}
      <span className="hukum-copy" aria-hidden="true">
        <span className="hukum-label">Hukum</span>
        <span className="hukum-value">
          {game.trump ?? (game.mode === "choose" ? "after five" : "first cut")}
        </span>
      </span>
    </div>
  );
}

export function Scoreboard({ game }: { game: PlayerGame }) {
  return (
    <div className="score">
      <TeamScore game={game} team={0} />
      <HukumChip game={game} />
      <TeamScore game={game} team={1} />
    </div>
  );
}
