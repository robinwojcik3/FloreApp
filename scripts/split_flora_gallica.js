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

async function loadToc() {
  const tocPath = path.join('assets', 'flora_gallica_toc.json');
  return JSON.parse(fs.readFileSync(tocPath, 'utf8'));
}

async function splitPdf(pdfPath, entries) {
  const data = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(data);

  // sort entries by start page
  entries.sort((a, b) => a.page - b.page);
  for (let i = 0; i < entries.length; i++) {
    const { genus, page } = entries[i];
    const endPage = (i + 1 < entries.length) ? entries[i + 1].page - 1 : pdfDoc.getPageCount();
    const newPdf = await PDFDocument.create();
    for (let p = page; p <= endPage; p++) {
      const [copied] = await newPdf.copyPages(pdfDoc, [p - 1]);
      newPdf.addPage(copied);
    }
    const outDir = path.join('assets', 'flora_gallica_segments');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${genus}.pdf`);
    fs.writeFileSync(outPath, await newPdf.save());
    console.log(`Written ${outPath} (pages ${page}-${endPage})`);
  }
}

async function main() {
  const toc = await loadToc();
  const byPdf = {};
  for (const [genus, info] of Object.entries(toc)) {
    if (!byPdf[info.pdfFile]) byPdf[info.pdfFile] = [];
    byPdf[info.pdfFile].push({ genus: norm(genus), page: info.page });
  }
  for (const [pdfFile, entries] of Object.entries(byPdf)) {
    const pdfPath = path.join('assets', 'flora_gallica_pdfs', pdfFile);
    if (!fs.existsSync(pdfPath)) {
      console.warn(`Missing PDF ${pdfPath}`);
      continue;
    }
    await splitPdf(pdfPath, entries);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
