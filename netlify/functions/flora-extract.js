const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

exports.handler = async function(event) {
  const genus = (event.queryStringParameters && event.queryStringParameters.genus || '').toLowerCase();
  if (!genus) {
    return { statusCode: 400, body: 'Missing genus parameter' };
  }
  try {
    const tocPath = path.join(__dirname, '../../assets/flora_gallica_toc.json');
    const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
    const entry = toc[genus];
    if (!entry || !entry.pdfFile || !entry.page) {
      return { statusCode: 404, body: 'Genus not found' };
    }

    const pdfPath = path.join(__dirname, '../../assets/flora_gallica_pdfs', entry.pdfFile);
    const srcBytes = fs.readFileSync(pdfPath);
    const srcDoc = await PDFDocument.load(srcBytes);

    const allEntries = Object.entries(toc)
      .filter(([,v]) => v.pdfFile === entry.pdfFile)
      .sort((a,b) => a[1].page - b[1].page);
    let endPage = srcDoc.getPageCount();
    for (let i=0;i<allEntries.length;i++) {
      if (allEntries[i][0] === genus) {
        if (i+1 < allEntries.length) endPage = allEntries[i+1][1].page - 1;
        break;
      }
    }
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, Array.from({length: endPage - entry.page + 1}, (_,i) => i + entry.page - 1));
    pages.forEach(p => newDoc.addPage(p));
    const newBytes = await newDoc.save();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/pdf' },
      body: Buffer.from(newBytes).toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('flora-extract error:', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
