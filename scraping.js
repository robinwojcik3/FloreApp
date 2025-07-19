document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('scrape-btn');
  const output = document.getElementById('scrape-output');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Exécution…';
    output.textContent = '';
    try {
      const r = await fetch('/.netlify/functions/arcgis-scrape', { method: 'POST' });
      const json = await r.json();
      output.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      output.textContent = JSON.stringify({ ok: false, error: e.message }, null, 2);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lancer le scraping';
    }
  });
});
