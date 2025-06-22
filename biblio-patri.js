// /biblio-patri.js

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results');
    const mapContainer = document.getElementById('map');
    let map = null;
    let speciesLayers = new Map(); // NOUVEAU : Pour gérer les couches de la carte

    // Palette de couleurs pour la cartographie des espèces
    const SPECIES_COLORS = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#800000', '#AA6E28', '#000075', '#A9A9A9'];

    // Table de correspondance pour les anciennes régions administratives françaises
    const OLD_REGION_MAP = {
        'Alsace': 'Grand Est', 'Aquitaine': 'Nouvelle-Aquitaine', 'Auvergne': 'Auvergne-Rhône-Alpes',
        'Basse-Normandie': 'Normandie', 'Bourgogne': 'Bourgogne-Franche-Comté', 'Centre': 'Centre-Val de Loire',
        'Champagne-Ardenne': 'Grand Est', 'Franche-Comté': 'Bourgogne-Franche-Comté', 'Haute-Normandie': 'Normandie',
        'Limousin': 'Nouvelle-Aquitaine', 'Lorraine': 'Grand Est', 'Languedoc-Roussillon': 'Occitanie',
        'Midi-Pyrénées': 'Occitanie', 'Nord-Pas-de-Calais': 'Hauts-de-France', 'Poitou-Charentes': 'Nouvelle-Aquitaine',
        'Rhône-Alpes': 'Auvergne-Rhône-Alpes'
    };

    /**
     * Affiche un message de statut ou une icône de chargement.
     * @param {string|null} message - Le message à afficher.
     * @param {boolean} isLoading - Si true, affiche une icône de chargement.
     */
    function setStatus(message, isLoading = false) {
        statusDiv.innerHTML = '';
        if (isLoading) {
            const spinner = document.createElement('div');
            spinner.className = 'loading';
            statusDiv.appendChild(spinner);
        }
        if (message) {
            const text = document.createElement('p');
            text.textContent = message;
            statusDiv.appendChild(text);
        }
    }

    /**
     * Récupère la localisation de l'utilisateur via l'API Geolocation du navigateur.
     * @returns {Promise<Coordinates>}
     */
    const getUserLocation = () => new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error("La géolocalisation n'est pas supportée."));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            () => reject(new Error("Permission de géolocalisation refusée.")),
            { timeout: 10000, enableHighAccuracy: true }
        );
    });

    /**
     * Construit un polygone circulaire au format WKT pour les requêtes spatiales.
     * @param {number} lat - Latitude du centre.
     * @param {number} lon - Longitude du centre.
     * @param {number} radiusKm - Rayon en kilomètres.
     * @returns {string} - Polygone au format WKT.
     */
    const createWktCircularPolygon = (lat, lon, radiusKm) => {
        const segments = 32;
        const latRad = lat * (Math.PI / 180);
        const degLatKm = 111.132;
        const degLonKm = 111.320 * Math.cos(latRad);
        const latDelta = radiusKm / degLatKm;
        const lonDelta = radiusKm / degLonKm;

        const points = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i * 2 * Math.PI) / segments;
            points.push(`${(lon + lonDelta * Math.cos(angle)).toFixed(5)} ${(lat + latDelta * Math.sin(angle)).toFixed(5)}`);
        }
        return `POLYGON((${points.join(', ')}))`;
    };

    /**
     * Obtient la région et le département à partir des coordonnées via l'API Géo.
     * @param {number} lat - Latitude.
     * @param {number} lon - Longitude.
     * @returns {Promise<{region: string, departement: string}>}
     */
    async function getRegionDepartement(lat, lon) {
        const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,codeRegion,codeDepartement&format=json`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Géocodage inverse impossible');
        const [info] = await resp.json();
        if (!info) throw new Error('Aucune commune trouvée pour ces coordonnées.');

        const [regionResp, deptResp] = await Promise.all([
            fetch(`https://geo.api.gouv.fr/regions/${info.codeRegion}`),
            fetch(`https://geo.api.gouv.fr/departements/${info.codeDepartement}`)
        ]);
        const regionData = await regionResp.json();
        const deptData = await deptResp.json();
        
        const regionName = OLD_REGION_MAP[regionData.nom] || regionData.nom;
        return { region: regionName, departement: deptData.nom };
    }

    /**
     * Charge et parse le fichier BDCstatut.csv.
     * @returns {Promise<Array<Object>>}
     */
    async function loadBDCstatut() {
        const resp = await fetch('BDCstatut.csv');
        if (!resp.ok) throw new Error("Le fichier BDCstatut.csv n'a pas pu être chargé.");
        const text = await resp.text();
        return text.trim().split(/\r?\n/).slice(1).map(line => {
            const cols = line.split(';');
            return {
                NIVEAU_ADMIN: cols[0], LB_ADM_TR: cols[1], LB_NOM: cols[2],
                CODE_STATUT: cols[7], LB_TYPE_STATUT: cols[6], LABEL_STATUT: cols[8]
            };
        });
    }

    /**
     * Définit une priorité pour les statuts afin de ne conserver que le plus pertinent.
     * @param {string} type - Type de statut (e.g., 'Protection nationale').
     * @param {string} code - Code du statut (e.g., 'CR').
     * @returns {number} - Niveau de priorité.
     */
    function priorityFor(type, code) {
        if (['Protection nationale', 'Réglementation', 'Protection régionale', 'Protection départementale', 'Sensibilité régionale', 'Sensibilité départementale'].includes(type)) return 5;
        if (code === 'CR') return 4;
        if (code === 'EN') return 3;
        if (code === 'VU') return 2;
        if (code === 'NT') return 1;
        return 0;
    }

    /**
     * Filtre la liste complète des espèces patrimoniales pour ne garder que celles pertinentes
     * pour la localisation de l'utilisateur (région/département).
     * @param {Array<Object>} data - Données brutes de BDCstatut.csv.
     * @param {string} region - Région de l'utilisateur.
     * @param {string} departement - Département de l'utilisateur.
     * @returns {Array<Object>} - Liste filtrée et priorisée des espèces patrimoniales.
     */
    function filterPatrimoniales(data, region, departement) {
        const result = new Map();
        data.forEach(row => {
            const adm = OLD_REGION_MAP[row.LB_ADM_TR] || row.LB_ADM_TR;
            const code = row.CODE_STATUT;
            const type = row.LB_TYPE_STATUT;
            let include = false;
            let level = row.NIVEAU_ADMIN;

            if (type === 'Liste rouge nationale' && ['NT','VU','EN','CR'].includes(code)) {
                include = true; level = 'Etat';
            } else if (type === 'Liste rouge régionale' && ['NT','VU','EN','CR'].includes(code) && adm === region) {
                include = true; level = 'Région';
            } else if (['Protection régionale','Sensibilité régionale'].includes(type) && adm === region) {
                include = true; level = 'Région';
            } else if (['Protection départementale','Sensibilité départementale'].includes(type) && adm === departement) {
                include = true; level = 'Département';
            } else if (['Protection nationale','Réglementation'].includes(type)) {
                include = true; level = 'Etat';
            }

            if (include) {
                const prio = priorityFor(type, code);
                if (!result.has(row.LB_NOM) || result.get(row.LB_NOM).priority < prio) {
                    result.set(row.LB_NOM, { 
                        name: row.LB_NOM, 
                        status: code, 
                        label: row.LABEL_STATUT, 
                        level: level, 
                        adminArea: adm,
                        priority: prio 
                    });
                }
            }
        });
        return Array.from(result.values());
    }

    /**
     * NOUVEAU : Recherche les occurrences des espèces patrimoniales locales.
     * @param {Array<Object>} patrimonialesList - Liste des espèces à rechercher.
     * @param {string} wktPolygon - Polygone WKT pour la requête spatiale.
     * @returns {Promise<Array<Object>>} - Liste des espèces trouvées avec leurs occurrences.
     */
    async function searchPatrimonialOccurrences(patrimonialesList, wktPolygon) {
        setStatus(`Résolution des noms pour ${patrimonialesList.length} espèces...`, true);

        // Étape 1 : Obtenir les taxonKey pour chaque espèce
        const speciesKeys = new Map();
        const keyPromises = patrimonialesList.map(async (sp) => {
            try {
                const matchUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sp.name)}`;
                const resp = await fetch(matchUrl);
                const data = await resp.json();
                if (data.usageKey) {
                    speciesKeys.set(data.usageKey, sp);
                    return data.usageKey;
                }
            } catch (e) {
                console.error(`Erreur de résolution pour ${sp.name}:`, e);
            }
            return null;
        });

        const validKeys = (await Promise.all(keyPromises)).filter(Boolean);
        if (validKeys.length === 0) {
            throw new Error("Aucun nom d'espèce n'a pu être résolu dans le référentiel GBIF.");
        }

        // Étape 2 : Rechercher les occurrences pour tous les taxonKeys en une seule requête
        let allOccurrences = [];
        let offset = 0;
        const limit = 300;
        let endOfRecords = false;

        while (!endOfRecords) {
            const countText = allOccurrences.length > 0 ? ` (${allOccurrences.length} trouvées)` : '';
            setStatus(`Recherche des occurrences pour ${validKeys.length} espèces...${countText}`, true);
            
            const params = new URLSearchParams({
                taxon_key: validKeys.join(','),
                geometry: wktPolygon,
                limit: limit,
                offset: offset
            });
            const url = `https://api.gbif.org/v1/occurrence/search?${params.toString()}`;
            
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`Erreur API GBIF (${resp.status})`);
                const data = await resp.json();

                if (data.results && data.results.length > 0) {
                    allOccurrences.push(...data.results);
                }
                offset += data.results.length;
                endOfRecords = data.endOfRecords;
                if(data.results.length === 0) endOfRecords = true;

            } catch (error) {
                console.error("Échec de la récupération des occurrences:", error);
                throw error;
            }
        }

        // Étape 3 : Regrouper les résultats par espèce
        const resultsBySpecies = new Map();
        allOccurrences.forEach(occ => {
            if (occ.speciesKey && speciesKeys.has(occ.speciesKey)) {
                const originalSpeciesData = speciesKeys.get(occ.speciesKey);
                if (!resultsBySpecies.has(occ.speciesKey)) {
                    resultsBySpecies.set(occ.speciesKey, {
                        ...originalSpeciesData,
                        speciesKey: occ.speciesKey,
                        occurrences: []
                    });
                }
                resultsBySpecies.get(occ.speciesKey).occurrences.push({
                    lat: occ.decimalLatitude,
                    lon: occ.decimalLongitude,
                    date: occ.eventDate ? new Date(occ.eventDate).toLocaleDateString() : 'N/A'
                });
            }
        });

        return Array.from(resultsBySpecies.values()).sort((a,b) => a.name.localeCompare(b.name));
    }

    /**
     * Initialise la carte Leaflet.
     * @param {Coordinates} coords - Coordonnées initiales pour centrer la carte.
     */
    function initializeMap(coords) {
        map = L.map(mapContainer).setView([coords.latitude, coords.longitude], 11);
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>'
        }).addTo(map);

        L.circle([coords.latitude, coords.longitude], {
            radius: 10000, color: '#c62828', weight: 2, fillOpacity: 0.1
        }).addTo(map);
    }
    
    /**
     * Affiche les résultats sur la carte et dans un tableau.
     * @param {Array<Object>} foundSpecies - Liste des espèces trouvées.
     */
    const displayResults = (foundSpecies) => {
        resultsContainer.innerHTML = '';
        speciesLayers.forEach(layer => map.removeLayer(layer));
        speciesLayers.clear();

        if (foundSpecies.length === 0) {
            setStatus("Aucune occurrence d'espèce patrimoniale locale trouvée dans le rayon de 10 km.");
            return;
        }
        
        setStatus(`${foundSpecies.length} espèce(s) patrimoniale(s) locale(s) trouvée(s) à proximité.`);

        foundSpecies.forEach((species, index) => {
            const color = SPECIES_COLORS[index % SPECIES_COLORS.length];
            const icon = L.divIcon({
                html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.5);"></div>`,
                className: 'custom-div-icon', iconSize: [16, 16], iconAnchor: [8, 8]
            });
            const layerGroup = L.layerGroup();
            species.occurrences.forEach(occ => {
                if (occ.lat && occ.lon) {
                    L.marker([occ.lat, occ.lon], { icon })
                     .addTo(layerGroup)
                     .bindPopup(`<b><i>${species.name}</i></b><br>Observé le: ${occ.date}`);
                }
            });
            layerGroup.addTo(map);
            speciesLayers.set(species.speciesKey, layerGroup);
            species.color = color; // Ajouter la couleur pour la légende du tableau
        });
        
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Nom scientifique</th>
                    <th>Statut</th>
                    <th>Échelle</th>
                    <th>Occurrences (10km)</th>
                    <th>Lien INPN</th>
                </tr>
            </thead>
            <tbody>
                ${foundSpecies.map(s => `
                    <tr>
                        <td><span class="legend-color" style="background-color:${s.color};"></span><i>${s.name}</i></td>
                        <td>${s.status} (${s.label})</td>
                        <td>${s.level} (${s.adminArea})</td>
                        <td>${s.occurrences.length}</td>
                        <td><a href="https://inpn.mnhn.fr/espece/recherche?q=${encodeURIComponent(s.name)}" target="_blank" rel="noopener noreferrer">Fiche</a></td>
                    </tr>
                `).join('')}
            </tbody>`;
        resultsContainer.appendChild(table);
    };

    /**
     * Fonction principale orchestrant le processus.
     */
    async function main() {
        try {
            // Phase 0 : Initialisation
            setStatus("Récupération de votre position...", true);
            const coords = await getUserLocation();
            setStatus("Initialisation de la carte...", true);
            initializeMap(coords);

            // Phase 1 : Identification des espèces patrimoniales locales
            setStatus("Identification de votre région...", true);
            const { region, departement } = await getRegionDepartement(coords.latitude, coords.longitude);
            
            setStatus("Analyse des statuts patrimoniaux pour votre localisation...", true);
            const dataset = await loadBDCstatut();
            const patrimoniales = filterPatrimoniales(dataset, region, departement);
            
            if (patrimoniales.length === 0) {
                setStatus(`Aucune espèce patrimoniale spécifique n'a été trouvée pour ${region} / ${departement}.`);
                mapContainer.style.display = 'block';
                return;
            }

            // Phase 2 : Recherche des occurrences
            const wktPolygon = createWktCircularPolygon(coords.latitude, coords.longitude, 10);
            const foundSpecies = await searchPatrimonialOccurrences(patrimoniales, wktPolygon);

            // Phase 3 : Affichage
            setStatus(null); // Nettoie le statut avant d'afficher les résultats
            displayResults(foundSpecies);

        } catch (error) {
            console.error("Erreur dans le processus principal:", error);
            setStatus(`Erreur : ${error.message}`);
            mapContainer.style.display = 'none';
        }
    }

    main();
});
