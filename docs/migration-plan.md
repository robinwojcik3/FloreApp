# Migration Python/Selenium vers Extension Chrome + Netlify

Ce document décrit l'architecture cible pour remplacer le script Python `Python pour application.py` par une solution 100 % web.

## 1. Analyse du script existant

Le fichier `Python pour application.py` exécute deux workflows Selenium :

- **ArcGIS WebAppViewer** : ouverture de la carte de la végétation potentielle, réglage de la plage de visibilité (`1:100`) et de la transparence (~50 %).
- **Géoportail** : ouverture de la carte des sols, recherche par coordonnées et léger dézoom.

Les coordonnées sont actuellement codées en dur mais proviendront de l'onglet « Contexte éco » de l'application Netlify. Aucun traitement de fichier (Excel, Word…) n'est requis.

## 2. Architecture proposée

### Extension Chrome
- Manifest V3 avec service worker.
- Content‑scripts dédiés :
  - `netlify.js` injecté sur le domaine Netlify pour écouter les coordonnées fournies par l'app.
  - `arcgis.js` exécuté sur `www.arcgis.com` pour automatiser la carte de la végétation.
  - `geoportail.js` exécuté sur `www.geoportail.gouv.fr` pour automatiser la carte des sols.
- Le service worker ouvre les deux onglets et transmet les coordonnées aux content‑scripts via `chrome.tabs.sendMessage`.

### Application Netlify
- Ajout d'un bouton « Ouvrir cartes automatiques » dans `contexte.js`.
- Envoi des coordonnées sélectionnées via `window.postMessage`.
- Affichage d’un message si l’extension n’est pas détectée.

### Communication
```
[Netlify page] --postMessage--> [netlify.js] --runtime.sendMessage--> [service_worker]
[service_worker] --tabs.sendMessage--> [arcgis.js / geoportail.js]
```
Le message contient :
```json
{ "action": "open-maps", "lat": <float>, "lon": <float> }
```
Chaque content‑script répond par `status:ok` ou un message d’erreur.

## 3. Plan de migration
1. Créer l’extension Chrome avec le manifest et les trois scripts.
2. Implémenter l’automatisation DOM dans `arcgis.js` et `geoportail.js` à partir des sélecteurs utilisés par Selenium.
3. Modifier `contexte.js` pour envoyer les coordonnées à l’extension et afficher les retours.
4. Tester le flux complet puis publier l’extension et mettre à jour la documentation Netlify.

Principaux risques : instabilité des sélecteurs sur les sites externes et permissions de l’extension. Un mode débogage visible est conservé pour simplifier le suivi par l’utilisateur.
