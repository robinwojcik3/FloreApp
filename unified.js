// unified.js - simple unified interface for flora analysis

document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map');
    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
    }).addTo(map);

    function setViewToUser() {
        if (!navigator.geolocation) {
            map.setView([45.1885, 5.7245], 12);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => map.setView([pos.coords.latitude, pos.coords.longitude], 12),
            () => map.setView([45.1885, 5.7245], 12)
        );
    }

    setViewToUser();

    document.getElementById('use-geolocation-btn').addEventListener('click', setViewToUser);

    document.getElementById('search-address-btn').addEventListener('click', async () => {
        const addr = document.getElementById('address-input').value.trim();
        if (!addr) return;
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.length > 0) {
            map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 13);
        }
    });

    // ----- Zoning layers -----
    const APICARTO_LAYERS = {
        'ZNIEFF I': {
            endpoint: 'https://apicarto.ign.fr/api/nature/znieff1',
            style: { color: '#AFB42B', weight: 2, opacity: 0.9, fillOpacity: 0.2, dashArray: '5, 5' }
        },
        'ZNIEFF II': {
            endpoint: 'https://apicarto.ign.fr/api/nature/znieff2',
            style: { color: '#E65100', weight: 2, opacity: 0.9, fillOpacity: 0.2 }
        },
        'Natura 2000': {
            endpoint: 'https://apicarto.ign.fr/api/nature/natura-habitat',
            style: { color: '#2E7D32', weight: 2, opacity: 0.9, fillOpacity: 0.2 }
        }
    };

    let zoningVisible = false;
    const zoningLayers = {};

    async function fetchLayer(name, config) {
        const c = map.getCenter();
        const url = `${config.endpoint}?lon=${c.lng}&lat=${c.lat}`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data && data.features && data.features.length) {
            return L.geoJSON(data, { style: config.style });
        }
        return null;
    }

    async function showZoning() {
        for (const [name, conf] of Object.entries(APICARTO_LAYERS)) {
            if (!zoningLayers[name]) {
                zoningLayers[name] = await fetchLayer(name, conf);
            }
            if (zoningLayers[name]) zoningLayers[name].addTo(map);
        }
    }

    function hideZoning() {
        for (const layer of Object.values(zoningLayers)) {
            if (layer) map.removeLayer(layer);
        }
    }

    document.getElementById('toggle-zoning-btn').addEventListener('click', async () => {
        zoningVisible = !zoningVisible;
        if (zoningVisible) {
            await showZoning();
        } else {
            hideZoning();
        }
    });

    // ----- Resources -----
    const resourcesDiv = document.getElementById('resources');
    document.getElementById('toggle-resources-btn').addEventListener('click', () => {
        resourcesDiv.style.display = resourcesDiv.style.display === 'none' ? 'block' : 'none';
    });
    resourcesDiv.innerHTML = `<ul>
        <li><a href='https://www.tela-botanica.org/' target='_blank'>Tela Botanica</a></li>
        <li><a href='https://inpn.mnhn.fr/' target='_blank'>INPN</a></li>
    </ul>`;

    // ----- Analysis -----
    let patrimonialSet = null;
    async function loadPatrimonialSet() {
        if (patrimonialSet) return patrimonialSet;
        const text = await fetch('BDCstatut.csv').then(r => r.text());
        patrimonialSet = new Set(text.split('\n').slice(1).map(l => l.split(';')[2]).filter(Boolean));
        return patrimonialSet;
    }

    function circleWkt(lat, lon, radiusKm, segments = 32) {
        const latRad = lat * Math.PI / 180;
        const degLatKm = 111.132;
        const degLonKm = 111.320 * Math.cos(latRad);
        const latDelta = radiusKm / degLatKm;
        const lonDelta = radiusKm / degLonKm;
        const pts = [];
        for (let i=0;i<=segments;i++) {
            const ang = i*2*Math.PI/segments;
            const ptLon = lon + lonDelta * Math.cos(ang);
            const ptLat = lat + latDelta * Math.sin(ang);
            pts.push(`${ptLon.toFixed(5)} ${ptLat.toFixed(5)}`);
        }
        return `POLYGON((${pts.join(', ')}))`;
    }

    async function fetchOccurrences(lat, lon, radiusKm) {
        const wkt = circleWkt(lat, lon, radiusKm);
        const url = `https://api.gbif.org/v1/occurrence/search?geometry=${encodeURIComponent(wkt)}&limit=300`;
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.results || [];
    }

    async function analyzePoint(latlng, patrimonial) {
        const container = document.getElementById('results');
        container.textContent = 'Recherche en cours...';
        const occs = await fetchOccurrences(latlng.lat, latlng.lng, 2);
        const counts = {};
        for (const o of occs) {
            if (!o.species) continue;
            counts[o.species] = (counts[o.species] || 0) + 1;
        }
        let entries = Object.entries(counts);
        if (patrimonial) {
            const set = await loadPatrimonialSet();
            entries = entries.filter(([sp]) => set.has(sp));
        }
        entries.sort((a,b) => b[1]-a[1]);
        if (!entries.length) {
            container.textContent = 'Aucune espèce trouvée.';
            return;
        }
        const list = document.createElement('ul');
        for (const [sp,c] of entries) {
            const li = document.createElement('li');
            li.innerHTML = `<i>${sp}</i> (${c})`;
            list.appendChild(li);
        }
        container.innerHTML = '';
        container.appendChild(list);
    }

    function showChoice(latlng) {
        const html = `<div style='text-align:center'>
            <button id='btn-pat' class='action-button'>Flore patrimoniale</button><br>
            <button id='btn-all' class='action-button' style='margin-top:4px;'>Toute la flore</button>
        </div>`;
        L.popup().setLatLng(latlng).setContent(html).openOn(map);
        setTimeout(() => {
            document.getElementById('btn-pat').onclick = () => { map.closePopup(); analyzePoint(latlng, true); };
            document.getElementById('btn-all').onclick = () => { map.closePopup(); analyzePoint(latlng, false); };
        });
    }

    let pressTimer;
    function startPress(e) {
        if (e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
        pressTimer = setTimeout(() => showChoice(e.latlng), 800);
    }
    function cancelPress() { clearTimeout(pressTimer); }

    map.on('contextmenu', e => { e.originalEvent.preventDefault(); showChoice(e.latlng); });
    map.on('mousedown', startPress);
    map.on('touchstart', startPress);
    map.on('mouseup', cancelPress);
    map.on('touchend', cancelPress);
    map.on('touchmove', cancelPress);
    map.on('move', cancelPress);
    map.on('zoomstart', cancelPress);
});
