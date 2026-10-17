// Rasterises the SVG icons in public/ into the PNGs the manifest and iOS use.
// Dev-only: uses the Playwright Chromium that the e2e suite already installs.
//   npm run icons
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const pub = fileURLToPath(new URL("../public/", import.meta.url));
const jobs = [
  { src: "icon.svg", out: "icon-192.png", size: 192, opaque: false },
  { src: "icon.svg", out: "icon-512.png", size: 512, opaque: false },
  { src: "icon-maskable.svg", out: "icon-maskable.png", size: 512, opaque: true },
  { src: "icon-maskable.svg", out: "apple-touch-icon.png", size: 180, opaque: true },
];

const browser = await chromium.launch();
try {
  for (const job of jobs) {
    const page = await browser.newPage({
      viewport: { width: job.size, height: job.size },
      deviceScaleFactor: 1,
    });
    const svg = readFileSync(pub + job.src, "utf8");
    const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}img{display:block;width:100vw;height:100vh}</style><img src="${data}">`,
    );
    await page.locator("img").evaluate((img) => img.decode());
    await page.screenshot({ path: pub + job.out, omitBackground: !job.opaque });
    await page.close();
    console.log(`${job.out} ${job.size}px`);
  }
} finally {
  await browser.close();
}
