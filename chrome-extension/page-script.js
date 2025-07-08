window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const { type, lat, lon } = e.data || {};
  if (type === 'open-maps') {
    chrome.runtime.sendMessage({ type: 'open-maps', lat, lon });
    window.postMessage({ type: 'open-maps-ack' }, '*');
  }
});
