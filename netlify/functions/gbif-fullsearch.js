const fetch = require('./utils/fetch');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const geometry = params.geometry;
  if (!geometry) {
    return { statusCode: 400, body: 'Missing geometry parameter' };
  }

  const limit = 300;
  const baseUrl = 'https://api.gbif.org/v1/occurrence/search';
  try {
    const metaResp = await fetch(`${baseUrl}?limit=1&geometry=${encodeURIComponent(geometry)}&kingdomKey=6`);
    if (!metaResp.ok) throw new Error('Failed to fetch count');
    const meta = await metaResp.json();
    const totalPages = Math.ceil(meta.count / limit);
    const batchSize = 20;
    const tempFiles = [];

    for (let start = 0; start < totalPages; start += batchSize) {
      const end = Math.min(totalPages, start + batchSize);
      let batchResults = [];
      for (let page = start; page < end; page++) {
        const offset = page * limit;
        const url = `${baseUrl}?limit=${limit}&offset=${offset}&geometry=${encodeURIComponent(geometry)}&kingdomKey=6`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch page');
        const data = await resp.json();
        if (Array.isArray(data.results)) batchResults.push(...data.results);
      }
      const file = path.join(os.tmpdir(), `gbif_batch_${tempFiles.length + 1}.json`);
      await fs.writeFile(file, JSON.stringify(batchResults), 'utf8');
      tempFiles.push(file);
      batchResults = null;
    }

    let allResults = [];
    for (const f of tempFiles) {
      const content = await fs.readFile(f, 'utf8');
      allResults.push(...JSON.parse(content));
      await fs.unlink(f).catch(() => {});
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: allResults })
    };
  } catch (err) {
    console.error('gbif-fullsearch error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
