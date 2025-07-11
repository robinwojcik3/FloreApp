const fetch = require('./utils/fetch');
const fs = require('fs');
const path = require('path');

const LIMIT = 300;
const BATCH_SIZE = 20;
const RETRIES = 3;
const RETRY_DELAY = 1000;

async function fetchJson(url) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText || 'request failed');
      return await res.json();
    } catch (err) {
      if (attempt === RETRIES) throw err;
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
}

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const geometry = params.geometry;
  if (!geometry) return { statusCode: 400, body: 'Missing geometry parameter' };
  const kingdomKey = params.kingdomKey || '6';
  const taxonKey = params.taxonKey;

  const baseSearch = () => {
    const url = new URL('https://api.gbif.org/v1/occurrence/search');
    url.searchParams.set('geometry', geometry);
    if (taxonKey) url.searchParams.set('taxonKey', taxonKey);
    else url.searchParams.set('kingdomKey', kingdomKey);
    return url;
  };

  try {
    const firstUrl = baseSearch();
    firstUrl.searchParams.set('limit', '1');
    const first = await fetchJson(firstUrl.toString());
    const count = first.count || 0;
    const totalPages = Math.ceil(count / LIMIT);

    const batchFiles = [];
    for (let start = 0, batch = 1; start < totalPages; start += BATCH_SIZE, batch++) {
      let all = [];
      for (let p = start; p < Math.min(start + BATCH_SIZE, totalPages); p++) {
        const url = baseSearch();
        url.searchParams.set('limit', LIMIT.toString());
        url.searchParams.set('offset', (p * LIMIT).toString());
        const data = await fetchJson(url.toString());
        if (Array.isArray(data.results)) all = all.concat(data.results);
      }
      const file = path.join('/tmp', `gbif_batch_${batch}.json`);
      fs.writeFileSync(file, JSON.stringify(all));
      batchFiles.push(file);
      all = null;
    }

    let finalResults = [];
    for (const f of batchFiles) {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      finalResults = finalResults.concat(data);
      fs.unlinkSync(f);
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalResults) };
  } catch (err) {
    console.error('deep-search error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
