const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

exports.handler = async function(event) {
  const genus = (event.queryStringParameters && event.queryStringParameters.genus || '').toLowerCase();
  if (!genus) {
    return { statusCode: 400, body: 'Missing genus parameter' };
  }

  const tocPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_toc.json');
  const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
  const entry = toc[genus];
  if (!entry) {
    return { statusCode: 404, body: 'Genus not found' };
  }

  const keys = Object.keys(toc).sort((a,b) => a.localeCompare(b));
  const idx = keys.indexOf(genus);
  let endPage;
  for (let i = idx + 1; i < keys.length; i++) {
    const next = toc[keys[i]];
    if (next.pdfFile === entry.pdfFile) {
      endPage = next.page - 1;
      break;
    }
  }
  const pdfPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_pdfs', entry.pdfFile);
  const srcBytes = fs.readFileSync(pdfPath);
  const srcDoc = await PDFDocument.load(srcBytes);
  if (!endPage || endPage > srcDoc.getPageCount()) {
    endPage = srcDoc.getPageCount();
  }
  const newDoc = await PDFDocument.create();
  for (let p = entry.page; p <= endPage; p++) {
    const [copied] = await newDoc.copyPages(srcDoc, [p - 1]);
    newDoc.addPage(copied);
  }
  const bytes = await newDoc.save();
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${genus}.pdf"`
    },
    body: Buffer.from(bytes).toString('base64'),
    isBase64Encoded: true
  };
};
