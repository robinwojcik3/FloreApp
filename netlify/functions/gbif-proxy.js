const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async function(event) {
    try {
        const path = event.path.replace('/.netlify/functions/gbif-proxy', '');
        const query = event.rawQuery ? `?${event.rawQuery}` : '';
        const url = `https://api.gbif.org${path}${query}`;
        const resp = await fetch(url);
        const body = await resp.text();
        return {
            statusCode: resp.status,
            headers: { 'Content-Type': resp.headers.get('content-type') || 'application/json' },
            body
        };
    } catch (err) {
        console.error('gbif-proxy error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: 'Proxy fetch error' }) };
    }
};
