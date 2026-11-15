import { describe, it, expect } from "vitest";
import {
  advanceTimers,
  applyCommand,
  createRoom,
  joinRoom,
  nextDeadline,
  parseCommand,
  playerName,
  reconcilePresence,
  roomView,
  setConnected,
  BOT_AFTER_DEAL_MS,
  TRICK_COLLECT_MS,
} from "./room-model";
import type { RoomState } from "./room-model";
import {
  chooseBotCard,
  collectTrick,
  newGame,
  resultOf,
} from "../src/game/engine";
import type { Seat } from "../src/game/engine";
import { playerGame } from "../src/game/view";
import { RECONNECT_MS } from "../src/multiplayer/protocol";
import type { RoomAction } from "../src/multiplayer/protocol";

function fixture() {
  const players = [0, 1, 2, 3].map((i) => ({
    id: `player-${i}`,
    name: `Friend ${i}`,
    tokenHash: `secret-${i}`,
    ready: true,
    disconnectedAt: null,
  }));
  const room = createRoom("ABCDEFGH", "cut", players[0], Date.now());
  room.players = players;
  return { room, connected: new Set(players.map((p) => p.id)) };
}
const command = (
  revision: number,
  action: RoomAction,
  id = crypto.randomUUID(),
) => ({ id, revision, action });

describe("authoritative multiplayer rooms", () => {
  it("lets a player leave despite intervening updates, but rejects future revisions", () => {
    const { room, connected } = fixture();
    room.game = newGame();
    room.revision = 9;
    expect(() =>
      applyCommand(
        room,
        "player-1",
        command(10, { type: "leave" }),
        connected,
        Date.now(),
      ),
    ).toThrow(/changed/);
    const next = applyCommand(
      room,
      "player-1",
      command(8, { type: "leave" }),
      connected,
      Date.now(),
    );
    expect(next.players[1]).toBeNull();
    expect(next.game).toBeNull();
    expect(next.notice).toMatch(/left/);
  });
  it("accepts readiness from four players viewing the same lobby revision", () => {
    const initial = fixture();
    let room = initial.room;
    room.players.forEach((p) => {
      p!.ready = false;
    });
    const revision = room.revision;
    for (const player of room.players) {
      room = applyCommand(
        room,
        player!.id,
        command(revision, { type: "ready", ready: true }),
        initial.connected,
        Date.now(),
      );
    }
    expect(room.players.every((p) => p!.ready)).toBe(true);
    expect(room.revision).toBe(revision + 4);
  });
  it("rejects readiness from before a setup change or a future revision", () => {
    const { room, connected } = fixture();
    const changed = applyCommand(
      room,
      "player-0",
      command(room.revision, { type: "mode", mode: "choose" }),
      connected,
      Date.now(),
    );
    for (const revision of [room.revision, changed.revision + 1]) {
      expect(() =>
        applyCommand(
          changed,
          "player-1",
          command(revision, { type: "ready", ready: true }),
          connected,
          Date.now(),
        ),
      ).toThrow(/changed/);
    }
    const departed = applyCommand(
      room,
      "player-3",
      command(room.revision, { type: "leave" }),
      connected,
      Date.now(),
    );
    expect(() =>
      applyCommand(
        departed,
        "player-1",
        command(room.revision, { type: "ready", ready: true }),
        connected,
        Date.now(),
      ),
    ).toThrow(/changed/);
  });
  it("requires the host, four connected seats, and readiness to start", () => {
    const { room, connected } = fixture();
    expect(() =>
      applyCommand(
        room,
        "player-1",
        command(1, { type: "start" }),
        connected,
        Date.now(),
      ),
    ).toThrow(/host/);
    connected.delete("player-3");
    expect(() =>
      applyCommand(
        room,
        "player-0",
        command(1, { type: "start" }),
        connected,
        Date.now(),
      ),
    ).toThrow(/Every seat/);
    connected.add("player-3");
    room.players[3]!.ready = false;
    expect(() =>
      applyCommand(
        room,
        "player-0",
        command(1, { type: "start" }),
        connected,
        Date.now(),
      ),
    ).toThrow(/Every seat/);
  });
  it("does not leak any other hand, reserve, credential, or action receipt", () => {
    const { room, connected } = fixture();
    room.game = newGame(undefined, 3, "choose");
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const view = roomView(room, `player-${seat}`, connected);
      expect(view.game!.hand).toEqual(room.game.hands[seat]);
      expect(view.game!.handCounts).toEqual([5, 5, 5, 5]);
      const json = JSON.stringify(view);
      for (const card of [
        ...room.game.reserve,
        ...room.game.hands.filter((_, i) => i !== seat).flat(),
      ])
        expect(json).not.toContain(card.id);
      expect(json).not.toMatch(/tokenHash|secret-|receipts|reserve|"hands"/);
    }
  });
  it("rotates seats, partners, and teams without altering the authoritative game", () => {
    const game = newGame();
    game.tricks = [2, 3];
    game.trick = [{ seat: 2, card: game.hands[2][0] }];
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const view = playerGame(game, seat);
      expect(view.hand).toEqual(game.hands[seat]);
      expect(view.trick[0].seat).toBe((2 - seat + 4) % 4);
      expect(view.tricks[0]).toBe(game.tricks[seat % 2]);
    }
    expect(game.trick[0].seat).toBe(2);
  });
  it("applies retries once, rejects stale actions, and leaves previous state unchanged", () => {
    const { room, connected } = fixture();
    const start = command(1, { type: "start" });
    const next = applyCommand(room, "player-0", start, connected, Date.now());
    expect(room.game).toBeNull();
    expect(next.game).not.toBeNull();
    expect(applyCommand(next, "player-0", start, connected, Date.now())).toBe(
      next,
    );
    expect(() =>
      applyCommand(
        next,
        "player-0",
        command(1, { type: "ready", ready: true }),
        connected,
        Date.now(),
      ),
    ).toThrow(/changed/);
  });
  it("rejects wrong-player moves, foreign cards, illegal cuts and moves while a player is away", () => {
    const { room, connected } = fixture();
    room.game = newGame();
    const card = room.game.hands[0][0];
    expect(() =>
      applyCommand(
        room,
        "player-1",
        command(1, { type: "play", cardId: card.id }),
        connected,
        Date.now(),
      ),
    ).toThrow();
    expect(() =>
      applyCommand(
        room,
        "player-0",
        command(1, { type: "play", cardId: room.game!.hands[1][0].id }),
        connected,
        Date.now(),
      ),
    ).toThrow();
    connected.delete("player-2");
    expect(() =>
      applyCommand(
        room,
        "player-0",
        command(1, { type: "play", cardId: card.id }),
        connected,
        Date.now(),
      ),
    ).toThrow(/reconnect/);
  });
  it("lets people choose empty seats and resets readiness when teams or mode change", () => {
    const { room, connected } = fixture();
    room.players[2] = null;
    const moved = applyCommand(
      room,
      "player-0",
      command(1, { type: "seat", seat: 2 }),
      connected,
      Date.now(),
    );
    expect(moved.players[2]!.id).toBe("player-0");
    expect(moved.players[0]).toBeNull();
    expect(moved.players.filter(Boolean).every((p) => !p!.ready)).toBe(true);
    expect(() =>
      applyCommand(
        room,
        "player-0",
        command(1, { type: "seat", seat: 1 }),
        connected,
        Date.now(),
      ),
    ).toThrow(/empty/);
  });
  it("ends abandoned active deals without a winner and transfers host ownership", () => {
    const { room, connected } = fixture();
    room.game = newGame();
    const next = applyCommand(
      room,
      "player-0",
      command(room.revision, { type: "leave" }),
      connected,
      Date.now(),
    );
    expect(next.game).toBeNull();
    expect(next.hostId).toBe("player-1");
    expect(next.notice).toMatch(/Friend 0 left/);
    expect(next.players.every((p) => !p?.ready)).toBe(true);
  });
  it("holds a disconnected seat for the reconnection window, then releases it", () => {
    const { room } = fixture();
    room.game = newGame();
    const away = setConnected(room, "player-2", false, 1_000);
    expect(away.players[2]!.disconnectedAt).toBe(1_000);
    // Readiness survives a refresh; start still requires a live connection.
    expect(away.players[2]!.ready).toBe(true);
    expect(nextDeadline(away)).toBe(1_000 + RECONNECT_MS);
    expect(advanceTimers(away, 1_000 + RECONNECT_MS - 1)).toBe(away);
    const back = setConnected(away, "player-2", true, 2_000);
    expect(back.players[2]!.disconnectedAt).toBeNull();
    const released = advanceTimers(away, 1_000 + RECONNECT_MS);
    expect(released.players[2]).toBeNull();
    expect(released.game).toBeNull();
    expect(released.notice).toMatch(/did not reconnect/);
    expect(released.setupRevision).toBe(released.revision);
  });
  it("starts every unconnected player's countdown after a restart", () => {
    const { room } = fixture();
    const next = reconcilePresence(room, new Set(["player-0"]), 5_000);
    expect(next.players.map((p) => p!.disconnectedAt)).toEqual([
      null,
      5_000,
      5_000,
      5_000,
    ]);
    expect(reconcilePresence(next, new Set(["player-0"]), 9_000)).toBe(next);
  });
  it("collects a completed trick only when its timer is due", () => {
    const { room, connected } = fixture();
    let next = applyCommand(
      room,
      "player-0",
      command(room.revision, { type: "start" }),
      connected,
      0,
    );
    for (let i = 0; i < 4; i++)
      next = applyCommand(
        next,
        `player-${next.game!.turn}`,
        command(next.revision, {
          type: "play",
          cardId: chooseBotCard(next.game!).id,
        }),
        connected,
        0,
      );
    expect(next.game!.phase).toBe("trick-complete");
    expect(next.collectAt).toBe(TRICK_COLLECT_MS);
    expect(advanceTimers(next, TRICK_COLLECT_MS - 1)).toBe(next);
    const collected = advanceTimers(next, TRICK_COLLECT_MS);
    expect(collected.game!.trick).toHaveLength(0);
    expect(collected.collectAt).toBeNull();
  });
  it("keeps readiness when a friend joins, and rejects a fifth player", () => {
    const { room } = fixture();
    room.players[3] = null;
    const newcomer = {
      id: "player-new",
      name: "New",
      tokenHash: "secret-new",
      ready: false,
      disconnectedAt: 0,
    };
    const joined = joinRoom(room, newcomer);
    expect(joined.players[3]!.id).toBe("player-new");
    expect(joined.players[0]!.ready).toBe(true);
    expect(joined.setupRevision).toBe(joined.revision);
    expect(() => joinRoom(joined, { ...newcomer, id: "fifth" })).toThrow(
      /four players/,
    );
  });
  it("starts a newcomer in the lobby, not on someone else's result", () => {
    const { room, connected } = fixture();
    room.game = { ...newGame(), phase: "complete" };
    const left = applyCommand(
      room,
      "player-3",
      command(room.revision, { type: "leave" }),
      connected,
      0,
    );
    // Those who stay can keep looking at the result.
    expect(left.game!.phase).toBe("complete");
    expect(left.notice).toBe("Friend 3 left and gave up their seat.");
    const joined = joinRoom(left, {
      id: "player-new",
      name: "New",
      tokenHash: "secret-new",
      ready: false,
      disconnectedAt: 0,
    });
    expect(joined.game).toBeNull();
    expect(joined.notice).toBeNull();
  });
  it("keeps rotating the dealer after an abandoned deal", () => {
    const { room, connected } = fixture();
    let next = applyCommand(
      room,
      "player-0",
      command(room.revision, { type: "start" }),
      connected,
      0,
    );
    expect(next.game!.dealer).toBe(3);
    next = applyCommand(
      next,
      "player-3",
      command(next.revision, { type: "leave" }),
      connected,
      0,
    );
    next = joinRoom(next, {
      id: "player-3",
      name: "Back",
      tokenHash: "secret-3",
      ready: true,
      disconnectedAt: null,
    });
    for (const p of next.players)
      next = applyCommand(
        next,
        p!.id,
        command(next.revision, { type: "ready", ready: true }),
        connected,
        0,
      );
    next = applyCommand(
      next,
      "player-0",
      command(next.revision, { type: "start" }),
      connected,
      0,
    );
    expect(next.game!.dealer).toBe(0);
  });
  it("explains why a host cannot change the mode during a deal", () => {
    const { room, connected } = fixture();
    room.game = newGame();
    expect(() =>
      applyCommand(
        room,
        "player-0",
        command(room.revision, { type: "mode", mode: "choose" }),
        connected,
        0,
      ),
    ).toThrow(/between deals/);
    expect(() =>
      applyCommand(
        room,
        "player-1",
        command(room.revision, { type: "mode", mode: "choose" }),
        connected,
        0,
      ),
    ).toThrow(/Only the host/);
  });
  it("rejects malformed commands and unsafe names", () => {
    for (const value of [
      null,
      {},
      { id: "tiny", revision: 1, action: { type: "start" } },
      command(1, { type: "trump", suit: "bogus" } as never),
      command(1, { type: "seat", seat: -1 } as never),
      command(1, { type: "ready", ready: "true" } as never),
    ])
      expect(() => parseCommand(value)).toThrow();
    expect(() => playerName(" \n ")).toThrow();
    expect(() => playerName("a".repeat(25))).toThrow();
    expect(() => playerName("a\u202Eb")).toThrow();
    expect(playerName("  My   Friend  ")).toBe("My Friend");
  });
  it.each(["cut", "choose"] as const)(
    "completes a %s deal through authenticated commands and supports rematches",
    (mode) => {
      const initial = fixture();
      let room = initial.room;
      const connected = initial.connected;
      room.mode = mode;
      room = applyCommand(
        room,
        "player-0",
        command(room.revision, { type: "start" }),
        connected,
        Date.now(),
      );
      if (mode === "choose")
        room = applyCommand(
          room,
          "player-0",
          command(room.revision, { type: "trump", suit: "hearts" }),
          connected,
          Date.now(),
        );
      let plays = 0;
      while (room.game!.phase !== "complete") {
        if (room.game!.phase === "trick-complete") {
          room = {
            ...room,
            game: collectTrick(room.game!),
            collectAt: null,
            revision: room.revision + 1,
          };
          continue;
        }
        const game = room.game!;
        const move = command(room.revision, {
          type: "play",
          cardId: chooseBotCard(game).id,
        });
        room = applyCommand(
          room,
          `player-${game.turn}`,
          move,
          connected,
          Date.now(),
        );
        plays++;
        expect(
          applyCommand(
            room,
            `player-${game.turn}`,
            move,
            connected,
            Date.now(),
          ),
        ).toBe(room);
      }
      expect(plays).toBe(52);
      expect(resultOf(room.game!)).not.toBeNull();
      const previousId = room.game!.id;
      for (const player of room.players)
        room = applyCommand(
          room,
          player!.id,
          command(room.revision, { type: "ready", ready: true }),
          connected,
          Date.now(),
        );
      room = applyCommand(
        room,
        "player-0",
        command(room.revision, { type: "start" }),
        connected,
        Date.now(),
      );
      expect(room.game!.id).not.toBe(previousId);
      expect(room.game!.dealer).toBe(0);
    },
  );
});

describe("bots in private rooms", () => {
  function hostAlone(mode: "cut" | "choose" = "cut") {
    const host = {
      id: "host",
      name: "Asha",
      tokenHash: "secret",
      ready: false,
      disconnectedAt: null,
    };
    return {
      room: createRoom("BOTSROOM", mode, host, 0),
      connected: new Set(["host"]),
    };
  }
  const act = (
    room: RoomState,
    who: string,
    action: RoomAction,
    connected: Set<string>,
    now = 0,
  ) => applyCommand(room, who, command(room.revision, action), connected, now);

  function withBots(mode: "cut" | "choose" = "cut") {
    let { room, connected } = hostAlone(mode);
    room = act(room, "host", { type: "bot", add: true }, connected);
    expect(room.players.map((p) => p?.name)).toEqual([
      "Asha",
      "Kavya",
      "Rohan",
      "Meera",
    ]);
    expect(() =>
      act(room, "host", { type: "bot", add: true }, connected),
    ).toThrow(/already taken/);
    room = act(room, "host", { type: "ready", ready: true }, connected);
    return { room, connected };
  }

  it("lets only the host fill and empty seats with bots between deals", () => {
    let { room, connected } = hostAlone();
    room = act(room, "host", { type: "bot", seat: 2, add: true }, connected);
    const bot = room.players[2]!;
    expect(bot).toMatchObject({ bot: true, ready: true, name: "Kavya" });
    expect(roomView(room, "host", connected).players[1]).toMatchObject({
      bot: true,
      connected: true,
      ready: true,
    });
    expect(() =>
      act(room, "host", { type: "bot", seat: 2, add: true }, connected),
    ).toThrow(/taken/);
    room = act(room, "host", { type: "bot", seat: 3, add: true }, connected);
    expect(room.players[3]!.name).toBe("Rohan");
    room = act(room, "host", { type: "bot", seat: 2, add: false }, connected);
    expect(room.players[2]).toBeNull();
    expect(() =>
      act(room, "host", { type: "bot", seat: 1, add: false }, connected),
    ).toThrow(/no bot/);
    expect(() =>
      parseCommand(command(1, { type: "bot", add: false } as RoomAction)),
    ).toThrow(/Invalid/);

    const guest = {
      id: "guest",
      name: "Dev",
      tokenHash: "g",
      ready: false,
      disconnectedAt: null,
    };
    room = joinRoom(room, guest);
    connected.add("guest");
    expect(() =>
      act(room, "guest", { type: "bot", seat: 2, add: true }, connected),
    ).toThrow(/host/);
  });

  it("starts with bots, plays their turns on a timer and finishes the deal", () => {
    let { room, connected } = withBots("choose");
    room = act(room, "host", { type: "start" }, connected);
    expect(room.game).not.toBeNull();
    let now = 0,
      humanMoves = 0;
    for (let step = 0; step < 400 && room.game!.phase !== "complete"; step++) {
      const game = room.game!;
      if (game.turn === 0 && game.phase === "choosing-trump") {
        room = act(
          room,
          "host",
          { type: "trump", suit: "hearts" },
          connected,
          now,
        );
        humanMoves++;
        continue;
      }
      if (game.turn === 0 && game.phase === "playing") {
        const cardId = chooseBotCard(game).id;
        room = act(room, "host", { type: "play", cardId }, connected, now);
        humanMoves++;
        continue;
      }
      // Bots and trick collection wait for the next deadline.
      now = nextDeadline(room);
      room = advanceTimers(room, now);
    }
    expect(room.game!.phase).toBe("complete");
    expect(resultOf(room.game!)).not.toBeNull();
    expect(humanMoves).toBeGreaterThanOrEqual(13);
    expect(room.botAt).toBeNull();
  });

  it("pauses bots while a person is away and resumes on return", () => {
    let { room, connected } = withBots();
    room = act(room, "host", { type: "start" }, connected);
    // Play until it is a bot's turn.
    while (!room.players[room.game!.turn]!.bot)
      room = act(
        room,
        "host",
        { type: "play", cardId: chooseBotCard(room.game!).id },
        connected,
      );
    expect(room.botAt).not.toBeNull();
    room = setConnected(room, "host", false, 10);
    expect(room.botAt).toBeNull();
    const frozen = room.game;
    room = advanceTimers(room, 5_000);
    expect(room.game).toEqual(frozen);
    room = setConnected(room, "host", true, 6_000);
    expect(room.botAt).toBe(7_000);
  });

  it("restarts treat bots as present", () => {
    const { room } = withBots();
    expect(reconcilePresence(room, new Set(["host"]), 5)).toBe(room);
    const next = reconcilePresence(room, new Set(), 5);
    expect(next.players.filter((p) => p?.disconnectedAt === 5)).toHaveLength(1);
  });

  it("gives a newcomer a bot's seat and clears bots when the last person leaves", () => {
    let { room, connected } = withBots();
    room = joinRoom(room, {
      id: "guest",
      name: "Dev",
      tokenHash: "g",
      ready: false,
      disconnectedAt: null,
    });
    expect(room.players[1]!.id).toBe("guest");
    expect(room.players.filter((p) => p?.bot)).toHaveLength(2);
    connected.add("guest");
    room = act(room, "guest", { type: "leave" }, connected);
    room = act(room, "host", { type: "leave" }, connected);
    expect(room.players.every((p) => p === null)).toBe(true);
    expect(room.hostId).toBe("");
  });

  it("lets the host start without pressing ready; bots wait out the deal animation", () => {
    let { room, connected } = hostAlone();
    room = act(room, "host", { type: "bot", add: true }, connected);
    expect(room.players[0]!.ready).toBe(false);
    room = act(room, "host", { type: "start" }, connected, 100);
    expect(room.game).not.toBeNull();
    // Seat 3 dealt, so the host leads; after the host plays, a bot is next.
    room = act(
      room,
      "host",
      { type: "play", cardId: chooseBotCard(room.game!).id },
      connected,
      200,
    );
    expect(room.botAt).toBe(1_200);
  });

  it("swaps a person into a bot's seat, keeping the bot at the table", () => {
    let { room, connected } = withBots();
    room = joinRoom(room, {
      id: "guest",
      name: "Dev",
      tokenHash: "g",
      ready: false,
      disconnectedAt: null,
    });
    connected.add("guest");
    const guestSeat = room.players.findIndex((p) => p?.id === "guest");
    const target = room.players.findIndex(
      (p, i) => p?.bot && i % 2 === 0,
    ) as Seat;
    const bot = room.players[target]!.id;
    room = act(room, "guest", { type: "seat", seat: target }, connected);
    expect(room.players[target]!.id).toBe("guest");
    expect(room.players[guestSeat]!.id).toBe(bot);
    expect(() =>
      act(room, "guest", { type: "seat", seat: 0 }, connected),
    ).toThrow(/empty seat/);
  });

  it("lets a bot choose hukum when the deal rotates to it", () => {
    let { room, connected } = withBots("choose");
    let now = 0;
    for (let deal = 0; deal < 2; deal++) {
      room = act(room, "host", { type: "start" }, connected, now);
      const chooser = room.game!.turn;
      if (deal === 1) {
        expect(room.players[chooser]!.bot).toBe(true);
        expect(room.botAt).toBe(now + BOT_AFTER_DEAL_MS);
      }
      for (
        let step = 0;
        step < 400 && room.game!.phase !== "complete";
        step++
      ) {
        const game = room.game!;
        if (game.turn === 0 && game.phase === "choosing-trump")
          room = act(
            room,
            "host",
            { type: "trump", suit: "spades" },
            connected,
            now,
          );
        else if (game.turn === 0 && game.phase === "playing")
          room = act(
            room,
            "host",
            { type: "play", cardId: chooseBotCard(game).id },
            connected,
            now,
          );
        else {
          now = nextDeadline(room);
          room = advanceTimers(room, now);
        }
      }
      expect(room.game!.phase).toBe("complete");
      if (deal === 1) expect(room.game!.trump).not.toBeNull();
    }
  });

  it("keeps a pending bot move across a restart and runs it once", () => {
    let { room, connected } = withBots();
    room = act(room, "host", { type: "start" }, connected, 0);
    room = act(
      room,
      "host",
      { type: "play", cardId: chooseBotCard(room.game!).id },
      connected,
      10,
    );
    const due = room.botAt!;
    // The object restarts with the host's socket still open.
    expect(reconcilePresence(room, new Set(["host"]), 20)).toBe(room);
    expect(nextDeadline(room)).toBe(due);
    const after = advanceTimers(room, due);
    expect(after.game!.trick).toHaveLength(2);
    // A second alarm for the same moment changes nothing more.
    const again = advanceTimers(after, due);
    expect(again.game!.trick).toHaveLength(2);
  });
});
