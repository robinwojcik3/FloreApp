const { promisify } = require('util');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const exec = promisify(execFile);

exports.handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let base64Pdf;
  try {
    ({ base64Pdf } = JSON.parse(event.body));
  } catch (err) {
    console.error('Invalid JSON body for pdf-ocr:', err);
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (!base64Pdf) {
    return { statusCode: 400, body: 'Missing base64Pdf' };
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-ocr-'));
  const pdfPath = path.join(tmpDir, 'input.pdf');
  fs.writeFileSync(pdfPath, Buffer.from(base64Pdf, 'base64'));

  try {
    await exec('pdftoppm', ['-png', pdfPath, path.join(tmpDir, 'page')]);
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort();
    let text = '';
    for (const file of files) {
      const { stdout } = await exec('tesseract', [path.join(tmpDir, file), 'stdout', '-l', 'fra+eng', '--psm', '3']);
      text += stdout.trim() + '\n';
    }
    fs.writeFileSync(path.join(tmpDir, 'output.txt'), text, 'utf8');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    console.error('OCR processing failed:', err);
    return { statusCode: 500, body: 'OCR processing error' };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
