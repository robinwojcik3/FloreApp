"use strict";

// We try to reuse an existing Chrome instance (Browserless for example)
// via a WebSocket endpoint. When no endpoint is defined we fall back to
// launching the Chromium bundled with the `puppeteer` package.
const puppeteerCore = require("puppeteer-core");
const puppeteer = require("puppeteer");

// Load the local `.env` file when running with `netlify dev`.
require("dotenv").config();

// Prevent Netlify from downloading Chromium on install since we may use
// an external browser.
process.env.PUPPETEER_SKIP_DOWNLOAD = "true";

const ARC_GIS_URL =
  'https://www.arcgis.com/apps/webappviewer/index.html?id=' +
  'bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289';

// CSS selector used to detect the pop-up displayed after clicking on the map
const POPUP_SEL = '.esriPopup, .esri-popup, .esri-popup__main, .dijitPopup';

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
    // Load the ArcGIS map and wait until all requests have settled
    await page.goto(ARC_GIS_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Wait for the map element then click roughly at its centre
    const map = await page.waitForSelector('#map_gc', { timeout: 10_000 });
    const { x, y, width, height } = await map.boundingBox();
    await page.mouse.click(x + width / 2, y + height / 2);

    // Wait for the pop-up showing the vegetation information
    await page.waitForSelector(POPUP_SEL, { timeout: 2_000 });

    // Extract the text inside the pop-up element
    const data = await page.evaluate((sel) => {
      const n = document.querySelector(sel);
      return n ? n.innerText.trim() : null;
    }, POPUP_SEL);

    // Send the result back to the client in JSON format
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, data }),
    };
  } catch (err) {
    // Any error (timeout, missing selector, etc.) is returned to the caller
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  } finally {
    if (browser) await browser.close();
  }
};
