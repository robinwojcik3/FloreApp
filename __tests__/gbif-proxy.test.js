const { loadGbifHandler } = require('../test-utils');

function createMockFetch(body) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body)
  });
}

describe('gbif-proxy handler', () => {
  test('calls correct endpoint', async () => {
    const fetchMock = createMockFetch('{"ok":true}');
    const handler = loadGbifHandler(fetchMock);
    const res = await handler({ queryStringParameters: { endpoint: 'match', name: 'Acer' } });
    expect(fetchMock).toHaveBeenCalledWith('https://api.gbif.org/v1/species/match?name=Acer');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('{"ok":true}');
  });

  test('synonyms endpoint uses taxonKey', async () => {
    const fetchMock = createMockFetch('{"ok":true}');
    const handler = loadGbifHandler(fetchMock);
    const res = await handler({ queryStringParameters: { endpoint: 'synonyms', taxonKey: '123' } });
    expect(fetchMock).toHaveBeenCalledWith('https://api.gbif.org/v1/species/123/synonyms');
    expect(res.statusCode).toBe(200);
  });

  test('returns 400 for invalid endpoint', async () => {
    const fetchMock = createMockFetch('{}');
    const handler = loadGbifHandler(fetchMock);
    const res = await handler({ queryStringParameters: { endpoint: 'foo' } });
    expect(res.statusCode).toBe(400);
  });
});
