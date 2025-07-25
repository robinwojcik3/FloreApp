const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

(async () => {
  const toc = JSON.parse(fs.readFileSync(path.join('assets', 'flora_gallica_toc.json'), 'utf8'));
  const entriesByPdf = {};
  for (const [genus, info] of Object.entries(toc)) {
    if (!entriesByPdf[info.pdfFile]) entriesByPdf[info.pdfFile] = [];
    entriesByPdf[info.pdfFile].push({ genus, page: info.page });
  }
  for (const [pdfFile, entries] of Object.entries(entriesByPdf)) {
    const pdfPath = path.join('assets', 'flora_gallica_pdfs', pdfFile);
    const pdfBytes = fs.readFileSync(pdfPath);
    const srcDoc = await PDFDocument.load(pdfBytes);
    entries.sort((a, b) => a.page - b.page);
    for (let i = 0; i < entries.length; i++) {
      const start = entries[i].page;
      const end = (i + 1 < entries.length ? entries[i + 1].page : srcDoc.getPageCount() + 1) - 1;
      const newDoc = await PDFDocument.create();
      const pages = await newDoc.copyPages(
        srcDoc,
        Array.from({ length: end - start + 1 }, (_, k) => k + start - 1)
      );
      pages.forEach(p => newDoc.addPage(p));
      const segBytes = await newDoc.save();
      const segDir = path.join('assets', 'flora_gallica_segments');
      if (!fs.existsSync(segDir)) fs.mkdirSync(segDir);
      const segFile = `${entries[i].genus}.pdf`;
      fs.writeFileSync(path.join(segDir, segFile), segBytes);
      toc[entries[i].genus].segmentFile = segFile;
    }
  }
  fs.writeFileSync(
    path.join('assets', 'flora_gallica_toc.json'),
    JSON.stringify(toc, null, 2)
  );
  console.log('Segmentation completed');
})();
