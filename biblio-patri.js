// /biblio-patri.js
// Version finale avec indexation côté client et contrôle des fonds de carte.

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Injection des styles ---

    // Définir la projection Lambert-93 pour proj4
    if (typeof proj4 !== 'undefined') {
        proj4.defs('EPSG:2154', '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs');
    }

    const LAMBERT93_WKT = 'PROJCS["RGF93 / Lambert-93",GEOGCS["GCS_RGF93",DATUM["D_RGF93",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]],PROJECTION["Lambert_Conformal_Conic_2SP"],PARAMETER["standard_parallel_1",49],PARAMETER["standard_parallel_2",44],PARAMETER["latitude_of_origin",46.5],PARAMETER["central_meridian",3],PARAMETER["false_easting",700000],PARAMETER["false_northing",6600000],UNIT["Meter",1]]';

    const LONG_PRESS_MS = 3000; // long press delay to select a location
    
    
    // --- 2. Déclaration des variables et constantes globales ---
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results');
    const mapContainer = document.getElementById('map');
    const addressInput = document.getElementById('address-input');
    const searchAddressBtn = document.getElementById('search-address-btn');
    const useGeolocationBtn = document.getElementById('use-geolocation-btn');
    const drawPolygonBtn = document.getElementById('draw-polygon-btn');
    const toggleTrackingBtn = document.getElementById('toggle-tracking-btn');
    const toggleLabelsBtn = document.getElementById('toggle-labels-btn');
    const downloadShapefileBtn = document.getElementById('download-shapefile-btn');
    const downloadContainer = document.getElementById('download-container');

    let trackingMap = null;
    let trackingButton = null;
    let analysisLabelsVisible = true;

    const stopLocationTracking = () => {
        if (trackingWatchId !== null) {
            navigator.geolocation.clearWatch(trackingWatchId);
            trackingWatchId = null;
        }
        if (trackingMarker && trackingMap) {
            trackingMap.removeLayer(trackingMarker);
            trackingMarker = null;
        }
        trackingActive = false;
        if (trackingButton) trackingButton.textContent = '⭐ Suivi de position';
        trackingMap = null;
        trackingButton = null;
    };

    const startLocationTracking = (mapInstance, buttonEl) => {
        if (!mapInstance || trackingActive) return;
        trackingMap = mapInstance;
        trackingButton = buttonEl;
        trackingWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                if (!trackingMarker) {
                    const icon = L.divIcon({ html: '⭐', className: 'user-location-icon', iconSize: [20,20], iconAnchor: [10,10] });
                    trackingMarker = L.marker(latlng, { icon }).addTo(trackingMap);
                } else {
                    trackingMarker.setLatLng(latlng);
                }
            },
            () => {
                if (typeof showNotification === 'function') {
                    showNotification('Erreur de géolocalisation', 'error');
                }
                stopLocationTracking();
            },
            { enableHighAccuracy: true }
        );
        trackingActive = true;
        if (trackingButton) trackingButton.textContent = '🛑 Arrêter suivi';
    };

    const toggleLocationTracking = (mapInstance, buttonEl) => {
        if (trackingActive) stopLocationTracking(); else startLocationTracking(mapInstance, buttonEl);
    };

    const toggleAnalysisLabels = () => {
        analysisLabelsVisible = !analysisLabelsVisible;
        mapContainer.classList.toggle('hide-labels', !analysisLabelsVisible);
        if (toggleLabelsBtn) {
            toggleLabelsBtn.textContent = analysisLabelsVisible ? 'Masquer les étiquettes' : 'Afficher les étiquettes';
        }
    };

    const showChoicePopup = (latlng, extra = {}) => {
        if (!map) return;
        const container = L.DomUtil.create('div', 'popup-button-container');
        const patrBtn = L.DomUtil.create('button', 'action-button', container);
        patrBtn.textContent = 'Flore patrimoniale';
        const obsBtn = L.DomUtil.create('button', 'action-button', container);
        obsBtn.textContent = 'Flore commune';
        L.DomEvent.on(patrBtn, 'click', () => {
            map.closePopup();
            runAnalysis({ latitude: latlng.lat, longitude: latlng.lng, ...extra });
        });
        L.DomEvent.on(obsBtn, 'click', () => {
            map.closePopup();
            loadObservationsAt({ latitude: latlng.lat, longitude: latlng.lng, ...extra });
        });
        L.DomEvent.disableClickPropagation(container);
        L.popup().setLatLng(latlng).setContent(container).openOn(map);
    };


    let currentShapefileData = null;

    let map = null;
    let layersControl = null;
    let searchAreaLayer = null;
    let patrimonialLayerGroup = L.layerGroup();
    let obsSearchPolygon = null;
    let observationsLayerGroup = L.layerGroup();
    let obsLayerAddedToControl = false;
    let speciesColorMap = new Map();
    let allPatrimonialLocations = null;
    let allPatrimonialSpecies = [];
    let selectedSpecies = new Set();
    let rulesByTaxonIndex = new Map();
    let trackingWatchId = null;
    let trackingMarker = null;
    let trackingActive = false;
    let ecology = {};
    let floreAlpesIndex = {};

    function norm(txt) {
        if (typeof txt !== 'string') return '';
        return txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '');
    }

    const ecolOf = n => ecology[norm(n)] || '—';

    const linkIcon = (url, img, alt, extraClass = '') => {
        if (!url) return '';
        const encoded = img.split('/').map(s => encodeURIComponent(s)).join('/');
        const cls = extraClass ? `logo-icon ${extraClass}` : 'logo-icon';
        return `<a href="${url}" target="_blank" rel="noopener"><img src="assets/${encoded}" alt="${alt}" class="${cls}"></a>`;
    };

    const floreAlpesUrl = (name) => {
        const normalizedSci = norm(name);
        const foundKey = Object.keys(floreAlpesIndex).find(key => norm(key.split('(')[0]) === normalizedSci);
        if (foundKey) {
            const urlPart = floreAlpesIndex[foundKey].split('?')[0];
            return `https://www.florealpes.com/${urlPart}`;
        }
        return null;
    };
    const SEARCH_RADIUS_KM = 2;
    const OBS_RADIUS_KM = 0.5;
    const ANALYSIS_MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;
    const FETCH_TIMEOUT_MS = 10000;
    const TRACHEOPHYTA_TAXON_KEY = 7707728; // GBIF taxonKey for vascular plants
    const SPECIES_COLORS = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#800000', '#AA6E28', '#000075', '#A9A9A9'];
    const nonPatrimonialLabels = new Set(["Liste des espèces végétales sauvages pouvant faire l'objet d'une réglementation préfectorale dans les départements d'outre-mer : Article 1"]);
    const nonPatrimonialRedlistCodes = new Set(['LC', 'DD', 'NA', 'NE']);
    const HABITATS_DIRECTIVE_CODES = new Set(['CDH1', 'CDH2', 'CDH4', 'CDH5']);
    const OLD_REGIONS_TO_DEPARTMENTS = { 'Alsace': ['67', '68'], 'Aquitaine': ['24', '33', '40', '47', '64'], 'Auvergne': ['03', '15', '43', '63'], 'Basse-Normandie': ['14', '50', '61'], 'Bourgogne': ['21', '58', '71', '89'], 'Champagne-Ardenne': ['08', '10', '51', '52'], 'Franche-Comté': ['25', '39', '70', '90'], 'Haute-Normandie': ['27', '76'], 'Languedoc-Roussillon': ['11', '30', '34', '48', '66'], 'Limousin': ['19', '23', '87'], 'Lorraine': ['54', '55', '57', '88'], 'Midi-Pyrénées': ['09', '12', '31', '32', '46', '65', '81', '82'], 'Nord-Pas-de-Calais': ['59', '62'], 'Picardie': ['02', '60', '80'], 'Poitou-Charentes': ['16', '17', '79', '86'], 'Rhône-Alpes': ['01', '07', '26', '38', '42', '69', '73', '74'] };
    const ADMIN_NAME_TO_CODE_MAP = { "France": "FR", "Ain": "01", "Aisne": "02", "Allier": "03", "Alpes-de-Haute-Provence": "04", "Hautes-Alpes": "05", "Alpes-Maritimes": "06", "Ardèche": "07", "Ardennes": "08", "Ariège": "09", "Aube": "10", "Aude": "11", "Aveyron": "12", "Bouches-du-Rhône": "13", "Calvados": "14", "Cantal": "15", "Charente": "16", "Charente-Maritime": "17", "Cher": "18", "Corrèze": "19", "Corse-du-Sud": "2A", "Haute-Corse": "2B", "Côte-d'Or": "21", "Côtes-d'Armor": "22", "Creuse": "23", "Dordogne": "24", "Doubs": "25", "Drôme": "26", "Eure": "27", "Eure-et-Loir": "28", "Finistère": "29", "Gard": "30", "Haute-Garonne": "31", "Gers": "32", "Gironde": "33", "Hérault": "34", "Ille-et-Vilaine": "35", "Indre": "36", "Indre-et-Loire": "37", "Isère": "38", "Jura": "39", "Landes": "40", "Loir-et-Cher": "41", "Loire": "42", "Haute-Loire": "43", "Loire-Atlantique": "44", "Loiret": "45", "Lot": "46", "Lot-et-Garonne": "47", "Lozère": "48", "Maine-et-Loire": "49", "Manche": "50", "Marne": "51", "Haute-Marne": "52", "Mayenne": "53", "Meurthe-et-Moselle": "54", "Meuse": "55", "Morbihan": "56", "Moselle": "57", "Nièvre": "58", "Nord": "59", "Oise": "60", "Orne": "61", "Pas-de-Calais": "62", "Puy-de-Dôme": "63", "Pyrénées-Atlantiques": "64", "Hautes-Pyrénées": "65", "Pyrénées-Orientales": "66", "Bas-Rhin": "67", "Haut-Rhin": "68", "Rhône": "69", "Haute-Saône": "70", "Saône-et-Loire": "71", "Sarthe": "72", "Savoie": "73", "Haute-Savoie": "74", "Paris": "75", "Seine-Maritime": "76", "Seine-et-Marne": "77", "Yvelines": "78", "Deux-Sèvres": "79", "Somme": "80", "Tarn": "81", "Tarn-et-Garonne": "82", "Var": "83", "Vaucluse": "84", "Vendée": "85", "Vienne": "86", "Haute-Vienne": "87", "Vosges": "88", "Yonne": "89", "Territoire de Belfort": "90", "Essonne": "91", "Hauts-de-Seine": "92", "Seine-Saint-Denis": "93", "Val-de-Marne": "94", "Val-d'Oise": "95", "Auvergne-Rhône-Alpes": "84", "Bourgogne-Franche-Comté": "27", "Bretagne": "53", "Centre-Val de Loire": "24", "Corse": "94", "Grand Est": "44", "Hauts-de-France": "32", "Île-de-France": "11", "Normandie": "28", "Nouvelle-Aquitaine": "75", "Occitanie": "76", "Pays de la Loire": "52", "Provence-Alpes-Côte d'Azur": "93", "Guadeloupe": "01", "Martinique": "02", "Guyane": "03", "La Réunion": "04", "Mayotte": "06" };

    const setStatus = (message, isLoading = false) => {
        statusDiv.innerHTML = '';
        if (isLoading) {
            const spinner = document.createElement('div');
            spinner.className = 'loading';
            statusDiv.appendChild(spinner);
        }
        if (message) statusDiv.innerHTML += `<p>${message}</p>`;
    };

    const fetchWithRetry = async (url, options = {}, maxRetries = ANALYSIS_MAX_RETRIES) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
                const resp = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(timeoutId);
                if (!resp.ok) throw new Error(resp.statusText || 'Request failed');
                return resp;
            } catch (err) {
                clearTimeout(timeoutId);
                if (attempt === maxRetries) throw err;
                setStatus(`Erreur : ${err.message}. Nouvelle tentative (${maxRetries - attempt} restante(s))...`, true);
                await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
            }
        }
    };
    
    const indexRulesFromCSV = (csvText) => {
        const lines = csvText.trim().split(/\r?\n/);
        const header = lines.shift().split(';').map(h => h.trim().replace(/"/g, ''));
        const indices = { adm: header.indexOf('LB_ADM_TR'), nom: header.indexOf('LB_NOM'), code: header.indexOf('CODE_STATUT'), type: header.indexOf('LB_TYPE_STATUT'), label: header.indexOf('LABEL_STATUT') };
        
        const index = new Map();
        lines.forEach(line => {
            const cols = line.split(';');
            const rowData = {
                adm: cols[indices.adm]?.trim().replace(/"/g, '') || '', nom: cols[indices.nom]?.trim().replace(/"/g, '') || '',
                code: cols[indices.code]?.trim().replace(/"/g, '') || '', type: cols[indices.type]?.trim().replace(/"/g, '') || '',
                label: cols[indices.label]?.trim().replace(/"/g, '') || ''
            };
            if (rowData.nom && rowData.type) {
                if (!index.has(rowData.nom)) { index.set(rowData.nom, []); }
                index.get(rowData.nom).push(rowData);
            }
        });
        return index;
    };

    const initializeApp = async () => {
        try {
            setStatus("Chargement des données...", true);
            const [bdcResp, ecoResp, faResp] = await Promise.all([
                fetch('/BDCstatut.csv'),
                fetch('ecology.json'),
                fetch('assets/florealpes_index.json')
            ]);
            if (!bdcResp.ok) throw new Error("Le référentiel BDCstatut.csv est introuvable.");
            if (!ecoResp.ok) throw new Error("Le fichier ecology.json est introuvable.");
            if (!faResp.ok) throw new Error("Le fichier florealpes_index.json est introuvable.");
            const csvText = await bdcResp.text();
            rulesByTaxonIndex = indexRulesFromCSV(csvText);
            const ecoJson = await ecoResp.json();
            Object.entries(ecoJson).forEach(([k,v]) => {
                ecology[norm(k.split(';')[0])] = v;
            });
            floreAlpesIndex = await faResp.json();
            setStatus("");
            console.log(`Référentiel chargé, ${rulesByTaxonIndex.size} taxons indexés.`);
        } catch (error) {
            setStatus(`Erreur critique au chargement : ${error.message}`);
            console.error(error);
        }
    };

    // --- *** MODIFICATION MAJEURE : Ajout du contrôle des couches *** ---
    const initializeMap = (params) => {
        stopLocationTracking();

        // 1. Définition des couches de base
        const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
        });
    
        const satelliteMap = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution:
                    'Tiles © Esri — Source: Esri, Earthstar Geographics, and the GIS User Community',
                maxZoom: 19,
                crossOrigin: true
            }
        );
    
        // 2. Création de la carte (ou mise à jour si elle existe déjà)
        mapContainer.style.display = 'block';
        if (!map) {
            map = L.map(mapContainer, {
                center: [params.latitude, params.longitude],
                zoom: 13,
                layers: [topoMap]
            });
        } else {
            map.setView([params.latitude, params.longitude], 13);
        }

        // 3. Définition des objets pour le contrôle des couches
        const baseMaps = {
            "Topographique": topoMap,
            "Satellite": satelliteMap
        };

        const overlayMaps = {
            "Espèces Patrimoniales": patrimonialLayerGroup,
            "Observations GBIF": observationsLayerGroup
        };

        // 4. Ajout du contrôle à la carte (une seule fois)
        if (!layersControl) {
            layersControl = L.control.layers(baseMaps, overlayMaps).addTo(map);
        }

        if (searchAreaLayer) {
            map.removeLayer(searchAreaLayer);
            searchAreaLayer = null;
        }
        if (params.polygon) {
            searchAreaLayer = L.polygon(params.polygon, { color: '#c62828', weight: 2, fillOpacity: 0.1, interactive: false }).addTo(map);
        } else {
            searchAreaLayer = L.circle([params.latitude, params.longitude], { radius: SEARCH_RADIUS_KM * 1000, color: '#c62828', weight: 2, fillOpacity: 0.1, interactive: false }).addTo(map);
        }
    };

const initializeSelectionMap = (coords) => {
        stopLocationTracking();
        const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
        });
        const satelliteMap = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Tiles © Esri — Source: Esri, Earthstar Geographics, and the GIS User Community',
                maxZoom: 19,
                crossOrigin: true
            }
        );
        mapContainer.style.display = 'block';
        if (!map) {
            map = L.map(mapContainer, { center: [coords.latitude, coords.longitude], zoom: 12, layers: [topoMap] });
            if (!layersControl) {
                layersControl = L.control.layers(
                    { "Topographique": topoMap, "Satellite": satelliteMap },
                    { "Espèces Patrimoniales": patrimonialLayerGroup, "Observations GBIF": observationsLayerGroup }
                ).addTo(map);
            }
        } else {
            map.setView([coords.latitude, coords.longitude], map.getZoom() || 12);
        }
};

    const polygonToWkt = (latlngs) => {
        const pts = latlngs.slice();
        if (pts[0].lat !== pts[pts.length-1].lat || pts[0].lng !== pts[pts.length-1].lng) {
            pts.push(pts[0]);
        }
        return `POLYGON((${pts.map(p => `${p.lng.toFixed(5)} ${p.lat.toFixed(5)}`).join(', ')}))`;
    };

    const centroidOf = (latlngs) => {
        let lat = 0, lng = 0;
        latlngs.forEach(p => { lat += p.lat; lng += p.lng; });
        const n = latlngs.length;
        return { latitude: lat/n, longitude: lng/n };
    };
    
    const fetchAndDisplayAllPatrimonialOccurrences = async (patrimonialMap, wkt, initialOccurrences) => {
        const speciesNames = Object.keys(patrimonialMap);
        if (speciesNames.length === 0) return;
        setStatus(`Étape 4/4: Cartographie détaillée des espèces patrimoniales... (0/${speciesNames.length})`, true);
        let allOccurrencesWithContext = [];
        const taxonKeyMap = new Map();
        initialOccurrences.forEach(occ => {
            if (occ.species && occ.speciesKey && !taxonKeyMap.has(occ.species)) {
                taxonKeyMap.set(occ.species, occ.speciesKey);
            }
        });
        for (const [index, speciesName] of speciesNames.entries()) {
            setStatus(`Étape 4/4: Cartographie détaillée des espèces patrimoniales... (${index + 1}/${speciesNames.length})`, true);
            const taxonKey = taxonKeyMap.get(speciesName);
            if (!taxonKey) continue;
            const color = SPECIES_COLORS[index % SPECIES_COLORS.length];
            let speciesOccs = [];
            let endOfRecords = false;
            for (let page = 0; page < 10 && !endOfRecords; page++) {
                const gbifUrl = `https://api.gbif.org/v1/occurrence/search?limit=1000&offset=${page*1000}&geometry=${encodeURIComponent(wkt)}&taxonKey=${taxonKey}`;
                try {
                    const resp = await fetchWithRetry(gbifUrl);
                    if (!resp.ok) break;
                    const pageData = await resp.json();
                    if (pageData.results?.length > 0) {
                        pageData.results.forEach(occ => {
                            occ.speciesName = speciesName;
                            occ.color = color;
                        });
                        speciesOccs = speciesOccs.concat(pageData.results);
                    }
                    endOfRecords = pageData.endOfRecords;
                } catch (e) { console.error("Erreur durant la cartographie détaillée pour :", speciesName, e); break; }
            }
            allOccurrencesWithContext = allOccurrencesWithContext.concat(speciesOccs);
        }
        const locations = new Map();
        allOccurrencesWithContext.forEach(occ => {
            if (occ.decimalLatitude && occ.decimalLongitude) {
                const coordKey = `${occ.decimalLatitude.toFixed(5)},${occ.decimalLongitude.toFixed(5)}`;
                if (!locations.has(coordKey)) {
                    locations.set(coordKey, { lat: occ.decimalLatitude, lon: occ.decimalLongitude, speciesList: [] });
                }
                const locationData = locations.get(coordKey);
                if (!locationData.speciesList.some(s => s.name === occ.speciesName)) {
                    locationData.speciesList.push({ name: occ.speciesName, color: occ.color });
                }
            }
        });
        allPatrimonialLocations = locations;
        allPatrimonialSpecies = speciesNames;
        speciesColorMap = new Map();
        speciesNames.forEach((name, idx) => {
            speciesColorMap.set(name, SPECIES_COLORS[idx % SPECIES_COLORS.length]);
        });
        if (selectedSpecies.size === 0) {
            selectedSpecies = new Set(allPatrimonialSpecies);
        }
        renderPatrimonialLocations();
    };

    const renderPatrimonialLocations = () => {
        if (!allPatrimonialLocations) return;
        // Ne pas effacer les points précédents pour conserver l'historique
        const features = [];
        let pointCount = 0;
        for (const location of allPatrimonialLocations.values()) {
            const filtered = location.speciesList.filter(s => selectedSpecies.has(s.name));
            if (filtered.length === 0) continue;
            pointCount++;
            const count = filtered.length;
            const iconHtml = `<div class="marker-cluster-icon" style="background-color: ${count > 1 ? '#c62828' : filtered[0].color};"><span>${count}</span></div>`;
            const icon = L.divIcon({ html: iconHtml, className: 'custom-cluster', iconSize: [28, 28], iconAnchor: [14, 14] });
            let popupContent = `<div class="custom-popup"><b>${count} espèce(s) patrimoniale(s) :</b><ul>`;
            filtered.forEach(s => {
                const eco = ecolOf(s.name);
                const faLink = linkIcon(floreAlpesUrl(s.name), 'FloreAlpes.png', 'FloreAlpes');
                popupContent += `<li><span class="legend-color" style="background-color:${s.color};"></span><i>${s.name}</i>${faLink}<br><small>${eco}</small></li>`;
            });
            popupContent += '</ul></div>';
            const tooltipHtml = `<i>${filtered.map(s => s.name).join('<br>')}</i>`;
            const marker = L.marker([location.lat, location.lon], { icon })
                .bindPopup(popupContent)
                .bindTooltip(tooltipHtml, { permanent: true, direction: 'right', offset: [8, 0] });
            patrimonialLayerGroup.addLayer(marker);
            if (typeof proj4 !== 'undefined') {
                const coords2154 = proj4('EPSG:4326', 'EPSG:2154', [location.lon, location.lat]);
                features.push({
                    type: 'Feature',
                    properties: { species: filtered.map(s => s.name).join('; ') },
                    geometry: { type: 'Point', coordinates: coords2154 }
                });
            }
        }
        if (features.length > 0) {
            currentShapefileData = { type: 'FeatureCollection', features };
            downloadContainer.style.display = 'block';
        } else {
            currentShapefileData = null;
            downloadContainer.style.display = 'none';
        }
        if(!map.hasLayer(patrimonialLayerGroup)) {
            patrimonialLayerGroup.addTo(map);
        }
        setStatus(`${selectedSpecies.size} espèce(s) patrimoniale(s) cartographiée(s) sur ${pointCount} points.`, false);
    };

    const displayResults = (occurrences, patrimonialMap, wkt) => {
        resultsContainer.innerHTML = '';
        // Ne pas effacer les points précédents pour conserver l'historique
        if (Object.keys(patrimonialMap).length === 0) {
            setStatus(`Aucune occurrence d'espèce patrimoniale trouvée dans ce rayon de ${SEARCH_RADIUS_KM} km.`);
            return;
        }
        setStatus(`${Object.keys(patrimonialMap).length} espèce(s) patrimoniale(s) trouvée(s). Lancement de l'étape 4/4 : cartographie détaillée...`);

        const allSpeciesList = Object.keys(patrimonialMap).sort();
        const tableBody = document.createElement('tbody');
        allSpeciesList.forEach((speciesName, index) => {
            const color = SPECIES_COLORS[index % SPECIES_COLORS.length];
            const row = tableBody.insertRow();
            row.dataset.species = speciesName;
            const statusCellContent = Array.isArray(patrimonialMap[speciesName])
                ? '<ul>' + patrimonialMap[speciesName].map(s => `<li>${s}</li>`).join('') + '</ul>'
                : patrimonialMap[speciesName];
            const faLink = linkIcon(floreAlpesUrl(speciesName), 'FloreAlpes.png', 'FloreAlpes');
            row.innerHTML = `<td><input type="checkbox" class="species-toggle" data-species="${speciesName}" checked></td><td><span class="legend-color" style="background-color:${color};"></span><i>${speciesName}</i></td><td>${statusCellContent}</td><td>${faLink}</td>`;
        });

        const selectAllBtn = document.createElement('button');
        selectAllBtn.id = 'toggle-all-btn';
        selectAllBtn.className = 'action-button';
        selectAllBtn.textContent = 'Tout désélectionner';
        resultsContainer.appendChild(selectAllBtn);

        const detailsBtn = document.createElement('button');
        detailsBtn.id = 'show-details-btn';
        detailsBtn.className = 'action-button';
        detailsBtn.style.marginLeft = '0.5rem';
        detailsBtn.textContent = 'Voir le détail des espèces patri';
        resultsContainer.appendChild(detailsBtn);

        const table = document.createElement('table');
        table.innerHTML = `<thead><tr><th></th><th>Nom scientifique</th><th>Statut de patrimonialité</th><th>Flore Alpes</th></tr></thead>`;
        table.appendChild(tableBody);
        resultsContainer.appendChild(table);

        const updateSelectAllButton = () => {
            selectAllBtn.textContent = selectedSpecies.size === allPatrimonialSpecies.length ? 'Tout désélectionner' : 'Tout sélectionner';
        };

        table.querySelectorAll('.species-toggle').forEach(cb => {
            cb.addEventListener('change', () => {
                const sp = cb.dataset.species;
                if (cb.checked) selectedSpecies.add(sp); else selectedSpecies.delete(sp);
                updateSelectAllButton();
                renderPatrimonialLocations();
            });
        });

        table.querySelectorAll('tbody tr').forEach(tr => {
            tr.addEventListener('click', (e) => {
                if (e.target.tagName.toLowerCase() === 'input') return;
                const sp = tr.dataset.species;
                selectedSpecies = new Set([sp]);
                table.querySelectorAll('.species-toggle').forEach(cb => {
                    cb.checked = cb.dataset.species === sp;
                });
                updateSelectAllButton();
                renderPatrimonialLocations();
            });
        });

        selectAllBtn.addEventListener('click', () => {
            const allSelected = selectedSpecies.size === allPatrimonialSpecies.length;
            if (allSelected) selectedSpecies.clear();
            else selectedSpecies = new Set(allPatrimonialSpecies);
            table.querySelectorAll('.species-toggle').forEach(cb => {
                cb.checked = selectedSpecies.has(cb.dataset.species);
            });
            updateSelectAllButton();
            renderPatrimonialLocations();
        });

        detailsBtn.addEventListener('click', () => {
            // Use the pre‑computed list from the analysis; fall back to the
            // global array if it has been populated later on.
            const names = allSpeciesList.length ? allSpeciesList : Array.from(allPatrimonialSpecies);
            if (names.length) {
                sessionStorage.setItem('speciesQueryNames', JSON.stringify(names));
                window.location.href = 'organ.html';
            }
        });

        selectedSpecies = new Set(Object.keys(patrimonialMap));
        updateSelectAllButton();
        fetchAndDisplayAllPatrimonialOccurrences(patrimonialMap, wkt, occurrences);
    };

    const runAnalysis = async (params) => {
        try {
            resultsContainer.innerHTML = '';
            mapContainer.style.display = 'none';
            initializeMap(params);
            setStatus("Étape 1/4: Initialisation de la carte...", true);
            let wkt = params.wkt;
            if (!wkt) {
                wkt = `POLYGON((${Array.from({length:33},(_,i)=>{const a=i*2*Math.PI/32,r=111.32*Math.cos(params.latitude*Math.PI/180);return`${(params.longitude+SEARCH_RADIUS_KM/r*Math.cos(a)).toFixed(5)} ${(params.latitude+SEARCH_RADIUS_KM/111.132*Math.sin(a)).toFixed(5)}`}).join(', ')}))`;
            }
            let allOccurrences = [];
            const maxPages = 20;
            const limit = 1000;
            setStatus(`Étape 2/4: Inventaire de la flore locale via GBIF... (Page 0/${maxPages})`, true);
            for (let page = 0; page < maxPages; page++) {
                const offset = page * limit;
                setStatus(`Étape 2/4: Inventaire de la flore locale via GBIF... (Page ${page + 1}/${maxPages})`, true);
                const gbifUrl = `https://api.gbif.org/v1/occurrence/search?limit=${limit}&offset=${offset}&geometry=${encodeURIComponent(wkt)}&kingdomKey=6`;
                const gbifResp = await fetchWithRetry(gbifUrl);
                if (!gbifResp.ok) throw new Error("L'API GBIF est indisponible.");
                const pageData = await gbifResp.json();
                if (pageData.results?.length > 0) { allOccurrences = allOccurrences.concat(pageData.results); }
                if (pageData.endOfRecords) { break; }
            }
            if (allOccurrences.length === 0) { throw new Error("Aucune occurrence de plante trouvée à proximité."); }
            setStatus("Étape 3/4: Analyse des données...", true);
            const uniqueSpeciesNames = [...new Set(allOccurrences.map(o => o.species).filter(Boolean))];
            const relevantRules = new Map();
            const { departement, region } = (await (await fetch(`https://geo.api.gouv.fr/communes?lat=${params.latitude}&lon=${params.longitude}&fields=departement,region`)).json())[0];
            for (const speciesName of uniqueSpeciesNames) {
                const rulesForThisTaxon = rulesByTaxonIndex.get(speciesName);
                if (rulesForThisTaxon) {
                    for (const row of rulesForThisTaxon) {
                        let ruleApplies = false;
                        const type = row.type.toLowerCase();
                        const isHabitatsDirective = type.includes('directive habitat') && HABITATS_DIRECTIVE_CODES.has(row.code);
                        if (isHabitatsDirective) {
                            ruleApplies = true;
                        } else if (ADMIN_NAME_TO_CODE_MAP[row.adm] === 'FR' || type.includes('nationale')) {
                            ruleApplies = true;
                        } else if (OLD_REGIONS_TO_DEPARTMENTS[row.adm]?.includes(departement.code)) {
                            ruleApplies = true;
                        } else {
                            const adminCode = ADMIN_NAME_TO_CODE_MAP[row.adm];
                            if (adminCode === departement.code || adminCode === region.code) { ruleApplies = true; }
                        }
                        if (ruleApplies) {
                            if (nonPatrimonialLabels.has(row.label) || type.includes('déterminante znieff')) { continue; }
                            const isRedList = type.includes('liste rouge');
                            if (isRedList && nonPatrimonialRedlistCodes.has(row.code)) { continue; }
                            const ruleKey = `${row.nom}|${row.type}|${row.adm}`;
                            if (!relevantRules.has(ruleKey)) {
                                const descriptiveStatus = isRedList ? `${row.type} (${row.code}) (${row.adm})` : row.label;
                                relevantRules.set(ruleKey, { species: row.nom, status: descriptiveStatus });
                            }
                        }
                    }
                }
            }
            let analysisResp;
            for (let attempt = 1; attempt <= ANALYSIS_MAX_RETRIES; attempt++) {
                try {
                    analysisResp = await fetch('/.netlify/functions/analyze-patrimonial-status', {
                        method: 'POST',
                        body: JSON.stringify({
                            relevantRules: Array.from(relevantRules.values()),
                            uniqueSpeciesNames,
                            coords: { latitude: params.latitude, longitude: params.longitude }
                        })
                    });
                    if (!analysisResp.ok) {
                        const errBody = await analysisResp.text();
                        throw new Error(`Le service d'analyse a échoué: ${errBody}`);
                    }
                    break;
                } catch (err) {
                    if (attempt === ANALYSIS_MAX_RETRIES) throw err;
                    setStatus(`Erreur : ${err.message}. Nouvelle tentative (${ANALYSIS_MAX_RETRIES - attempt} restante(s))...`, true);
                    await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
                }
            }
            const patrimonialMap = await analysisResp.json();
            displayResults(allOccurrences, patrimonialMap, wkt);
        } catch (error) {
            console.error("Erreur durant l'analyse:", error);
            setStatus(`Erreur : ${error.message}`);
            if (mapContainer) mapContainer.style.display = 'none';
        }
    };
    
    const handleAddressSearch = async () => {
        const address = addressInput.value.trim();
        if (!address) return alert("Veuillez saisir une adresse.");
        try {
            setStatus(`Géocodage de l'adresse...`, true);
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            if (!resp.ok) throw new Error("Service de géocodage indisponible.");
            const data = await resp.json();
            if (data.length === 0) throw new Error("Adresse non trouvée.");
            const coords = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
            initializeSelectionMap(coords);
            showChoicePopup(L.latLng(coords.latitude, coords.longitude));
        } catch (error) { setStatus(`Erreur : ${error.message}`); }
    };
    
    const handleGeolocationSearch = async (showPopup = true) => {
        try {
            setStatus("Récupération de votre position...", true);
            const { coords } = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }));
            initializeSelectionMap(coords);
            if (showPopup) {
                showChoicePopup(L.latLng(coords.latitude, coords.longitude));
            }
        } catch(error) { setStatus(`Erreur de géolocalisation : ${error.message}`); }
    };

    const startMapSelection = async () => {
        let center;
        if (map) {
            const c = map.getCenter();
            center = { latitude: c.lat, longitude: c.lng };
        } else {
            center = { latitude: 45.1885, longitude: 5.7245 };
            try {
                const { coords } = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
                center = { latitude: coords.latitude, longitude: coords.longitude };
            } catch (e) {}
        }
        initializeSelectionMap(center);
        let pressTimer;
        const showPopup = (latlng) => showChoicePopup(latlng);
        const onContextMenu = (e) => {
            e.originalEvent.preventDefault();
            showPopup(e.latlng);
        };
        const onDown = (e) => {
            if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
            pressTimer = setTimeout(() => showPopup(e.latlng), LONG_PRESS_MS);
        };
        const cancel = () => clearTimeout(pressTimer);
        map.on('contextmenu', onContextMenu);
        map.on('mousedown', onDown);
        map.on('mouseup', cancel);
        map.on('mousemove', cancel);
        map.on('touchstart', onDown);
        map.on('touchend', cancel);
        map.on('touchmove', cancel);
        map.on('dragstart', cancel);
        map.on('move', cancel);
        map.on('zoomstart', cancel);
    };

    const startPolygonSelection = async () => {
        let center;
        if (map) {
            const c = map.getCenter();
            center = { latitude: c.lat, longitude: c.lng };
        } else {
            center = { latitude: 45.1885, longitude: 5.7245 };
            try {
                const { coords } = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
                center = { latitude: coords.latitude, longitude: coords.longitude };
            } catch (e) {}
        }
        initializeSelectionMap(center);
        setStatus('Tracez un polygone pour définir la zone de recherche.', false);
        const drawer = new L.Draw.Polygon(map, { shapeOptions: { color: '#c62828' } });
        drawer.enable();
        map.once(L.Draw.Event.CREATED, (e) => {
            const latlngs = e.layer.getLatLngs()[0];
            const centroid = centroidOf(latlngs);
            const wkt = polygonToWkt(latlngs);
            showChoicePopup(L.latLng(centroid.latitude, centroid.longitude), { wkt, polygon: latlngs });
        });
    };

    let obsSearchCircle = null;

    const displayObservations = (occurrences) => {
        observationsLayerGroup.clearLayers();
        const floraOccs = occurrences.filter(o =>
            (o.phylum && /tracheophyta/i.test(o.phylum)) ||
            (o.kingdom && /plantae/i.test(o.kingdom))
        );
        floraOccs.forEach(o => {
            if (o.decimalLatitude && o.decimalLongitude && o.species) {
                const m = L.marker([o.decimalLatitude, o.decimalLongitude]);
                const eco = ecolOf(o.species);
                const faLink = linkIcon(floreAlpesUrl(o.species), 'FloreAlpes.png', 'FloreAlpes');
                const popup = `<div class="custom-popup"><i>${o.species}</i>${faLink}<br><small>${eco}</small></div>`;
                m.bindTooltip(`<i>${o.species}</i>`, { permanent: true, direction: 'right', offset: [8,0] })
                 .bindPopup(popup);
                observationsLayerGroup.addLayer(m);
            }
        });
        statusDiv.innerHTML = `${floraOccs.length} observation(s) de flore trouvée(s).`;
    };

    const triggerShapefileDownload = () => {
        if (!currentShapefileData) return;
        try {
            if (typeof downloadShapefile === 'function') {
                downloadShapefile(currentShapefileData, LAMBERT93_WKT);
            }
        } catch (e) {
            if (typeof showNotification === 'function') {
                showNotification("Erreur lors de la génération du shapefile", 'error');
            }
        }
    };

      const loadObservationsAt = async (params) => {
          try {
              if (!map) initializeSelectionMap(params);
              mapContainer.style.display = 'block';
              if (searchAreaLayer) {
                  map.removeLayer(searchAreaLayer);
                  searchAreaLayer = null;
              }
              if (obsSearchCircle) { map.removeLayer(obsSearchCircle); obsSearchCircle = null; }
              if (obsSearchPolygon) { map.removeLayer(obsSearchPolygon); obsSearchPolygon = null; }
              let wkt;
            if (params.wkt) {
                obsSearchPolygon = L.polygon(params.polygon, { color: '#c62828', weight: 2, fillOpacity: 0.1, interactive: false }).addTo(map);
                wkt = params.wkt;
                map.fitBounds(obsSearchPolygon.getBounds());
            } else {
                obsSearchCircle = L.circle([params.latitude, params.longitude], { radius: OBS_RADIUS_KM * 1000, color: '#c62828', weight: 2, fillOpacity: 0.1, interactive: false }).addTo(map);
                wkt = 'POLYGON((' + Array.from({length:33},(_,i)=>{const a=i*2*Math.PI/32,r=111.32*Math.cos(params.latitude*Math.PI/180);return `${(params.longitude+OBS_RADIUS_KM/r*Math.cos(a)).toFixed(5)} ${(params.latitude+OBS_RADIUS_KM/111.132*Math.sin(a)).toFixed(5)}`;}).join(', ') + '))';
                map.fitBounds(obsSearchCircle.getBounds());
            }
            statusDiv.textContent = 'Recherche des occurrences GBIF...';

            const limit = 300;
            let offset = 0;
            let endOfRecords = false;
            let allResults = [];

            while (!endOfRecords) {
                const url = `https://api.gbif.org/v1/occurrence/search?limit=${limit}&offset=${offset}&geometry=${encodeURIComponent(wkt)}&taxonKey=${TRACHEOPHYTA_TAXON_KEY}`;
                const resp = await fetchWithRetry(url);
                if (!resp.ok) throw new Error("L'API GBIF est indisponible.");
                const data = await resp.json();
                if (data.results?.length > 0) {
                    allResults = allResults.concat(data.results);
                }
                endOfRecords = data.endOfRecords || (data.results?.length < limit);
                offset += limit;
            }

            if (allResults.length === 0) {
                statusDiv.textContent = 'Aucune observation trouvée.';
                return;
            }

            displayObservations(allResults);
            if (!map.hasLayer(observationsLayerGroup)) {
                observationsLayerGroup.addTo(map);
            }
            if (layersControl && !obsLayerAddedToControl) {
                layersControl.addOverlay(observationsLayerGroup, 'Observations GBIF');
                obsLayerAddedToControl = true;
            }
        } catch(error) {
            statusDiv.textContent = `Erreur : ${error.message}`;
        }
    };

    
    // --- 6. DÉMARRAGE DE L'APPLICATION ---
    await initializeApp();
    await handleGeolocationSearch(false);
    startMapSelection();
    searchAddressBtn.addEventListener('click', handleAddressSearch);
    useGeolocationBtn.addEventListener('click', handleGeolocationSearch);
    drawPolygonBtn.addEventListener('click', startPolygonSelection);
    addressInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleAddressSearch());
    downloadShapefileBtn.addEventListener('click', triggerShapefileDownload);
    toggleTrackingBtn.addEventListener('click', () => toggleLocationTracking(map, toggleTrackingBtn));
    if (toggleLabelsBtn) {
        toggleLabelsBtn.addEventListener('click', toggleAnalysisLabels);
    }
});
