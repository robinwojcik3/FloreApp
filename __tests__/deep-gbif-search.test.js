const { loadDeepGbifHandler } = require('../test-utils');

describe('deep gbif search handler', () => {
  test('aggregates all pages', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 3 }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [{ id: 1 }] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [{ id: 2 }] }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [{ id: 3 }] }) });
    const handler = loadDeepGbifHandler(fetchMock);
    const res = await handler({ queryStringParameters: { geometry: 'POLYGON()' } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test('returns 400 without geometry', async () => {
    const handler = loadDeepGbifHandler(jest.fn());
    const res = await handler({ queryStringParameters: {} });
    expect(res.statusCode).toBe(400);
  });
});
