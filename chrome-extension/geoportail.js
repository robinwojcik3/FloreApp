function waitSelector(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (Date.now() - t0 > timeout) {
        clearInterval(timer);
        reject(new Error('not found: ' + selector));
      }
    }, 500);
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'start') {
    runAutomation(msg.lat, msg.lon).catch(console.error);
  }
});

async function runAutomation(lat, lon) {
  const wait = selector => waitSelector(selector, 15000);

  await wait('#header-search-submit').then(btn => btn.click());
  const select = await wait("div.advanced-search select");
  select.value = 'Coordonnées';
  select.dispatchEvent(new Event('change', {bubbles: true}));

  await wait('#advanced-search-coords-inputDecLat').then(inp => { inp.value = lat; inp.dispatchEvent(new Event('input', {bubbles:true})); });
  await wait('#advanced-search-coords-inputDecLon').then(inp => { inp.value = lon; inp.dispatchEvent(new Event('input', {bubbles:true})); });
  await wait('#advanced-search-coords-submit').then(btn => btn.click());

  try {
    await wait('#advanced-search-close', 5000).then(btn => btn.click());
  } catch {}
  try {
    await wait('#GPlayerInfoClose', 5000).then(btn => btn.click());
  } catch {}

  const zoomOut = await wait('#zoom-out', 5000).catch(() => null);
  if (zoomOut) { zoomOut.click(); setTimeout(() => zoomOut.click(), 200); }
}
