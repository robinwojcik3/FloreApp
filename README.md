# Déploiement Selenium API

Ce dossier complète l'application front-end avec un service FastAPI exécutant un workflow Selenium.

## Provisionner la VM Oracle

1. Créer une VM Ampere A1 Ubuntu 22.04 "Always Free".
2. Ouvrir les ports **80** et **443** dans la console Oracle Cloud.
3. Se connecter en `ssh ubuntu@VM_IP`.

## Installation du backend

```bash
sudo apt update && sudo apt install -y python3.12 python3.12-venv \
  chromium-browser chromium-chromedriver nginx certbot python3-certbot-nginx
```

Déployer le code dans `/home/ubuntu/app` puis installer les dépendances :

```bash
cd /home/ubuntu/app
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Service systemd

Copier `selenium-api.service` dans `/etc/systemd/system/` puis :

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now selenium-api
```

L'API écoute sur `http://localhost:8000`.

## Configuration Nginx et HTTPS

1. Copier la configuration fournie dans `/etc/nginx/sites-available/selenium`.
2. Activer le site :

```bash
sudo ln -s /etc/nginx/sites-available/selenium /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

3. Obtenir un certificat Let's Encrypt :

```bash
sudo certbot --nginx -d example.com
```

Remplacer `example.com` par votre nom de domaine. Nginx reverse‑proxiera alors les requêtes HTTPS vers FastAPI.

## Intégration Netlify

Le front-end peut appeler l'endpoint via `fetch` :

```javascript
import { triggerRun } from './services/seleniumApi';
```

Déployez le front-end sur Netlify comme d'habitude. Aucun secret n'est exposé dans le code : ajoutez les variables sensibles dans `/etc/environment` ou `~/.bashrc` sur la VM si nécessaire.

## Test

Depuis le poste local ou Netlify :

```bash
curl -X POST "https://example.com/run?lat=43.6&lon=3.9"
```

La réponse JSON `{"status": "started"}` indique que le workflow a été déclenché.
