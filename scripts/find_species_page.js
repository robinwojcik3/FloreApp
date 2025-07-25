const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function findInSegment(genus, epithet) {
  const toc = JSON.parse(fs.readFileSync(path.join('assets', 'flora_gallica_toc.json'), 'utf8'));
  const entry = toc[genus.toLowerCase()];
  if (!entry || !entry.segmentFile) {
    console.error('Segment not found for genus');
    process.exit(1);
  }
  const pdfPath = path.join('assets', 'flora_gallica_segments', entry.segmentFile);
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const text = await page.getTextContent();
    const content = text.items.map(it => it.str).join(' ').toLowerCase();
    if (content.includes(epithet.toLowerCase())) {
      console.log('Found on page', entry.page + i - 1);
      return;
    }
  }
  console.log('Not found');
}

const [,, genus, epithet] = process.argv;
if (!genus || !epithet) {
  console.error('Usage: node find_species_page.js <genus> <epithet>');
  process.exit(1);
}
findInSegment(genus, epithet);
