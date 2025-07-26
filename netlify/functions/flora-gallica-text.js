const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');

function looksBinary(str) {
  return /[\x00-\x08]/.test(str);
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let pdfFile, startPage, genus;
  try {
    ({ pdfFile, startPage, genus } = JSON.parse(event.body));
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }
  if (!pdfFile || !startPage || !genus) {
    return { statusCode: 400, body: 'Missing parameters' };
  }

  try {
    const pdfPath = path.join(__dirname, 'flora_gallica_pdfs', pdfFile);
    const pdfBytes = fs.readFileSync(pdfPath);

    const tocPath = path.join(__dirname, '..', '..', 'assets', 'flora_gallica_toc.json');
    const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
    const pages = Object.values(toc)
      .filter(e => e.pdfFile === pdfFile)
      .map(e => e.page)
      .sort((a, b) => a - b);

    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();
    let endPage = totalPages;
    for (const p of pages) {
      if (p > startPage) { endPage = p; break; }
    }

    const subDoc = await PDFDocument.create();
    for (let p = startPage; p <= endPage; p++) {
      const [pg] = await subDoc.copyPages(srcDoc, [p - 1]);
      subDoc.addPage(pg);
    }
    const subBytes = await subDoc.save();

    let text = '';
    try {
      text = (await pdfParse(subBytes)).text;
      if (!text || looksBinary(text)) throw new Error('no text');
    } catch (err) {
      const worker = await createWorker('fra+lat');
      await worker.loadLanguage('fra+lat');
      await worker.initialize('fra+lat');
      const pdfjs = require('pdfjs-dist');
      const { getDocument } = pdfjs;
      const { createCanvas } = require('canvas');
      const doc = await getDocument({ data: subBytes }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const { data: { text: pageText } } = await worker.recognize(canvas.toBuffer());
        text += pageText + '\n\n';
      }
      await worker.terminate();
    }

    const outPath = path.join(__dirname, `FloraGallica_${genus}.txt`);
    fs.writeFileSync(outPath, text, 'utf8');
    const fileBuffer = fs.readFileSync(outPath);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename=FloraGallica_${genus}.txt`
      },
      body: fileBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error('flora-gallica-text error', err);
    return { statusCode: 500, body: 'Server error' };
  }
};
