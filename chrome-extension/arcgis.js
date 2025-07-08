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
  // attendre splash-screen
  try {
    const ok = await waitSelector("button[normalize-space='OK']", 5000);
    ok.click();
  } catch {}

  // ouvrir liste des couches
  await waitSelector("div[title='Liste des couches']").then(btn => btn.click());

  // menu ... de la couche
  const dots = await waitSelector(
    "#dijit__TemplatedMixin_2 > table > tbody > tr.layer-tr-node-Carte_de_la_végétation_9780 > td.col.col3 > div"
  );
  dots.scrollIntoView({block:'center'});
  dots.click();

  // Plage de visibilité
  await waitSelector("div[normalize-space='Définir la plage de visibilité']").then(btn => btn.click());
  await waitSelector("div.VisibleScaleRangeSlider span.dijitArrowButtonInner:last-child").then(btn => btn.click());
  const textbox = await waitSelector("input.dijitInputInner[type='text'][aria-label]");
  textbox.focus();
  textbox.select();
  document.execCommand('delete');
  textbox.value = '1:100';
  textbox.dispatchEvent(new Event('change', {bubbles:true}));

  // Transparence
  try {
    await waitSelector("div[itemid='transparency']").then(btn => btn.click());
  } catch {}
  const slider = await waitSelector("div.dijitSliderBarContainerH");
  slider.click();
}
