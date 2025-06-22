document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results');
    const mapContainer = document.getElementById('map');
    let map = null;
    
    const SPECIES_COLORS = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#800000', '#AA6E28'];

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

            const wktPolygon = createWktCircularPolygon(coords.latitude, coords.longitude, 10);
            const occurrences = await searchThreatenedSpecies(wktPolygon, setStatus);
            const processedSpecies = processOccurrences(occurrences);
            
            setStatus(null);
            displayResults(processedSpecies);

        } catch (error) {
            console.error("Erreur dans le processus:", error);
            setStatus(`Erreur : ${error.message}`);
            mapContainer.style.display = 'none';
        }
    }

    main();
});
