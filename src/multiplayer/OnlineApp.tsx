import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { CardDefs } from "../components/cards";
import { TopBar } from "../components/TopBar";
import { Scoreboard } from "../components/Scoreboard";
import { Table } from "../components/Table";
import { Hand } from "../components/Hand";
import { ActionBar } from "../components/ActionBar";
import { Sheet } from "../components/sheets/Sheet";
import { RulesSheet } from "../components/sheets/RulesSheet";
import { LastTrickSheet } from "../components/sheets/LastTrickSheet";
import { MenuSheet } from "../components/sheets/MenuSheet";
import { InstallSheet } from "../components/sheets/InstallSheet";
import { Toasts } from "../components/Toasts";
import { useSound } from "../hooks/useSound";
import { canHaptic, canSwitchTick, useHaptics } from "../hooks/useHaptics";
import {
  canFullscreen,
  toggleFullscreen,
  useSystemFlags,
} from "../hooks/useSystemFlags";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import type { PlayerGame } from "../game/view";
import { readPrefs, writePrefs } from "../state/prefs";
import { TableIdentity } from "../state/tableIdentity";
import { statusOf } from "../state/status";
import { RoomEntry, RoomLobby } from "./RoomLobby";
import { useRoom } from "./useRoom";

export function OnlineApp({ onBack }: { onBack: () => void }) {
  const client = useRoom();
  const { room, code, connection, pending, busy, error, send } = client;
  const [sheet, setSheet] = useState<
    "rules" | "menu" | "last" | "room" | "install" | null
  >(null);
  const [prefs, setPrefs] = useState(readPrefs);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [dealing, setDealing] = useState(false);
  const previous = useRef<PlayerGame | null>(null);
  const game = room?.game ?? null;
  const { offline, fullscreen, systemReduced } = useSystemFlags();
  const reduced = prefs.reducedMotion || systemReduced;
  const sound = useSound(prefs.sound, prefs.volume);
  const tap = useHaptics(prefs.haptics);
  const install = useInstallPrompt(() => setSheet(null));
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const active = !!game && game.phase !== "complete";
  const showTable = !!game && (active || showResults);
  const disabled = connection !== "connected" || pending;
  const everyoneHere =
    room?.players.length === 4 && room.players.every((p) => p.connected);
  const legal = new Set(game?.legalCardIds ?? []);
  const myTurn =
    !!game &&
    game.phase === "playing" &&
    game.turn === 0 &&
    !disabled &&
    everyoneHere &&
    !dealing;
  const canPlay = myTurn && !!selected && legal.has(selected);
  const names = [0, 1, 2, 3].map(
    (relative) =>
      room?.players.find((p) => p.seat === (room.yourSeat + relative) % 4)
        ?.name ?? "Empty seat",
  );
  names[0] = "You";
  const connected = [0, 1, 2, 3].map(
    (relative) =>
      !!room?.players.find((p) => p.seat === (room.yourSeat + relative) % 4)
        ?.connected,
  );

  useEffect(() => writePrefs(prefs), [prefs]);
  useEffect(() => {
    if (!game) {
      previous.current = null;
      return;
    }
    const old = previous.current;
    if (!old || game.id !== old.id) setShowResults(true);
    if (
      (!old || old.id !== game.id || game.hand.length > old.hand.length) &&
      game.phase !== "complete"
    ) {
      setDealing(true);
      soundRef.current("deal");
    } else if (old?.id === game.id) {
      if (game.trick.length > old.trick.length) soundRef.current("place");
      if (game.tricks[0] + game.tricks[1] > old.tricks[0] + old.tricks[1])
        soundRef.current("collect");
    }
    previous.current = game;
    setSelected((card) =>
      card && game.hand.some((c) => c.id === card) ? card : null,
    );
  }, [game]);
  useEffect(() => {
    if (!dealing) return;
    const timeout = setTimeout(() => setDealing(false), reduced ? 100 : 950);
    return () => clearTimeout(timeout);
  }, [dealing, reduced]);

  function back() {
    client.forget();
    onBack();
  }
  function leave() {
    if (
      active &&
      !window.confirm(
        "Leave this room? The current deal will end for everyone without a winner.",
      )
    )
      return;
    send({ type: "leave" });
    setSheet(null);
  }
  function play() {
    if (!canPlay || !selected) return;
    send({ type: "play", cardId: selected });
    setSelected(null);
    tap(12);
  }
  const status = statusOf(game, dealing ? "deal" : "ready", names);
  if (connection !== "connected") {
    status.text =
      connection === "replaced"
        ? "Your seat is open in another tab."
        : "Reconnecting… Your seat is reserved.";
    status.mine = false;
    delete status.suit;
  } else if (!everyoneHere) {
    status.text = "Waiting for a friend to reconnect · up to 2 minutes";
    status.mine = false;
    delete status.suit;
  } else if (pending) {
    status.text = "Confirming your action…";
    status.mine = false;
    delete status.suit;
  } else if (error) {
    status.text = error;
    status.mine = false;
    delete status.suit;
  }

  return (
    <TableIdentity.Provider value={{ names, online: true, connected }}>
      <div
        className={`app online-app${reduced ? " reduce-motion" : ""}`}
        data-screen={showTable ? "game" : "room"}
        data-phase={game?.phase}
        data-stage={dealing ? "deal" : "ready"}
        data-room-revision={room?.revision}
        data-connection={connection}
      >
        <CardDefs />
        <TopBar
          offline={offline}
          onHelp={() => setSheet("rules")}
          onMenu={() => setSheet("menu")}
        />
        <main
          className="table"
          aria-label={showTable ? "Mendikot game table" : "Play with friends"}
        >
          {showTable && game ? (
            <>
              <Scoreboard game={game} />
              <Table
                game={game}
                stage={dealing ? "deal" : "ready"}
                status={status}
                interactionDisabled={disabled || !everyoneHere}
                onChoose={(suit) => {
                  if (!disabled && everyoneHere) send({ type: "trump", suit });
                }}
                onAgain={() => setShowResults(false)}
                onChangeMode={() => setShowResults(false)}
                onLastTrick={() => setSheet("last")}
                resultActions={
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowResults(false)}
                  >
                    Return to room for a rematch
                  </button>
                }
              />
              <Hand
                cards={game.hand}
                legal={legal}
                myTurn={myTurn}
                selected={selected}
                disabled={!myTurn}
                dealing={dealing}
                shaking={null}
                canPlay={canPlay}
                haptic={prefs.haptics && canSwitchTick()}
                onSelect={(card) => {
                  if (!legal.has(card.id)) {
                    client.setError("Follow the suit that was led.");
                    tap(10);
                    return;
                  }
                  client.setError("");
                  setSelected((old) => (old === card.id ? null : card.id));
                  sound("select");
                }}
                onPlay={play}
              />
              <ActionBar
                phase={
                  game.phase === "choosing-trump"
                    ? "choosing"
                    : game.phase === "complete"
                      ? "complete"
                      : "playing"
                }
                canPlay={canPlay}
                haptic={prefs.haptics && canSwitchTick()}
                onPlay={play}
              />
            </>
          ) : (
            <div className="room-scroll">
              {error && (
                <p className="room-alert" role="alert">
                  {error}
                </p>
              )}
              {room?.endedReason && (
                <p className="room-alert" role="status">
                  {room.endedReason}
                </p>
              )}
              {room ? (
                <>
                  {connection !== "connected" && (
                    <p className="room-note" role="status">
                      {connection === "replaced"
                        ? "This seat is active in another tab."
                        : "Reconnecting to your table…"}
                    </p>
                  )}
                  <RoomLobby
                    room={room}
                    disabled={disabled}
                    send={send}
                    onLeave={leave}
                    onResults={
                      game?.phase === "complete"
                        ? () => setShowResults(true)
                        : undefined
                    }
                  />
                  {connection === "replaced" && (
                    <button className="btn btn-ghost" onClick={back}>
                      Back to practice
                    </button>
                  )}
                </>
              ) : code ? (
                <section className="room-panel">
                  <h1>Opening your table…</h1>
                  <p role="status">
                    {connection === "reconnecting"
                      ? "Cannot reach the room. Retrying…"
                      : "Connecting to your room."}
                  </p>
                  <button className="btn btn-ghost" onClick={back}>
                    Back to practice
                  </button>
                </section>
              ) : (
                <RoomEntry
                  busy={busy}
                  onEnter={(name, mode, code) =>
                    void client.enter(name, mode, code)
                  }
                  onBack={back}
                />
              )}
            </div>
          )}
        </main>
        <Toasts
          saveError={false}
          needRefresh={needRefresh && !active}
          onUpdate={() => void updateServiceWorker(true)}
        />
        <Sheet
          open={!!sheet}
          title={
            sheet === "rules"
              ? "Bring the tens home."
              : sheet === "last"
                ? "Last trick"
                : sheet === "room"
                  ? "Around the table"
                  : sheet === "install"
                    ? "A seat on your home screen."
                    : "Make yourself comfortable."
          }
          onClose={() => setSheet(null)}
        >
          {sheet === "rules" && <RulesSheet />}
          {sheet === "last" && game && <LastTrickSheet game={game} />}
          {sheet === "install" && <InstallSheet />}
          {sheet === "menu" && (
            <MenuSheet
              prefs={prefs}
              setPrefs={(update) => setPrefs((p) => ({ ...p, ...update }))}
              haptics={canHaptic()}
              fullscreen={fullscreen}
              canFullscreen={canFullscreen()}
              hasGame={!!room}
              online
              onFullscreen={() => void toggleFullscreen()}
              onInstall={async () => {
                if (!(await install())) setSheet("install");
              }}
              onNewDeal={() => setSheet("room")}
              onRules={() => setSheet("rules")}
              onVolumePreview={() => sound("place")}
            />
          )}
          {sheet === "room" && room && (
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
                A disconnected seat is held for two minutes. Play pauses until
                everyone returns. Leaving during a deal ends it for everyone.
              </p>
              {error && <p role="alert">{error}</p>}
              {connection === "replaced" ? (
                <button className="btn btn-quiet" onClick={back}>
                  Back to practice
                </button>
              ) : (
                <button
                  className="btn btn-quiet"
                  disabled={disabled}
                  onClick={leave}
                >
                  <LogOut size={18} /> Leave room
                </button>
              )}
            </>
          )}
        </Sheet>
      </div>
    </TableIdentity.Provider>
  );
}
