/**
 * Netlify serverless function used to query the ArcGIS vegetation map.
 * It loads the map, simulates a click at the centre and returns the
 * text content of the resulting pop-up.
 *
 * When `CHROME_WS_ENDPOINT` is defined, the function connects to the
 * remote browser via puppeteer-core (typically Browserless). Otherwise
 * it falls back to launching the local Chromium bundled with puppeteer.
 */
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
      // Connect to the remote Chrome instance defined by CHROME_WS_ENDPOINT
      browser = await puppeteerCore.connect({ browserWSEndpoint: ws });
    } else {
      // No endpoint provided: launch the bundled Chromium instead
      browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(ARC_GIS_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Wait for the map element and click roughly at its centre
    const map = await page.waitForSelector('#map_gc', { timeout: 10_000 });
    const { x, y, width, height } = await map.boundingBox();
    await page.mouse.click(x + width / 2, y + height / 2);

    // Pop-up container used by various ArcGIS themes
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
