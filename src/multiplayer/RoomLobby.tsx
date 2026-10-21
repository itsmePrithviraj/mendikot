import { useState } from "react";
import { Check, Copy, Share2, Users } from "lucide-react";
import type { Mode, Seat } from "../game/engine";
import { ModePicker } from "../components/panels/ModePicker";
import type { RoomAction, RoomSnapshot } from "./protocol";
import { invitedRoom } from "./useRoom";

export function RoomEntry({
  busy,
  onEnter,
  onBack,
}: {
  busy: boolean;
  onEnter: (name: string, mode: Mode, code?: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(invitedRoom);
  const [mode, setMode] = useState<Mode>("cut");
  const [joining, setJoining] = useState(() => !!invitedRoom());
  return (
    <section className="room-panel" aria-labelledby="room-entry-title">
      <div className="room-intro">
        <Users size={32} strokeWidth={1.5} aria-hidden="true" />
        <h1 id="room-entry-title">A table for friends.</h1>
        <p>Four people. Two teams. Bring your own rivalry.</p>
      </div>
      <div className="room-tabs" role="group" aria-label="Room options">
        <button
          className={!joining ? "active" : ""}
          aria-pressed={!joining}
          onClick={() => setJoining(false)}
          disabled={busy}
        >
          Create a room
        </button>
        <button
          className={joining ? "active" : ""}
          aria-pressed={joining}
          onClick={() => setJoining(true)}
          disabled={busy}
        >
          Join a room
        </button>
      </div>
      <form
        className="room-form"
        onSubmit={(event) => {
          event.preventDefault();
          onEnter(name.trim(), mode, joining ? code : undefined);
        }}
      >
        <label className="room-field">
          Your name
          <input
            name="name"
            autoComplete="nickname"
            maxLength={24}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="What should we call you?"
          />
        </label>
        {joining ? (
          <label className="room-field">
            Room code
            <input
              name="code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
              minLength={8}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={busy}
              placeholder="Eight-character code"
            />
          </label>
        ) : (
          <ModePicker mode={mode} onChange={setMode} />
        )}
        <button
          className="btn btn-primary"
          disabled={busy || !name.trim()}
          type="submit"
        >
          {busy ? "Opening your table…" : joining ? "Join room" : "Create room"}
        </button>
      </form>
      <p className="room-note">
        No account needed. Share the room link with three friends.
      </p>
      <button className="btn btn-ghost" onClick={onBack} disabled={busy}>
        Back to practice
      </button>
    </section>
  );
}

export function RoomLobby({
  room,
  disabled,
  send,
  onLeave,
  onResults,
}: {
  room: RoomSnapshot;
  disabled: boolean;
  send: (action: RoomAction) => void;
  onLeave: () => void;
  onResults?: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [showLink, setShowLink] = useState(false);
  const mine = room.players.find((p) => p.id === room.yourId)!;
  const host = room.yourId === room.hostId;
  const allReady =
    room.players.length === 4 &&
    room.players.every((p) => p.ready && p.connected);
  const link = new URL(`?room=${room.code}`, location.href).href;
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({ title: "Join my Mendikot table", url: link });
      else {
        await navigator.clipboard.writeText(link);
        setNotice("Invite link copied.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setShowLink(true);
        setNotice("Copy the invite link below.");
      }
    }
  }
  return (
    <section className="room-panel lobby" aria-labelledby="lobby-title">
      <div className="room-intro">
        <h1 id="lobby-title">Your table is waiting.</h1>
        <p>Partners sit opposite. Choose an empty seat to switch teams.</p>
      </div>
      <div className="room-invite">
        <div>
          <span>Room code</span>
          <strong className="tnum">{room.code}</strong>
        </div>
        <button className="btn btn-primary" onClick={() => void share()}>
          <Share2 size={18} /> Invite friends
        </button>
      </div>
      {showLink && (
        <label className="room-field">
          Invite link
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
      )}
      <span className="room-note" role="status">
        {notice}
      </span>
      <div className="room-teams">
        {([0, 1] as const).map((team) => (
          <section key={team} aria-label={`Team ${team + 1}`}>
            <h2>Team {team + 1}</h2>
            {[team, team + 2].map((seat) => {
              const player = room.players.find((p) => p.seat === seat);
              return (
                <div
                  className={`lobby-seat${player?.id === mine.id ? " is-you" : ""}`}
                  key={seat}
                >
                  {player ? (
                    <>
                      <span className="avatar" aria-hidden="true">
                        {player.name[0]}
                      </span>
                      <div className="lobby-person">
                        <strong>
                          {player.name}
                          {player.id === mine.id ? " (you)" : ""}
                        </strong>
                        <span>
                          {!player.connected
                            ? "Reconnecting…"
                            : player.ready
                              ? "Ready"
                              : "Not ready"}
                          {player.id === room.hostId ? " · Host" : ""}
                        </span>
                      </div>
                      {player.ready && player.connected && (
                        <Check size={18} aria-label="Ready" />
                      )}
                    </>
                  ) : (
                    <button
                      disabled={disabled}
                      onClick={() => send({ type: "seat", seat: seat as Seat })}
                    >
                      Take seat {seat + 1}
                      <span>Waiting for a friend</span>
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {host ? (
        <fieldset disabled={disabled}>
          <ModePicker
            mode={room.mode}
            onChange={(mode) => send({ type: "mode", mode })}
          />
        </fieldset>
      ) : (
        <p className="room-note">
          {room.mode === "cut"
            ? "Cut hukum · first off-suit card sets trump"
            : "Choose hukum · choose after five cards"}
        </p>
      )}
      <div className="room-ready">
        <button
          className={`btn ${mine.ready ? "btn-ghost" : "btn-primary"}`}
          disabled={disabled}
          onClick={() => send({ type: "ready", ready: !mine.ready })}
        >
          {mine.ready ? "Not ready" : "Ready to play"}
        </button>
        {host && (
          <button
            className="btn btn-primary"
            disabled={disabled || !allReady}
            onClick={() => send({ type: "start" })}
          >
            Start deal
          </button>
        )}
      </div>
      <p className="room-note" role="status">
        {room.players.length < 4
          ? `${4 - room.players.length} more ${room.players.length === 3 ? "friend" : "friends"} to join.`
          : allReady
            ? host
              ? "Everyone is ready. Deal when you are."
              : "Everyone is ready. Waiting for the host to deal."
            : "All four players must be connected and ready."}
      </p>
      <div className="room-footer">
        {onResults && (
          <button className="btn btn-ghost" onClick={onResults}>
            See results
          </button>
        )}
        <button className="btn btn-ghost" onClick={onLeave} disabled={disabled}>
          Leave room
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(room.code).then(
              () => setNotice("Room code copied."),
              () => setNotice(`Room code: ${room.code}`),
            );
          }}
          aria-label="Copy room code"
        >
          <Copy size={18} />
        </button>
      </div>
    </section>
  );
}
