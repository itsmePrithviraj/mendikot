import { test, expect } from "@playwright/test";
import { newGame, playCard, chooseBotCard } from "../src/game/engine";
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
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
  await expect(page.locator(".hand")).toHaveCSS("display", "grid");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".hand")).toHaveCSS("display", "flex");
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
test("responsive table captures and essential controls remain within viewport", async ({
  page,
}) => {
  let game = newGame(seeded(44), 0, "cut");
  for (let i = 0; i < 3; i++)
    game = playCard(game, game.turn, chooseBotCard(game).id);
  await page.addInitScript((g) => {
    localStorage.setItem("mendikot.game.v1", JSON.stringify(g));
    localStorage.setItem(
      "mendikot.preferences.v1",
      JSON.stringify({ reducedMotion: true }),
    );
  }, game);
  const views = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
    { name: "landscape", width: 844, height: 390 },
    { name: "small-phone", width: 320, height: 740 },
    { name: "tablet", width: 768, height: 1024 },
  ];
  for (const v of views) {
    await page.setViewportSize(v);
    await page.goto("/");
    await page.locator(".hand-card.legal").first().click();
    await expect(page.locator(".played-card").getByRole("img")).toHaveCount(3);
    for (const card of await page
      .locator(".played-card")
      .getByRole("img")
      .all()) {
      await expect(card).toHaveAttribute(
        "aria-label",
        / of (spades|hearts|clubs|diamonds)$/,
      );
    }
    await page.screenshot({
      path: `.impeccable/review/${v.name}.png`,
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow, v.name).toBe(false);
    const box = await page
      .getByRole("button", { name: "Play card", exact: true })
      .boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(v.width);
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
