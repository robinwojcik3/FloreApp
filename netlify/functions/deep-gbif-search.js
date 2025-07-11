const fetch = require('./utils/fetch');
const fs = require('fs');

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const geometry = params.geometry;
  if (!geometry) {
    return { statusCode: 400, body: 'Missing geometry parameter' };
  }
  const limit = 300;
  const batchSize = 20;
  const baseUrl = 'https://api.gbif.org/v1/occurrence/search';
  const firstUrl = `${baseUrl}?limit=1&geometry=${encodeURIComponent(geometry)}&kingdomKey=6`;
  try {
    const firstResp = await fetch(firstUrl);
    if (!firstResp.ok) {
      return { statusCode: firstResp.status, body: 'GBIF error' };
    }
    const firstData = await firstResp.json();
    const count = firstData.count || 0;
    const totalPages = Math.ceil(count / limit);
    const tempFiles = [];
    for (let start = 0; start < totalPages; start += batchSize) {
      const end = Math.min(start + batchSize, totalPages);
      let batch = [];
      for (let page = start; page < end; page++) {
        const offset = page * limit;
        const url = `${baseUrl}?limit=${limit}&offset=${offset}&geometry=${encodeURIComponent(geometry)}&kingdomKey=6`;
        const resp = await fetch(url);
        if (!resp.ok) return { statusCode: resp.status, body: 'GBIF error' };
        const data = await resp.json();
        if (Array.isArray(data.results)) batch = batch.concat(data.results);
      }
      const file = `/tmp/gbif_batch_${tempFiles.length + 1}.json`;
      fs.writeFileSync(file, JSON.stringify(batch));
      tempFiles.push(file);
      batch = null;
    }
    let all = [];
    for (const file of tempFiles) {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      all = all.concat(content);
      fs.unlinkSync(file);
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all) };
  } catch (err) {
    console.error('deep gbif search error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
