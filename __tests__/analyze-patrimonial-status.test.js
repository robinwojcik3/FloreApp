const { loadAnalyzeHandler } = require('../test-utils');

describe('analyze-patrimonial-status handler', () => {
  test('rejects non-POST requests', async () => {
    const handler = loadAnalyzeHandler(jest.fn(), { GEMINI_API_KEY: 'x' });
    const res = await handler({ httpMethod: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  test('returns 400 for invalid JSON', async () => {
    const handler = loadAnalyzeHandler(jest.fn(), { GEMINI_API_KEY: 'x' });
    const res = await handler({ httpMethod: 'POST', body: '{' });
    expect(res.statusCode).toBe(400);
  });

  test('returns patrimonial map on success', async () => {
    const fetchMock = jest.fn((url) => {
      if (url.startsWith('https://geo.api.gouv.fr')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ departement: { code: '42' }, region: { code: '84' } }])
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '{"Abies alba":["protégée"]}' }] } }] })
      });
    });
    const handler = loadAnalyzeHandler(fetchMock, { GEMINI_API_KEY: 'abc' });
    const body = { relevantRules: [], uniqueSpeciesNames: ['Abies alba'], coords: { latitude: 1, longitude: 2 } };
    const res = await handler({ httpMethod: 'POST', body: JSON.stringify(body) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ 'Abies alba': ['protégée'] });
  });
});
