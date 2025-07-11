const fetch = require('./utils/fetch');
const { promises: fs } = require('fs');
const os = require('os');
const path = require('path');

const LIMIT = 300;
const BATCH_SIZE = 20;
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await delay(RETRY_DELAY);
    }
  }
}

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const base = new URL('https://api.gbif.org/v1/occurrence/search');
  for (const [k, v] of Object.entries(params)) {
    base.searchParams.append(k, v);
  }
  base.searchParams.set('limit', '1');
  try {
    const resp = await fetchWithRetry(base.toString());
    const first = await resp.json();
    const count = first.count || 0;
    const totalPages = Math.ceil(count / LIMIT);
    const tempDir = os.tmpdir();
    const batchFiles = [];
    for (let start = 0, batchIdx = 1; start < totalPages; start += BATCH_SIZE, batchIdx++) {
      const batchResults = [];
      for (let p = start; p < Math.min(start + BATCH_SIZE, totalPages); p++) {
        const pageUrl = new URL('https://api.gbif.org/v1/occurrence/search');
        for (const [k, v] of Object.entries(params)) pageUrl.searchParams.append(k, v);
        pageUrl.searchParams.set('limit', String(LIMIT));
        pageUrl.searchParams.set('offset', String(p * LIMIT));
        const pageResp = await fetchWithRetry(pageUrl.toString());
        const pageData = await pageResp.json();
        if (Array.isArray(pageData.results)) batchResults.push(...pageData.results);
      }
      const file = path.join(tempDir, `gbif_batch_${batchIdx}.json`);
      await fs.writeFile(file, JSON.stringify(batchResults));
      batchFiles.push(file);
    }
    let finalResults = [];
    for (const file of batchFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        finalResults = finalResults.concat(JSON.parse(content));
        await fs.unlink(file);
      } catch (e) {
        console.error('Failed to process', file, e);
      }
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalResults) };
  } catch (err) {
    console.error('deep gbif search error:', err);
    return { statusCode: 500, body: 'Deep GBIF search failed' };
  }
};
