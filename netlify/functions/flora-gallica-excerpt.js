const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

exports.handler = async function(event) {
  const { file, start, end } = event.queryStringParameters || {};
  if (!file || !start) {
    return { statusCode: 400, body: 'Missing file or start parameter' };
  }
  const startPage = parseInt(start, 10);
  const endPage = end ? parseInt(end, 10) : undefined;
  if (isNaN(startPage) || (end && isNaN(endPage))) {
    return { statusCode: 400, body: 'Invalid page numbers' };
  }

  try {
    const pdfPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_pdfs', file);
    if (!fs.existsSync(pdfPath)) {
      return { statusCode: 404, body: 'PDF not found' };
    }
    const data = fs.readFileSync(pdfPath);
    const srcDoc = await PDFDocument.load(data);
    const total = srcDoc.getPageCount();
    const endPg = endPage && endPage <= total ? endPage : total;
    if (startPage < 1 || startPage > total) {
      return { statusCode: 400, body: 'Start page out of range' };
    }

    const newDoc = await PDFDocument.create();
    for (let i = startPage - 1; i < endPg; i++) {
      const [page] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(page);
    }
    const bytes = await newDoc.save();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/pdf' },
      body: Buffer.from(bytes).toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('Excerpt generation error', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
