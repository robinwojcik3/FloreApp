const { loadFloraGallicaHandler } = require('../test-utils');
const { PDFDocument } = require('pdf-lib');

describe('flora-gallica handler', () => {
  test('returns 400 when genus missing', async () => {
    const handler = loadFloraGallicaHandler();
    const res = await handler({ httpMethod: 'GET', queryStringParameters: {} });
    expect(res.statusCode).toBe(400);
  });

  test('returns 404 for unknown genus', async () => {
    const handler = loadFloraGallicaHandler();
    const res = await handler({ httpMethod: 'GET', queryStringParameters: { genus: 'Foo' } });
    expect(res.statusCode).toBe(404);
  });

  test('extracts correct page range', async () => {
    const handler = loadFloraGallicaHandler();
    const res = await handler({ httpMethod: 'GET', queryStringParameters: { genus: 'Lamium' } });
    expect(res.statusCode).toBe(200);
    expect(res.isBase64Encoded).toBe(true);
    const bytes = Buffer.from(res.body, 'base64');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });
});
