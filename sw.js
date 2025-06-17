/* ================================================================
   Service-Worker – PlantID PWA (v3 - Avec contexte environnemental)
   ================================================================ */

// Changez ce nom de version à chaque fois que vous mettez à jour les fichiers de l'application
const CACHE_NAME = "plantid-v18";

// Fichiers essentiels pour le fonctionnement de base de l'application
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./organ.html",
  "./viewer.html",
  "./pca.html",
  "./contexte.html",                // NOUVEAU : page contexte environnemental
  "./app.js",
  "./contexte.js",                   // NOUVEAU : script contexte environnemental
  "./assets/viewer_app.js",
  "./manifest.json",
  "./assets/flora_gallica_toc.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/Bandeau.jpg",
  "./assets/FloreAlpes.png",
  "./assets/Flora Gallica.png",
  "./assets/INPN.png",
  "./assets/Biodiv'AURA.png",
  "./assets/Info Flora.png",
  "./assets/Audio.png",
  "./assets/PFAF.png",
  // Bibliothèque PDF.js
  "./pdfjs/build/pdf.mjs",
  "./pdfjs/build/pdf.worker.mjs",
  // NOUVEAU : Leaflet pour la carte interactive (depuis CDN)
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

// Fichiers de données
const DATA_ASSETS = [
    "./taxref.json",
    "./ecology.json",
    "./assets/florealpes_index.json",
    "./Criteres_herbier.json",      // NOUVEAU : ajout des critères
    "./Physionomie.json"            // Nouvelle : descriptions de physionomie
];


/* ---------------- phase INSTALL ---------------- */
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Mise en cache des assets de base et des données.');
      return cache.addAll(CORE_ASSETS.concat(DATA_ASSETS));
    })
  );
});

/* ---------------- phase ACTIVATE --------------- */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log(`Service Worker: Suppression de l'ancien cache ${key}`);
            return caches.delete(key);
          })
      );
    }).then(() => {
        console.log('Service Worker: Activation terminée, contrôle des clients.');
        return self.clients.claim();
    })
  );
});

/* ---------------- interceptions FETCH ---------- */
self.addEventListener("fetch", event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ne pas mettre en cache les requêtes vers les API
    if (request.url.includes("my-api.plantnet.org") || 
        request.url.includes("generativelanguage.googleapis.com") ||
        request.url.includes("texttospeech.googleapis.com")) {
        event.respondWith(fetch(request));
        return;
    }

    // Gérer les ressources externes (Leaflet, OpenStreetMap)
    if (request.url.includes("unpkg.com") ||
        request.url.includes("tile.openstreetmap.org") ||
        request.url.includes("tile.opentopomap.org")) {
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(request).then(networkResponse => {
                        // Mettre en cache uniquement les fichiers CSS/JS de Leaflet
                        if (request.url.includes("unpkg.com")) {
                            return caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, networkResponse.clone());
                                return networkResponse;
                            });
                        }
                        return networkResponse;
                    });
                })
        );
        return;
    }

    // Stratégie "Network First" pour HTML et scripts
    if (request.destination === 'document' || request.destination === 'script') {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    return caches.match(request).then(cachedResponse => {
                        return cachedResponse || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // Stratégie "Cache First" pour les autres ressources
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(request).then(networkResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
    );
});
