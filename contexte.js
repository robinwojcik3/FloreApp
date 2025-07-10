/* ================================================================
      CONTEXTE ENVIRONNEMENTAL - Logique JavaScript
      Refonte pour utiliser l'API Carto (REST/GeoJSON) de l'IGN
      ================================================================ */

// Variables globales
let envMap = null; // Carte pour l'affichage des résultats
let layerControl = null; // Contrôleur de couches pour la carte de résultats
let openTopoLayer = null; // Couche OpenTopoMap par défaut
let openStreetLayer = null; // Alternative OpenStreetMap
let envMarker = null; // Marqueur du point analysé
let selectedLat = null;
let selectedLon = null;

// Cache des couches déjà chargées pour accélérer les changements
let layerCache = {};
let lastCacheCoords = null;

// Variables pour la mesure de distance
let measuring = false;
let measurePoints = [];
let measureLine = null;
let measureTooltip = null;

// États de chargement des résultats pour chaque onglet
let zoningLoaded = false;
let resourcesLoaded = false;

const ALTITUDES_URL = 'assets/altitudes_fr.json';
let altitudeDataPromise = null;

function loadAltitudeData() {
    if (!altitudeDataPromise) {
        altitudeDataPromise = fetch(ALTITUDES_URL)
            .then(r => r.ok ? r.json() : {})
            .catch(() => ({}));
    }
    return altitudeDataPromise;
}

const GOOGLE_MAPS_LONG_PRESS_MS = 2000;
const MAP_LONG_PRESS_MS = 3000; // delay for selecting a point on the map

function initializeEnvMap() {
    const defaultLat = 45.188529;
    const defaultLon = 5.724524;
    envMap = L.map('env-map', { preferCanvas: true }).setView([defaultLat, defaultLon], 11);

    if (!openTopoLayer) {
        openTopoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
            maxZoom: 17,
            crossOrigin: true
        });
    }
    if (!openStreetLayer) {
        openStreetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });
    }

    openTopoLayer.addTo(envMap);
    layerControl = L.control.layers({ 'OpenTopoMap': openTopoLayer, 'OpenStreetMap': openStreetLayer }, null, { collapsed: false }).addTo(envMap);
    enableChoicePopup(envMap);
}

function enableChoicePopup(targetMap) {
    let pressTimer;
    const showPopup = (latlng) => showChoicePopup(latlng);
    const onContextMenu = (e) => {
        e.originalEvent.preventDefault();
        showPopup(e.latlng);
    };
    const onDown = (e) => {
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
        pressTimer = setTimeout(() => showPopup(e.latlng), MAP_LONG_PRESS_MS);
    };
    const cancel = () => clearTimeout(pressTimer);
    targetMap.on('contextmenu', onContextMenu);
    targetMap.on('mousedown', onDown);
    targetMap.on('mouseup', cancel);
    targetMap.on('mousemove', cancel);
    targetMap.on('touchstart', onDown);
    targetMap.on('touchend', cancel);
    targetMap.on('touchmove', cancel);
    targetMap.on('dragstart', cancel);
    targetMap.on('move', cancel);
    targetMap.on('zoomstart', cancel);
}

function showChoicePopup(latlng) {
    const container = L.DomUtil.create('div', 'popup-button-container');
    const zonageBtn = L.DomUtil.create('button', 'action-button', container);
    zonageBtn.textContent = 'Zonage';
    const resBtn = L.DomUtil.create('button', 'action-button', container);
    resBtn.textContent = 'Ressources';
    const gmapsBtn = L.DomUtil.create('button', 'action-button', container);
    gmapsBtn.textContent = 'Google Maps';
    L.DomEvent.on(zonageBtn, 'click', () => { envMap.closePopup(); runZonageAt(latlng); });
    L.DomEvent.on(resBtn, 'click', () => { envMap.closePopup(); runResourcesAt(latlng); });
    L.DomEvent.on(gmapsBtn, 'click', () => { envMap.closePopup(); window.open(`https://www.google.com/maps?q=${latlng.lat},${latlng.lng}`, '_blank'); });
    L.DomEvent.disableClickPropagation(container);
    L.popup().setLatLng(latlng).setContent(container).openOn(envMap);
}

function runZonageAt(latlng) {
    selectedLat = latlng.lat;
    selectedLon = latlng.lng;
    resourcesLoaded = false;
    updateAltitudeDisplay(selectedLat, selectedLon);
    displayInteractiveEnvMap();
    document.getElementById('results-grid').style.display = 'none';
}

function runResourcesAt(latlng) {
    selectedLat = latlng.lat;
    selectedLon = latlng.lng;
    zoningLoaded = false;
    updateAltitudeDisplay(selectedLat, selectedLon);
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = 'Préparation des liens...';
    setTimeout(() => {
        displayResources();
        loading.style.display = 'none';
    }, 200);
    document.getElementById('results-grid').style.display = 'grid';
}

// Configuration des services externes (liens)
const SERVICES = {
        arcgis: {
                name: "ArcGIS - Carte de la végétation",
                description: "Visualisez la carte de végétation de la zone",
                icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+CiAgPHBvbHlsaW5lIHBvaW50cz0iMiA3IDkgNCAxNSA3IDIyIDQgMjIgMTcgMTUgMjAgOSAxNyAyIDIwIDIgNyIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxsaW5lIHgxPSI5IiB5MT0iNCIgeDI9IjkiIHkyPSIxNyIgLz4KICA8bGluZSB4MT0iMTUiIHkxPSI3IiB4Mj0iMTUiIHkyPSIyMCIgLz4KPC9zdmc+Cg==',
                buildUrl: (lat, lon) => {
                        const { x, y } = latLonToWebMercator(lat, lon);
                        const buffer = 1000;
                        return `https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&extent=${x-buffer}%2C${y-buffer}%2C${x+buffer}%2C${y+buffer}%2C102100`;
                }
        },
        geoportail: {
                name: "Géoportail - Carte des sols",
                description: "Explorez la carte pédologique de la zone",
                icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+CiAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIgLz4KICA8cGF0aCBkPSJNMyAxMmgxOCIgLz4KICA8cGF0aCBkPSJNMTIgM2E5IDkgMCAwIDAgMCAxOCIgLz4KICA8cGF0aCBkPSJNMTIgM2E5IDkgMCAwIDEgMCAxOCIgLz4KPC9zdmc+Cg==',
                buildUrl: (lat, lon) => {
                        return `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=15&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&l1=AGRICULTURE.CARTE.PEDOLOGIQUE::GEOPORTAIL:OGC:WMS(0.5)&permalink=yes`;
                }
        },
        ign: {
                name: "IGN Remonter le temps",
                description: "Comparez l'évolution du paysage dans le temps",
                icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+CiAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iOSIgLz4KICA8cG9seWxpbmUgcG9pbnRzPSIxMiA3IDEyIDEyIDE1IDE1IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIC8+Cjwvc3ZnPgo=',
                buildUrl: (lat, lon) => {
                        return `https://remonterletemps.ign.fr/comparer?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}&z=17&layer1=16&layer2=19&mode=split-h`;
                }
        },
        inaturalist: {
                name: "iNaturalist - Observations",
                description: "Découvrez les observations naturalistes de la zone",
                icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+CiAgPHBhdGggZD0iTTEyIDJDNyAyIDQgMTIgNCAxMnMzIDEwIDggMTAgOC0xMCA4LTEwLTMtMTAtOC0xMHoiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIC8+CiAgPGxpbmUgeDE9IjEyIiB5MT0iMiIgeDI9IjEyIiB5Mj0iMjIiIC8+Cjwvc3ZnPgo=',
                buildUrl: (lat, lon) => {
                        const radius = 5; // km
                        return `https://www.inaturalist.org/observations?lat=${lat.toFixed(8)}&lng=${lon.toFixed(8)}&radius=${radius}&subview=map&threatened&iconic_taxa=Plantae`;
                }
        }
};

// NOUVEAU : Configuration des couches via l'API Carto de l'IGN
const APICARTO_LAYERS = {
    // Les couches à enjeux naturalistes forts sont chargées en priorité
    'ZNIEFF I': {
        endpoint: 'https://apicarto.ign.fr/api/nature/znieff1',
        style: { color: "#AFB42B", weight: 2, opacity: 0.9, fillOpacity: 0.2, dashArray: '5, 5' },
    },
    'ZNIEFF II': {
        endpoint: 'https://apicarto.ign.fr/api/nature/znieff2',
        style: { color: "#E65100", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Natura 2000 (Habitats)': {
        endpoint: 'https://apicarto.ign.fr/api/nature/natura-habitat',
        style: { color: "#2E7D32", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },

    // Les autres couches sont chargées ensuite
    'Réserves Naturelles Nationales': {
        endpoint: 'https://apicarto.ign.fr/api/nature/rnn',
        style: { color: "#7B1FA2", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Parcs Nationaux': {
        endpoint: 'https://apicarto.ign.fr/api/nature/pn',
        style: { color: "#AD1457", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Parcs Naturels Régionaux': {
        endpoint: 'https://apicarto.ign.fr/api/nature/pnr',
        style: { color: "#558B2F", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Natura 2000 (Oiseaux)': {
        endpoint: 'https://apicarto.ign.fr/api/nature/natura-oiseaux',
        style: { color: "#0277BD", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Réserves Naturelles': {
        endpoint: 'https://apicarto.ign.fr/api/nature/rn',
        style: { color: "#6A1B9A", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Réserves Naturelles Régionales': {
        endpoint: 'https://apicarto.ign.fr/api/nature/rnr',
        style: { color: "#9C27B0", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Arrêtés de Protection de Biotope': {
        endpoint: 'https://apicarto.ign.fr/api/nature/apb',
        style: { color: "#1B5E20", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Espaces Naturels Sensibles': {
        endpoint: 'https://apicarto.ign.fr/api/nature/ens',
        style: { color: "#004D40", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Zones humides': {
        endpoint: 'https://apicarto.ign.fr/api/nature/zones_humides',
        style: { color: "#1565C0", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Pelouses sèches': {
        endpoint: 'https://apicarto.ign.fr/api/nature/pelouses_seches',
        style: { color: "#8BC34A", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'Sites Ramsar': {
        endpoint: 'https://apicarto.ign.fr/api/nature/ramsar',
        style: { color: "#00ACC1", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    },
    'ZICO (Zones importantes pour la conservation des oiseaux)': {
        endpoint: 'https://apicarto.ign.fr/api/nature/zico',
        style: { color: "#FF9800", weight: 2, opacity: 0.9, fillOpacity: 0.2 },
    }
};


// Utilitaires de conversion
function latLonToWebMercator(lat, lon) {
        const R = 6378137.0;
        const x = R * (lon * Math.PI / 180);
        const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
        return { x, y };
}

async function fetchAltitudeFromApi(lat, lon) {
    try {
        const resp = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`
        );
        if (!resp.ok) throw new Error('api');
        const json = await resp.json();
        if (typeof json.elevation === 'number') return json.elevation;
    } catch (e) {
        return null;
    }
    return null;
}

async function fetchAltitude(lat, lon) {
    const apiAlt = await fetchAltitudeFromApi(lat, lon);
    if (apiAlt !== null) return apiAlt;
    const data = await loadAltitudeData();
    const round = v => (Math.round(v * 2) / 2).toFixed(1);
    const key = `${round(lat)},${round(lon)}`;
    return data[key] ?? null;
}

function updateAltitudeDisplay(lat, lon) {
    const el = document.getElementById('altitude-info');
    if (!el) return;
    el.style.display = 'block';
    el.textContent = 'Altitude : ...';
    fetchAltitude(lat, lon).then(alt => {
        if (alt === null) {
            el.textContent = 'Altitude indisponible';
        } else {
            el.textContent = `Altitude : ${Math.round(alt)} m`;
        }
    }).catch(() => {
        el.textContent = 'Altitude indisponible';
    });
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('use-geolocation').addEventListener('click', useGeolocation);
    document.getElementById('search-address').addEventListener('click', searchAddress);
    document.getElementById('address-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchAddress();
    });
    document.getElementById('measure-distance').addEventListener('click', toggleMeasure);
    initializeEnvMap();
});

// Fonction pour utiliser la géolocalisation
async function useGeolocation() {
        const button = document.getElementById('use-geolocation');
        button.disabled = true;
        button.textContent = 'Récupération de la position...';
	
	if (!navigator.geolocation) {
		showNotification('La géolocalisation n\'est pas supportée par votre navigateur', 'error');
		button.disabled = false;
                button.textContent = '📍 Ma position';
		return;
	}
	
	navigator.geolocation.getCurrentPosition(
		(position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        envMap.setView([lat, lon], 13);
                        button.textContent = 'Position récupérée ✓';
                        setTimeout(() => {
                                button.disabled = false;
                                button.textContent = '📍 Ma position';
                        }, 2000);
                        showChoicePopup(L.latLng(lat, lon));
		},
		(error) => {
			let message = 'Impossible de récupérer votre position';
			switch(error.code) {
				case error.PERMISSION_DENIED:
					message = 'Vous avez refusé l\'accès à votre position';
					break;
				case error.POSITION_UNAVAILABLE:
					message = 'Position indisponible';
					break;
				case error.TIMEOUT:
					message = 'La demande de position a expiré';
					break;
			}
			showNotification(message, 'error');
			button.disabled = false;
                        button.textContent = '📍 Ma position';
		},
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0
		}
	);
}

// Fonction pour afficher/masquer la carte de sélection
// ancien système de sélection remplacé par une carte unique

// Fonction pour rechercher une adresse
async function searchAddress() {
    const input = document.getElementById('address-input');
    const address = input.value.trim();
    if (!address) {
        showNotification('Veuillez entrer une adresse', 'error');
        return;
    }

    const button = document.getElementById('search-address');
    button.disabled = true;
    button.textContent = 'Recherche en cours...';

    try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
        if (!resp.ok) throw new Error('Service indisponible');
        const data = await resp.json();
        if (!data.length) {
            showNotification('Adresse introuvable', 'error');
            return;
        }
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        envMap.setView([lat, lon], 13);
        showChoicePopup(L.latLng(lat, lon));
    } catch (err) {
        showNotification('Erreur pendant la recherche', 'error');
    } finally {
        button.disabled = false;
        button.textContent = '🔍 Rechercher';
    }
}

// Génère les cartes de ressources environnementales
function displayResources() {
    const resultsGrid = document.getElementById('results-grid');
    resultsGrid.innerHTML = '';
    Object.keys(SERVICES).forEach(serviceKey => {
        const service = SERVICES[serviceKey];
        const url = service.buildUrl(selectedLat, selectedLon);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'resource-btn';
        const img = document.createElement('img');
        img.src = service.icon;
        img.alt = '';
        img.className = 'resource-icon';
        const span = document.createElement('span');
        span.textContent = service.name;
        link.appendChild(img);
        link.appendChild(span);
        resultsGrid.appendChild(link);
    });
    resultsGrid.style.display = 'grid';
}

/**
 * NOUVELLE FONCTION : Affiche la carte interactive avec les couches GeoJSON
 * récupérées depuis l'API Carto de l'IGN.
 */
async function displayInteractiveEnvMap() {
    const mapDiv = document.getElementById('env-map');
    mapDiv.style.display = 'block';
    document.getElementById('measure-distance').style.display = 'inline-block';

    // Vérifie si la localisation a changé de manière significative
    const coordsChanged =
        !lastCacheCoords ||
        Math.abs(lastCacheCoords.lat - selectedLat) > 0.01 ||
        Math.abs(lastCacheCoords.lon - selectedLon) > 0.01;
    if (coordsChanged) {
        layerCache = {};
    }
    lastCacheCoords = { lat: selectedLat, lon: selectedLon };

    // Initialisation ou réinitialisation de la carte
    if (!openTopoLayer) {
        openTopoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
            maxZoom: 17,
            crossOrigin: true
        });
    }
    if (!openStreetLayer) {
        openStreetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });
    }

    const baseLayers = { 'OpenTopoMap': openTopoLayer, 'OpenStreetMap': openStreetLayer };

    if (!envMap) {
        envMap = L.map('env-map', { preferCanvas: true }).setView([selectedLat, selectedLon], 11);
        openTopoLayer.addTo(envMap);
    } else {
        envMap.setView([selectedLat, selectedLon], 11);
        envMap.eachLayer(layer => { if (layer instanceof L.GeoJSON) envMap.removeLayer(layer); });
    }

    if (layerControl) envMap.removeControl(layerControl);
    layerControl = L.control.layers(baseLayers, null, { collapsed: false }).addTo(envMap);

    // Ajoute un marqueur pour le point analysé
    if (envMarker) envMap.removeLayer(envMarker);
    envMarker = L.marker([selectedLat, selectedLon]).addTo(envMap)
      .bindPopup("Point d'analyse").openPopup();

    const loading = document.getElementById('loading');
    const total = Object.keys(APICARTO_LAYERS).length;
    let loaded = 0;

    const updateLoading = () => {
        loading.textContent = `Chargement des couches ${loaded}/${total}...`;
        if (loaded === total) {
            loading.style.display = 'none';
        }
    };

    loading.style.display = 'block';
    updateLoading();

    Object.entries(APICARTO_LAYERS).forEach(([name, config]) => {
        if (layerCache[name]) {
            layerControl.addOverlay(layerCache[name], name);
            loaded += 1;
            updateLoading();
        } else {
            fetchAndDisplayApiLayer(name, config, selectedLat, selectedLon)
                .then((layer) => {
                    if (layer) layerCache[name] = layer;
                })
                .catch((err) => console.error(err))
                .finally(() => {
                    loaded += 1;
                    updateLoading();
                });
        }
    });
}

/**
 * NOUVELLE FONCTION : Récupère une couche de données depuis l'API Carto et l'ajoute à la carte.
 * @param {string} name - Nom de la couche pour l'affichage.
 * @param {object} config - Configuration de la couche (endpoint, style).
 * @param {number} lat - Latitude du point d'interrogation.
 * @param {number} lon - Longitude du point d'interrogation.
 */
async function fetchAndDisplayApiLayer(name, config, lat, lon) {
    try {
        const url = `${config.endpoint}?lon=${lon}&lat=${lat}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Réponse réseau non OK: ${response.statusText}`);
        }
        const geojsonData = await response.json();

        if (geojsonData && geojsonData.features && geojsonData.features.length > 0) {
            const geoJsonLayer = L.geoJSON(geojsonData, {
                renderer: L.canvas(),
                style: config.style,
                onEachFeature: addDynamicPopup
            });
            layerControl.addOverlay(geoJsonLayer, name);
            return geoJsonLayer;
        } else {
            console.log(`Aucune donnée de type "${name}" trouvée pour ce point.`);
        }
    } catch (error) {
        console.error(`Erreur lors du chargement de la couche ${name}:`, error);
    }
    return null;
}

// Extrait un nom lisible à partir des propriétés d'une entité
function getZoneName(props) {
    if (!props) return 'Zonage';
    const candidates = ['zone_name', 'nom', 'name', 'libelle', 'NOM', 'NOM_SITE', 'nom_zone'];
    for (const key of candidates) {
        if (props[key]) return props[key];
        if (props[key && key.toUpperCase()]) return props[key.toUpperCase()];
    }
    // Fallback: premier champ texte rencontré
    for (const k in props) {
        if (typeof props[k] === 'string' && props[k]) return props[k];
    }
    return 'Zonage';
}

// Ajoute une pop-up interactive sur chaque entité
function addDynamicPopup(feature, layer) {
    const props = feature.properties || {};
    const zoneName = getZoneName(props);
    const url = props.url;

    const content = `<strong>${zoneName}</strong><br><button class="zone-info-btn">Cliquer ici pour plus d\'informations</button>`;
    const popup = L.popup().setContent(content);

    layer.on('click', (e) => {
        const existing = layer.getPopup();
        if (existing && existing.isOpen()) {
            if (url) window.open(url, '_blank');
        } else {
            layer.bindPopup(popup).openPopup(e.latlng);
            const element = layer.getPopup().getElement();
            if (element) {
                const btn = element.querySelector('.zone-info-btn');
                if (btn) {
                    btn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        if (url) window.open(url, '_blank');
                    });
                }
            }
        }
    });
}

// Fonction de notification générique
function showNotification(message, type = 'info') {
        console.log(`Notification (${type}): ${message}`);
        alert(message);
}

// Copie les coordonnées dans le presse-papiers

// Ouvre la position dans Google Maps

// Active ou désactive le mode de mesure sur la carte
function toggleMeasure() {
    if (!envMap) return;
    measuring = !measuring;
    const btn = document.getElementById('measure-distance');
    if (measuring) {
        btn.textContent = 'Arrêter la mesure';
        measurePoints = [];
        if (measureLine) { envMap.removeLayer(measureLine); measureLine = null; }
        if (measureTooltip) { envMap.removeLayer(measureTooltip); measureTooltip = null; }
        envMap.on('click', addMeasurePoint);
        envMap.doubleClickZoom.disable();
    } else {
        btn.textContent = 'Mesurer une distance';
        envMap.off('click', addMeasurePoint);
        envMap.doubleClickZoom.enable();
        if (measureLine) { envMap.removeLayer(measureLine); measureLine = null; }
        if (measureTooltip) { envMap.removeLayer(measureTooltip); measureTooltip = null; }
        measurePoints = [];
    }
}

// Ajoute un point de mesure et met à jour la distance affichée
function addMeasurePoint(e) {
    measurePoints.push(e.latlng);
    if (measureLine) {
        measureLine.setLatLngs(measurePoints);
    } else {
        measureLine = L.polyline(measurePoints, { color: '#ff0000' }).addTo(envMap);
    }
    let dist = 0;
    for (let i = 1; i < measurePoints.length; i++) {
        dist += measurePoints[i - 1].distanceTo(measurePoints[i]);
    }
    const text = dist < 1000 ? `${dist.toFixed(0)} m` : `${(dist/1000).toFixed(2)} km`;
    if (!measureTooltip) {
        measureTooltip = L.marker(e.latlng, {
            interactive: false,
            icon: L.divIcon({ className: 'measure-tooltip', html: text })
        }).addTo(envMap);
    } else {
        measureTooltip.setLatLng(e.latlng);
        const el = measureTooltip.getElement();
        if (el) el.innerHTML = text;
    }
}

// Gestionnaire pour le retour à la page d'accueil
window.addEventListener('pageshow', (event) => {
	if (event.persisted) {
                document.getElementById('use-geolocation').disabled = false;
                document.getElementById('use-geolocation').textContent = '📍 Ma position';
	}
});
