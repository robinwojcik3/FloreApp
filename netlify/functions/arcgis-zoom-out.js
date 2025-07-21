const puppeteerCore = require('puppeteer-core');
const puppeteer = require('puppeteer');
require('dotenv').config();
process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';

const ARC_GIS_URL =
  'https://www.arcgis.com/apps/webappviewer/index.html?id=' +
  'bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289';

exports.handler = async () => {
  const ws = process.env.CHROME_WS_ENDPOINT;
  let browser;
  try {
    if (ws) {
      browser = await puppeteerCore.connect({ browserWSEndpoint: ws });
    } else {
      browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(ARC_GIS_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    await page.waitForTimeout(5000);
    const zoomOutBtn = await page.waitForSelector('.zoom.zoom-out', { timeout: 5000 });
    for (let i = 0; i < 4; i++) {
      await zoomOutBtn.click();
      await page.waitForTimeout(300);
    }

    const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, screenshot }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  } finally {
    if (browser) await browser.close();
  }
};
