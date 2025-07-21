/**
 * Connects to the ArcGIS "Carte de la végétation" web app and retrieves
 * the text shown in the popup after clicking on the map.
 *
 * If `CHROME_WS_ENDPOINT` is defined the function connects to this remote
 * browser using `puppeteer-core`. Otherwise it launches the local Chromium
 * bundled with Puppeteer.
 */
// Lightweight package used when a remote Chrome endpoint is provided
const puppeteerCore = require('puppeteer-core');
// Full Puppeteer for the local fallback
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
      // Remote browser (Browserless or similar)
      browser = await puppeteerCore.connect({ browserWSEndpoint: ws });
    } else {
      // Local Chromium fallback
      browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    }

    const page = await browser.newPage();
    // Ensure the map has enough space for the click to be triggered
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(ARC_GIS_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Wait for the map container and click roughly at its center
    const map = await page.waitForSelector('#map_gc', { timeout: 10_000 });
    const { x, y, width, height } = await map.boundingBox();
    await page.mouse.click(x + width / 2, y + height / 2);

    // Several selectors are supported depending on the ArcGIS version
    const popupSel = '.esriPopup, .esri-popup, .esri-popup__main, .dijitPopup';
    await page.waitForSelector(popupSel, { timeout: 2_000 });

    const data = await page.evaluate((sel) => {
      const n = document.querySelector(sel);
      return n ? n.innerText.trim() : null;
    }, popupSel);

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, data }),
    };
  } catch (err) {
    // Any error (timeout, missing popup, etc.) is returned to the client
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  } finally {
    if (browser) await browser.close();
  }
};
