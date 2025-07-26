const fs = require('fs');
const { loadOcrHandler } = require('../test-utils');

describe('ocr-pdf handler', () => {
  jest.setTimeout(20000);
  test('rejects non-POST', async () => {
    const handler = loadOcrHandler();
    const res = await handler({ httpMethod: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  test('extracts text from pdf', async () => {
    const handler = loadOcrHandler();
    const pdf = fs.readFileSync('assets/WMS WFS Contexte éco/transfertSIG.pdf');
    const res = await handler({
      httpMethod: 'POST',
      body: JSON.stringify({ pdfBase64: pdf.toString('base64') })
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.text).toMatch(/Description des couches/);
  });
});
