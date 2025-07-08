# Migration Python/Selenium vers extension Chrome & Netlify

Ce document décrit l'extraction de la logique du script `Python pour application.py` et son adaptation vers une extension Chrome associée à l'application Netlify.

## 1. Analyse du script Python

Le fichier `Python pour application.py` contient deux fonctions Selenium principales :

- **`workflow_arcgis`** : ouvre l'application ArcGIS WebAppViewer, règle la plage de visibilité d'une couche de végétation et applique ~50 % de transparence.
  - Sélecteurs utilisés : menu « Liste des couches », éléments `Définir la plage de visibilité`, champ texte, menu `transparency`.
  - Les coordonnées sont converties en WebMercator pour construire l'URL avec l'`extent`.
- **`workflow_geoportail`** : affiche la carte pédologique sur Geoportail.
  - Étapes : ouverture de la recherche avancée, sélection du mode "Coordonnées", saisie lat/lon, validation, fermeture des panneaux et deux zoom out.

Les coordonnées (lat, lon) sont actuellement codées en dur (44.334500, 5.781500). Les interactions avec Excel ou d'autres fichiers sont ignorées pour la migration.

## 2. Architecture cible

### Extension Chrome

- **Service worker (`background.js`)** : reçoit les demandes de l'application Netlify et ouvre de nouveaux onglets sur ArcGIS ou Geoportail. Après chargement, il injecte des scripts d'automatisation spécifiques (`arcgis.js`, `geoportail.js`).
- **Content script (`content.js`)** : injecté sur la page Netlify. Il sert de passerelle : écoute les `window.postMessage` émis par l'application et les transmet au service worker via `chrome.runtime.sendMessage`.
- **Scripts d'automatisation** : exécutés dans les onglets ArcGIS ou Geoportail, reproduisent les actions Selenium (sélecteurs équivalents, saisie des coordonnées, réglage de la transparence, etc.).

### Application Netlify

- Ajout d'un bouton dans l'onglet « Contexte éco » permettant de lancer l'automatisation.
- La page émet un message `window.postMessage` contenant `service`, `lat`, `lon` et l'URL construite par `contexte.js`.
- Affichage d'un retour utilisateur (progression/erreur) selon les messages reçus de l'extension.

### Protocole d'échange

```text
Page Netlify ⇄ Content script ⇄ Service worker ⇄ Scripts ArcGIS/Geoportail
```

- **Message `LAUNCH_SERVICE`** : envoyé par la page pour déclencher l'ouverture d'un service externe.
- **Message `EXTENSION_AVAILABLE`** : réponse émise par l'extension pour indiquer sa présence.
- D'autres messages (succès, erreur) peuvent être définis pour remonter l'état à l'application.

## 3. Plan de migration

1. **Création de l'extension Chrome** avec manifest V3, service worker et scripts d'automatisation s'appuyant sur les sélecteurs relevés dans le script Python.
2. **Modification de l'application Netlify** : ajout d'un bouton et d'une logique de communication avec l'extension dans `contexte.js`.
3. **Mise au point du protocole de messagerie** entre la page et l'extension (test en local, gestion des erreurs si l'extension n'est pas installée).
4. **Tests et documentation** : validation manuelle de l'automatisation sur les sites cibles, rédaction d'un guide d'installation.

Cette architecture permet de reproduire les workflows Selenium sans serveur, uniquement côté client, tout en conservant la logique de l'application existante.
