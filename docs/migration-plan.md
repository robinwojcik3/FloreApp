# Migration Python/Selenium vers Extension Chrome + Netlify

Ce document décrit l'architecture cible et la stratégie de migration du script `Python pour application.py` vers une solution 100 % web composée d'une extension Chrome et d'une application Netlify.

## 1. Analyse du script existant

Le fichier `Python pour application.py` automatise deux sites :

1. **ArcGIS WebAppViewer** pour afficher la *Carte de la végétation potentielle* et régler la transparence de la couche.
2. **Geoportail** pour interroger la *Carte des sols* par coordonnées géographiques.

Les coordonnées sont actuellement codées en dur et les fonctions de lecture Excel sont inutilisées. Les actions Selenium clés sont :

- ouverture de l'URL ArcGIS avec un `extent` autour des coordonnées (lignes 134 à 141) ;
- gestion du splash‑screen, ouverture de la liste des couches et réglage de la visibilité (lignes 148 à 227) ;
- chargement de `https://www.geoportail.gouv.fr/donnees/carte-des-sols` ;
- recherche avancée "Coordonnées" et saisie de la latitude/longitude (lignes 241 à 266) ;
- fermeture des panneaux et dézoom (lignes 269 à 286).

Seules ces actions doivent être portées dans la nouvelle solution.

## 2. Architecture cible

### Extension Chrome

- **Manifest V3** avec service worker.
- **Content scripts** pour automatiser ArcGIS et Geoportail : insertion de code dans chaque page afin de reproduire les clics Selenium (ouverture des menus, remplissage des formulaires…).
- **Popup** déclenchant l'automatisation et affichant les éventuelles erreurs.
- **Messaging** : l'extension écoute des messages provenant de l'application Netlify (coordonnées à traiter) puis répond avec le résultat (confirmation, erreur…).

### Application Netlify

- Interface existante (onglet « Contexte éco ») enrichie d'un bouton « Lancer l'automatisation ».
- Lecture des coordonnées choisies par l’utilisateur et envoi à l’extension via `chrome.runtime.sendMessage`.
- Réception des réponses et affichage dans l’UI (ex. notification « Carte mise à jour »).

### Schéma d’échange

```text
[Netlify App] → (coords) → [Extension Chrome]
[Extension Chrome] → (status / erreurs) → [Netlify App]
```

Les données échangées sont de la forme :

```json
{
  "lat": 44.3345,
  "lon": 5.7815,
  "action": "display_maps"
}
```

La réponse peut contenir `ok: true` ou un message d’erreur.

## 3. Plan de migration

1. **Créer l’extension** : manifest, scripts pour ArcGIS et Geoportail.
2. **Implémenter la communication** avec `chrome.runtime.onMessage` pour recevoir les coordonnées et lancer les automatisations.
3. **Adapter l’app Netlify** : bouton dans « Contexte éco », envoi des coordonnées, gestion des retours.
4. **Tests** : vérification du fonctionnement sur les sites réels, gestion des cas d’erreur (absence de l’extension, éléments non trouvés…).

## 4. Risques techniques

- Changements de structure des pages ArcGIS ou Geoportail (sélecteurs fragiles).
- Limitations des content scripts (pas d’accès direct aux API internes des sites).
- Absence d’infrastructure serveur : tout traitement doit rester léger côté client.

En concentrant la logique dans l’extension et en conservant uniquement les actions nécessaires, la migration assure une automatisation visible et utilisable depuis l’application Netlify.
