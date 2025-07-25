const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function main() {
  const toc = JSON.parse(fs.readFileSync(path.join('assets', 'flora_gallica_toc.json'), 'utf8'));
  const byFile = {};
  for (const [genus, entry] of Object.entries(toc)) {
    if (!entry.pdfFile || !entry.page) continue;
    const arr = byFile[entry.pdfFile] || [];
    arr.push({ genus, page: entry.page });
    byFile[entry.pdfFile] = arr;
  }

  for (const [pdfFile, items] of Object.entries(byFile)) {
    items.sort((a, b) => a.page - b.page);
    const srcPath = path.join('assets', 'flora_gallica_pdfs', pdfFile);
    const bytes = fs.readFileSync(srcPath);
    const doc = await PDFDocument.load(bytes);
    for (let i = 0; i < items.length; i++) {
      const start = items[i].page - 1;
      const end = i + 1 < items.length ? items[i + 1].page - 1 : doc.getPageCount();
      const outDoc = await PDFDocument.create();
      const pages = await outDoc.copyPages(doc, Array.from({ length: end - start }, (_, j) => j + start));
      pages.forEach(p => outDoc.addPage(p));
      const outBytes = await outDoc.save();
      const outDir = path.join('assets', 'flora_gallica_segments');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${items[i].genus}.pdf`);
      fs.writeFileSync(outPath, outBytes);
      console.log(`Wrote ${outPath}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
