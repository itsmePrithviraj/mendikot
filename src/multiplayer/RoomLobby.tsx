import { useState } from "react";
import { Check, Copy, LogOut, Share2 } from "lucide-react";
import type { Mode, Seat } from "../game/engine";
import { ModePicker } from "../components/panels/ModePicker";
import type { RoomAction, RoomSnapshot } from "./protocol";
import { invitedRoom } from "./useRoom";

/** Create-or-join form shown before the player has a seat. */
export function RoomEntry({
  busy,
  notice,
  onEnter,
  onEdit,
  onBack,
}: {
  busy: boolean;
  /** A confirmation such as "You left room ABCD2345." */
  notice: string;
  /** New rooms start in cut hukum; the host can change it in the lobby. */
  onEnter: (name: string, mode: Mode, code?: string) => void;
  /** Called when the player edits the form, to clear a stale error. */
  onEdit: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(invitedRoom);
  const [joining, setJoining] = useState(() => !!invitedRoom());
  return (
    <section className="room-panel" aria-labelledby="room-entry-title">
      {notice && (
        <p className="room-alert" role="status">
          {notice}
        </p>
      )}
      <h1 id="room-entry-title">Play with friends</h1>
      <div className="room-tabs" role="group" aria-label="Room options">
        <button
          className={!joining ? "active" : ""}
          aria-pressed={!joining}
          onClick={() => {
            setJoining(false);
            onEdit();
          }}
          disabled={busy}
        >
          New room
        </button>
        <button
          className={joining ? "active" : ""}
          aria-pressed={joining}
          onClick={() => {
            setJoining(true);
            onEdit();
          }}
          disabled={busy}
        >
          Join with code
        </button>
      </div>
      <form
        className="room-form"
        onChange={onEdit}
        onSubmit={(event) => {
          event.preventDefault();
          onEnter(name.trim(), "cut", joining ? code : undefined);
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
          />
        </label>
        {joining && (
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
            />
          </label>
        )}
        <button
          className="btn btn-primary"
          disabled={busy || !name.trim()}
          type="submit"
        >
          {busy ? "Opening…" : joining ? "Join room" : "Create room"}
        </button>
      </form>
      <button className="btn-link room-back" onClick={onBack} disabled={busy}>
        Back to practice
      </button>
    </section>
  );
}

/** "Mira", "Mira and Rohan", "Dev, Mira and Rohan". */
function listNames(names: string[]) {
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The waiting room between deals: invitations, seats, mode and readiness. */
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
  const hostName = room.players.find((p) => p.id === room.hostId)?.name;
  const allReady =
    room.players.length === 4 &&
    room.players.every((p) => p.ready && p.connected);
  const link = new URL(`?room=${room.code}`, location.href).href;
  const who = (p: { id: string; name: string }) =>
    p.id === mine.id ? "you" : p.name;
  const away = room.players.filter((p) => !p.connected).map(who);
  const unready = room.players.filter((p) => !p.ready).map(who);
  const missing = 4 - room.players.length;
  const waiting =
    missing > 0
      ? `Waiting for ${missing} more ${missing === 1 ? "player" : "players"}`
      : away.length
        ? `Waiting for ${listNames(away)} to reconnect`
        : unready.length
          ? `Waiting for ${listNames(unready)} to get ready`
          : host
            ? "Everyone’s ready."
            : `Everyone’s ready. ${hostName ?? "The host"} deals.`;
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
      <h1 id="lobby-title" className="sr-only">
        Room {room.code}
      </h1>
      <div className="room-invite">
        <div className="room-code">
          <span>Room</span>
          <strong className="tnum">{room.code}</strong>
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
        <button
          className={`btn ${room.players.length < 4 ? "btn-primary" : "btn-ghost"}`}
          onClick={() => void share()}
        >
          <Share2 size={18} /> Invite
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
          <section
            key={team}
            aria-label={mine.seat % 2 === team ? "Your team" : "Opponents"}
          >
            <h2>{mine.seat % 2 === team ? "Your team" : "Opponents"}</h2>
            {[team, team + 2].map((seat) => {
              const player = room.players.find((p) => p.seat === seat);
              return (
                <div
                  className={`lobby-seat${player?.id === mine.id ? " is-you" : ""}${player?.ready && player.connected ? " is-ready" : ""}`}
                  key={seat}
                >
                  {player ? (
                    <>
                      <span className="avatar" aria-hidden="true">
                        {player.ready && player.connected ? (
                          <Check size={16} strokeWidth={2.5} />
                        ) : (
                          player.name[0]
                        )}
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
                    </>
                  ) : (
                    <button
                      disabled={disabled}
                      onClick={() => send({ type: "seat", seat: seat as Seat })}
                      aria-label={`Sit in seat ${seat + 1}`}
                    >
                      <span className="avatar empty" aria-hidden="true" />
                      Sit here
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
        <p className="room-mode">
          <strong>{room.mode === "cut" ? "Cut hukum" : "Choose hukum"}</strong>{" "}
          ·{" "}
          {room.mode === "cut"
            ? "the first off-suit card played becomes hukum"
            : "hukum is named after the first five cards"}
        </p>
      )}
      <div className="room-ready">
        <p className="room-waiting" role="status">
          {waiting}
        </p>
        <div className="room-ready-actions">
          {!mine.ready ? (
            <button
              className="btn btn-primary"
              disabled={disabled}
              onClick={() => send({ type: "ready", ready: true })}
            >
              Ready to play
            </button>
          ) : (
            <>
              <button
                className="btn btn-ghost"
                disabled={disabled}
                onClick={() => send({ type: "ready", ready: false })}
              >
                Undo ready
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
            </>
          )}
        </div>
      </div>
      <div className="room-footer">
        <button className="btn-link" onClick={onLeave} disabled={disabled}>
          Leave room
        </button>
        {onResults && (
          <button className="btn-link" onClick={onResults}>
            See results
          </button>
        )}
      </div>
    </section>
  );
}

/** The "Room & players" sheet available from the menu during a deal. */
export function RoomDetails({
  room,
  error,
  replaced,
  disabled,
  onLeave,
  onBack,
}: {
  room: RoomSnapshot;
  error: string;
  /** This tab lost the seat to another tab. */
  replaced: boolean;
  disabled: boolean;
  onLeave: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <p>
        Room <strong>{room.code}</strong> ·{" "}
        {room.mode === "cut" ? "Cut hukum" : "Choose hukum"}
      </p>
      <ul className="room-player-list">
        {room.players.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong>
            <span>
              Team {(p.seat % 2) + 1} ·{" "}
              {p.connected ? "Connected" : "Reconnecting"}
            </span>
          </li>
        ))}
      </ul>
      <p className="small-print">
        A disconnected seat is held for two minutes. Play pauses until everyone
        returns. Leaving during a deal ends it for everyone.
      </p>
      {error && <p role="alert">{error}</p>}
      {replaced ? (
        <button className="btn btn-quiet" onClick={onBack}>
          Back to practice
        </button>
      ) : (
        <button className="btn btn-quiet" disabled={disabled} onClick={onLeave}>
          <LogOut size={18} /> Leave room
        </button>
      )}
    </>
  );
}
