const puppeteer = require('puppeteer-core');

const ARC_GIS_URL =
  'https://www.arcgis.com/apps/webappviewer/index.html?id=' +
  'bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289';

exports.handler = async () => {
  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: process.env.CHROME_WS_ENDPOINT,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(ARC_GIS_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

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
