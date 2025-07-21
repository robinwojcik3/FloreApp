const fetch = require('./utils/fetch');
const { URL } = require('url');

const ENDPOINTS = {
  match: 'https://api.gbif.org/v1/species/match',
  search: 'https://api.gbif.org/v1/occurrence/search',
  synonyms: (id) => `https://api.gbif.org/v1/species/${id}/synonyms`
};

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const endpoint = params.endpoint;
  if (!endpoint || !ENDPOINTS[endpoint]) {
    return { statusCode: 400, body: 'Invalid or missing endpoint' };
  }

  let url;
  if (endpoint === 'synonyms') {
    const id = params.taxonKey;
    if (!id) {
      return { statusCode: 400, body: 'Missing taxonKey' };
    }
    url = new URL(ENDPOINTS.synonyms(id));
  } else {
    url = new URL(ENDPOINTS[endpoint]);
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'endpoint') url.searchParams.append(key, value);
    }
  }

  try {
    const resp = await fetch(url.toString());
    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json' },
      body
    };
  } catch (err) {
    console.error('GBIF proxy error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
