import { useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { CardDefs } from "./components/cards";
import { ActionBar } from "./components/ActionBar";
import { Hand } from "./components/Hand";
import { Home } from "./components/panels/Home";
import { Scoreboard } from "./components/Scoreboard";
import { InstallSheet } from "./components/sheets/InstallSheet";
import { LastTrickSheet } from "./components/sheets/LastTrickSheet";
import { MenuSheet } from "./components/sheets/MenuSheet";
import { NewDealSheet } from "./components/sheets/NewDealSheet";
import { RulesSheet } from "./components/sheets/RulesSheet";
import { Sheet } from "./components/sheets/Sheet";
import { Table } from "./components/Table";
import { Toasts } from "./components/Toasts";
import { TopBar } from "./components/TopBar";
import {
  botTrump,
  chooseBotCard,
  chooseTrump,
  collectTrick,
  legalCards,
  newGame,
  nextSeat,
  playCard,
  teamOf,
  winnerOf,
} from "./game/engine";
import type { Card, Game, Mode, Suit } from "./game/engine";
import { playerGame } from "./game/view";
import { canHaptic, canSwitchTick, useHaptics } from "./hooks/useHaptics";
import { useInstallPrompt } from "./hooks/useInstallPrompt";
import { useSound } from "./hooks/useSound";
import {
  canFullscreen,
  toggleFullscreen,
  useSystemFlags,
} from "./hooks/useSystemFlags";
import { readPrefs, writePrefs } from "./state/prefs";
import type { Preferences } from "./state/prefs";
import { readGame, writeGame } from "./state/save";
import { statusOf } from "./state/status";
import type { RoomIntent } from "./multiplayer/RoomLobby";
import type { Stage, Status } from "./state/status";

type SheetKind = "rules" | "menu" | "new" | "install" | "last" | null;

/** Set while this tab shows a solo deal, so a reload returns to it while a
 * fresh visit opens on the start screen. */
const SCREEN_KEY = "mendikot.screen";
function resumeInThisTab() {
  try {
    return sessionStorage.getItem(SCREEN_KEY) === "game";
  } catch {
    return false;
  }
}

const SHEET_TITLES: Record<Exclude<SheetKind, null>, string> = {
  rules: "How to play",
  menu: "Menu",
  new: "New deal",
  install: "Install Mendikot",
  last: "Last sheep",
};

/** Offline practice: one human and three bots, saved on this device. */
/** The start screen and offline solo play: one human and three bots, saved on this device. */
export function PracticeApp({
  onOnline,
}: {
  onOnline: (intent: RoomIntent) => void;
}) {
  const [game, setGame] = useState<Game | null>(readGame),
    [mode, setMode] = useState<Mode>(() => readGame()?.mode ?? "cut"),
    [selected, setSelected] = useState<string | null>(null),
    [stage, setStage] = useState<Stage>("ready"),
    [sheet, setSheet] = useState<SheetKind>(null),
    [prefs, setPrefsState] = useState(readPrefs),
    [saveError, setSaveError] = useState(false),
    [atHome, setAtHome] = useState(() => !readGame() || !resumeInThisTab()),
    // `n` counts refused taps so the same card shakes again on every tap.
    [hint, setHint] = useState<{
      id: string;
      n: number;
      status: Status;
    } | null>(null);
  const { offline, visible, fullscreen, systemReduced } = useSystemFlags();
  const install = useInstallPrompt(() => setSheet(null));
  const sound = useSound(prefs.sound, prefs.volume);
  const tap = useHaptics(prefs.haptics);
  const switchTicks = prefs.haptics && canSwitchTick();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const reduced = prefs.reducedMotion || systemReduced;
  const available = useMemo(() => (game ? legalCards(game, 0) : []), [game]);
  const legal = useMemo(() => new Set(available.map((c) => c.id)), [available]);
  const canPlay = !!selected && legal.has(selected) && stage === "ready";
  const playing = game?.phase === "playing",
    myTurn = !!game && playing && game.turn === 0 && stage === "ready";
  const setPrefs = (update: Partial<Preferences>) =>
    setPrefsState((p) => ({ ...p, ...update }));

  useEffect(() => {
    if (game) setSaveError(!writeGame(game));
  }, [game]);
  useEffect(() => writePrefs(prefs), [prefs]);
  useEffect(() => {
    try {
      sessionStorage.setItem(SCREEN_KEY, game && !atHome ? "game" : "home");
    } catch {
      /* Reloads simply open on the start screen. */
    }
  }, [game, atHome]);
  useEffect(() => {
    if (stage === "ready") return;
    const timer = setTimeout(
      () => setStage(stage === "shuffle" ? "deal" : "ready"),
      reduced ? 80 : stage === "shuffle" ? 850 : 1250,
    );
    return () => clearTimeout(timer);
  }, [stage, reduced]);
  useEffect(() => {
    if (stage === "deal") sound("deal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // Bot turns and trick collection. Timings are unchanged from the original
  // table; CSS --pace-hold mirrors the trick-complete wait.
  useEffect(() => {
    if (!game || atHome || stage !== "ready" || sheet || !visible) return;
    let callback: (() => void) | null = null;
    let wait = prefs.speed === "quick" ? 430 : 1100;
    if (game.phase === "trick-complete") {
      callback = () => {
        setGame(collectTrick(game));
        setSelected(null);
        sound("collect");
      };
      wait = prefs.speed === "quick" ? 850 : 1700;
    } else if (game.turn !== 0 && game.phase === "choosing-trump") {
      callback = () => {
        setGame(chooseTrump(game, game.turn, botTrump(game.hands[game.turn])));
        setStage("deal");
      };
      wait = 1700;
    } else if (game.turn !== 0 && game.phase === "playing") {
      callback = () => {
        setGame(playCard(game, game.turn, chooseBotCard(game).id));
        sound("place");
      };
    }
    if (!callback) return;
    const timer = setTimeout(callback, wait);
    return () => clearTimeout(timer);
    // Timers depend on game identity; rotating never changes game state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, atHome, stage, sheet, visible, prefs.speed, prefs.sound]);
  // A small celebratory buzz when our side takes a trick.
  const trickWinner =
    game?.phase === "trick-complete" ? winnerOf(game.trick, game.trump) : null;
  useEffect(() => {
    if (trickWinner !== null && teamOf(trickWinner) === 0) tap([10, 40, 10]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trickWinner]);
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 1400);
    return () => clearTimeout(timer);
  }, [hint]);

  function start(nextMode = mode) {
    setMode(nextMode);
    setGame(newGame(undefined, game ? nextSeat(game.dealer) : 3, nextMode));
    setSelected(null);
    setStage("shuffle");
    setSheet(null);
    setAtHome(false);
    sound("shuffle");
  }
  function play() {
    if (!game || !canPlay || !selected) return;
    setGame(playCard(game, 0, selected));
    setSelected(null);
    setHint(null);
    sound("place");
    tap(12);
  }
  function select(card: Card) {
    if (myTurn && !legal.has(card.id) && game?.trick.length) {
      const led = game.trick[0].card.suit;
      setHint((old) => ({
        id: card.id,
        n: (old?.n ?? 0) + 1,
        status: { text: "Follow", suit: led, mine: true },
      }));
      setSelected(null);
      tap(10);
      return;
    }
    setSelected(selected === card.id ? null : card.id);
    sound("select");
  }
  function setTrump(suit: Suit) {
    if (!game || game.phase !== "choosing-trump" || game.turn !== 0) return;
    setGame(chooseTrump(game, 0, suit));
    setStage("deal");
    setSelected(null);
  }
  async function installApp() {
    if (!(await install())) setSheet("install");
  }

  const view = game ? playerGame(game, 0) : null;
  const status = hint?.status ?? statusOf(view, stage);
  const hand = game?.hands[0] ?? [];
  return (
    <div
      className={`app${reduced ? " reduce-motion" : ""}${prefs.speed === "quick" ? " pace-quick" : ""}`}
      data-screen={game && !atHome ? "game" : "home"}
      data-phase={game?.phase}
      data-stage={stage}
    >
      <CardDefs />
      <TopBar offline={offline} onMenu={() => setSheet("menu")} />
      <main className="table" aria-label="Mendikot game table">
        {game && view && !atHome ? (
          <>
            <Scoreboard game={view} />
            <Table
              game={view}
              stage={stage}
              onChoose={setTrump}
              onAgain={() => start(game.mode)}
              onChangeMode={() => setSheet("new")}
              onLastTrick={() => setSheet("last")}
            />
            <Hand
              cards={hand}
              legal={legal}
              myTurn={myTurn}
              selected={selected}
              disabled={stage !== "ready" || !playing || game.turn !== 0}
              dealing={stage === "deal"}
              shake={hint}
              canPlay={canPlay}
              haptic={switchTicks}
              onSelect={select}
              onPlay={play}
            />
            <ActionBar
              status={status}
              card={hand.find((c) => c.id === selected) ?? null}
              canPlay={canPlay}
              haptic={switchTicks}
              onPlay={play}
            />
          </>
        ) : (
          <Home
            mode={mode}
            resume={!!game && game.phase !== "complete"}
            onMode={setMode}
            onSolo={() =>
              game && game.phase !== "complete" ? setAtHome(false) : start()
            }
            onCreate={() => onOnline("create")}
            onJoin={() => onOnline("join")}
          />
        )}
      </main>
      <Toasts
        saveError={saveError}
        needRefresh={needRefresh}
        onUpdate={() => void updateServiceWorker(true)}
      />
      <Sheet
        open={!!sheet}
        title={sheet ? SHEET_TITLES[sheet] : ""}
        onClose={() => setSheet(null)}
      >
        {sheet === "rules" && <RulesSheet />}
        {sheet === "install" && <InstallSheet />}
        {sheet === "last" && view && <LastTrickSheet game={view} />}
        {sheet === "new" && (
          <NewDealSheet
            mode={mode}
            finished={game?.phase === "complete"}
            onMode={setMode}
            onKeep={() => setSheet(null)}
            onDeal={() => start()}
          />
        )}
        {sheet === "menu" && (
          <MenuSheet
            prefs={prefs}
            setPrefs={setPrefs}
            haptics={canHaptic()}
            fullscreen={fullscreen}
            canFullscreen={canFullscreen()}
            hasGame={!!game && !atHome}
            onFullscreen={() => void toggleFullscreen()}
            onInstall={() => void installApp()}
            onNewDeal={() => setSheet("new")}
            onRules={() => setSheet("rules")}
            onHome={() => {
              setSheet(null);
              setSelected(null);
              setAtHome(true);
            }}
            onVolumePreview={() => sound("place")}
          />
        )}
      </Sheet>
    </div>
  );
}
