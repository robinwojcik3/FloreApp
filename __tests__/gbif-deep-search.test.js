const { loadDeepGbifHandler } = require('../test-utils');

describe('gbif-deep-search handler', () => {
  test('returns all pages', async () => {
    const results1 = [{ id: 1 }];
    const results2 = [{ id: 2 }];
    let call = 0;
    const fetchMock = jest.fn(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ count: 2 }) });
      }
      if (call === 2) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: results1 }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: results2 }) });
    });
    const handler = loadDeepGbifHandler(fetchMock);
    const res = await handler({ queryStringParameters: { geometry: 'POLYGON(())' } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([...results1, ...results2]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
