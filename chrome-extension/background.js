function latLonToWebMercator(lat, lon) {
  const R = 6378137;
  const x = R * (lon * Math.PI / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  return { x, y };
}

function openArcGis(lat, lon) {
  const { x, y } = latLonToWebMercator(lat, lon);
  const b = 1000;
  const url = `https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&extent=${x-b},${y-b},${x+b},${y+b},102100`;
  chrome.tabs.create({ url });
}

function openGeoportail(lat, lon) {
  const url = `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=15&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&l1=AGRICULTURE.CARTE.PEDOLOGIQUE::GEOPORTAIL:OGC:WMS(0.5)&permalink=yes`;
  chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'open-maps') {
    openArcGis(msg.lat, msg.lon);
    openGeoportail(msg.lat, msg.lon);
  }
});
