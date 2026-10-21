import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import type { RoomSnapshot } from "../../src/multiplayer/protocol";

declare global {
  interface Window {
    roomTest: { socket: WebSocket; view: RoomSnapshot };
  }
}

test("saved game and action receipts survive a full Workers runtime restart", async ({
  browser,
}) => {
  const storage = await mkdtemp(join(tmpdir(), "mendikot-restart-"));
  const port = await new Promise<number>((resolvePort) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  let runtime: ChildProcess | null = null;
  let logs = "";
  async function start() {
    runtime = spawn(
      process.execPath,
      [
        resolve("node_modules/wrangler/bin/wrangler.js"),
        "dev",
        "--ip",
        "127.0.0.1",
        "--port",
        String(port),
        "--persist-to",
        storage,
        "--log-level",
        "error",
      ],
      {
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
    );
    runtime.stdout?.on("data", (data) => {
      logs += String(data);
    });
    runtime.stderr?.on("data", (data) => {
      logs += String(data);
    });
    await expect
      .poll(
        async () => {
          if (runtime?.exitCode != null) throw new Error(logs);
          try {
            return (await fetch(`${base}/api/health`)).ok;
          } catch {
            return false;
          }
        },
        { timeout: 30_000 },
      )
      .toBe(true);
  }
  async function stop() {
    if (!runtime?.pid) return;
    const child = runtime;
    const exited = new Promise<void>((done) =>
      child.once("exit", () => done()),
    );
    process.kill(-runtime.pid, "SIGTERM");
    await exited;
    runtime = null;
  }
  const contexts = await Promise.all(
    [0, 1, 2, 3].map(() => browser.newContext({ serviceWorkers: "block" })),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    await start();
    let code = "";
    for (let i = 0; i < 4; i++) {
      await pages[i].goto(base);
      const result = await pages[i].evaluate(
        async ({ code, i }) => {
          const response = await fetch(
            code ? `/api/rooms/${code}/join` : "/api/rooms",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: `Player ${i}`, mode: "cut" }),
            },
          );
          if (!response.ok) throw new Error(await response.text());
          return response.json();
        },
        { code, i },
      );
      code = result.code;
    }
    async function connectAll() {
      for (const page of pages) {
        await page.evaluate(async (code) => {
          const socket = new WebSocket(
            `ws://${location.host}/api/rooms/${code}/socket`,
          );
          await new Promise<void>((done, fail) => {
            socket.onerror = () => fail(new Error("WebSocket failed"));
            socket.onmessage = (event) => {
              const message = JSON.parse(event.data);
              if (message.type === "snapshot") {
                window.roomTest = { socket, view: message.room };
                done();
              }
            };
          });
        }, code);
      }
      for (const page of pages)
        await page.waitForFunction(() =>
          window.roomTest.view.players.every((p) => p.connected),
        );
    }
    await connectAll();
    for (const page of pages) {
      await page.evaluate(() => {
        const { socket, view } = window.roomTest;
        socket.send(
          JSON.stringify({
            id: crypto.randomUUID(),
            revision: view.revision,
            action: { type: "ready", ready: true },
          }),
        );
      });
      await page.waitForFunction(
        () =>
          window.roomTest.view.players.find(
            (p) => p.id === window.roomTest.view.yourId,
          )?.ready,
      );
    }
    await pages[0].waitForFunction(() =>
      window.roomTest.view.players.every((p) => p.ready),
    );
    await pages[0].evaluate(() => {
      const { socket, view } = window.roomTest;
      socket.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          revision: view.revision,
          action: { type: "start" },
        }),
      );
    });
    for (const page of pages)
      await page.waitForFunction(
        () => window.roomTest.view.game?.phase === "playing",
      );
    const move = await pages[0].evaluate(() => {
      const { socket, view } = window.roomTest;
      const command = {
        id: crypto.randomUUID(),
        revision: view.revision,
        action: { type: "play", cardId: view.game!.legalCardIds[0] },
      };
      socket.send(JSON.stringify(command));
      return command;
    });
    await pages[0].waitForFunction(
      () => window.roomTest.view.game!.hand.length === 12,
    );
    const before = await Promise.all(
      pages.map((page) => page.evaluate(() => window.roomTest.view)),
    );
    await stop();
    await start();
    await connectAll();
    const after = await Promise.all(
      pages.map((page) => page.evaluate(() => window.roomTest.view)),
    );
    for (let i = 0; i < 4; i++) {
      expect(after[i].yourId).toBe(before[i].yourId);
      expect(after[i].game).toEqual(before[i].game);
    }
    // The saved receipt recognizes the old request even after the runtime restart.
    const acknowledged = await pages[0].evaluate(async (move) => {
      const socket = window.roomTest.socket;
      return new Promise<boolean>((done) => {
        const listener = (event: MessageEvent) => {
          const message = JSON.parse(event.data);
          if (message.id === move.id) {
            socket.removeEventListener("message", listener);
            done(message.type === "ack");
          }
        };
        socket.addEventListener("message", listener);
        socket.send(JSON.stringify(move));
      });
    }, move);
    expect(acknowledged).toBe(true);
    expect(
      await pages[0].evaluate(() => window.roomTest.view.game!.hand.length),
    ).toBe(12);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await stop();
    await rm(storage, { recursive: true, force: true });
  }
});
