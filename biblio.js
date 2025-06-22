// Script for the "Biblio Patri" tab
// This fetches protected or threatened species around the user location via GBIF.
// Network access to api.gbif.org is required. The current Codex environment may block it.

async function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non supportée.'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords),
      err => reject(err),
      { timeout: 10000 }
    );
  });
}

async function queryGbif(lat, lon) {
  const radius = 10; // km
  const url = `https://api.gbif.org/v1/occurrence/search?hasCoordinate=true&distance=${radius}&geometry=POINT(${lon}%20${lat})&threatStatus=NT,VU,EN,CR&isInvasive=false`;
  // threatStatus and protection filters are placeholders as GBIF does not expose them directly.
  const res = await fetch(url);
  if (!res.ok) throw new Error('GBIF request failed');
  return res.json();
}

function populateTable(data) {
  const table = document.getElementById('results-table');
  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';
  data.results.forEach(item => {
    const tr = document.createElement('tr');
    const gbifUrl = `https://www.gbif.org/species/${item.taxonKey}`;
    tr.innerHTML = `<td>${item.scientificName}</td><td>${item.threatStatus || ''}</td><td>${item.protected || ''}</td><td>${item.individualCount || 1}</td><td><a href="${gbifUrl}" target="_blank">GBIF</a></td>`;
    tbody.appendChild(tr);
  });
  table.style.display = data.results.length ? '' : 'none';
  document.getElementById('no-results').style.display = data.results.length ? 'none' : '';
}

async function init() {
  try {
    const coords = await getUserLocation();
    const data = await queryGbif(coords.latitude, coords.longitude);
    populateTable(data);
  } catch (err) {
    console.error(err);
    document.getElementById('no-results').textContent = 'Impossible de contacter le service GBIF.';
    document.getElementById('no-results').style.display = '';
  }
}

document.addEventListener('DOMContentLoaded', init);
