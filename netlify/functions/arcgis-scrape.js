// Use puppeteer-core when connecting to a remote browserless instance
// Fallback to the full puppeteer package when no endpoint is provided
const puppeteerCore = require('puppeteer-core');
const puppeteer = require('puppeteer');
require('dotenv').config(); // charge .env en dev
process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';

const ARC_GIS_URL =
  'https://www.arcgis.com/apps/webappviewer/index.html?id=' +
  'bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289';

exports.handler = async () => {
  const ws = process.env.CHROME_WS_ENDPOINT;
  let browser;
  try {
    if (ws) {
      // Connect to a remote Chrome instance when provided
      browser = await puppeteerCore.connect({ browserWSEndpoint: ws });
    } else {
      // Fall back to launching a local Chromium bundled with puppeteer
      browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(ARC_GIS_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Wait 5s for the page to fully render before interacting
    await page.waitForTimeout(5000);

    // Automatically zoom out 4 times if the control is available
    const zoomSel = '.zoom.zoom-out';
    try {
      await page.waitForSelector(zoomSel, { timeout: 5000 });
      for (let i = 0; i < 4; i++) {
        await page.click(zoomSel);
        await page.waitForTimeout(200);
      }
    } catch (err) {
      // Ignore if zoom control isn't found; continue scraping
    }

    const map = await page.waitForSelector('#map_gc', { timeout: 10_000 });
    const { x, y, width, height } = await map.boundingBox();
    await page.mouse.click(x + width / 2, y + height / 2);

    const popupSel = '.esriPopup, .esri-popup, .esri-popup__main, .dijitPopup';
    await page.waitForSelector(popupSel, { timeout: 2_000 });

    const data = await page.evaluate(sel => {
      const n = document.querySelector(sel);
      return n ? n.innerText.trim() : null;
    }, popupSel);

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, data }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  } finally {
    if (browser) await browser.close();
  }
};
