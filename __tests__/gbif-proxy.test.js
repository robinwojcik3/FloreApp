const { loadGbifHandler } = require('../test-utils');

describe('gbif-proxy handler', () => {
  test('forwards request to GBIF', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve('{"ok":true}')
    });
    const handler = loadGbifHandler(fetchMock);
    const res = await handler({
      path: '/.netlify/functions/gbif-proxy/v1/species/match',
      rawQuery: 'name=Abies%20alba',
      queryStringParameters: { name: 'Abies alba' }
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.gbif.org/v1/species/match?name=Abies%20alba');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"ok":true}');
  });
});
