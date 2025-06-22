// /biblio-patri.js

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results');
    const mapContainer = document.getElementById('map');
    let map = null;
    let speciesLayers = new Map();

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
        if (!navigator.geolocation) {
            return reject(new Error("La géolocalisation n'est pas supportée."));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            () => reject(new Error("Permission de géolocalisation refusée.")),
            { timeout: 10000, enableHighAccuracy: true }
        );
    });

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
     * MODIFIÉ : Charge et parse le fichier BDCstatut.csv en filtrant pour la flore.
     * @returns {Promise<Array<Object>>}
     */
    async function loadBDCstatut() {
        const resp = await fetch('BDCstatut.csv');
        if (!resp.ok) throw new Error("Le fichier BDCstatut.csv n'a pas pu être chargé.");
        const text = await resp.text();
        
        const lines = text.trim().split(/\r?\n/);
        const header = lines[0].split(';');
        const regneIndex = header.indexOf('REGNE');

        if (regneIndex === -1) {
             console.warn("La colonne 'REGNE' est absente du CSV. Le filtrage sur la flore ne peut être effectué.");
             // Fallback : on retourne tout si la colonne n'existe pas
             return lines.slice(1).map(line => {
                const cols = line.split(';');
                let rowData = {};
                header.forEach((h, i) => rowData[h] = cols[i]);
                return rowData;
             });
        }

        // Filtre pour ne garder que le règne végétal et transforme en objets
        return lines.slice(1).map(line => {
            const cols = line.split(';');
            if (cols[regneIndex] === 'Plantae') {
                let rowData = {};
                header.forEach((h, i) => rowData[h] = cols[i]);
                return rowData;
            }
            return null;
        }).filter(Boolean); // retire les lignes null (non-Plantae)
    }

    function priorityFor(type, code) {
        if (type.includes('Directive')) return 6; // Priorité la plus haute pour les directives
        if (['Protection nationale', 'Réglementation', 'Protection régionale', 'Protection départementale', 'Sensibilité régionale', 'Sensibilité départementale'].includes(type)) return 5;
        if (code === 'CR') return 4;
        if (code === 'EN') return 3;
        if (code === 'VU') return 2;
        if (code === 'NT') return 1;
        return 0;
    }

    /**
     * MODIFIÉ : Filtre les espèces patrimoniales en incluant la Directive Habitats.
     * @param {Array<Object>} data - Données brutes de BDCstatut.csv (déjà filtrées sur Plantae).
     * @param {string} region - Région de l'utilisateur.
     * @param {string} departement - Département de l'utilisateur.
     * @returns {Array<Object>}
     */
    function filterPatrimoniales(data, region, departement) {
        const result = new Map();
        const threatCodes = ['NT', 'VU', 'EN', 'CR'];

        data.forEach(row => {
            const adm = OLD_REGION_MAP[row.LB_ADM_TR] || row.LB_ADM_TR;
            const code = row.CODE_STATUT;
            const type = row.LB_TYPE_STATUT;
            let include = false;
            let level = row.NIVEAU_ADMIN;

            // Conditions de sélection élargies
            const isRedList = type.toLowerCase().includes('liste rouge') && threatCodes.includes(code);
            const isProtection = type.toLowerCase().includes('protection') || type.toLowerCase().includes('sensibilité');
            const isRegulation = type.toLowerCase().includes('réglementation');
            const isDirective = type.toLowerCase().includes('directive');

            if (isDirective) {
                include = true; level = 'Europe';
            } else if (isRedList) {
                if (type.includes('nationale') || adm === region) include = true;
                level = type.includes('nationale') ? 'Etat' : 'Région';
            } else if (isProtection) {
                if (type.includes('nationale')) { include = true; level = 'Etat'; }
                else if (type.includes('régionale') && adm === region) { include = true; level = 'Région'; }
                else if (type.includes('départementale') && adm === departement) { include = true; level = 'Département'; }
            } else if (isRegulation) {
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
    
    async function searchPatrimonialOccurrences(patrimonialesList, wktPolygon) {
        setStatus(`Résolution des noms pour ${patrimonialesList.length} espèces...`, true);

        const speciesKeys = new Map();
        const keyPromises = patrimonialesList.map(async (sp) => {
            try {
                const matchUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(sp.name)}`;
                const resp = await fetch(matchUrl);
                const data = await resp.json();
                if (data.usageKey && data.kingdom === 'Plantae') { // Double vérification
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
            throw new Error("Aucun nom d'espèce floristique n'a pu être résolu dans le référentiel GBIF.");
        }

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

    function initializeMap(coords) {
        map = L.map(mapContainer).setView([coords.latitude, coords.longitude], 11);
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>'
        }).addTo(map);

        L.circle([coords.latitude, coords.longitude], {
            radius: 10000, color: '#c62828', weight: 2, fillOpacity: 0.1
        }).addTo(map);
    }
    
    const displayResults = (foundSpecies) => {
        resultsContainer.innerHTML = '';
        speciesLayers.forEach(layer => map.removeLayer(layer));
        speciesLayers.clear();

        if (foundSpecies.length === 0) {
            setStatus("Aucune occurrence d'espèce patrimoniale floristique trouvée dans le rayon de 10 km.");
            return;
        }
        
        setStatus(`${foundSpecies.length} espèce(s) patrimoniale(s) floristique(s) trouvée(s) à proximité.`);

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
            species.color = color;
        });
        
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Nom scientifique</th>
                    <th>Statut (Label)</th>
                    <th>Échelle</th>
                    <th>Occurrences (10km)</th>
                    <th>Lien INPN</th>
                </tr>
            </thead>
            <tbody>
                ${foundSpecies.map(s => `
                    <tr>
                        <td><span class="legend-color" style="background-color:${s.color};"></span><i>${s.name}</i></td>
                        <td>${s.label}</td>
                        <td>${s.level}</td>
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
            const coords = await getUserLocation();
            
            setStatus("Initialisation de la carte...", true);
            initializeMap(coords);

            setStatus("Identification de votre région...", true);
            const { region, departement } = await getRegionDepartement(coords.latitude, coords.longitude);
            
            setStatus("Analyse des statuts patrimoniaux pour la flore...", true);
            const floraDataset = await loadBDCstatut();
            const patrimoniales = filterPatrimoniales(floraDataset, region, departement);
            
            if (patrimoniales.length === 0) {
                setStatus(`Aucune espèce floristique patrimoniale spécifique n'a été trouvée pour ${region} / ${departement}.`);
                mapContainer.style.display = 'block';
                return;
            }

            const wktPolygon = createWktCircularPolygon(coords.latitude, coords.longitude, 10);
            const foundSpecies = await searchPatrimonialOccurrences(patrimoniales, wktPolygon);

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
