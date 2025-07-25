const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function splitFloraGallica() {
  const tocPath = path.join('assets', 'flora_gallica_toc.json');
  const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
  const byPdf = {};
  for (const [genus, entry] of Object.entries(toc)) {
    if (!entry.pdfFile || !entry.page) continue;
    const file = entry.pdfFile;
    if (!byPdf[file]) byPdf[file] = [];
    byPdf[file].push({ genus, page: entry.page });
  }
  await fs.promises.mkdir(path.join('assets', 'flora_gallica_segments'), { recursive: true });
  for (const [pdfFile, entries] of Object.entries(byPdf)) {
    const pdfPath = path.join('assets', 'flora_gallica_pdfs', pdfFile);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    entries.sort((a, b) => a.page - b.page);
    for (let i = 0; i < entries.length; i++) {
      const start = entries[i].page;
      const end = i + 1 < entries.length ? entries[i + 1].page - 1 : pdfDoc.getPageCount();
      const pages = [];
      for (let p = start - 1; p < end; p++) pages.push(p);
      const newPdf = await PDFDocument.create();
      const copied = await newPdf.copyPages(pdfDoc, pages);
      copied.forEach(pg => newPdf.addPage(pg));
      const outBytes = await newPdf.save();
      const genusKey = entries[i].genus.toLowerCase();
      const outPath = path.join('assets', 'flora_gallica_segments', `${genusKey}.pdf`);
      fs.writeFileSync(outPath, outBytes);
      console.log('Created', outPath, `pages ${start}-${end}`);
    }
  }
}

splitFloraGallica().catch(err => {
  console.error(err);
  process.exit(1);
});
