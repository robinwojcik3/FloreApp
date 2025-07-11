const { loadAuraHandler, mockFetch } = require('../test-utils');

describe('aura-images handler', () => {
  test('converts relative urls to absolute', async () => {
    const html = '<img src="/img/pic1.jpg"><img src="http://example.com/pic2.png">';
    const fetchMock = mockFetch(html);
    const handler = loadAuraHandler(fetchMock);
    const res = await handler({ queryStringParameters: { cd: '42' } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.images).toEqual([
      'https://atlas.biodiversite-auvergne-rhone-alpes.fr/img/pic1.jpg',
      'http://example.com/pic2.png'
    ]);
  });

  test('filters out logo images', async () => {
    const html = '<img src="/img/logo.png"><img src="/photos/plant1.jpg">';
    const fetchMock = mockFetch(html);
    const handler = loadAuraHandler(fetchMock);
    const res = await handler({ queryStringParameters: { cd: '1' } });
    const body = JSON.parse(res.body);
    expect(body.images).toEqual([
      'https://atlas.biodiversite-auvergne-rhone-alpes.fr/photos/plant1.jpg'
    ]);
  });
});
