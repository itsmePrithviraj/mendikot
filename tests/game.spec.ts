import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  newGame,
  playCard,
  chooseBotCard,
  collectTrick,
} from "../src/game/engine";
import type { Game } from "../src/game/engine";
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
/** Distinct rows the hand occupies (cards are never re-rendered per orientation). */
const handRows = (page: Page) =>
  page.locator(".hand-card").evaluateAll((cards) => {
    const boxes = cards.map((c) => c.getBoundingClientRect());
    const tops = boxes.map((b) => b.top).sort((a, b) => a - b);
    const half = boxes[0].height / 2;
    return 1 + tops.slice(1).filter((t, i) => t - tops[i] > half).length;
  });
test("five cards precede chosen hukum; rotation and refresh preserve the hand", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mendikot.preferences.v1",
      JSON.stringify({ reducedMotion: true, sound: false, speed: "quick" }),
    ),
  );
  await page.goto("/");
  await page.getByLabel("Choose hukum", { exact: false }).check();
  await page.getByRole("button", { name: "Take your seat" }).click();
  await expect(
    page.getByRole("button", { name: "Choose hearts as hukum" }),
  ).toBeVisible();
  await expect(page.locator(".hand-card")).toHaveCount(5);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mendikot.game.v1")!).reserve.length,
    ),
  ).toBe(32);
  await page.getByRole("button", { name: "Choose hearts as hukum" }).click();
  await expect(page.locator(".hand-card")).toHaveCount(13);
  await expect(page.locator(".turn-status")).toContainText("Your turn");
  const saved = await page.evaluate(() =>
    localStorage.getItem("mendikot.game.v1"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => handRows(page)).toBe(2);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => handRows(page)).toBe(1);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect.poll(() => handRows(page)).toBe(3);
  await expect(page.locator(".hand-card")).toHaveCount(13);
  expect(
    await page.evaluate(() => localStorage.getItem("mendikot.game.v1")),
  ).toBe(saved);
  await page.reload();
  await expect(page.locator(".hand-card")).toHaveCount(13);
  expect(
    await page.evaluate(() => localStorage.getItem("mendikot.game.v1")),
  ).toBe(saved);
});
test("cut mode starts with thirteen; preview does not play; confirmation advances", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Take your seat" }).click();
  await expect(page.locator(".turn-status")).toContainText("Your turn", {
    timeout: 10000,
  });
  await expect(page.locator(".hand-card")).toHaveCount(13);
  await page.locator(".hand-card").first().click();
  await expect(page.locator(".hand-card")).toHaveCount(13);
  await expect(
    page.getByRole("button", { name: "Play card", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Play card", exact: true }).click();
  await expect(page.locator(".hand-card")).toHaveCount(12);
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("production PWA survives an offline reload with its saved game", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole("button", { name: "Take your seat" }).click();
  await expect(page.locator(".turn-status")).toContainText("Your turn", {
    timeout: 10000,
  });
  const saved = await page.evaluate(() =>
    localStorage.getItem("mendikot.game.v1"),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".hand-card")).toHaveCount(13);
  expect(
    await page.evaluate(() => localStorage.getItem("mendikot.game.v1")),
  ).toBe(saved);
  await expect(page.locator(".table-tools")).toContainText("Offline");
  await page.locator(".hand-card").first().click();
  await page.getByRole("button", { name: "Play card", exact: true }).click();
  await expect(page.locator(".hand-card")).toHaveCount(12);
});
function playingGame(): Game {
  let game = newGame(seeded(44), 0, "cut");
  for (let i = 0; i < 3; i++)
    game = playCard(game, game.turn, chooseBotCard(game).id);
  return game;
}
function trickCompleteGame(): Game {
  const game = playingGame();
  return playCard(game, 0, chooseBotCard(game).id);
}
function completeGame(): Game {
  let game = newGame(seeded(11), 2, "cut");
  while (game.phase !== "complete")
    game =
      game.phase === "trick-complete"
        ? collectTrick(game)
        : playCard(game, game.turn, chooseBotCard(game).id);
  return game;
}
const STATES: { name: string; game: Game | null }[] = [
  { name: "lobby", game: null },
  { name: "choosing", game: newGame(seeded(3), 3, "choose") },
  { name: "playing", game: playingGame() },
  { name: "trick-complete", game: trickCompleteGame() },
  { name: "complete", game: completeGame() },
];
const VIEWS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 780 },
  { width: 320, height: 740 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
  { width: 667, height: 375 },
];
async function load(page: Page, game: Game | null) {
  await page.goto("/");
  await page.evaluate((g) => {
    localStorage.clear();
    localStorage.setItem(
      "mendikot.preferences.v1",
      JSON.stringify({ reducedMotion: true }),
    );
    if (g) localStorage.setItem("mendikot.game.v1", JSON.stringify(g));
  }, game);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
}
/** Geometry contract shared by every viewport and state. */
async function checkLayout(
  page: Page,
  label: string,
  safe = { top: 0, right: 0, bottom: 0, left: 0 },
) {
  const v = page.viewportSize()!;
  const report = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden";
    };
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const small: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("svg") || !visible(el)) continue;
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent!.trim(),
      );
      if (hasText && parseFloat(getComputedStyle(el).fontSize) < 11)
        small.push(el.className.toString() || el.tagName);
    }
    const select = (q: string) =>
      [...document.querySelectorAll(q)].filter(visible).map(box);
    return {
      scroll: {
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
      },
      small,
      buttons: [...document.querySelectorAll("button")]
        .filter((b) => visible(b) && !b.closest(".hand") && !b.closest("dialog"))
        .map((b) => ({ name: b.textContent || b.getAttribute("aria-label"), ...box(b) })),
      cards: select(".hand-card"),
      inside: select(
        ".play-btn, .turn-status, .hukum-chip, .seat, .played-card, .start-btn, .suit-option, .result-panel .btn",
      ),
      statusFont: [...document.querySelectorAll(".turn-status")].map((s) =>
        parseFloat(getComputedStyle(s).fontSize),
      ),
    };
  });
  expect(report.scroll.w, `${label} horizontal overflow`).toBeLessThanOrEqual(v.width);
  expect(report.scroll.h, `${label} vertical overflow`).toBeLessThanOrEqual(v.height);
  expect(report.small, `${label} text under 11px`).toEqual([]);
  for (const b of report.buttons) {
    expect(b.w, `${label} ${b.name} width`).toBeGreaterThanOrEqual(44);
    expect(b.h, `${label} ${b.name} height`).toBeGreaterThanOrEqual(44);
  }
  for (const c of report.cards) {
    expect(c.w, `${label} card width`).toBeGreaterThanOrEqual(v.width <= 320 ? 40 : 44);
    expect(c.h, `${label} card height`).toBeGreaterThanOrEqual(44);
  }
  if (v.width > v.height && report.cards.length > 1) {
    const lefts = report.cards.map((c) => c.x).sort((a, b) => a - b);
    const step = Math.min(...lefts.slice(1).map((x, i) => x - lefts[i]));
    expect(step, `${label} visible card strip`).toBeGreaterThanOrEqual(40);
  }
  const tolerance = 1;
  for (const b of [...report.inside, ...report.cards]) {
    expect(b.x, `${label} left edge`).toBeGreaterThanOrEqual(safe.left - tolerance);
    expect(b.y, `${label} top edge`).toBeGreaterThanOrEqual(safe.top - tolerance);
    expect(b.x + b.w, `${label} right edge`).toBeLessThanOrEqual(v.width - safe.right + tolerance);
    expect(b.y + b.h, `${label} bottom edge`).toBeLessThanOrEqual(v.height - safe.bottom + tolerance);
  }
  for (const size of report.statusFont)
    expect(size, `${label} status size`).toBeGreaterThanOrEqual(12);
  await page.mouse.move(v.width / 2, v.height / 2);
  await page.mouse.wheel(0, 600);
  expect(
    await page.evaluate(() => scrollY + document.scrollingElement!.scrollTop),
    `${label} page scrolled`,
  ).toBe(0);
}
for (const v of VIEWS) {
  test(`responsive table ${v.width}x${v.height}: every state fits, nothing scrolls`, async ({
    page,
  }) => {
    await page.setViewportSize(v);
    await page.clock.install();
    for (const s of STATES) {
      await load(page, s.game);
      if (s.name === "playing") {
        await page.locator(".hand-card.legal").first().click();
        await expect(page.locator(".played-card").getByRole("img")).toHaveCount(3);
        for (const card of await page.locator(".played-card").getByRole("img").all())
          await expect(card).toHaveAttribute("aria-label", / of (spades|hearts|clubs|diamonds)$/);
        await expect(page.getByRole("button", { name: "Play card", exact: true })).toBeEnabled();
      }
      if (s.name === "lobby")
        await expect(page.getByRole("button", { name: "Take your seat" })).toBeVisible();
      if (s.name === "choosing")
        await expect(page.getByRole("button", { name: "Choose hearts as hukum" })).toBeVisible();
      if (s.name === "trick-complete")
        await expect(page.locator(".played-card")).toHaveCount(4);
      if (s.name === "complete")
        await expect(page.getByRole("button", { name: "Deal again" })).toBeVisible();
      await page.screenshot({ path: `.impeccable/review/${v.width}x${v.height}-${s.name}.png` });
      await checkLayout(page, `${v.width}x${v.height} ${s.name}`);
    }
  });
}
test("simulated safe areas keep controls clear of notches and home indicators", async ({
  page,
}) => {
  await page.clock.install();
  const cases = [
    { view: { width: 390, height: 844 }, safe: { top: 47, right: 0, bottom: 34, left: 0 } },
    { view: { width: 844, height: 390 }, safe: { top: 0, right: 47, bottom: 21, left: 47 } },
    { view: { width: 932, height: 430 }, safe: { top: 0, right: 59, bottom: 21, left: 59 } },
  ];
  for (const { view, safe } of cases) {
    await page.setViewportSize(view);
    for (const s of [STATES[2], STATES[1], STATES[4]]) {
      await load(page, s.game);
      await page.addStyleTag({
        content: `:root{--safe-top:${safe.top}px;--safe-right:${safe.right}px;--safe-bottom:${safe.bottom}px;--safe-left:${safe.left}px}`,
      });
      await checkLayout(page, `${view.width}x${view.height} safe ${s.name}`, safe);
    }
    const play = await page.getByRole("button", { name: "Deal again" }).boundingBox();
    expect(play!.y + play!.height).toBeLessThanOrEqual(view.height - safe.bottom);
  }
});
test("plays an entire deal through the interface and shows the result", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "mendikot.preferences.v1",
      JSON.stringify({ reducedMotion: true, sound: false, speed: "quick" }),
    ),
  );
  await page.goto("/");
  await page.clock.install();
  await page.getByRole("button", { name: "Take your seat" }).click();
  let complete = false;
  for (let i = 0; i < 150; i++) {
    await page.clock.fastForward(2500);
    const g = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mendikot.game.v1")!),
    );
    if (g.phase === "complete") {
      complete = true;
      break;
    }
    if (
      g.phase === "playing" &&
      g.turn === 0 &&
      (await page.locator(".hand-card.legal").first().isEnabled())
    ) {
      await page.locator(".hand-card.legal").first().click();
      await page
        .getByRole("button", { name: "Play card", exact: true })
        .click();
    }
  }
  expect(complete).toBe(true);
  await expect(page.getByRole("button", { name: "Deal again" })).toBeVisible();
  const g = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mendikot.game.v1")!),
  );
  expect(g.tricks[0] + g.tricks[1]).toBe(13);
  expect(g.captured.flat()).toHaveLength(52);
  await page.screenshot({
    path: ".impeccable/review/result-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/result-mobile.png",
    fullPage: true,
  });
});
