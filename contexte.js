/* ================================================================
      CONTEXTE ENVIRONNEMENTAL - Logique JavaScript
      Refonte pour utiliser l'API Carto (REST/GeoJSON) de l'IGN
      ================================================================ */

// Variables globales
let map = null; // Carte pour la sélection du point
let envMap = null; // Carte pour l'affichage des résultats
let layerControl = null; // Contrôleur de couches pour la carte de résultats
let envMarker = null; // Marqueur du point analysé
let marker = null;
let selectedLat = null;
let selectedLon = null;
let selectedAlt = null;

// Cache des couches déjà chargées pour accélérer les changements
let layerCache = {};
let lastCacheCoords = null;

// Variables pour la mesure de distance
let measuring = false;
let measurePoints = [];
let measureLine = null;
let measureTooltip = null;

const GOOGLE_MAPS_LONG_PRESS_MS = 2000;

// Configuration des services externes (liens)
const SERVICES = {
	arcgis: {
		name: "ArcGIS - Carte de la végétation",
		description: "Visualisez la carte de végétation de la zone",
		buildUrl: (lat, lon) => {
			const { x, y } = latLonToWebMercator(lat, lon);
			const buffer = 1000;
			return `https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&extent=${x-buffer}%2C${y-buffer}%2C${x+buffer}%2C${y+buffer}%2C102100`;
		}
	},
	geoportail: {
		name: "Géoportail - Carte des sols",
		description: "Explorez la carte pédologique de la zone",
		buildUrl: (lat, lon) => {
			return `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=15&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&l1=AGRICULTURE.CARTE.PEDOLOGIQUE::GEOPORTAIL:OGC:WMS(0.5)&permalink=yes`;
		}
	},
	ign: {
		name: "IGN Remonter le temps",
		description: "Comparez l'évolution du paysage dans le temps",
		buildUrl: (lat, lon) => {
			return `https://remonterletemps.ign.fr/comparer?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}&z=17&layer1=16&layer2=19&mode=split-h`;
		}
	},
	inaturalist: {
		name: "iNaturalist - Observations",
		description: "Découvrez les observations naturalistes de la zone",
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

// Récupère l'altitude via le service OpenTopoData
async function fetchAltitude(lat, lon) {
    try {
        const resp = await fetch(`https://api.opentopodata.org/v1/srtm90m?locations=${lat},${lon}`);
        if (!resp.ok) throw new Error('fail');
        const data = await resp.json();
        if (data && data.results && data.results.length) {
            return data.results[0].elevation;
        }
    } catch (err) {
        console.error('Altitude error', err);
    }
    return null;
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('use-geolocation').addEventListener('click', useGeolocation);
        document.getElementById('choose-on-map').addEventListener('click', toggleMap);
        document.getElementById('validate-location').addEventListener('click', validateLocation);
        document.getElementById('search-address').addEventListener('click', searchAddress);
        document.getElementById('address-input').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') searchAddress();
        });
        document.getElementById('copy-coords').addEventListener('click', copyCoords);
        document.getElementById('open-gmaps').addEventListener('click', openInGmaps);
        document.getElementById('reset-selection').addEventListener('click', resetSelection);
        document.getElementById('measure-distance').addEventListener('click', toggleMeasure);
        document.querySelectorAll('.subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).classList.add('active');
            });
        });
        initializeMap();
        toggleMap();
});

// Fonction pour utiliser la géolocalisation
async function useGeolocation() {
	const button = document.getElementById('use-geolocation');
	button.disabled = true;
	button.textContent = 'Récupération de la position...';
	
	if (!navigator.geolocation) {
		showNotification('La géolocalisation n\'est pas supportée par votre navigateur', 'error');
		button.disabled = false;
                button.textContent = '📍 Utiliser ma localisation';
		return;
	}
	
	navigator.geolocation.getCurrentPosition(
		(position) => {
			selectedLat = position.coords.latitude;
			selectedLon = position.coords.longitude;
			button.textContent = 'Position récupérée ✓';
			setTimeout(() => {
				button.disabled = false;
                                button.textContent = '📍 Utiliser ma localisation';
			}, 2000);
			showResults();
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
                        button.textContent = '📍 Utiliser ma localisation';
		},
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0
		}
	);
}

// Fonction pour afficher/masquer la carte de sélection
function toggleMap() {
	const mapContainer = document.getElementById('map-container');
	const button = document.getElementById('choose-on-map');
	const instruction = document.getElementById('map-instruction');
	
	if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
		mapContainer.style.display = 'block';
		instruction.style.display = 'block';
                button.textContent = '🗺️ Fermer la carte';
		if (!map) {
			initializeMap();
		} else {
			setTimeout(() => map.invalidateSize(), 100);
		}
		setTimeout(() => {
			instruction.style.display = 'none';
		}, 3000);
	} else {
		mapContainer.style.display = 'none';
                button.textContent = '🗺️ Ouvrir la carte';
        }
}

// Initialisation de la carte de sélection Leaflet
function initializeMap() {
	const defaultLat = 45.188529;
	const defaultLon = 5.724524;
        map = L.map('map').setView([defaultLat, defaultLon], 13);
        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
                maxZoom: 17,
                crossOrigin: true
        }).addTo(map);
        topoLayer.on('tileerror', () => {
                if (map.hasLayer(topoLayer)) {
                        map.removeLayer(topoLayer);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                attribution: '© OpenStreetMap contributors',
                                maxZoom: 19
                        }).addTo(map);
                }
        });
	
	let pressTimer;
	let isPressing = false;
	
	function selectPoint(e) {
		const lat = e.latlng.lat;
		const lon = e.latlng.lng;
		if (marker) map.removeLayer(marker);
		marker = L.marker([lat, lon]).addTo(map);
		selectedLat = lat;
		selectedLon = lon;
		document.getElementById('coordinates-display').style.display = 'block';
		document.getElementById('selected-coords').textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
		document.getElementById('validate-location').style.display = 'block';
	}
	
	map.on('mousedown', (e) => { isPressing = true; pressTimer = setTimeout(() => { if (isPressing) selectPoint(e); }, 500); });
	map.on('mouseup', () => { isPressing = false; clearTimeout(pressTimer); });
	map.on('mousemove', () => { if (isPressing) { isPressing = false; clearTimeout(pressTimer); }});
	map.on('touchstart', (e) => { isPressing = true; pressTimer = setTimeout(() => { if (isPressing) selectPoint(e); }, 500); });
	map.on('touchend', () => { isPressing = false; clearTimeout(pressTimer); });
	map.on('touchmove', () => { if (isPressing) { isPressing = false; clearTimeout(pressTimer); }});
	map.on('contextmenu', (e) => { e.originalEvent.preventDefault(); selectPoint(e); });
}

// Fonction pour valider la localisation sélectionnée sur la carte
function validateLocation() {
	if (selectedLat && selectedLon) {
		showResults();
	}
}

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
		selectedLat = parseFloat(data[0].lat);
		selectedLon = parseFloat(data[0].lon);
		document.getElementById('coordinates-display').style.display = 'block';
		document.getElementById('selected-coords').textContent = `${selectedLat.toFixed(6)}°, ${selectedLon.toFixed(6)}°`;
		document.getElementById('validate-location').style.display = 'block';
		showResults();
	} catch (err) {
		showNotification('Erreur pendant la recherche', 'error');
	} finally {
		button.disabled = false;
                button.textContent = '🔍 Rechercher';
	}
}

// Fonction principale pour afficher les résultats
async function showResults() {
        if (!selectedLat || !selectedLon) {
                showNotification('Aucune localisation sélectionnée', 'error');
                return;
        }

        const loading = document.getElementById('loading');
        loading.style.display = 'block';
        loading.textContent = 'Préparation des liens...';

        const alt = await fetchAltitude(selectedLat, selectedLon);
        selectedAlt = alt;
        const altLine = document.getElementById('altitude-line');
        const altVal = document.getElementById('altitude-value');
        if (alt !== null && alt !== undefined) {
                altVal.textContent = `${Math.round(alt)} m`;
        } else {
                altVal.textContent = 'indisponible';
        }
        altLine.style.display = 'block';
	
	setTimeout(() => {
		loading.style.display = 'none';
		const resultsSection = document.getElementById('results-section');
		resultsSection.style.display = 'block';
		const resultsGrid = document.getElementById('results-grid');
		resultsGrid.innerHTML = '';
		
		Object.keys(SERVICES).forEach(serviceKey => {
			const service = SERVICES[serviceKey];
			const url = service.buildUrl(selectedLat, selectedLon);
			const card = document.createElement('div');
			card.className = 'result-card';
			card.innerHTML = `<h3>${service.name}</h3><p>${service.description}</p><a href="${url}" target="_blank" rel="noopener noreferrer">Ouvrir dans un nouvel onglet →</a>`;
			resultsGrid.appendChild(card);
		});

		displayInteractiveEnvMap();
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
}

/**
 * Active un appui long pour ouvrir Google Maps sur la carte fournie.
 * @param {L.Map} targetMap
 */
function enableGoogleMapsLongPress(targetMap) {
    let timer;
    let startEvent;

    function openPopup() {
        const lat = startEvent.latlng.lat.toFixed(6);
        const lon = startEvent.latlng.lng.toFixed(6);
        L.popup()
            .setLatLng(startEvent.latlng)
            .setContent(`<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener noreferrer">Google Maps</a>`)
            .openOn(targetMap);
    }

    function start(e) {
        startEvent = e;
        timer = setTimeout(openPopup, GOOGLE_MAPS_LONG_PRESS_MS);
    }

    function cancel() {
        clearTimeout(timer);
    }

    targetMap.on('mousedown', start);
    targetMap.on('touchstart', start);
    targetMap.on('mouseup', cancel);
    targetMap.on('touchend', cancel);
    targetMap.on('dragstart', cancel);
    targetMap.on('move', cancel);
    targetMap.on('zoomstart', cancel);
    targetMap.on('contextmenu', (e) => {
        e.originalEvent.preventDefault();
        startEvent = e;
        openPopup();
    });
}

/**
 * NOUVELLE FONCTION : Affiche la carte interactive avec les couches GeoJSON
 * récupérées depuis l'API Carto de l'IGN.
 */
async function displayInteractiveEnvMap() {
    const mapDiv = document.getElementById('env-map');
    mapDiv.style.display = 'block';
    document.getElementById('layer-controls').style.display = 'none'; // On n'utilise plus les contrôles manuels
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
    if (!envMap) {
        envMap = L.map('env-map', { preferCanvas: true }).setView([selectedLat, selectedLon], 11);
        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
            maxZoom: 17,
            crossOrigin: true
        }).addTo(envMap);
        topoLayer.on('tileerror', () => {
            if (envMap.hasLayer(topoLayer)) {
                envMap.removeLayer(topoLayer);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(envMap);
            }
        });
        enableGoogleMapsLongPress(envMap);
    } else {
        envMap.setView([selectedLat, selectedLon], 11);
        if (layerControl) envMap.removeControl(layerControl); // Supprime l'ancien contrôle de couches
        envMap.eachLayer(layer => { // Supprime les anciennes couches GeoJSON
            if (layer instanceof L.GeoJSON) envMap.removeLayer(layer);
        });
    }

    // Ajoute un marqueur pour le point analysé
    if (envMarker) envMap.removeLayer(envMarker);
    envMarker = L.marker([selectedLat, selectedLon]).addTo(envMap)
      .bindPopup("Point d'analyse").openPopup();

    // Initialise le nouveau contrôle de couches
    const overlayMaps = {};
    layerControl = L.control.layers(null, overlayMaps, { collapsed: false }).addTo(envMap);

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
function copyCoords() {
    if (!selectedLat || !selectedLon) return;
    const text = `${selectedLat.toFixed(6)}, ${selectedLon.toFixed(6)}`;
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Coordonnées copiées');
    });
}

// Ouvre la position dans Google Maps
function openInGmaps() {
    if (!selectedLat || !selectedLon) return;
    window.open(`https://www.google.com/maps?q=${selectedLat},${selectedLon}`, '_blank');
}

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

// Réinitialise la sélection et masque les résultats
function resetSelection() {
    selectedLat = null;
    selectedLon = null;
    selectedAlt = null;
    layerCache = {};
    lastCacheCoords = null;
    if (marker) { map.removeLayer(marker); marker = null; }
    if (envMap) { envMap.remove(); envMap = null; }
    envMarker = null;
    document.getElementById('coordinates-display').style.display = 'none';
    document.getElementById('selected-coords').textContent = '--';
    document.getElementById('validate-location').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('env-map').style.display = 'none';
    document.getElementById('map-container').style.display = 'none';
    document.getElementById('choose-on-map').textContent = '🗺️ Ouvrir la carte';
    document.getElementById('measure-distance').style.display = 'none';
    document.getElementById('altitude-line').style.display = 'none';
    document.getElementById('altitude-value').textContent = '--';
    if (measuring && envMap) toggleMeasure();
}

// Gestionnaire pour le retour à la page d'accueil
window.addEventListener('pageshow', (event) => {
	if (event.persisted) {
                document.getElementById('use-geolocation').disabled = false;
                document.getElementById('use-geolocation').textContent = '📍 Utiliser ma localisation';
	}
});
