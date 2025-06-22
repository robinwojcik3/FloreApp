document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const resultsContainer = document.getElementById('results');

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
        const text = document.createElement('p');
        text.textContent = message;
        statusDiv.appendChild(text);
    }

    /**
     * Récupère la localisation de l'utilisateur.
     */
    const getUserLocation = () => new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error("La géolocalisation n'est pas supportée par ce navigateur."));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(position.coords),
            () => reject(new Error("Permission de géolocalisation refusée ou impossible d'obtenir la position.")),
            { timeout: 10000, enableHighAccuracy: true }
        );
    });
    
    /**
     * Construit un polygone circulaire WKT.
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
     * Interroge l'API GBIF pour les espèces menacées.
     */
    const searchPatrimonialSpecies = async (wktPolygon) => {
        const threatStati = ['CRITICALLY_ENDANGERED', 'ENDANGERED', 'VULNERABLE', 'NEAR_THREATENED'];
        const taxonKey = 6; // Kingdom Plantae
        const limit = 1000; // Nombre max d'occurrences à récupérer

        let allOccurrences = [];
        for (const status of threatStati) {
            const url = `https://api.gbif.org/v1/occurrence/search?taxon_key=${taxonKey}&geometry=${encodeURIComponent(wktPolygon)}&threat=${status}&limit=${limit}`;
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Erreur API pour statut ${status}`);
                const data = await response.json();
                if (data.results) {
                    allOccurrences.push(...data.results);
                }
            } catch (error) {
                console.error(`Échec de la récupération pour le statut ${status}:`, error);
            }
        }
        return allOccurrences;
    };

    /**
     * Regroupe les occurrences par espèce.
     */
    const processOccurrences = (occurrences) => {
        const speciesMap = new Map();
        occurrences.forEach(occ => {
            if (!occ.speciesKey) return;
            if (!speciesMap.has(occ.speciesKey)) {
                speciesMap.set(occ.speciesKey, {
                    name: occ.scientificName,
                    threatStatus: occ.threatStatus || 'N/A',
                    count: 0,
                    link: `https://www.gbif.org/species/${occ.speciesKey}`
                });
            }
            speciesMap.get(occ.speciesKey).count++;
        });
        return Array.from(speciesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    };

    /**
     * Affiche les résultats dans un tableau.
     */
    const displayResults = (speciesList) => {
        resultsContainer.innerHTML = '';
        if (speciesList.length === 0) {
            setStatus("Aucune espèce patrimoniale (menace globale) trouvée dans cette zone.");
            return;
        }

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
                        <td><i>${s.name}</i></td>
                        <td>${s.threatStatus}</td>
                        <td>${s.count}</td>
                        <td><a href="${s.link}" target="_blank" rel="noopener noreferrer">Fiche</a></td>
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
            
            setStatus("Recherche des espèces patrimoniales...", true);
            const wktPolygon = createWktCircularPolygon(coords.latitude, coords.longitude, 10);
            const occurrences = await searchPatrimonialSpecies(wktPolygon);
            const processedSpecies = processOccurrences(occurrences);
            
            setStatus( occurrences.length > 0 ? "Affichage des résultats." : "Aucune espèce trouvée.");
            displayResults(processedSpecies);

        } catch (error) {
            console.error("Erreur dans le processus:", error);
            setStatus(`Erreur : ${error.message}`);
        }
    }

    main();
});
