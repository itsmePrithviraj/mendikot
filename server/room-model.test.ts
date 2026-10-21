import { describe, it, expect } from "vitest";
import {
  applyCommand,
  createRoom,
  parseCommand,
  playerName,
  removePlayer,
  roomView,
} from "./room-model";
import {
  chooseBotCard,
  collectTrick,
  newGame,
  resultOf,
} from "../src/game/engine";
import type { Seat } from "../src/game/engine";
import { playerGame } from "../src/game/view";
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
    ).toThrow(/four/);
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
    ).toThrow(/four/);
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
    const { room } = fixture();
    room.game = newGame();
    removePlayer(room, "player-0", "Host left.");
    expect(room.game).toBeNull();
    expect(room.hostId).toBe("player-1");
    expect(room.endedReason).toBe("Host left.");
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
