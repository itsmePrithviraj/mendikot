import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import type { RoomSnapshot } from "../../src/multiplayer/protocol";

const baseURL = "http://localhost:8787";
async function player(browser: Browser) {
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: "block",
    reducedMotion: "reduce",
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "mendikot.preferences.v1",
      JSON.stringify({ reducedMotion: true, sound: false }),
    ),
  );
  return { context, page: await context.newPage() };
}
async function snapshot(page: Page, code: string): Promise<RoomSnapshot> {
  return page.evaluate(async (code) => {
    const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, code);
}
async function connected(page: Page) {
  await expect(page.locator(".online-app")).toHaveAttribute(
    "data-connection",
    "connected",
  );
}
async function table(
  browser: Browser,
  mode: "cut" | "choose",
  names = ["Asha", "Dev", "Mira", "Rohan"],
) {
  const users = await Promise.all([0, 1, 2, 3].map(() => player(browser)));
  const pages = users.map((u) => u.page);
  await pages[0].goto("/");
  await pages[0]
    .getByRole("button", { name: "Play with friends", exact: true })
    .last()
    .click();
  await pages[0].getByLabel("Your name").fill(names[0]);
  if (mode === "choose")
    await pages[0].getByLabel("Choose hukum", { exact: false }).check();
  await pages[0]
    .getByRole("button", { name: "Create room", exact: true })
    .click();
  await expect(pages[0].locator(".room-invite strong")).toBeVisible();
  const code = (await pages[0].locator(".room-invite strong").textContent())!;
  for (let i = 1; i < 4; i++) {
    await pages[i].goto(`/?room=${code}`);
    await pages[i].getByLabel("Your name").fill(names[i]);
    await pages[i]
      .getByRole("button", { name: "Join room", exact: true })
      .click();
    await connected(pages[i]);
  }
  for (const page of pages)
    await expect(page.locator(".lobby-person")).toHaveCount(4);
  return { users, pages, code };
}
async function readyAndStart(pages: Page[]) {
  for (const page of pages) {
    await page
      .getByRole("button", { name: "Ready to play", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Not ready", exact: true }),
    ).toBeEnabled();
  }
  await expect(
    pages[0].getByRole("button", { name: "Start deal" }),
  ).toBeEnabled();
  await pages[0].getByRole("button", { name: "Start deal" }).click();
  await Promise.all(
    pages.map((page) => expect(page.locator(".hand-card")).not.toHaveCount(0)),
  );
}

for (const mode of ["cut", "choose"] as const) {
  test(`four isolated browsers finish ${mode} hukum, preserve private hands and rematch`, async ({
    browser,
  }) => {
    const { users, pages, code } = await table(browser, mode);
    try {
      await readyAndStart(pages);
      const initial = await Promise.all(
        pages.map((page) => snapshot(page, code)),
      );
      for (let i = 0; i < 4; i++) {
        expect(initial[i].yourSeat).toBe(i);
        expect(initial[i].game!.hand).toHaveLength(mode === "choose" ? 5 : 13);
        const payload = JSON.stringify(initial[i]);
        expect(payload).not.toMatch(/tokenHash|reserve|"hands"|receipts/);
        for (let j = 0; j < 4; j++)
          if (i !== j)
            for (const card of initial[j].game!.hand)
              expect(payload).not.toContain(card.id);
        expect(
          await pages[i].evaluate(() =>
            localStorage.getItem("mendikot.game.v1"),
          ),
        ).toBeNull();
      }
      if (mode === "choose") {
        await pages[0]
          .getByRole("button", { name: "Choose hearts as hukum" })
          .click();
        for (const page of pages)
          await expect(page.locator(".hand-card")).toHaveCount(13);
      }
      // A returning player keeps their exact hand and identity; others stay in the same deal.
      const before = await snapshot(pages[2], code);
      await pages[2].reload();
      await connected(pages[2]);
      const restored = await snapshot(pages[2], code);
      expect(restored.yourId).toBe(before.yourId);
      expect(restored.game!.hand).toEqual(before.game!.hand);
      expect(restored.game!.id).toBe(before.game!.id);
      let moves = 0;
      while (true) {
        const host = await snapshot(pages[0], code);
        const game = host.game!;
        if (game.phase === "complete") break;
        if (game.phase === "trick-complete") {
          await expect
            .poll(async () => (await snapshot(pages[0], code)).game!.phase)
            .not.toBe("trick-complete");
          continue;
        }
        const page = pages[game.turn]; // Host is absolute seat zero for this deal.
        const own = await snapshot(page, code);
        await expect(page.locator(".hand-card.legal").first()).toBeEnabled();
        await page.locator(".hand-card.legal").first().click();
        await page
          .getByRole("button", { name: "Play card", exact: true })
          .click();
        await expect(page.locator(".hand-card")).toHaveCount(
          own.game!.hand.length - 1,
        );
        moves++;
        expect(moves).toBeLessThanOrEqual(52);
      }
      expect(moves).toBe(52);
      for (const page of pages)
        await expect(
          page.getByRole("button", { name: "Return to room for a rematch" }),
        ).toBeVisible();
      const results = await Promise.all(
        pages.map((page) => snapshot(page, code)),
      );
      expect(results[0].game!.tricks.reduce((a, b) => a + b)).toBe(13);
      expect(results[0].game!.tricks).toEqual(results[2].game!.tricks);
      expect(results[1].game!.tricks).toEqual(
        [...results[0].game!.tricks].reverse(),
      );
      for (const page of pages)
        await page
          .getByRole("button", { name: "Return to room for a rematch" })
          .click();
      await readyAndStart(pages);
      expect((await snapshot(pages[0], code)).game!.id).not.toBe(
        results[0].game!.id,
      );
      expect((await snapshot(pages[0], code)).game!.dealer).toBe(0);
    } finally {
      await Promise.all(users.map((u) => u.context.close()));
    }
  });
}

test("authentication, origin protection, duplicate moves, replacement tabs and leaving", async ({
  browser,
  request,
}) => {
  const { users, pages, code } = await table(browser, "cut");
  try {
    expect((await request.get(`/api/rooms/${code}`)).status()).toBe(401);
    expect(
      (
        await request.post("/api/rooms", {
          headers: { Origin: "https://other.example" },
          data: { name: "Other", mode: "cut" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post(`/api/rooms/${code}/join`, {
          headers: { Origin: baseURL },
          data: { name: "Fifth" },
        })
      ).status(),
    ).toBe(409);
    const res = await pages[0].evaluate(async () =>
      fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x".repeat(4096), mode: "cut" }),
      }).then((r) => r.status),
    );
    expect(res).toBe(400);
    await readyAndStart(pages);
    // A second tab in the same browser reclaims the same seat; the original stops retrying.
    const replacement = await users[0].context.newPage();
    await replacement.goto(`/?room=${code}`);
    await replacement.getByLabel("Your name").fill("Same person");
    await replacement
      .getByRole("button", { name: "Join room", exact: true })
      .click();
    await connected(replacement);
    await expect(pages[0].locator(".online-app")).toHaveAttribute(
      "data-connection",
      "replaced",
    );
    expect((await snapshot(replacement, code)).yourId).toBe(
      (await snapshot(pages[0], code)).yourId,
    );
    // A raw socket uses the same cookies, so this tests real transport validation/deduplication.
    const outcome = await replacement.evaluate(async (code) => {
      const ws = new WebSocket(
        `ws://${location.host}/api/rooms/${code}/socket`,
      );
      return new Promise<{ counts: number[]; errors: string[] }>(
        (resolve, reject) => {
          const counts: number[] = [],
            errors: string[] = [];
          let sent = false,
            acknowledgements = 0;
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error("Socket test timed out"));
          }, 10000);
          ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === "error") errors.push(msg.message);
            if (msg.type === "ack") acknowledgements++;
            if (msg.type === "snapshot") {
              counts.push(msg.room.game.hand.length);
              if (!sent) {
                sent = true;
                // The attempted seat field is ignored; player identity comes from the cookie.
                ws.send(
                  JSON.stringify({
                    id: "invalid-card-action",
                    revision: msg.room.revision,
                    action: { type: "play", cardId: "bogus" },
                  }),
                );
                const command = {
                  id: "duplicate-card-action",
                  revision: msg.room.revision,
                  action: {
                    type: "play",
                    cardId: msg.room.game.legalCardIds[0],
                  },
                };
                ws.send(JSON.stringify(command));
                ws.send(JSON.stringify(command));
              } else if (acknowledgements === 2) {
                clearTimeout(timeout);
                ws.close();
                resolve({ counts, errors });
              }
            }
          };
        },
      );
    }, code);
    expect(outcome.counts.at(-1)).toBe(12);
    expect(outcome.errors).toContain("Invalid action.");
    await pages[1].getByRole("button", { name: "Menu", exact: true }).click();
    await pages[1].getByRole("button", { name: "Room & players" }).click();
    pages[1].once("dialog", (dialog) => dialog.accept());
    await pages[1]
      .getByRole("button", { name: "Leave room", exact: true })
      .click();
    await expect(
      pages[2].getByText("Dev left. This deal has ended without a winner."),
    ).toBeVisible();
    expect((await snapshot(pages[2], code)).game).toBeNull();
  } finally {
    await Promise.all(users.map((u) => u.context.close()));
  }
});

test("maximum-length player names stay inside the online table", async ({
  browser,
}) => {
  const names = [
    "Prithviraj",
    "Alexandria Longplayer AB",
    "Mira With A Long Surname",
    "Rohan With A Long Name!!",
  ];
  const { users, pages } = await table(browser, "cut", names);
  try {
    await readyAndStart(pages);
    const page = pages[0];
    await expect(page.locator(".online-app")).toHaveAttribute(
      "data-stage",
      "ready",
    );
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
      ["narrow", 320, 740],
      ["landscape", 844, 390],
    ] as const) {
      await page.setViewportSize({ width, height });
      for (const label of await page.locator(".seat-name").all()) {
        const box = await label.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(await label.textContent()).toBe(
          await label.getAttribute("title"),
        );
      }
      await page.screenshot({
        path: `.impeccable/review/online-game-${name}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await Promise.all(users.map((u) => u.context.close()));
  }
});

test("entry and lobby fit desktop, portrait and landscape phones", async ({
  browser,
}) => {
  const { context, page } = await player(browser);
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Play with friends", exact: true })
      .last()
      .click();
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
      ["narrow", 320, 740],
      ["landscape", 844, 390],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByLabel("Your name")).toBeVisible();
      await page.screenshot({
        path: `.impeccable/review/online-entry-${name}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(
        await page
          .locator(".room-scroll")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
    }
    await page.getByLabel("Your name").fill("Prithviraj");
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    await expect(page.locator(".room-invite")).toBeVisible();
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
      ["narrow", 320, 740],
      ["landscape", 844, 390],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.locator(".room-scroll").evaluate((e) => {
        e.scrollTop = 0;
      });
      await page.screenshot({
        path: `.impeccable/review/online-lobby-${name}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(
        await page
          .locator(".room-scroll")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Ready to play", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        page.getByRole("button", { name: "Ready to play", exact: true }),
      ).toBeInViewport();
    }
  } finally {
    await context.close();
  }
});
