// Relay messages between the web page and the extension service worker
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'LAUNCH_SERVICE') {
    chrome.runtime.sendMessage(event.data);
  }
});

// Notify the page that the extension is present
window.postMessage({ type: 'EXTENSION_AVAILABLE' }, '*');
