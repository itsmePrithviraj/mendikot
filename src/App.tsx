import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleHelp,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  CardBack,
  CardFace,
  HandCard,
  Sheep,
  SuitMark,
} from "./components/Cards";
import {
  botTrump,
  cardLabel,
  chooseBotCard,
  chooseTrump,
  collectTrick,
  isGame,
  legalCards,
  newGame,
  nextSeat,
  playCard,
  resultOf,
  SUITS,
  tens,
  winnerOf,
} from "./game/engine";
import type { Game, Mode, Seat, Suit } from "./game/engine";
const SAVE = "mendikot.game.v1",
  PREFS = "mendikot.preferences.v1";
const names = ["You", "Kavya", "Aniruddha", "Rohan"];
interface Preferences {
  sound: boolean;
  speed: "relaxed" | "quick";
  reducedMotion: boolean;
}
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
function readGame(): Game | null {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE) ?? "null");
    return isGame(data) ? data : null;
  } catch {
    return null;
  }
}
function readPrefs(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
    return {
      sound: data.sound === true,
      speed: data.speed === "quick" ? "quick" : "relaxed",
      reducedMotion: data.reducedMotion === true,
    };
  } catch {
    return { sound: false, speed: "relaxed", reducedMotion: false };
  }
}
function App() {
  const [game, setGame] = useState<Game | null>(readGame),
    [mode, setMode] = useState<Mode>(() => readGame()?.mode ?? "cut"),
    [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<"ready" | "shuffle" | "deal">("ready"),
    [dialog, setDialog] = useState<
      "rules" | "settings" | "new" | "install" | null
    >(null);
  const [prefs, setPrefs] = useState(readPrefs),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [offline, setOffline] = useState(!navigator.onLine),
    [saveError, setSaveError] = useState(false),
    [visible, setVisible] = useState(!document.hidden),
    [fullscreen, setFullscreen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null),
    audio = useRef<AudioContext | null>(null),
    lastFocus = useRef<HTMLElement | null>(null);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const reduced = prefs.reducedMotion || systemReduced;
  const available = game ? legalCards(game, 0) : [],
    selectedCard = game?.hands[0].find((c) => c.id === selected),
    canPlay =
      !!selectedCard &&
      available.some((c) => c.id === selected) &&
      stage === "ready";
  const result = game ? resultOf(game) : null,
    choosing = game?.phase === "choosing-trump",
    playing = game?.phase === "playing";
  const completed = game ? game.tricks[0] + game.tricks[1] : 0;
  function sound() {
    if (!prefs.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const oscillator = audio.current.createOscillator(),
        gain = audio.current.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(420, audio.current.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        150,
        audio.current.currentTime + 0.07,
      );
      gain.gain.setValueAtTime(0.025, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.07,
      );
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.08);
    } catch {
      /* Sound is optional. */
    }
  }
  useEffect(() => {
    try {
      if (game) localStorage.setItem(SAVE, JSON.stringify(game));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [game]);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify(prefs));
    } catch {
      /* Continue without persistence. */
    }
  }, [prefs]);
  useEffect(() => {
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const installed = () => {
      setInstall(null);
      setDialog(null);
    };
    const online = () => setOffline(!navigator.onLine);
    const visibility = () => setVisible(!document.hidden);
    const full = () => setFullscreen(!!document.fullscreenElement);
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setSystemReduced(query.matches);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", full);
    query.addEventListener("change", motion);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", full);
      query.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (dialog) {
      lastFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      lastFocus.current?.focus();
    }
  }, [dialog]);
  useEffect(() => {
    if (stage === "ready") return;
    const timer = setTimeout(
      () => setStage(stage === "shuffle" ? "deal" : "ready"),
      reduced ? 80 : stage === "shuffle" ? 850 : 1250,
    );
    return () => clearTimeout(timer);
  }, [stage, reduced]);
  useEffect(() => {
    if (!game || stage !== "ready" || dialog || !visible) return;
    let callback: (() => void) | null = null;
    let wait = prefs.speed === "quick" ? 430 : 1100;
    if (game.phase === "trick-complete") {
      callback = () => {
        setGame(collectTrick(game));
        setSelected(null);
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
        sound();
      };
    }
    if (!callback) return;
    const timer = setTimeout(callback, wait);
    return () => clearTimeout(timer);
    // Timers depend on game identity; rotating never changes game state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, stage, dialog, visible, prefs.speed, prefs.sound]);
  function start(nextMode = mode) {
    setMode(nextMode);
    setGame(newGame(undefined, game ? nextSeat(game.dealer) : 3, nextMode));
    setSelected(null);
    setStage("shuffle");
    setDialog(null);
    sound();
  }
  function play() {
    if (!game || !canPlay || !selected) return;
    setGame(playCard(game, 0, selected));
    setSelected(null);
    sound();
  }
  function setTrump(suit: Suit) {
    if (!game || game.phase !== "choosing-trump" || game.turn !== 0) return;
    setGame(chooseTrump(game, 0, suit));
    setStage("deal");
    setSelected(null);
    sound();
  }
  async function installApp() {
    if (install) {
      await install.prompt();
      await install.userChoice;
      setInstall(null);
    } else setDialog("install");
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* Native browser may not support full screen. */
    }
  }
  const status = !game
    ? "Your seat is waiting."
    : stage === "shuffle"
      ? "Shuffling the deck…"
      : stage === "deal"
        ? choosing
          ? "Dealing five cards each…"
          : "Dealing your cards…"
        : result
          ? result.winner === 0
            ? "Your team wins. Nicely played."
            : "Their team takes this one."
          : choosing
            ? game.turn === 0
              ? "Choose hukum from your first five cards."
              : `${names[game.turn]} is choosing hukum from five cards.`
            : game.phase === "trick-complete"
              ? `${names[winnerOf(game.trick, game.trump)]} takes the trick.`
              : game.turn === 0
                ? game.trick.length
                  ? `Your turn. ${available[0]?.suit === game.trick[0].card.suit ? `Follow ${game.trick[0].card.suit}.` : "Play any card."}`
                  : "Your turn. Lead any card."
                : `${names[game.turn]} is thinking…`;
  function ModePicker() {
    return (
      <fieldset className="mode-picker">
        <legend>Choose your hukum</legend>
        <label className={mode === "cut" ? "active" : ""}>
          <input
            type="radio"
            name="mode"
            value="cut"
            checked={mode === "cut"}
            onChange={() => setMode("cut")}
          />
          <span>
            <strong>Cut hukum</strong>
            <small>First cut decides trump</small>
          </span>
          {mode === "cut" && <Check size={16} />}
        </label>
        <label className={mode === "choose" ? "active" : ""}>
          <input
            type="radio"
            name="mode"
            value="choose"
            checked={mode === "choose"}
            onChange={() => setMode("choose")}
          />
          <span>
            <strong>Choose hukum</strong>
            <small>Five cards. Then choose.</small>
          </span>
          {mode === "choose" && <Check size={16} />}
        </label>
      </fieldset>
    );
  }
  function Player({ seat }: { seat: Seat }) {
    const active =
      game?.turn === seat && game.phase !== "complete" && stage === "ready";
    return (
      <div className={`player player-${seat} ${active ? "is-turn" : ""}`}>
        <div className="avatar">
          {names[seat][0]}
          <span className="turn-dot" />
        </div>
        <div className="player-copy">
          <strong>
            {names[seat]}
            {seat === 2 && <span className="partner-label">Your partner</span>}
          </strong>
          <span>
            {seat === 2 ? "Partner" : "Opponent"} · Bot
            {game ? ` · ${game.hands[seat].length} cards` : ""}
          </span>
        </div>
        <div className="held-backs" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <CardBack key={i} />
          ))}
        </div>
      </div>
    );
  }
  const hand = game?.hands[0] ?? [];
  return (
    <div
      className={`app ${reduced ? "reduce-motion" : ""} ${game ? "in-game" : "at-lobby"} stage-${stage}`}
    >
      <header className="masthead">
        <span className="wordmark" aria-label="Mendikot">
          <Sheep />
          <span>
            Mendikot<span className="brand-dot">.</span>
          </span>
        </span>
        <span className="masthead-note">Good company. Better cards.</span>
        <nav aria-label="Game controls">
          <button
            className="icon-button"
            onClick={installApp}
            aria-label="Install game"
          >
            <ArrowDownToLine size={19} />
            <span>Install</span>
          </button>
          <button
            className="icon-button"
            onClick={() => setDialog("rules")}
            aria-label="How to play"
          >
            <CircleHelp size={20} />
          </button>
          <button
            className="icon-button"
            onClick={() => setDialog("settings")}
            aria-label="Settings"
          >
            <Settings2 size={20} />
          </button>
        </nav>
      </header>
      <main className="table-shell" aria-label="Mendikot game table">
        <div className="table-top">
          <div className="table-label">
            <span className="presence-dot" />
            <span>Practice table</span>
            <span className="table-detail">You + 3 bots</span>
          </div>
          <div className="table-tools">
            {offline && <span>Offline</span>}
            <button
              className="table-icon"
              aria-label={prefs.sound ? "Mute sound" : "Enable sound"}
              onClick={() => {
                setPrefs((p) => ({ ...p, sound: !p.sound }));
              }}
            >
              {prefs.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button
              className="table-icon fullscreen-control"
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </div>
        <div className="score-strip">
          <div className="team-score">
            <span>Us</span>
            <strong>{game ? tens(game, 0).length : 0}</strong>
            <div
              className="ten-slots"
              aria-label={`${game ? tens(game, 0).length : 0} tens captured`}
            >
              {[0, 1, 2, 3].map((i) => (
                <Sheep
                  key={i}
                  className={game && i < tens(game, 0).length ? "captured" : ""}
                />
              ))}
            </div>
          </div>
          <div className="hukum-display">
            <span>Hukum</span>
            {game?.trump ? (
              <>
                <SuitMark suit={game.trump} />
                <strong>{game.trump}</strong>
              </>
            ) : (
              <strong>
                {game?.mode === "choose" ? "Choose after five" : "First cut"}
              </strong>
            )}
          </div>
          <div className="team-score theirs">
            <span>Them</span>
            <strong>{game ? tens(game, 1).length : 0}</strong>
            <div
              className="ten-slots"
              aria-label={`${game ? tens(game, 1).length : 0} tens captured`}
            >
              {[0, 1, 2, 3].map((i) => (
                <Sheep
                  key={i}
                  className={game && i < tens(game, 1).length ? "captured" : ""}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="play-field">
          <div className="table-ring" aria-hidden="true" />
          <Player seat={2} />
          <Player seat={3} />
          <Player seat={1} />
          {!game ? (
            <section className="welcome">
              <div className="welcome-cards" aria-hidden="true">
                <CardBack />
                <CardFace
                  card={{ id: "hearts-10", rank: 10, suit: "hearts" }}
                />
                <CardBack />
              </div>
              <h1>
                Four tens.
                <br />
                <em>One lovely rivalry.</em>
              </h1>
              <p>
                Find your partner. Follow the suit.
                <br />
                Bring the sheep home.
              </p>
            </section>
          ) : (
            <>
              <div
                className={`trick-area ${game.phase === "trick-complete" ? "is-complete" : ""}`}
                aria-label="Current trick"
              >
                {game.trick.map((p) => (
                  <div key={p.card.id} className={`played-card from-${p.seat}`}>
                    <CardFace card={p.card} />
                    <span className="played-by">{names[p.seat]}</span>
                  </div>
                ))}
              </div>
              {stage === "shuffle" && (
                <div className="shuffle-stack" aria-label="Shuffling">
                  {[0, 1, 2].map((i) => (
                    <CardBack key={i} />
                  ))}
                </div>
              )}
              {choosing && stage === "ready" && (
                <section className="choose-panel">
                  <Sheep />
                  <h2>
                    {game.turn === 0
                      ? "Make it your suit."
                      : `${names[game.turn]} chooses.`}
                  </h2>
                  <p>Only five cards. A little foresight.</p>
                  {game.turn === 0 ? (
                    <div className="suit-options">
                      {SUITS.map((suit) => (
                        <button
                          key={suit}
                          onClick={() => setTrump(suit)}
                          aria-label={`Choose ${suit} as hukum`}
                        >
                          <SuitMark suit={suit} />
                          <span>{suit}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="thinking-dots">Choosing hukum…</span>
                  )}
                </section>
              )}
              {playing && game.trick.length === 0 && stage === "ready" && (
                <div className="table-watermark">
                  <Sheep />
                  <span>
                    {completed === 0 ? "Let’s begin." : "Next trick."}
                  </span>
                </div>
              )}
              {result && (
                <section className="result-panel" aria-live="polite">
                  <Sheep />
                  <h2>
                    {result.whitewash
                      ? "A clean sweep."
                      : result.coat
                        ? "A Mendikot!"
                        : result.winner === 0
                          ? "Beautifully played."
                          : "The next one is yours."}
                  </h2>
                  <p>
                    {result.winner === 0 ? "Your team wins" : "Their team wins"}{" "}
                    · {game.tricks[result.winner]} tricks
                  </p>
                  <div className="result-tens">
                    {SUITS.map((s) => (
                      <span
                        key={s}
                        className={
                          tens(game, result.winner).some((c) => c.suit === s)
                            ? "won"
                            : ""
                        }
                      >
                        10
                        <SuitMark suit={s} />
                      </span>
                    ))}
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => start(game.mode)}
                  >
                    Deal again <ArrowRight size={17} />
                  </button>
                </section>
              )}
            </>
          )}
        </div>
        {!game ? (
          <div className="lobby-controls">
            <ModePicker />
            <button className="primary-button" onClick={() => start()}>
              Take your seat <ArrowRight size={18} />
            </button>
            <span className="practice-note">
              A full game with three practice bots · no sign-up
            </span>
          </div>
        ) : (
          <div className="hand-zone">
            <div className="hand-heading">
              <span
                className={`turn-status ${game.turn === 0 ? "your-turn" : ""}`}
                role="status"
                aria-live="polite"
              >
                {status}
              </span>
              <span className="hand-count">
                {hand.length} cards{" "}
                <span>· Trick {Math.min(completed + 1, 13)} / 13</span>
              </span>
            </div>
            <div
              className={`hand ${choosing ? "five-cards" : ""} ${stage === "deal" ? "dealing" : ""}`}
              aria-label="Your cards"
            >
              {hand.map((card, index) => (
                <HandCard
                  key={card.id}
                  card={card}
                  index={index}
                  legal={available.some((c) => c.id === card.id)}
                  selected={selected === card.id}
                  disabled={stage !== "ready" || !playing || game.turn !== 0}
                  onSelect={() => {
                    setSelected(selected === card.id ? null : card.id);
                    sound();
                  }}
                />
              ))}
            </div>
            <div className="hand-actions">
              <div className="selection-label">
                {selectedCard ? (
                  <>
                    <span>{cardLabel(selectedCard)}</span>
                    <small>
                      {canPlay
                        ? "Ready when you are."
                        : "Follow the led suit when you can."}
                    </small>
                  </>
                ) : (
                  <>
                    <span>
                      You <small className="you-team">& Aniruddha</small>
                    </span>
                    <small>
                      {choosing
                        ? "The remaining eight cards follow your choice."
                        : result
                          ? "A good game deserves another."
                          : "Tap a card, then play it."}
                    </small>
                  </>
                )}
              </div>
              {!result && !choosing && (
                <button
                  className="primary-button play-button"
                  disabled={!canPlay}
                  onClick={play}
                >
                  Play card <ArrowRight size={18} />
                </button>
              )}
              {choosing && <span className="five-note">5 first. 8 after.</span>}
            </div>
          </div>
        )}
        <footer className="table-footer">
          <span>
            {game?.mode === "choose" ? "Choose hukum" : "Cut hukum"}
            <span className="footer-extra"> · partners sit opposite</span>
          </span>
          {game?.lastTrick && (
            <details className="last-trick">
              <summary>Last trick</summary>
              <div className="last-trick-popover">
                <strong>{names[game.lastTrick.winner]} won</strong>
                <div>
                  {game.lastTrick.plays.map((p) => (
                    <div key={p.card.id}>
                      <span>{names[p.seat]}</span>
                      <CardFace card={p.card} small />
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
          {game && (
            <button onClick={() => setDialog("new")}>
              <RotateCcw size={13} /> New deal
            </button>
          )}
        </footer>
      </main>
      <footer className="page-footer">
        <span>Four players. Two teams. All heart.</span>
        <span className="footer-suits">
          <SuitMark suit="spades" />
          <SuitMark suit="hearts" />
          <SuitMark suit="clubs" />
          <SuitMark suit="diamonds" />
        </span>
      </footer>
      {saveError && (
        <div className="notification" role="alert">
          This browser can’t save the game. Keep this tab open to continue.
        </div>
      )}
      {needRefresh && (
        <div className="notification" role="status">
          A fresh version is ready.
          <button onClick={() => void updateServiceWorker(true)}>
            Save & update
          </button>
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="dialog"
        onCancel={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog(null);
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-inner">
          <button
            className="dialog-close icon-button"
            aria-label="Close dialog"
            onClick={() => setDialog(null)}
          >
            <X size={21} />
          </button>
          {dialog === "rules" && (
            <>
              <h2 id="dialog-title">Bring the tens home.</h2>
              <p>Four players. Two teams. Your partner sits opposite you.</p>
              <ol className="rules-list">
                <li>
                  <strong>Follow the suit.</strong> Play the suit led if you
                  have it. Otherwise play any card.
                </li>
                <li>
                  <strong>Hukum has the last word.</strong> The highest trump
                  wins. Without a trump, the highest card in the led suit wins.
                  A, K, Q, J, 10 … 2.
                </li>
                <li>
                  <strong>Collect the tens.</strong> Three tens win. All four
                  make a Mendikot. At two each, the team with more tricks wins.
                </li>
              </ol>
              <h3>Two ways to choose hukum</h3>
              <p>
                <strong>Cut hukum:</strong> everyone gets 13 cards. The first
                legal off-suit card sets trump, including for that trick.
              </p>
              <p>
                <strong>Choose hukum:</strong> everyone gets five cards. The
                player after the dealer announces trump, then everyone gets
                eight more cards.
              </p>
              <p className="small-print">
                Play proceeds anticlockwise. Practice bots use only their own
                cards and public play. The sheep decorates each 10; the number
                and suit always stay.
              </p>
            </>
          )}
          {dialog === "settings" && (
            <>
              <h2 id="dialog-title">Make yourself comfortable.</h2>
              <label className="setting-row">
                <span>
                  Card sounds<small>A soft tick when a card moves</small>
                </span>
                <input
                  type="checkbox"
                  checked={prefs.sound}
                  onChange={(e) =>
                    setPrefs({ ...prefs, sound: e.target.checked })
                  }
                />
              </label>
              <label className="setting-row">
                <span>
                  Less motion<small>Keep dealing and play still</small>
                </span>
                <input
                  type="checkbox"
                  checked={prefs.reducedMotion}
                  onChange={(e) =>
                    setPrefs({ ...prefs, reducedMotion: e.target.checked })
                  }
                />
              </label>
              <label className="setting-row">
                <span>
                  Table pace<small>Time between bot turns</small>
                </span>
                <select
                  value={prefs.speed}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      speed: e.target.value as Preferences["speed"],
                    })
                  }
                >
                  <option value="relaxed">Relaxed</option>
                  <option value="quick">Quick</option>
                </select>
              </label>
              <p className="small-print">
                Turn your phone any time. Your game stays exactly where it is.
                Device motion preferences are also respected.
              </p>
            </>
          )}
          {dialog === "new" && (
            <>
              <h2 id="dialog-title">A fresh hand?</h2>
              <p>This ends the current practice deal.</p>
              <ModePicker />
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setDialog(null)}
                >
                  Keep playing
                </button>
                <button className="primary-button" onClick={() => start()}>
                  Shuffle & deal
                </button>
              </div>
            </>
          )}
          {dialog === "install" && (
            <>
              <h2 id="dialog-title">A seat on your home screen.</h2>
              <p>
                On iPhone or iPad, open this game in Safari, tap{" "}
                <strong>Share</strong>, then <strong>Add to Home Screen</strong>
                .
              </p>
              <p>
                On Android or desktop, use your browser’s{" "}
                <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong> option when available.
              </p>
              <p>
                After your first online visit finishes loading, practice games
                work offline. Your hand saves on this device.
              </p>
              <p className="small-print">
                Installation needs HTTPS or localhost. You can always bookmark
                this page.
              </p>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
export default App;
