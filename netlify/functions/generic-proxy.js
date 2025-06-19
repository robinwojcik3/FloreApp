const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async function(event) {
  try {
    const params = event.queryStringParameters || {};
    const targetService = params.targetService;
    if (!targetService) {
      return { statusCode: 400, body: 'Missing targetService parameter' };
    }
    const query = { ...params };
    delete query.targetService;
    const search = new URLSearchParams(query).toString();
    const finalUrl = targetService + (search ? `?${search}` : '');

    const response = await fetch(finalUrl);
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();
    if (!response.ok) {
      return { statusCode: response.status, body: buffer.toString() };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('Generic proxy error', err);
    return { statusCode: 500, body: 'Internal server error' };
  }
};
