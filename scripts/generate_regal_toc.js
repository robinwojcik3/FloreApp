const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

function norm(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

async function loadSpeciesGenus() {
  const data = JSON.parse(fs.readFileSync('Criteres_herbier.json', 'utf8'));
  const genusSet = new Set();
  for (const item of data) {
    const genus = item.species.split(' ')[0];
    genusSet.add(norm(genus));
  }
  return genusSet;
}

async function extractToc(pdfPath, genusSet) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  const outline = await pdfDoc.getOutline();
  const mapping = {};

  async function processItems(items) {
    if (!items) return;
    for (const item of items) {
      const title = (item.title || '').trim();
      const key = norm(title.split(' ')[0]);
      if (genusSet.has(key) && item.dest) {
        try {
          const pageIndex = await pdfDoc.getPageIndex(item.dest[0]);
          const page = pageIndex + 1;
          if (!mapping[key]) {
            mapping[key] = { pdfFile: path.basename(pdfPath), page };
          }
        } catch (err) {
          // Ignore items with invalid destinations
        }
      }
      if (item.items && item.items.length) {
        await processItems(item.items);
      }
    }
  }
  await processItems(outline);
  return mapping;
}

async function main() {
  const genusSet = await loadSpeciesGenus();
  const pdfPath = path.join('assets', 'regal_vegetal_pdf', 'R\u00e9galV\u00e9g\u00e9tal-SIGNETS.pdf');
  const mapping = await extractToc(pdfPath, genusSet);
  fs.writeFileSync(
    path.join('assets', 'regal_vegetal_toc.json'),
    JSON.stringify(mapping, null, 2),
    'utf8'
  );
  console.log('Generated', Object.keys(mapping).length, 'entries');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
