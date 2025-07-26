const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const pdfParse = require('pdf-parse');
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  const { pdfData, genus } = body;
  if (!pdfData || !genus) {
    return { statusCode: 400, body: 'Missing parameters' };
  }
  const pdfBuffer = Buffer.from(pdfData, 'base64');

  let text = '';
  try {
    const parsed = await pdfParse(pdfBuffer);
    text = parsed.text.trim();
  } catch (err) {
    text = '';
  }

  const looksBad = !text || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text.slice(0, 16));

  if (looksBad) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flora-'));
    const pdfPath = path.join(tmpDir, 'input.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    const imgPrefix = path.join(tmpDir, 'page');
    await run('pdftoppm', ['-png', '-r', '300', pdfPath, imgPrefix]);
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('page') && f.endsWith('.png')).sort();
    let ocrText = '';
    for (const file of files) {
      const base = path.join(tmpDir, path.parse(file).name);
      await run('tesseract', [path.join(tmpDir, file), base, '-l', 'fra+lat']);
      ocrText += fs.readFileSync(base + '.txt', 'utf-8') + '\n';
    }
    text = ocrText.trim();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const finalPath = path.join(os.tmpdir(), `FloraGallica_${genus}.txt`);
  fs.writeFileSync(finalPath, text, 'utf-8');
  const fileContent = fs.readFileSync(finalPath);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename=FloraGallica_${genus}.txt`
    },
    body: fileContent.toString('utf-8')
  };
};
