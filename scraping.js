document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('run-scrape-btn');
  const pre = document.getElementById('scrape-result');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Exécution…';
    pre.style.display = 'none';
    pre.textContent = '';
    try {
      const r = await fetch('/.netlify/functions/arcgis-scrape', { method: 'POST' });
      const json = await r.json();
      pre.textContent = JSON.stringify(json, null, 2);
      pre.style.display = 'block';
    } catch (e) {
      pre.textContent = JSON.stringify({ ok: false, error: e.message }, null, 2);
      pre.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lancer le scraping';
    }
  });
});
