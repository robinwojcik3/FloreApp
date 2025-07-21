# Plantouille Express

Plantouille Express est une application web progressive qui aide à l'identification de la flore. Elle s'appuie sur l'API PlantNet pour analyser les photos et utilise des fonctions serverless hébergées par Netlify.

## Aperçu

- recherche de taxons par nom complet ou trigramme
- comparaison et suggestions d'espèces via Google Gemini
- synthèse audio avec l'API Google Text‑to‑Speech
- consultation hors ligne grâce au service worker
- cartes patrimoniales et couches contextuelles (INPN, Biodiv'AURA, IGN)
- récupération de l'altitude via l'API Open‑Meteo

## Prérequis

- **Node.js 20** et **npm**
- un navigateur récent prenant en charge les service workers
- facultatif : **Netlify CLI** pour tester les fonctions serverless en local
- aucun module Python n'est requis ; le fichier `requirements.txt` a donc été supprimé

## Installation

Exécutez `npm install` à la racine du projet pour installer les dépendances
déclarées dans `package.json` (notamment `node-fetch` utilisé par les fonctions
serverless).

Copiez ensuite `env.example` en `.env` et remplissez les clés
`PLANTNET_API_KEY`, `GEMINI_API_KEY`, `TTS_API_KEY` et
`CHROME_WS_ENDPOINT` (WebSocket Browserless).

Si vous déployez sur Netlify, ces variables se définissent dans l'interface sous
**Site settings > Environment variables**. N'oubliez pas d'y ajouter
`CHROME_WS_ENDPOINT` pour la fonction de scraping.

## Configuration

Les fonctions Netlify lisent les clés `PLANTNET_API_KEY`, `GEMINI_API_KEY`,
`TTS_API_KEY` et `CHROME_WS_ENDPOINT` depuis l'environnement.
`netlify dev` charge automatiquement le fichier `.env` si présent. Vérifiez donc
que ces variables sont définies avant de lancer l'application.

## Lancement en local

1. Servez le répertoire depuis un serveur HTTP (`npx serve` ou `python3 -m http.server`).
2. Ouvrez `http://localhost:PORT/index.html`.
3. Pour les fonctions serverless, lancez :

```bash
npm install -g netlify-cli
netlify dev
```

## Tests


Le projet inclut une suite Jest. Pour faciliter l'exécution des tests sur
toute plateforme, un script est fourni pour installer les dépendances et
lancer Jest automatiquement :

```bash
./scripts/setup-tests.sh
```

Les tests couvrent aussi les fonctions serverless présentes dans `netlify/functions` (`inpn-proxy.js`, `api-proxy.js`, ...).
Une fois les dépendances installées, exécutez simplement `npm test` depuis la racine pour lancer l'ensemble de la suite.

## Déploiement

Poussez le dépôt sur GitHub puis créez un site sur Netlify. Le fichier `netlify.toml` publie la racine du projet et active les fonctions sous `/.netlify/functions/`.

## Fonctionnalités principales

- table de résultats avec liens vers INPN et Biodiv'AURA
- copie du nom scientifique en un clic
- affichage détaillé des critères écologiques et physiologiques
- carte contextuelle avec couches IGN (réserves, zones humides, etc.)
- recherche par trigramme et suggestions via TaxRef Match
- comparaison d'espèces et synthèse vocale optionnelle

## Scraping

Avant tout lancement local (`netlify dev`) créez un fichier `.env` à la racine
contenant la clé `CHROME_WS_ENDPOINT` fournie par Browserless.
Si cette variable est absente, la fonction tentera d'ouvrir le
Chromium inclus avec Puppeteer, mais l'utilisation d'un navigateur
distant reste recommandée pour un déploiement léger.

## Intégration de la Carte de la Végétation Potentielle

Cette application peut afficher la Carte de la Végétation Potentielle (CVP)
de France fournie par le laboratoire **ECOLAB / OMP**. Les données n'étant
pas libres, il faut les acquérir auprès du laboratoire
(`carteveget@obs-mip.fr`). Le jeu reçu comprend des scans TIFF
géoréférencés en EPSG:2154, un vecteur harmonisé 1 :1 000 000 et un guide
d'utilisation. L'exploitation commerciale est interdite sans accord et la
source "CNRS–ECOLAB, BDGveg_FR" doit toujours être citée.

Une fois les fichiers obtenus :

1. Reprojetez vers Web Mercator et générez vos tuiles.
   - **Raster** : `gdalwarp` puis `gdal2tiles.py`.
   - **Vecteur** : `tippecanoe` et `tile-join` si besoin.
2. Hébergez le répertoire `/tiles` dans `public` (moins de 100 Mo sur
   Netlify) ou sur un bucket externe.
3. Branchez les tuiles dans Leaflet ou MapLibre :

```js
L.tileLayer('/tiles/{z}/{x}/{y}.png', {
  attribution: '© CNRS–ECOLAB, BDGveg_FR',
  minZoom: 3,
  maxZoom: 10
}).addTo(map);
```

Activez la compression (gzip ou brotli) pour limiter le poids des transferts.


## Déploiement de l'API Selenium

Ce guide résume les étapes pour connecter la SPA hébergée sur Netlify à un backend Python tournant sur une VM Oracle Cloud (Ampere A1).

1. **Provisionner la VM**
   - Créez une instance Ubuntu 22.04 ARM64 "Always Free".
   - Ouvrez le port `80` et `443` dans le panneau réseau.
2. **Installer les dépendances**
   ```bash
   sudo apt update && sudo apt install -y python3.12 python3.12-venv \
     chromium-browser chromium-chromedriver nginx certbot python3-certbot-nginx
   ```
3. **Déployer le code**
   ```bash
   git clone https://github.com/your/repo.git ~/app
   cd ~/app/app && python3.12 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Configurer systemd**
   - Copiez `etc/systemd/system/selenium-api.service` vers `/etc/systemd/system/`.
   - `sudo systemctl enable --now selenium-api.service`.
5. **Configurer Nginx et HTTPS**
   - Copiez `etc/nginx/sites-available/selenium` vers `/etc/nginx/sites-available/` puis activez-le :
     `sudo ln -s /etc/nginx/sites-available/selenium /etc/nginx/sites-enabled/`.
   - `sudo nginx -t && sudo systemctl reload nginx`.
   - Obtenez un certificat :
     `sudo certbot --nginx -d your-domain.example`.
6. **Tester depuis Netlify**
   - Dans votre SPA React, appelez `triggerRun(lat, lon)` défini dans `frontend/src/services/seleniumApi.js`.
   - Le backend renvoie `{ "status": "started" }` lorsque le workflow démarre.


