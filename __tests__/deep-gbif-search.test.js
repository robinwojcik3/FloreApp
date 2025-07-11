const { loadDeepGbifHandler } = require('../test-utils');

describe('deep-gbif-search handler', () => {
  test('fetches all pages in batches', async () => {
    const responses = [
      { ok: true, json: () => Promise.resolve({ count: 450 }) },
      { ok: true, json: () => Promise.resolve({ results: [{ id: 1 }] }) },
      { ok: true, json: () => Promise.resolve({ results: [{ id: 2 }] }) }
    ];
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(responses[2]);
    const files = {};
    const fsMock = {
      writeFileSync: (p, d) => { files[p] = d; },
      readFileSync: p => files[p],
      unlinkSync: p => { delete files[p]; }
    };
    const handler = loadDeepGbifHandler(fetchMock, fsMock);
    const res = await handler({ queryStringParameters: { geometry: 'POLYGON()' } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('limit=1');
    expect(fetchMock.mock.calls[1][0]).toContain('offset=0');
    expect(fetchMock.mock.calls[2][0]).toContain('offset=300');
    expect(JSON.parse(res.body).length).toBe(2);
    expect(Object.keys(files).length).toBe(0);
  });
});
