function openWithExtension(lat, lon) {
  return new Promise((resolve) => {
    const handler = (e) => {
      if (e.data && e.data.type === 'open-maps-ack') {
        window.removeEventListener('message', handler);
        resolve(true);
      }
    };
    window.addEventListener('message', handler, { once: true });
    window.postMessage({ type: 'open-maps', lat, lon }, '*');
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(false);
    }, 500);
  });
}

function launchExternalMaps() {
  if (typeof selectedLat !== 'number' || typeof selectedLon !== 'number') {
    showNotification('Choisissez d\'abord une localisation', 'error');
    return;
  }
  openWithExtension(selectedLat, selectedLon).then((ok) => {
    if (!ok) {
      showNotification('Extension Chrome non d\u00e9tect\u00e9e', 'error');
    }
  });
}
