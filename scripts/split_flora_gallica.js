const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function main() {
  const tocPath = path.join('assets', 'flora_gallica_toc.json');
  const toc = JSON.parse(fs.readFileSync(tocPath, 'utf8'));
  const outDir = path.join('assets', 'flora_gallica_segments');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const byPdf = {};
  for (const [genus, info] of Object.entries(toc)) {
    if (!byPdf[info.pdfFile]) byPdf[info.pdfFile] = [];
    byPdf[info.pdfFile].push({ genus, page: info.page });
  }

  const segmentToc = {};

  for (const [pdfFile, entries] of Object.entries(byPdf)) {
    const pdfPath = path.join('assets', 'flora_gallica_pdfs', pdfFile);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    entries.sort((a, b) => a.page - b.page);
    for (let i = 0; i < entries.length; i++) {
      const start = entries[i].page;
      const end = i + 1 < entries.length ? entries[i + 1].page - 1 : pdfDoc.getPageCount();
      const newDoc = await PDFDocument.create();
      for (let p = start; p <= end; p++) {
        const [pg] = await newDoc.copyPages(pdfDoc, [p - 1]);
        newDoc.addPage(pg);
      }
      const bytes = await newDoc.save();
      const fileName = `${entries[i].genus}.pdf`;
      fs.writeFileSync(path.join(outDir, fileName), bytes);
      segmentToc[entries[i].genus] = { pdfFile: fileName, page: 1 };
    }
  }

  fs.writeFileSync(path.join('assets', 'flora_gallica_segments_toc.json'), JSON.stringify(segmentToc, null, 2), 'utf8');
  console.log('Generated segments for', Object.keys(segmentToc).length, 'genera');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
