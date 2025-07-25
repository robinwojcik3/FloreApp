const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const TOC_PATH = path.join(__dirname, '..', 'assets', 'flora_gallica_toc.json');
const PDF_DIR = path.join(__dirname, '..', 'assets', 'flora_gallica_pdfs');
const SEGMENT_DIR = path.join(__dirname, '..', 'assets', 'flora_gallica_segments');

function norm(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

async function splitFloraGallica() {
  if (!fs.existsSync(SEGMENT_DIR)) fs.mkdirSync(SEGMENT_DIR, { recursive: true });
  const toc = JSON.parse(fs.readFileSync(TOC_PATH, 'utf8'));
  const byPdf = {};
  for (const [genus, entry] of Object.entries(toc)) {
    if (!byPdf[entry.pdfFile]) byPdf[entry.pdfFile] = [];
    byPdf[entry.pdfFile].push({ genus, page: entry.page });
  }
  for (const [pdfFile, list] of Object.entries(byPdf)) {
    const pdfPath = path.join(PDF_DIR, pdfFile);
    const pdfData = await fs.promises.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfData);
    list.sort((a, b) => a.page - b.page);
    for (let i = 0; i < list.length; i++) {
      const { genus, page } = list[i];
      const endPage = i + 1 < list.length ? list[i + 1].page - 1 : pdfDoc.getPageCount();
      const newPdf = await PDFDocument.create();
      for (let p = page; p <= endPage; p++) {
        const [copied] = await newPdf.copyPages(pdfDoc, [p - 1]);
        newPdf.addPage(copied);
      }
      const bytes = await newPdf.save();
      await fs.promises.writeFile(path.join(SEGMENT_DIR, `${genus}.pdf`), bytes);
    }
  }
  console.log('Segmentation terminée.');
}

async function searchInGenus(genus, epithet) {
  const filePath = path.join(SEGMENT_DIR, `${genus}.pdf`);
  if (!fs.existsSync(filePath)) {
    console.error('Segment introuvable. Exécutez la commande split au préalable.');
    return;
  }
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(it => it.str).join(' ').toLowerCase();
    if (text.includes(epithet.toLowerCase())) {
      console.log(`Trouvé sur la page ${i}`);
      return i;
    }
  }
  console.log('Épithète introuvable dans ce segment.');
}

async function main() {
  const [,,cmd, arg1, arg2] = process.argv;
  if (cmd === 'split') {
    await splitFloraGallica();
  } else if (cmd === 'search') {
    if (!arg1 || !arg2) {
      console.log('Usage: node flora_gallica_utils.js search <genus> <epithet>');
      return;
    }
    await searchInGenus(norm(arg1), arg2);
  } else {
    console.log('Usage: node flora_gallica_utils.js <split|search> [args]');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
