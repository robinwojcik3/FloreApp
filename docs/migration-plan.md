# Migration Python/Selenium vers Extension Chrome + Netlify

## 1. Analyse du script source

Le fichier `Python pour application.py.py` automatise deux sites via Selenium :

- **ArcGIS WebAppViewer** : ouverture de la carte de la végétation, réglage d'une plage
  de visibilité et d'une transparence.
- **Géoportail** : recherche par coordonnées sur la carte des sols puis dézoom.

Les coordonnées sont actuellement codées en dur. Les fonctions de lecture Excel
et toute génération de fichiers sont ignorées dans la migration.

## 2. Architecture cible

### Extension Chrome

- Manifest V3 avec `background.js`.
- Permissions : `tabs`, `scripting`, accès aux domaines ArcGIS et Géoportail.
- Un script `page-script.js` est injecté sur l'application Netlify pour écouter
  `postMessage`.
- Le service worker ouvre deux onglets configurés pour ArcGIS et Géoportail.
- `arcgis.js` supprime automatiquement le splash‑screen.

### Application Netlify

- Nouveau fichier `extension-bridge.js` qui envoie
  `postMessage({type:'open-maps', lat, lon})` lorsque l'utilisateur clique sur le
  bouton « Cartes végétation/sols ».
- Ajout d'un bouton dans `contexte.html`.

### Protocole d'échange

1. L'utilisateur choisit une localisation dans « Contexte éco ».
2. La page déclenche l'événement `open-maps` avec les coordonnées.
3. `page-script.js` relaie ce message au service worker.
4. `background.js` ouvre les deux onglets et, pour ArcGIS, `arcgis.js` ferme le
   splash‑screen.

Objet transmis :

```json
{ "type": "open-maps", "lat": <float>, "lon": <float> }
```

## 3. Plan de migration

1. Création de l'extension Chrome (manifest, scripts).
2. Adaptation de l'app Netlify (bouton + `extension-bridge.js`).
3. Tests de bout en bout sur les sites externes.
4. Documentation utilisateur pour l'installation de l'extension.

_Risques techniques :_ évolution de l'interface des sites tiers, restrictions de
sécurité empêchant certains scripts, ou modification future des URL.
