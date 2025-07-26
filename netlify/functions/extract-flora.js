const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

function norm(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function buildSortedEntries(toc, file) {
  const list = [];
  for (const [gen, data] of Object.entries(toc)) {
    if (data.pdfFile === file) list.push({ genus: gen, page: data.page });
  }
  list.sort((a, b) => a.page - b.page);
  return list;
}

exports.handler = async (event) => {
  const genusParam = event.queryStringParameters && event.queryStringParameters.genus;
  if (!genusParam) {
    return { statusCode: 400, body: 'Missing genus parameter' };
  }

  const genus = norm(genusParam);
  const tocPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_toc.json');
  const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
  const entry = toc[genus];
  if (!entry) {
    return { statusCode: 404, body: 'Genus not found' };
  }

  const pdfPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_pdfs', entry.pdfFile);
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const entries = buildSortedEntries(toc, entry.pdfFile);
  let endPage = pdfDoc.getPageCount();
  for (const e of entries) {
    if (e.page > entry.page) {
      endPage = e.page - 1;
      break;
    }
  }

  const newPdf = await PDFDocument.create();
  const pages = await newPdf.copyPages(pdfDoc, Array.from({ length: endPage - entry.page + 1 }, (_, i) => entry.page - 1 + i));
  for (const p of pages) newPdf.addPage(p);
  const newBytes = await newPdf.save();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/pdf' },
    body: Buffer.from(newBytes).toString('base64'),
    isBase64Encoded: true
  };
};

