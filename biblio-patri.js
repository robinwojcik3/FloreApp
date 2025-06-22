// /biblio-patri.js

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results');
    const mapContainer = document.getElementById('map');
    let map = null;
    let speciesLayers = new Map();

    // NOUVEAU : Définition du rayon de recherche en tant que constante
    const SEARCH_RADIUS_KM = 5;

    const SPECIES_COLORS = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#800000', '#AA6E28', '#000075', '#A9A9A9'];

    const OLD_REGION_MAP = {
        'Alsace': 'Grand Est', 'Aquitaine': 'Nouvelle-Aquitaine', 'Auvergne': 'Auvergne-Rhône-Alpes',
        'Basse-Normandie': 'Normandie', 'Bourgogne': 'Bourgogne-Franche-Comté', 'Centre': 'Centre-Val de Loire',
        'Champagne-Ardenne': 'Grand Est', 'Franche-Comté': 'Bourgogne-Franche-Comté', 'Haute-Normandie': 'Normandie',
        'Limousin': 'Nouvelle-Aquitaine', 'Lorraine': 'Grand Est', 'Languedoc-Roussillon': 'Occitanie',
        'Midi-Pyrénées': 'Occitanie', 'Nord-Pas-de-Calais': 'Hauts-de-France', 'Poitou-Charentes': 'Nouvelle-Aquitaine',
        'Rhône-Alpes': 'Auvergne-Rhône-Alpes'
    };

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

    const getUserLocation = () => new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("La géolocalisation n'est pas supportée."));
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("La permission de géolocalisation a été refusée.")), { timeout: 10000, enableHighAccuracy: true });
    });

    const createWktCircularPolygon = (lat, lon, radiusKm) => {
        const segments = 32, latRad = lat * (Math.PI / 180), degLatKm = 111.132, degLonKm = 111.320 * Math.cos(latRad);
        const latDelta = radiusKm / degLatKm, lonDelta = radiusKm / degLonKm;
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i * 2 * Math.PI) / segments;
            points.push(`${(lon + lonDelta * Math.cos(angle)).toFixed(5)} ${(lat + latDelta * Math.sin(angle)).toFixed(5)}`);
        }
        return `POLYGON((${points.join(', ')}))`;
    };

    async function getRegionDepartement(lat, lon) {
        try {
            const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,codeRegion,codeDepartement,departement,region&format=json`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const [info] = await resp.json();
            if (!info || !info.region || !info.departement) throw new Error('Données administratives incomplètes.');
            const regionName = OLD_REGION_MAP[info.region.nom] || info.region.nom;
            return { region: regionName, departement: info.departement.nom };
        } catch (e) {
            throw new Error(`Échec de la récupération des données administratives. (${e.message})`);
        }
    }

    async function loadBDCstatut() {
        try {
            const resp = await fetch('BDCstatut.csv');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            let text = await resp.text();
            if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
            const lines = text.trim().split(/\r?\n/);
            if (lines.length < 1) throw new Error("Le fichier CSV est vide.");
            const header = lines[0].split(';').map(h => h.trim());
            const requiredColumns = ['LB_ADM_TR', 'LB_NOM', 'CODE_STATUT', 'LB_TYPE_STATUT', 'LABEL_STATUT'];
            const missingColumns = requiredColumns.filter(col => !header.includes(col));
            if (missingColumns.length > 0) throw new Error(`Colonnes requises manquantes: [${missingColumns.join(', ')}]. Colonnes trouvées: [${header.join(', ')}]`);
            const indices = Object.fromEntries(requiredColumns.map(col => [col, header.indexOf(col)]));
            return lines.slice(1).map(line => {
                const cols = line.split(';');
                if (cols.length > Math.max(...Object.values(indices))) return Object.fromEntries(requiredColumns.map(col => [col, cols[indices[col]]]));
                return null;
            }).filter(Boolean);
        } catch (e) {
            throw new Error(`Le fichier de statuts (BDCstatut.csv) n'a pas pu être chargé. (${e.message})`);
        }
    }
    
    function getPatrimonialSpeciesList(allFloraStatus, region, departement) {
        const result = new Map();
        const threatCodes = ['NT', 'VU', 'EN', 'CR'];
        const priorityFor = (type) => {
            if (type.includes('Directive')) return 5;
            if (type.includes('Protection')) return 4;
            if (type.includes('Réglementation')) return 3;
            if (type.includes('Liste rouge')) return 2;
            if (type.includes('Sensibilité')) return 1;
            return 0;
        };
        allFloraStatus.forEach(row => {
            if (!row || !row.LB_ADM_TR) return;
            const adm = OLD_REGION_MAP[row.LB_ADM_TR.trim()] || row.LB_ADM_TR.trim();
            let isRelevant = false;
            if (adm === region || adm === departement) {
                const type = row.LB_TYPE_STATUT.toLowerCase();
                const code = row.CODE_STATUT;
                const isRedList = type.includes('liste rouge') && threatCodes.includes(code);
                const isProtected = type.includes('protection') || type.includes('réglementation') || type.includes('directive');
                const isSensibilite = type.includes('sensibilité');
                if (isRedList || isProtected || isSensibilite) isRelevant = true;
            }
            if (isRelevant) {
                const prio = priorityFor(row.LB_TYPE_STATUT);
                if (!result.has(row.LB_NOM) || prio > result.get(row.LB_NOM).priority) {
                    result.set(row.LB_NOM, { name: row.LB_NOM, label: row.LABEL_STATUT, priority: prio });
                }
            }
        });
        return Array.from(result.values());
    }

    async function searchOccurrences(speciesList, wktPolygon) {
        if (speciesList.length === 0) return [];
        const NAME_CHUNK_SIZE = 100;
        const OCCURRENCE_CHUNK_SIZE = 300;
        const speciesKeys = new Map();
        try {
            for (let i = 0; i < speciesList.length; i += NAME_CHUNK_SIZE) {
                const chunk = speciesList.slice(i, i + NAME_CHUNK_SIZE);
                setStatus(`Résolution des noms... (${i}/${speciesList.length})`, true);
                const promises = chunk.map(sp => 
                    fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sp.name)}&strict=true&kingdom=Plantae`)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => { if (data && data.usageKey && data.matchType !== 'NONE') speciesKeys.set(data.usageKey, sp); })
                    .catch(() => {})
                );
                await Promise.all(promises);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            const validKeys = Array.from(speciesKeys.keys());
            if (validKeys.length === 0) return [];
            let allOccurrences = [];
            for (let i = 0; i < validKeys.length; i += OCCURRENCE_CHUNK_SIZE) {
                const keyChunk = validKeys.slice(i, i + OCCURRENCE_CHUNK_SIZE);
                let offset = 0;
                let endOfRecords = false;
                setStatus(`Recherche des occurrences... (Lot ${i / OCCURRENCE_CHUNK_SIZE + 1}/${Math.ceil(validKeys.length / OCCURRENCE_CHUNK_SIZE)})`, true);
                while(!endOfRecords) {
                    const payload = {
                        taxonKeys: keyChunk,
                        geometry: wktPolygon,
                        limit: 300,
                        offset: offset
                    };
                    const resp = await fetch('https://api.gbif.org/v1/occurrence/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!resp.ok) {
                        const errorBody = await resp.text();
                        console.error("Erreur de l'API GBIF:", errorBody);
                        throw new Error(`Erreur API GBIF (${resp.status})`);
                    }
                    const data = await resp.json();
                    if (data.results && data.results.length > 0) allOccurrences.push(...data.results);
                    offset += data.results.length;
                    endOfRecords = data.endOfRecords || data.results.length === 0;
                }
            }
            const resultsBySpecies = new Map();
            allOccurrences.forEach(occ => {
                if (occ.speciesKey && speciesKeys.has(occ.speciesKey)) {
                    const originalSpeciesData = speciesKeys.get(occ.speciesKey);
                    if (!resultsBySpecies.has(occ.speciesKey)) resultsBySpecies.set(occ.speciesKey, { ...originalSpeciesData, occurrences: [] });
                    resultsBySpecies.get(occ.speciesKey).occurrences.push({ lat: occ.decimalLatitude, lon: occ.decimalLongitude, date: occ.eventDate ? new Date(occ.eventDate).toLocaleDateString() : 'N/A' });
                }
            });
            return Array.from(resultsBySpecies.values()).sort((a,b) => a.name.localeCompare(b.name));
        } catch (e) {
            throw new Error(`Échec de la communication avec la base de données GBIF. (${e.message})`);
        }
    }
    
    function initializeMap(coords) {
        if(map) map.remove();
        map = L.map(mapContainer).setView([coords.latitude, coords.longitude], 11);
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>'
        }).addTo(map);
        // MODIFIÉ : Utilisation de la constante pour le rayon du cercle
        L.circle([coords.latitude, coords.longitude], { 
            radius: SEARCH_RADIUS_KM * 1000, 
            color: '#c62828', 
            weight: 2, 
            fillOpacity: 0.1 
        }).addTo(map);
    }
    
    function displayResults(foundSpecies) {
        resultsContainer.innerHTML = '';
        speciesLayers.forEach(layer => map.removeLayer(layer));
        speciesLayers.clear();
        if (foundSpecies.length === 0) {
            setStatus(`Aucune occurrence des espèces patrimoniales locales n'a été trouvée dans un rayon de ${SEARCH_RADIUS_KM} km.`);
            return;
        }
        setStatus(`${foundSpecies.length} espèce(s) patrimoniale(s) trouvée(s) à proximité.`);
        foundSpecies.forEach((species, index) => {
            const color = SPECIES_COLORS[index % SPECIES_COLORS.length];
            const icon = L.divIcon({
                html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.5);"></div>`,
                className: 'custom-div-icon', iconSize: [16, 16], iconAnchor: [8, 8]
            });
            const layerGroup = L.layerGroup();
            species.occurrences.forEach(occ => {
                if (occ.lat && occ.lon) L.marker([occ.lat, occ.lon], { icon }).addTo(layerGroup).bindPopup(`<b><i>${species.name}</i></b><br>Observé le: ${occ.date}`);
            });
            layerGroup.addTo(map);
            speciesLayers.set(species.name, layerGroup);
            species.color = color;
        });
        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>Nom scientifique</th><th>Statut</th><th>Occurrences (${SEARCH_RADIUS_KM}km)</th><th>Lien INPN</th></tr></thead>
            <tbody>
                ${foundSpecies.map(s => `
                    <tr>
                        <td><span class="legend-color" style="background-color:${s.color};"></span><i>${s.name}</i></td>
                        <td>${s.label}</td>
                        <td>${s.occurrences.length}</td>
                        <td><a href="https://inpn.mnhn.fr/espece/recherche?q=${encodeURIComponent(s.name)}" target="_blank" rel="noopener noreferrer">Fiche</a></td>
                    </tr>
                `).join('')}
            </tbody>`;
        resultsContainer.appendChild(table);
    };

    async function main() {
        try {
            setStatus("Récupération de votre position...", true);
            const {coords} = await getUserLocation();
            initializeMap(coords);
            setStatus("Identification de votre région administrative...", true);
            const { region, departement } = await getRegionDepartement(coords.latitude, coords.longitude);
            setStatus("Chargement et filtrage des statuts de la flore locale...", true);
            const allFloraStatus = await loadBDCstatut();
            const patrimonialesList = getPatrimonialSpeciesList(allFloraStatus, region, departement);
            if (patrimonialesList.length === 0) {
                setStatus(`Aucune espèce floristique patrimoniale spécifique n'a été identifiée pour ${region} / ${departement}.`);
                return;
            }
            // MODIFIÉ : Utilisation de la constante pour le polygone de recherche
            const wktPolygon = createWktCircularPolygon(coords.latitude, coords.longitude, SEARCH_RADIUS_KM);
            const foundSpecies = await searchOccurrences(patrimonialesList, wktPolygon);
            setStatus(null);
            displayResults(foundSpecies);
        } catch (error) {
            console.error("Erreur dans le processus principal:", error);
            setStatus(`Erreur : ${error.message}`);
            if (mapContainer) mapContainer.style.display = 'none';
        }
    }

    main();
});
