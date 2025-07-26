const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const tocPath = path.join(__dirname, 'flora_gallica_toc.json');
const floraToc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));

function norm(txt) {
  if (typeof txt !== 'string') return '';
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

function getOrderedEntries() {
  return Object.entries(floraToc)
    .map(([genus, data]) => ({ genus, pdfFile: data.pdfFile, page: data.page }))
    .sort((a, b) => {
      if (a.pdfFile === b.pdfFile) return a.page - b.page;
      return a.pdfFile.localeCompare(b.pdfFile);
    });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const genusParam = event.queryStringParameters && event.queryStringParameters.genus;
  if (!genusParam) {
    return { statusCode: 400, body: 'Missing genus parameter' };
  }

  const key = norm(genusParam);
  const entry = floraToc[key];
  if (!entry) {
    return { statusCode: 404, body: 'Unknown genus' };
  }

  const ordered = getOrderedEntries();
  const idx = ordered.findIndex((e) => e.genus === key);
  let endPage;
  if (idx >= 0 && idx < ordered.length - 1 && ordered[idx + 1].pdfFile === entry.pdfFile) {
    endPage = ordered[idx + 1].page;
  } else {
    const pdfPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_pdfs', entry.pdfFile);
    const bytes = fs.readFileSync(pdfPath);
    const doc = await PDFDocument.load(bytes);
    endPage = doc.getPageCount() + 1;
  }

  const pdfPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_pdfs', entry.pdfFile);
  const bytes = fs.readFileSync(pdfPath);
  const srcDoc = await PDFDocument.load(bytes);
  const outDoc = await PDFDocument.create();
  for (let p = entry.page; p < endPage; p++) {
    const [page] = await outDoc.copyPages(srcDoc, [p - 1]);
    outDoc.addPage(page);
  }
  const outBytes = await outDoc.save();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${key}.pdf"`
    },
    body: Buffer.from(outBytes).toString('base64'),
    isBase64Encoded: true
  };
};
