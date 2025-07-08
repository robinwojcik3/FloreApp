# Extension "FloreApp Automator"

Cette extension Chrome ouvre automatiquement la carte de la végétation potentielle (ArcGIS) ou la carte des sols (Geoportail) à partir des coordonnées fournies par l'application Netlify.

## Installation en mode développeur

1. Ouvrez `chrome://extensions`.
2. Activez **Mode développeur**.
3. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier `extension`.

## Utilisation

- Dans l'onglet « Contexte éco » de l'application Netlify, choisissez un point puis lancez l'ouverture d'un service.
- L'extension crée un nouvel onglet et exécute les actions de navigation correspondantes.

Les scripts `arcgis.js` et `geoportail.js` sont des exemples à compléter avec les sélecteurs détaillés dans `Python pour application.py`.
