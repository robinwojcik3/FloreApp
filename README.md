# Plantouille Express

Plantouille Express is a progressive web application for plant identification built using the PlantNet API. The project also integrates Google Gemini and Google Text‑to‑Speech for generating short descriptions and audio.

## Prerequisites

- **Node.js** and **npm** for running Netlify serverless functions.
- A recent web browser supporting service workers.
- Optional: **Netlify CLI** for local testing.

## Installing Node dependencies

Serverless functions rely on `jsdom` and `node-fetch`. Install them in the `netlify/functions` folder:

```bash
npm init -y               # if you do not already have a package.json
npm install jsdom node-fetch
```

The function `inpn-proxy.js` requires these modules as shown below:

```javascript
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));
```

## Configuring API keys

Edit `app.js` and replace the placeholder values with your own API keys:

```javascript
const API_KEY  = "your-plantnet-key";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const GEMINI_API_KEY = "your-gemini-key";
const TTS_API_KEY    = "your-text-to-speech-key";
```

These keys are required for PlantNet image identification, Gemini summaries and Google TTS audio synthesis.

## Running the application locally

1. Serve the project from a local HTTP server (for example using `npx serve` or `python3 -m http.server`).
2. Open `http://localhost:PORT/index.html` in your browser. Service workers require an HTTP context, so opening the file directly will not work.
3. The application automatically registers `sw.js` via `sw-register.js` to cache core assets for offline use.
4. For serverless functions, install Netlify CLI and run:

```bash
npm install -g netlify-cli
netlify dev
```

This emulates the Netlify environment and exposes the functions under `/.netlify/functions/`.

## Searching by trigram

When using the "Recherche par nom" field on the homepage, you can now type the
first three letters of the genus and species to quickly locate an entry. For
example `Lam pur` will match **Lamium purpureum**. For taxa with ranks such as
`subsp.` or `var.`, include the rank and the first three letters of the epithet:
`car atr subsp. nig` will resolve to `Carex atrata subsp. nigra`.

## TaxRef Match suggestions

If a typed name does not directly match the local dataset, the application now
queries the [TaxRef Match](https://taxref.mnhn.fr/taxref-match) service to
suggest the closest valid name. The best suggestion is displayed along with its
similarity score and can be selected directly from the search field.

## Deploying to Netlify

1. Push the project to a Git repository (e.g. GitHub).
2. In Netlify, create a new site from your repository.
3. Netlify automatically reads the `netlify.toml` configuration, publishing the root directory and bundling functions from `netlify/functions`.
4. In the site settings, add your API keys as environment variables or embed them directly in `app.js` before deploying.
5. Trigger a deploy. Once finished, your application is accessible from the generated Netlify URL.

## Node version

The project is tested with **Node.js 20** in continuous integration. Use the same
version locally to avoid compatibility issues when running the serverless
functions and the test suite.

## Running tests

Install the development dependencies then execute:

```bash
npm install
npm test
```

This launches the Jest test suite which validates the helper utilities and the
`inpn-proxy.js` serverless function.


## Additional features

- The results table includes buttons linking to INPN and Biodiv'AURA maps for
  quick reference.
- Clicking a species name copies the Latin name to the clipboard.
- Clicking a cell in the "Critères physiologiques", "Écologie" or "Physionomie"
  columns opens an overlay pop‑up with the full text **only after a static
  click**. A swipe used to scroll the table will no longer trigger the pop‑up.
  Clicking outside the pop‑up closes it instantly.
- Google Gemini can generate a comparison table with optional text‑to‑speech
  playback.
- When a single species is searched, a button under the results can retrieve
  suggestions of up to **five** morphologically similar species from the same
  genus using the Gemini API. These suggestions correspondent à des espèces
  avec lesquelles elle peut être confondue en région Rhône-Alpes ou PACA. This
  button now sits directly under the results table with enhanced styling for
  better visibility.
 - The "Contexte éco" tab displays several geographic overlays
  retrieved from the IGN API Carto. It now includes layers for **Réserves
  Naturelles Nationales et Régionales**, **Arrêtés Préfectoraux de Protection de
  Biotope**, **Espaces Naturels Sensibles**, **Zones humides** and **Pelouses
  sèches**.
- A long press (about two seconds) on the environmental context map opens a
  pop‑up with a **Google Maps** link to the selected coordinates. The timer is
  cancelled if the user starts moving the map.

- Launching an analysis from the patrimonial maps now also requires a long press
  or right click, making accidental selections on mobile devices less likely.


- The patrimonial analysis page now provides a "Voir le détail des espèces patri" button to list every found species on the organ page. The underlying logic was reinforced so the button works reliably even if the map is still loading.
- Buttons on both patrimonial maps toggle label visibility; labels start slightly translucent for readability.
