const { loadGbifFullHandler } = require('../test-utils');

function createMockFetch(responses) {
  let call = 0;
  return jest.fn().mockImplementation(() => {
    const body = responses[call++] || responses[responses.length - 1];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
}

describe('gbif-fullsearch handler', () => {
  test('aggregates all pages', async () => {
    const count = 3;
    const resp1 = { count, results: [{ id: 1 }] };
    const resp2 = { results: [{ id: 2 }] };
    const resp3 = { results: [{ id: 3 }] };
    const fetchMock = createMockFetch([resp1, resp2, resp3]);
    const handler = loadGbifFullHandler(fetchMock);
    const res = await handler({ queryStringParameters: { geometry: 'POLYGON' } });
    const body = JSON.parse(res.body);
    expect(body.results.length).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
