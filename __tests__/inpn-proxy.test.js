const { loadHandler, mockFetch } = require('../test-utils');

describe('inpn-proxy handler', () => {
  test('extracts canvas for carte type', async () => {
    const html = '<html><body><canvas class="ol-unselectable"></canvas></body></html>';
    const fetchMock = mockFetch(html);
    const handler = loadHandler(fetchMock);
    const res = await handler({ queryStringParameters: { cd: '1', type: 'carte' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('<canvas class="ol-unselectable"></canvas>');
  });

  test('returns 404 when fragment missing', async () => {
    const html = '<html><body></body></html>';
    const fetchMock = mockFetch(html);
    const handler = loadHandler(fetchMock);
    const res = await handler({ queryStringParameters: { cd: '1', type: 'statut' } });
    expect(res.statusCode).toBe(404);
  });

  test('returns 400 for unsupported type', async () => {
    const fetchMock = mockFetch('');
    const handler = loadHandler(fetchMock);
    const res = await handler({ queryStringParameters: { cd: '1', type: 'foo' } });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 when cd is missing', async () => {
    const fetchMock = mockFetch('');
    const handler = loadHandler(fetchMock);
    const res = await handler({ queryStringParameters: { type: 'carte' } });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 when type parameter missing', async () => {
    const fetchMock = mockFetch('');
    const handler = loadHandler(fetchMock);
    const res = await handler({ queryStringParameters: {} });
    expect(res.statusCode).toBe(400);
  });

  test('proxies WMS requests', async () => {
    const binary = Buffer.from('abc');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      buffer: () => Promise.resolve(binary)
    });
    const handler = loadHandler(fetchMock);
    const res = await handler({
      rawQuery: 'service=WMS&LAYERS=foo',
      queryStringParameters: { service: 'WMS' },
      headers: {}
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.isBase64Encoded).toBe(true);
    expect(res.body).toBe(binary.toString('base64'));
  });
});
