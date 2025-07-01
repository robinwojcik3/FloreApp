/* Interface unifiée pour l'analyse floristique */
document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map');
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)',
        maxZoom: 17,
        crossOrigin: true
    }).addTo(map);
    map.setView([46.6, 2.2], 6);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 12);
        });
    }

    document.getElementById('use-geolocation-btn').addEventListener('click', () => {
        if (!navigator.geolocation) return showNotification('Géolocalisation indisponible', 'error');
        navigator.geolocation.getCurrentPosition(
            pos => map.setView([pos.coords.latitude, pos.coords.longitude], 12),
            () => showNotification('Impossible de récupérer la position', 'error')
        );
    });

    document.getElementById('search-address-btn').addEventListener('click', async () => {
        const addr = document.getElementById('address-input').value.trim();
        if (!addr) return;
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
            if (!resp.ok) throw new Error();
            const data = await resp.json();
            if (data.length) map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 12);
        } catch {
            showNotification('Adresse introuvable', 'error');
        }
    });

    let pressTimer;
    function promptAnalysis(latlng) {
        const popup = L.popup().setLatLng(latlng).setContent(
            '<button id="patri-btn">Flore patrimoniale</button><br>' +
            '<button id="all-btn">Toute la flore</button>'
        ).openOn(map);
        popup.getElement().querySelector('#patri-btn').addEventListener('click', () => {
            map.closePopup();
            analyzePatri(latlng);
        });
        popup.getElement().querySelector('#all-btn').addEventListener('click', () => {
            map.closePopup();
            analyzeAll(latlng);
        });
    }

    function onDown(e){
        if (e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
        pressTimer = setTimeout(() => promptAnalysis(e.latlng), 1500);
    }
    function cancel(){ clearTimeout(pressTimer); }
    map.on('contextmenu', e => { e.originalEvent.preventDefault(); promptAnalysis(e.latlng); });
    map.on('mousedown', onDown);
    map.on('mouseup', cancel);
    map.on('mousemove', cancel);
    map.on('touchstart', onDown);
    map.on('touchend', cancel);
    map.on('touchmove', cancel);
    map.on('dragstart', cancel);
    map.on('move', cancel);
    map.on('zoomstart', cancel);

    const resultsDiv = document.getElementById('results');

    function circleWkt(lat, lon, radiusKm){
        const pts = [];
        for(let i=0;i<=32;i++){
            const a = i*2*Math.PI/32;
            const dx = radiusKm/(111.32*Math.cos(lat*Math.PI/180));
            const dy = radiusKm/111.132;
            pts.push(`${(lon+dx*Math.cos(a)).toFixed(5)} ${(lat+dy*Math.sin(a)).toFixed(5)}`);
        }
        return `POLYGON((${pts.join(', ')}))`;
    }

    async function fetchGbif(lat, lon, radius){
        const wkt = circleWkt(lat, lon, radius);
        const url = `https://api.gbif.org/v1/occurrence/search?limit=300&geometry=${encodeURIComponent(wkt)}&taxonKey=7707728`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('GBIF');
        const json = await resp.json();
        return json.results || [];
    }

    async function analyzeAll(latlng){
        resultsDiv.textContent = 'Recherche...';
        try {
            const occs = await fetchGbif(latlng.lat, latlng.lng, 1);
            const species = [...new Set(occs.map(o => o.species).filter(Boolean))].sort();
            resultsDiv.innerHTML = `<h3>Espèces observées (${species.length})</h3><ul>` +
                species.map(s => `<li><i>${s}</i></li>`).join('') + '</ul>';
        } catch {
            resultsDiv.textContent = 'Erreur lors de la récupération des données';
        }
    }

    async function analyzePatri(latlng){
        resultsDiv.textContent = 'Recherche...';
        try {
            const occs = await fetchGbif(latlng.lat, latlng.lng, 2);
            const species = [...new Set(occs.map(o => o.species).filter(Boolean))].sort();
            resultsDiv.innerHTML = `<h3>Espèces remarquables (${species.length})</h3><ul>` +
                species.map(s => `<li><i>${s}</i></li>`).join('') + '</ul>';
        } catch {
            resultsDiv.textContent = 'Erreur lors de la récupération des données';
        }
    }

    const ZONING_LAYERS = {
        'Natura 2000 (Habitats)': 'https://apicarto.ign.fr/api/nature/natura-habitat',
        'ZNIEFF I': 'https://apicarto.ign.fr/api/nature/znieff1',
        'ZNIEFF II': 'https://apicarto.ign.fr/api/nature/znieff2'
    };
    let zoningOn = false;
    let zoningLayers = [];
    document.getElementById('toggle-zonages-btn').addEventListener('click', () => {
        if (!zoningOn) {
            showZoning(map.getCenter());
            zoningOn = true;
            document.getElementById('toggle-zonages-btn').textContent = 'Masquer les zonages';
        } else {
            zoningLayers.forEach(l => map.removeLayer(l));
            zoningLayers = [];
            zoningOn = false;
            document.getElementById('toggle-zonages-btn').textContent = 'Afficher les zonages';
        }
    });

    async function showZoning(center){
        for (const [name, url] of Object.entries(ZONING_LAYERS)){
            try {
                const resp = await fetch(`${url}?lon=${center.lng}&lat=${center.lat}`);
                if (!resp.ok) continue;
                const geo = await resp.json();
                const layer = L.geoJSON(geo, { style:{ color:'#FF5722', weight:2, fillOpacity:0.2 } }).addTo(map);
                layer.bindPopup(name);
                zoningLayers.push(layer);
            } catch {}
        }
    }

    document.getElementById('resources-btn').addEventListener('click', () => {
        const box = document.getElementById('resources');
        if (box.style.display === 'none' || !box.style.display) {
            const c = map.getCenter();
            box.innerHTML = buildResources(c.lat, c.lng);
            box.style.display = 'block';
        } else {
            box.style.display = 'none';
        }
    });

    function buildResources(lat, lon){
        const links = [
            {name: 'IGN Remonter le temps', url:`https://remonterletemps.ign.fr/comparer?lon=${lon}&lat=${lat}&z=17`},
            {name: 'ArcGIS Végétation', url:`https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&center=${lon},${lat}`}
        ];
        return '<h3>Ressources complémentaires</h3><ul>' +
            links.map(l => `<li><a href="${l.url}" target="_blank" rel="noopener">${l.name}</a></li>`).join('') +
            '</ul>';
    }
});
