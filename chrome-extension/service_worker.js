const tabsToCoords = new Map();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'open-maps') {
    openTabs(msg.lat, msg.lon);
  }
});

function openTabs(lat, lon) {
  const urls = [
    `https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c`,
    `https://www.geoportail.gouv.fr/donnees/carte-des-sols`
  ];
  urls.forEach(url => {
    chrome.tabs.create({url}, tab => {
      tabsToCoords.set(tab.id, {lat, lon});
    });
  });
}

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' && tabsToCoords.has(tabId)) {
    const {lat, lon} = tabsToCoords.get(tabId);
    chrome.tabs.sendMessage(tabId, {action: 'start', lat, lon});
    tabsToCoords.delete(tabId);
  }
});
