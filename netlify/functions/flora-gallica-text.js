const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');

function execPromise(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) reject(err); else resolve(stdout);
    });
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let params;
  try {
    params = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { pdfFile, startPage, endPage, genus } = params;
  if (!pdfFile || !startPage || !endPage || !genus) {
    return { statusCode: 400, body: 'Missing parameters' };
  }

  try {
    const pdfPath = path.join(__dirname, '../../assets/flora_gallica_pdfs', pdfFile);
    const bytes = fs.readFileSync(pdfPath);
    const srcDoc = await PDFDocument.load(bytes);
    const last = Math.min(endPage, srcDoc.getPageCount());

    const newDoc = await PDFDocument.create();
    for (let p = startPage; p <= last; p++) {
      const [pg] = await newDoc.copyPages(srcDoc, [p - 1]);
      newDoc.addPage(pg);
    }
    const subsetBytes = await newDoc.save({ useObjectStreams: false });
    const tmpPdf = path.join(os.tmpdir(), `flora_${Date.now()}.pdf`);
    fs.writeFileSync(tmpPdf, subsetBytes);

    let text = '';
    try {
      const data = await pdfParse(fs.readFileSync(tmpPdf));
      text = data.text.trim();
    } catch {
      text = '';
    }
    const gibberish = /[\x00-\x08\x0E-\x1F]/.test(text);

    if (!text || gibberish) {
      const prefix = path.join(os.tmpdir(), `flora_${Date.now()}`);
      await execPromise('pdftoppm', ['-png', tmpPdf, prefix, '-r', '300']);
      let page = 1;
      const parts = [];
      while (true) {
        const img = `${prefix}-${page}.png`;
        if (!fs.existsSync(img)) break;
        const ocr = await execPromise('tesseract', [img, 'stdout', '-l', 'fra+lat', '--dpi', '300']);
        parts.push(ocr.trim());
        fs.unlinkSync(img);
        page++;
      }
      text = parts.join('\n');
    }

    const txtName = `FloraGallica_${genus}.txt`;
    const outPath = path.join(os.tmpdir(), txtName);
    fs.writeFileSync(outPath, text, 'utf8');
    const buf = fs.readFileSync(outPath);

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${txtName}"`
      },
      body: buf.toString('base64')
    };
  } catch (err) {
    console.error('flora-gallica-text error', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};

