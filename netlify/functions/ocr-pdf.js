const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    if (!pdfBase64) {
      return { statusCode: 400, body: 'Missing pdfBase64' };
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const timestamp = Date.now();
    const inputPath = path.join('/tmp', `ocr-${timestamp}.pdf`);
    const prefix = path.join('/tmp', `ocr-${timestamp}`);
    await fs.writeFile(inputPath, pdfBuffer);

    await execAsync(`pdftoppm "${inputPath}" "${prefix}" -png`);

    const dirFiles = await fs.readdir('/tmp');
    const pageFiles = dirFiles.filter(f => f.startsWith(path.basename(prefix)) && f.endsWith('.png'));
    let fullText = '';
    for (const file of pageFiles) {
      const pngPath = path.join('/tmp', file);
      const outBase = pngPath.slice(0, -4);
      await execAsync(`tesseract "${pngPath}" "${outBase}" -l fra`);
      const txt = await fs.readFile(`${outBase}.txt`, 'utf8');
      fullText += txt + '\n';
      await fs.unlink(pngPath);
      await fs.unlink(`${outBase}.txt`);
    }
    await fs.unlink(inputPath);
    return { statusCode: 200, body: JSON.stringify({ text: fullText.trim() }) };
  } catch (err) {
    console.error('OCR processing failed:', err);
    return { statusCode: 500, body: 'OCR processing failed' };
  }
};
