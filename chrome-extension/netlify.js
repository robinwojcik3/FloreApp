// Informe la page que l'extension est présente
window.postMessage({type: 'flore_extension_ready'}, '*');

// Réception des coordonnées depuis la page
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'flore_extension_coords') {
    chrome.runtime.sendMessage({
      action: 'open-maps',
      lat: e.data.lat,
      lon: e.data.lon
    });
  }
});
