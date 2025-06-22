document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results');
    const mapContainer = document.getElementById('map');
    let map = null;
    
    const SPECIES_COLORS = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#800000', '#AA6E28'];

    // Correspondance des anciennes régions avec les nouvelles (post-2016)
    const OLD_REGION_MAP = {
        'Alsace': 'Grand Est',
        'Aquitaine': 'Nouvelle-Aquitaine',
        'Auvergne': 'Auvergne-Rhône-Alpes',
        'Basse-Normandie': 'Normandie',
        'Bourgogne': 'Bourgogne-Franche-Comté',
        'Centre': 'Centre-Val de Loire',
        'Champagne-Ardenne': 'Grand Est',
        'Franche-Comté': 'Bourgogne-Franche-Comté',
        'Haute-Normandie': 'Normandie',
        'Limousin': 'Nouvelle-Aquitaine',
        'Lorraine': 'Grand Est',
        'Languedoc-Roussillon': 'Occitanie',
        'Midi-Pyrénées': 'Occitanie',
        'Nord-Pas-de-Calais': 'Hauts-de-France',
        'Poitou-Charentes': 'Nouvelle-Aquitaine',
        'Rhône-Alpes': 'Auvergne-Rhône-Alpes'
    };

    /**
     * Affiche un message de statut ou une icône de chargement.
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
     * Récupère la localisation de l'utilisateur.
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
     * Construit un polygone circulaire WKT pour la recherche.
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
     * MODIFIÉ : Interroge l'API GBIF en bouclant sur les pages de résultats.
     */
    const searchThreatenedSpecies = async (wktPolygon, statusUpdater) => {
        const threatStati = ['CRITICALLY_ENDANGERED', 'ENDANGERED', 'VULNERABLE', 'NEAR_THREATENED'];
        const baseParams = new URLSearchParams({
            taxon_key: 6, // Kingdom Plantae
            geometry: wktPolygon,
        });
        threatStati.forEach(status => baseParams.append('threat', status));

        let allOccurrences = [];
        let offset = 0;
        const limit = 300; // Limite par requête, standard pour GBIF
        let endOfRecords = false;
        let totalRecords = 0;

        while (!endOfRecords) {
            const pageParams = new URLSearchParams(baseParams);
            pageParams.set('offset', offset);
            pageParams.set('limit', limit);
            
            const url = `https://api.gbif.org/v1/occurrence/search?${pageParams.toString()}`;
            
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Erreur API GBIF (${response.status})`);
                
                const data = await response.json();
                
                if (offset === 0) { // Première requête
                    totalRecords = data.count;
                }

                if (data.results && data.results.length > 0) {
                    allOccurrences.push(...data.results);
                }

                if (statusUpdater) {
                    const message = totalRecords > 0 ? `Chargement des occurrences... (${allOccurrences.length} / ${totalRecords})` : "Recherche en cours...";
                    statusUpdater(message, true);
                }
                
                offset += data.results.length;
                endOfRecords = data.endOfRecords || offset >= totalRecords;
                
                // Sécurité pour éviter une boucle infinie si l'API ne retourne pas endOfRecords=true
                if (data.results.length === 0) {
                    endOfRecords = true;
                }

            } catch (error) {
                console.error("Échec de la récupération d'une page d'occurrences:", error);
                throw error;
            }
        }
        
        return allOccurrences;
    };
    
    /**
     * Regroupe les occurrences par espèce et assigne une couleur.
     */
    const processOccurrences = (occurrences) => {
        const speciesMap = new Map();
        let colorIndex = 0;

        occurrences.forEach(occ => {
            if (!occ.speciesKey) return;

            if (!speciesMap.has(occ.speciesKey)) {
                speciesMap.set(occ.speciesKey, {
                    name: occ.scientificName,
                    speciesKey: occ.speciesKey,
                    threatStatus: occ.threatStatus || 'N/A',
                    color: SPECIES_COLORS[colorIndex % SPECIES_COLORS.length],
                    occurrences: []
                });
                colorIndex++;
            }
            const speciesData = speciesMap.get(occ.speciesKey);
            speciesData.occurrences.push({
                lat: occ.decimalLatitude,
                lon: occ.decimalLongitude,
                date: occ.eventDate ? new Date(occ.eventDate).toLocaleDateString() : 'N/A'
            });
        });
        return Array.from(speciesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    };

    /**
     * Obtient la région administrative et le département à partir des coordonnées.
     */
    async function getRegionDepartement(lat, lon) {
        const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,codeRegion,codeDepartement&format=json`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Géocodage inverse impossible');
        const [info] = await resp.json();
        const regionResp = await fetch(`https://geo.api.gouv.fr/regions/${info.codeRegion}`);
        const regionData = await regionResp.json();
        const deptResp = await fetch(`https://geo.api.gouv.fr/departements/${info.codeDepartement}`);
        const deptData = await deptResp.json();
        const regionName = OLD_REGION_MAP[regionData.nom] || regionData.nom;
        return { region: regionName, departement: deptData.nom };
    }

    /**
     * Charge le fichier BDCstatut.csv et renvoie les enregistrements parsés.
     */
    async function loadBDCstatut() {
        const resp = await fetch('BDCstatut.csv');
        const text = await resp.text();
        return text.trim().split(/\r?\n/).slice(1).map(line => {
            const cols = line.split(';');
            return {
                NIVEAU_ADMIN: cols[0],
                LB_ADM_TR: cols[1],
                LB_NOM: cols[2],
                CODE_STATUT: cols[7],
                LB_TYPE_STATUT: cols[6],
                LABEL_STATUT: cols[8]
            };
        });
    }

    function priorityFor(type, code) {
        if (['Protection nationale', 'Réglementation', 'Protection régionale', 'Protection départementale', 'Sensibilité régionale', 'Sensibilité départementale'].includes(type)) return 5;
        if (code === 'CR') return 4;
        if (code === 'EN') return 3;
        if (code === 'VU') return 2;
        if (code === 'NT') return 1;
        return 0;
    }

    /**
     * Filtre les espèces patrimoniales selon le contexte utilisateur.
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
                    result.set(row.LB_NOM, { LB_NOM: row.LB_NOM, CODE_STATUT: code, LABEL_STATUT: row.LABEL_STATUT, NIVEAU_ADMIN: level, LB_ADM_TR: adm, SOURCE: 'BDCstatut.csv', priority: prio });
                }
            }
        });
        return Array.from(result.values());
    }

    function logCounts(list) {
        const counts = { Etat:0, Région:0, Département:0 };
        list.forEach(it => { if(counts[it.NIVEAU_ADMIN] !== undefined) counts[it.NIVEAU_ADMIN]++; });
        console.log('Espèces patrimoniales - Etat:', counts.Etat, 'Région:', counts.Région, 'Département:', counts.Département);
    }

    function displayPatrimoniales(list) {
        resultsContainer.innerHTML = '';
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>LB_NOM</th>
                    <th>CODE_STATUT</th>
                    <th>LABEL_STATUT</th>
                    <th>NIVEAU_ADMIN</th>
                    <th>LB_ADM_TR</th>
                    <th>SOURCE</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(l => `
                    <tr>
                        <td><i>${l.LB_NOM}</i></td>
                        <td>${l.CODE_STATUT}</td>
                        <td>${l.LABEL_STATUT}</td>
                        <td>${l.NIVEAU_ADMIN}</td>
                        <td>${l.LB_ADM_TR}</td>
                        <td>${l.SOURCE}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        resultsContainer.appendChild(table);
    }

    /**
     * Initialise la carte Leaflet.
     */
    function initializeMap(coords) {
        map = L.map(mapContainer).setView([coords.latitude, coords.longitude], 11);
        L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>'
        }).addTo(map);

        L.circle([coords.latitude, coords.longitude], {
            radius: 10000,
            color: '#c62828',
            weight: 2,
            fillOpacity: 0.1
        }).addTo(map);
    }

    /**
     * Affiche les résultats dans le tableau et sur la carte.
     */
    const displayResults = (speciesList) => {
        resultsContainer.innerHTML = '';
        if (speciesList.length === 0) {
            setStatus("Aucune espèce avec statut de menace global (CR, EN, VU, NT) n'a été trouvée dans cette zone.");
            return;
        }
        
        speciesList.forEach(species => {
            const icon = L.divIcon({
                html: `<div style="background-color: ${species.color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.5);"></div>`,
                className: 'custom-div-icon',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            species.occurrences.forEach(occ => {
                if (occ.lat && occ.lon) {
                    L.marker([occ.lat, occ.lon], { icon: icon })
                      .addTo(map)
                      .bindPopup(`<b><i>${species.name}</i></b><br>Observé le: ${occ.date}`);
                }
            });
        });
        
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Nom scientifique</th>
                    <th>Statut (Global)</th>
                    <th>Occurrences</th>
                    <th>Lien GBIF</th>
                </tr>
            </thead>
            <tbody>
                ${speciesList.map(s => `
                    <tr>
                        <td><span class="legend-color" style="background-color:${s.color};"></span><i>${s.name}</i></td>
                        <td>${s.threatStatus.replace(/_/g, ' ')}</td>
                        <td>${s.occurrences.length}</td>
                        <td><a href="https://www.gbif.org/species/${s.speciesKey}" target="_blank" rel="noopener noreferrer">Fiche</a></td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        resultsContainer.appendChild(table);
    };

    /**
     * Fonction principale
     */
    async function main() {
        try {
            setStatus("Récupération de votre position...", true);
            const coords = await getUserLocation();
            
            setStatus("Initialisation de la carte...", true);
            initializeMap(coords);

            const { region, departement } = await getRegionDepartement(coords.latitude, coords.longitude);
            setStatus('Chargement des statuts patrimoniaux...', true);
            const dataset = await loadBDCstatut();
            const patrimoniales = filterPatrimoniales(dataset, region, departement);
            logCounts(patrimoniales);

            setStatus(null);
            displayPatrimoniales(patrimoniales);

        } catch (error) {
            console.error("Erreur dans le processus:", error);
            setStatus(`Erreur : ${error.message}`);
            mapContainer.style.display = 'none';
        }
    }

    main();
});
