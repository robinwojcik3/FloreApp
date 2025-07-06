document.addEventListener('DOMContentLoaded', () => {
    try {
        // --- Vérification des dépendances ---
        if (typeof L === 'undefined') {
            document.getElementById('statusInfo').textContent = 'Erreur : La librairie de carte (Leaflet) est inaccessible. Vérifiez votre connexion ou un bloqueur de publicités.';
            document.getElementById('searchButton').disabled = true;
            return;
        }

        // --- 1. INITIALISATION ET CONSTANTES ---
        const map = L.map('map').setView([46.6, 2.2], 6);

        const openTopoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });

        const baseLayers = {
            'OpenTopoMap': openTopoLayer,
            'Satellite': satelliteLayer
        };

        openTopoLayer.addTo(map);

        const mainLayerGroup = L.layerGroup().addTo(map);

        L.control.layers(baseLayers).addTo(map);

        // Références DOM
        const searchButton = document.getElementById('searchButton');
        const clearButton = document.getElementById('clearButton');
        const speciesInput = document.getElementById('speciesInput');
        const statusInfo = document.getElementById('statusInfo');
        const spinner = document.getElementById('spinner');
        const legendDiv = document.getElementById('legend');
        const radiusSlider = document.getElementById('radiusSlider');
        const radiusValue = document.getElementById('radiusValue');

        const SPECIES_COLORS = ['#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4', '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE'];
        let isSearching = false;

        // --- 2. FONCTIONS UTILES ---

        const getUserLocation = () => new Promise((resolve, reject) => {
            if (!navigator.geolocation) return reject(new Error("Géolocalisation non supportée par ce navigateur."));
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    if (position && position.coords) {
                        resolve(position.coords);
                    } else {
                        reject(new Error("Objet de position de géolocalisation invalide."));
                    }
                },
                () => reject(new Error("Permission de géolocalisation refusée ou impossible d'obtenir la position.")),
                { timeout: 10000 }
            );
        });
        
        const createWktCircularPolygon = (centerLat, centerLon, radiusKm, segments = 32) => {
            const latRad = centerLat * (Math.PI / 180);
            const degLatKm = 111.132;
            const degLonKm = 111.320 * Math.cos(latRad);

            const latDelta = radiusKm / degLatKm;
            const lonDelta = radiusKm / degLonKm;

            const points = [];
            for (let i = 0; i <= segments; i++) {
                const angle = (i * 2 * Math.PI) / segments;
                const lon = centerLon + lonDelta * Math.cos(angle);
                const lat = centerLat + latDelta * Math.sin(angle);
                points.push(`${lon.toFixed(5)} ${lat.toFixed(5)}`);
            }
            
            const wktString = `POLYGON((${points.join(', ')}))`;
            console.log("Generated WKT for search:", wktString);
            return wktString;
        };

        const createColoredIcon = (color) => {
            const diameter = 12;
            const border = 2;
            const html = `<div style="width:${diameter}px;height:${diameter}px;background:${color};border:${border}px solid white;border-radius:50%; box-shadow: 0 0 2px rgba(0,0,0,0.5);"></div>`;
            const size = diameter + border * 2;
            return L.divIcon({ html, className: 'custom-div-icon', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
        };

        const createStarIcon = (color) => {
            const size = 20;
            const html = `<div style="color:${color};font-size:${size}px;text-shadow:0 0 2px rgba(0,0,0,0.5);">★</div>`;
            return L.divIcon({ html, className: 'custom-div-icon', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
        };

        // --- 3. LOGIQUE DE RECHERCHE ET D'AFFICHAGE ---

        const searchSingleSpecies = async (speciesName, wktPolygon, color) => {
            try {
                const matchUrl = `/api/gbif/v1/species/match?name=${encodeURIComponent(speciesName)}`;
                const matchResponse = await fetch(matchUrl);
                if (!matchResponse.ok) throw new Error(`Erreur de validation du nom d'espèce (HTTP ${matchResponse.status})`);
                const matchData = await matchResponse.json();
                if (matchData.matchType === 'NONE' || !matchData.usageKey) throw new Error(`Espèce non trouvée dans le référentiel GBIF`);

                const allResults = [];
                let offset = 0;
                let keepFetching = true;
                const maxOccurrences = 5000;
                const pageSize = 300; 

                while (keepFetching && allResults.length < maxOccurrences) {
                    const occurrenceUrl = `/api/gbif/v1/occurrence/search?taxonKey=${matchData.usageKey}&geometry=${encodeURIComponent(wktPolygon)}&limit=${pageSize}&offset=${offset}`;
                    const occResponse = await fetch(occurrenceUrl);
                    
                    if (!occResponse.ok) {
                        const errorText = await occResponse.text();
                        console.error("GBIF API Request Failed:", occurrenceUrl);
                        console.error("Response:", occResponse.status, occResponse.statusText, errorText);
                        throw new Error(`Erreur lors de la recherche des occurrences (HTTP ${occResponse.status})`);
                    }

                    const occData = await occResponse.json();

                    if (occData.results && occData.results.length > 0) {
                        allResults.push(...occData.results);
                    }
                    offset += pageSize;
                    if (occData.endOfRecords || occData.results.length < pageSize) {
                        keepFetching = false;
                    }
                }
                
                return { 
                    name: matchData.canonicalName || speciesName, 
                    count: allResults.length, 
                    endOfRecords: !keepFetching,
                    occurrences: allResults.slice(0, maxOccurrences),
                    color: color
                };
            
            } catch (error) {
                console.error(`Erreur pour ${speciesName}:`, error);
                return { 
                    name: speciesName, 
                    count: 0, 
                    error: error.message,
                    occurrences: [],
                    color: color
                };
            }
        };

        const handleSearch = async () => {
            console.log("handleSearch: Démarrage de la recherche.");
            const speciesList = speciesInput.value.split(',').map(s => s.trim()).filter(Boolean);
            if (speciesList.length === 0 || isSearching) {
                console.log("handleSearch: Recherche annulée (aucune espèce ou déjà en cours).");
                return;
            }

            isSearching = true;
            searchButton.disabled = true;
            spinner.style.display = 'block';
            mainLayerGroup.clearLayers();
            legendDiv.innerHTML = '';
            statusInfo.textContent = "Demande de votre position...";

            try {
                const coords = await getUserLocation();
                statusInfo.textContent = "Position obtenue. Lancement des recherches...";
                
                const radiusKm = parseInt(radiusSlider.value, 10);
                
                const wktPolygon = createWktCircularPolygon(coords.latitude, coords.longitude, radiusKm);
                const searchCircle = L.circle([coords.latitude, coords.longitude], {
                    radius: radiusKm * 1000,
                    color: 'blue',
                    weight: 2,
                    fill: false
                }).addTo(mainLayerGroup);

                const userIcon = createStarIcon('blue');
                L.marker([coords.latitude, coords.longitude], { icon: userIcon })
                    .bindPopup('Votre position')
                    .addTo(mainLayerGroup);

                map.fitBounds(searchCircle.getBounds());
                
                const searchPromises = speciesList.map((name, index) =>
                    searchSingleSpecies(name, wktPolygon, SPECIES_COLORS[index % SPECIES_COLORS.length])
                );
                
                const results = await Promise.all(searchPromises);

                const speciesLayers = new Map();

                const summary = results.map(r => {
                    let text = `${r.count} <i>${r.name}</i>`;
                    if (r.error) text += ` (Erreur: ${r.error})`;
                    else if (r.count >= 5000 || !r.endOfRecords) text += ' (limite atteinte)';
                    return text;
                }).join(', ');
                statusInfo.innerHTML = `Résultats : ${summary}.`;

                const sortedResults = [...results].sort((a, b) => b.count - a.count);

                sortedResults.forEach(result => {
                    const speciesLayer = L.layerGroup();
                    const icon = createColoredIcon(result.color);
                    result.occurrences.forEach(occ => {
                        const lat = occ.decimalLatitude;
                        const lon = occ.decimalLongitude;
                        if (typeof lat === 'number' && typeof lon === 'number') {
                            L.marker([lat, lon], { icon })
                                .bindPopup(`<b>${occ.scientificName}</b><br>${occ.eventDate ? new Date(occ.eventDate).toLocaleDateString() : 'Date non disponible'}`)
                                .addTo(speciesLayer);
                        }
                    });
                    speciesLayers.set(result.name, speciesLayer);
                    speciesLayer.addTo(mainLayerGroup);
                });
                
                results.forEach((r) => {
                    const item = document.createElement('div');
                    item.className = 'legend-item';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = true;
                    checkbox.dataset.speciesName = r.name;
                    
                    checkbox.addEventListener('change', (event) => {
                        const layerToToggle = speciesLayers.get(event.target.dataset.speciesName);
                        if (layerToToggle) {
                            if (event.target.checked) {
                                mainLayerGroup.addLayer(layerToToggle);
                            } else {
                                mainLayerGroup.removeLayer(layerToToggle);
                            }
                        }
                    });

                    const colorSpan = document.createElement('span');
                    colorSpan.className = 'legend-color';
                    colorSpan.style.background = r.color;

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = ` ${r.name} (${r.count})`;

                    item.appendChild(checkbox);
                    item.appendChild(colorSpan);
                    item.appendChild(nameSpan);
                    legendDiv.appendChild(item);
                });

            } catch (error) {
                console.error("Erreur de recherche globale:", error);
                statusInfo.textContent = `Erreur: ${error.message}`;
            } finally {
                isSearching = false;
                searchButton.disabled = false;
                spinner.style.display = 'none';
                console.log("handleSearch: Fin de la recherche.");
            }
        };

        const handleClear = () => {
            mainLayerGroup.clearLayers();
            legendDiv.innerHTML = '';
            speciesInput.value = '';
            statusInfo.textContent = 'Prêt. Saisissez une espèce et lancez la recherche.';
            map.setView([46.6, 2.2], 6);
        };


        // --- 4. ÉCOUTEURS D'ÉVÉNEMENTS ---
        searchButton.addEventListener('click', handleSearch);
        clearButton.addEventListener('click', handleClear);
        speciesInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') handleSearch();
        });
        radiusSlider.addEventListener('input', () => {
            radiusValue.textContent = `${radiusSlider.value} km`;
        });
        
        // --- SECTION AJOUTÉE POUR L'INTÉGRATION ---
        const urlParams = new URLSearchParams(window.location.search);
        const speciesFromUrl = urlParams.get('species');
        if (speciesFromUrl) {
            speciesInput.value = speciesFromUrl;
            handleSearch();
        }
        // --- FIN DE LA SECTION AJOUTÉE ---


    } catch (e) {
        console.error("Erreur critique lors de l'initialisation:", e);
        const statusDiv = document.getElementById('statusInfo');
        if (statusDiv) {
            statusDiv.textContent = `Erreur critique d'initialisation : ${e.message}`;
        }
    }
});
