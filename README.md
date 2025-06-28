# Plantouille Express

Plantouille Express est une application web progressive qui aide à l'identification de la flore. Elle s'appuie sur l'API PlantNet pour analyser les photos et utilise des fonctions serverless hébergées par Netlify.

## Aperçu

- recherche de taxons par nom complet ou trigramme
- comparaison et suggestions d'espèces via Google Gemini
- synthèse audio avec l'API Google Text‑to‑Speech
- consultation hors ligne grâce au service worker
- cartes patrimoniales et couches contextuelles (INPN, Biodiv'AURA, IGN)

## Prérequis

- **Node.js 20** et **npm**
- un navigateur récent prenant en charge les service workers
- facultatif : **Netlify CLI** pour tester les fonctions serverless en local

## Installation

Dans `netlify/functions`, installez les dépendances requises :

```bash
npm init -y
npm install jsdom node-fetch
```

Les fonctions `inpn-proxy.js` et `aura-images.js` utilisent ces modules.

## Configuration

Éditez `app.js` et renseignez vos clés d'API :

```javascript
const API_KEY       = 'votre-cle-plantnet';
const GEMINI_API_KEY= 'votre-cle-gemini';
const TTS_API_KEY   = 'votre-cle-tts';
```

## Lancement en local

1. Servez le répertoire depuis un serveur HTTP (`npx serve` ou `python3 -m http.server`).
2. Ouvrez `http://localhost:PORT/index.html`.
3. Pour les fonctions serverless, lancez :

```bash
npm install -g netlify-cli
netlify dev
```

## Tests

Le projet inclut une suite Jest. Installez les dépendances puis lancez :

```bash
npm install
npm test
```

## Déploiement

Poussez le dépôt sur GitHub puis créez un site sur Netlify. Le fichier `netlify.toml` publie la racine du projet et active les fonctions sous `/.netlify/functions/`.

## Fonctionnalités principales

- table de résultats avec liens vers INPN et Biodiv'AURA
- copie du nom scientifique en un clic
- affichage détaillé des critères écologiques et physiologiques
- carte contextuelle avec couches IGN (réserves, zones humides, etc.)
- recherche par trigramme et suggestions via TaxRef Match
- comparaison d'espèces et synthèse vocale optionnelle

