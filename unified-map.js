const LONG_PRESS_MS = 1000;
let map;
let zonesVisible = false;
const zoneLayers = [];

const APICARTO_LAYERS = {
  'ZNIEFF I': {
    endpoint: 'https://apicarto.ign.fr/api/nature/znieff1',
    style: { color: '#AFB42B', weight: 2, opacity: 0.9, fillOpacity: 0.2, dashArray: '5,5' }
  },
  'ZNIEFF II': {
    endpoint: 'https://apicarto.ign.fr/api/nature/znieff2',
    style: { color: '#E65100', weight: 2, opacity: 0.9, fillOpacity: 0.2 }
  },
  'Natura 2000 (Habitats)': {
    endpoint: 'https://apicarto.ign.fr/api/nature/natura-habitat',
    style: { color: '#2E7D32', weight: 2, opacity: 0.9, fillOpacity: 0.2 }
  }
};

const SERVICES = {
  geopal: {
    name: 'Géoportail',
    buildUrl: (lat, lon) => `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=15`
  },
  gmaps: {
    name: 'Google Maps',
    buildUrl: (lat, lon) => `https://www.google.com/maps?q=${lat},${lon}`
  }
};

function initMap() {
  map = L.map('map').setView([45.1885, 5.7245], 13);
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
    maxZoom: 17
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 13);
    });
  }

  enableLongPressSelection();
}

function enableLongPressSelection() {
  let timer;
  let startEvt;
  function showPopup(e) {
    const lat = startEvt.latlng.lat.toFixed(6);
    const lon = startEvt.latlng.lng.toFixed(6);
    const content = `<button id="patri" class="action-button">Flore patrimoniale</button><br>`+
                    `<button id="full" class="action-button">Toute la flore</button>`;
    L.popup().setLatLng(startEvt.latlng).setContent(content).openOn(map);
    document.getElementById('patri').addEventListener('click', () => {
      L.popup().remove();
      document.getElementById('results').textContent = `Analyse patrimoniale en ${lat}, ${lon}`;
    });
    document.getElementById('full').addEventListener('click', () => {
      L.popup().remove();
      document.getElementById('results').textContent = `Recherche de toute la flore en ${lat}, ${lon}`;
    });
  }
  function start(e) { startEvt = e; timer = setTimeout(showPopup, LONG_PRESS_MS); }
  function cancel() { clearTimeout(timer); }
  map.on('mousedown', start);
  map.on('touchstart', start);
  map.on('mouseup', cancel);
  map.on('touchend', cancel);
  map.on('dragstart', cancel);
  map.on('move', cancel);
  map.on('contextmenu', e => { e.originalEvent.preventDefault(); startEvt = e; showPopup(); });
}

async function fetchLayer(name, config, lat, lon) {
  const url = `${config.endpoint}?lon=${lon}&lat=${lat}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (data.features && data.features.length) {
    return L.geoJSON(data, { style: config.style });
  }
  return null;
}

async function toggleZones() {
  if (zonesVisible) {
    zoneLayers.forEach(l => map.removeLayer(l));
    zoneLayers.length = 0;
    document.getElementById('toggle-zones').textContent = 'Afficher les zonages';
    zonesVisible = false;
    return;
  }
  const center = map.getCenter();
  for (const [name, conf] of Object.entries(APICARTO_LAYERS)) {
    const layer = await fetchLayer(name, conf, center.lat, center.lng);
    if (layer) { layer.addTo(map); zoneLayers.push(layer); }
  }
  document.getElementById('toggle-zones').textContent = 'Masquer les zonages';
  zonesVisible = true;
}

function showResources() {
  const center = map.getCenter();
  const results = document.getElementById('results');
  results.innerHTML = '<h3>Ressources</h3>';
  Object.values(SERVICES).forEach(s => {
    const link = document.createElement('a');
    link.href = s.buildUrl(center.lat, center.lng);
    link.target = '_blank';
    link.textContent = s.name;
    link.style.display = 'block';
    results.appendChild(link);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  document.getElementById('search-address').addEventListener('click', async () => {
    const addr = document.getElementById('address-input').value.trim();
    if (!addr) return;
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
    const data = await resp.json();
    if (data && data[0]) {
      map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 13);
    }
  });
  document.getElementById('geoloc').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 13);
      });
    }
  });
  document.getElementById('toggle-zones').addEventListener('click', toggleZones);
  document.getElementById('show-resources').addEventListener('click', showResources);
});
