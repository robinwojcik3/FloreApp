// unified.js - simple combined interface

const ZONING_LAYERS = {
    'Natura 2000 (Habitats)': {
        url: 'https://apicarto.ign.fr/api/nature/natura-habitat',
        style: { color: '#2E7D32', weight: 2, opacity: 0.9, fillOpacity: 0.2 }
    },
    'ZNIEFF I': {
        url: 'https://apicarto.ign.fr/api/nature/znieff1',
        style: { color: '#AFB42B', weight: 2, opacity: 0.9, fillOpacity: 0.2, dashArray: '5,5' }
    },
    'ZNIEFF II': {
        url: 'https://apicarto.ign.fr/api/nature/znieff2',
        style: { color: '#E65100', weight: 2, opacity: 0.9, fillOpacity: 0.2 }
    }
};

let map;
let zoningVisible = false;
const zoningLayers = {};

function initMap() {
    map = L.map('map');
    const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    map.setView([46.6, 2.2], 6);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 12);
        });
    }

    map.on('contextmenu', showChoicePopup);
    let pressTimer;
    map.on('mousedown', e => {
        if (e.originalEvent.touches && e.originalEvent.touches.length > 1) return;
        pressTimer = setTimeout(() => showChoicePopup(e), 800);
    });
    map.on('mouseup touchend move zoomstart dragstart', () => clearTimeout(pressTimer));
}

function showChoicePopup(e) {
    e.originalEvent.preventDefault();
    const lat = e.latlng.lat.toFixed(6);
    const lon = e.latlng.lng.toFixed(6);
    const content = `<strong>Analyse ici ?</strong><br>
        <button onclick="startAnalysis(${lat},${lon},true)">Flore patrimoniale</button><br>
        <button onclick="startAnalysis(${lat},${lon},false)">Toute la flore</button>`;
    L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
}

async function searchAddress() {
    const q = document.getElementById('address-input').value.trim();
    if (!q) return;
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.length === 0) return;
    const { lat, lon } = data[0];
    map.setView([parseFloat(lat), parseFloat(lon)], 12);
}

function geolocate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 12);
    });
}

async function startAnalysis(lat, lon, patrimonialOnly) {
    map.closePopup();
    const radiusKm = 2;
    const degLatKm = 111.132;
    const latDelta = radiusKm / degLatKm;
    const wkt = `POLYGON((
        ${lon - radiusKm/111.32},${lat - latDelta},
        ${lon + radiusKm/111.32},${lat - latDelta},
        ${lon + radiusKm/111.32},${lat + latDelta},
        ${lon - radiusKm/111.32},${lat + latDelta},
        ${lon - radiusKm/111.32},${lat - latDelta}
    ))`;
    const url = `https://api.gbif.org/v1/occurrence/search?limit=200&geometry=${encodeURIComponent(wkt)}&kingdomKey=6`;
    const resp = await fetch(url);
    if (!resp.ok) return;
    const data = await resp.json();
    const list = document.createElement('ul');
    const species = new Set();
    data.results.forEach(r => { if (r.species) species.add(r.species); });
    Array.from(species).forEach(name => {
        if (patrimonialOnly && !/protect|rare/i.test(name)) return;
        const li = document.createElement('li');
        li.textContent = name;
        list.appendChild(li);
    });
    const results = document.getElementById('results');
    results.innerHTML = '';
    results.appendChild(list);
}

async function toggleZoning() {
    zoningVisible = !zoningVisible;
    const btn = document.getElementById('toggle-zoning');
    btn.textContent = zoningVisible ? 'Masquer les zonages' : 'Afficher les zonages';
    if (zoningVisible) {
        for (const [name, cfg] of Object.entries(ZONING_LAYERS)) {
            const url = `${cfg.url}?lon=${map.getCenter().lng}&lat=${map.getCenter().lat}`;
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const geo = await resp.json();
            const layer = L.geoJSON(geo, { style: cfg.style });
            layer.addTo(map);
            zoningLayers[name] = layer;
        }
    } else {
        Object.values(zoningLayers).forEach(l => map.removeLayer(l));
    }
}

function showResources() {
    const div = document.getElementById('resources');
    if (div.style.display === 'block') { div.style.display = 'none'; return; }
    div.innerHTML = '<a href="https://inpn.mnhn.fr">INPN</a><br>' +
        '<a href="https://www.florealpes.com">FloreAlpes</a>';
    div.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    document.getElementById('search-address-btn').addEventListener('click', searchAddress);
    document.getElementById('geoloc-btn').addEventListener('click', geolocate);
    document.getElementById('toggle-zoning').addEventListener('click', toggleZoning);
    document.getElementById('show-resources').addEventListener('click', showResources);
});
