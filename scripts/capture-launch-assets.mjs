import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "docs", "launch-assets");
const siteUrl = "https://borderlessbusinessdays.com";

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1270, height: 760 } });
const page = await context.newPage();

async function capture(url, filename) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputDir, filename) });
}

await capture(`${siteUrl}/?countries=US,GB&mode=add&start=2026-08-03&amount=30`, "product-hunt-calculator.png");
const icon = await page.locator(".brand-mark").innerHTML();
await capture(`${siteUrl}/guides/international-payment-due-date-calculator/`, "product-hunt-guide.png");
const thumbnailContext = await browser.newContext({ viewport: { width: 240, height: 240 } });
const thumbnailPage = await thumbnailContext.newPage();
await thumbnailPage.setContent(`<!doctype html>
<html>
  <head>
    <style>
      * { box-sizing: border-box; }
      html, body { width: 240px; height: 240px; margin: 0; }
      body { background: #edf2ee; color: #14221b; font-family: Arial, Helvetica, sans-serif; }
      main { display: flex; width: 100%; height: 100%; flex-direction: column; padding: 19px; border: 3px solid #14221b; }
      .top { display: flex; align-items: center; justify-content: space-between; }
      .mark { display: grid; width: 33px; height: 33px; place-items: center; border: 1px solid #14221b; border-radius: 4px; background: #f7faf7; color: #1f7450; }
      .mark svg { width: 19px; height: 19px; stroke-width: 2.2; }
      .market { color: #1f7450; font-size: 7px; font-weight: 800; }
      .eyebrow { margin: 26px 0 6px; color: #1f7450; font-size: 7px; font-weight: 800; text-transform: uppercase; }
      h1 { margin: 0; font-size: 24px; line-height: 0.94; letter-spacing: 0; }
      .bottom { margin-top: auto; padding-top: 9px; border-top: 1px solid #7f9187; color: #516259; font-size: 7px; font-weight: 700; line-height: 1.3; }
    </style>
  </head>
  <body>
    <main>
      <div class="top"><div class="mark">${icon}</div><div class="market">206 markets</div></div>
      <div class="eyebrow">Cross-border planning</div>
      <h1>Borderless<br>Business Days</h1>
      <div class="bottom">Shared working days across countries.</div>
    </main>
  </body>
</html>`);
await thumbnailPage.screenshot({ path: path.join(outputDir, "product-hunt-thumbnail.png") });

await thumbnailContext.close();
await context.close();
await browser.close();

console.log(`Wrote launch assets to ${outputDir}`);
