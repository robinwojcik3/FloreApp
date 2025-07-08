// Service worker handling messages from the Netlify page
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'LAUNCH_SERVICE') {
    const { service, url, lat, lon } = msg;
    chrome.tabs.create({ url }, (tab) => {
      if (!tab.id) return;
      // Inject the automation script once the page has loaded
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [`${service}.js`]
      }, () => {
        chrome.tabs.sendMessage(tab.id, { type: 'COORDS', lat, lon });
      });
    });
  }
});
