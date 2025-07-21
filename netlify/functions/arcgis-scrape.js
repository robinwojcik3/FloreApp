// Chargement de .env en développement
require('dotenv').config();

// Évite le téléchargement automatique de Chromium lors de l'installation
process.env.PUPPETEER_SKIP_DOWNLOAD = 'true';

// Dépendances Puppeteer : la version "core" est utilisée avec un navigateur
// distant (Browserless, Chrome headless...), sinon on lance celui fourni.
const puppeteerCore = require('puppeteer-core');
const localPuppeteer = require('puppeteer');

// Adresse de la "Carte de la végétation" hébergée sur ArcGIS Online
const ARC_GIS_URL =
  'https://www.arcgis.com/apps/webappviewer/index.html?id=' +
  'bece6e542e4c42e0ba9374529c7de44c&center=623474.6438%2C5625419.691%2C102100&scale=577790.554289';

exports.handler = async () => {
  // WebSocket vers un navigateur distant, ex. Browserless
  const ws = process.env.CHROME_WS_ENDPOINT;
  const puppeteer = ws ? puppeteerCore : localPuppeteer;
  let browser;
  try {
    // Connexion au navigateur (distant ou local)
    browser = ws
      ? await puppeteer.connect({ browserWSEndpoint: ws })
      : await puppeteer.launch({ args: ['--no-sandbox'] });

    // Préparation et navigation
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(ARC_GIS_URL, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Attente de la div contenant la carte puis clic en son centre
    const map = await page.waitForSelector('#map_gc', { timeout: 10_000 });
    const { x, y, width, height } = await map.boundingBox();
    await page.mouse.click(x + width / 2, y + height / 2);

    // Attente de l'apparition de la pop-up ArcGIS
    const popupSel = '.esriPopup, .esri-popup, .esri-popup__main, .dijitPopup';
    await page.waitForSelector(popupSel, { timeout: 2_000 });

    // Extraction du texte affiché
    const data = await page.evaluate(sel => {
      const n = document.querySelector(sel);
      return n ? n.innerText.trim() : null;
    }, popupSel);

    if (!data) throw new Error('Pop-up introuvable');

    // Réponse en JSON pour le frontend
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  } finally {
    if (browser) await browser.close();
  }
};
