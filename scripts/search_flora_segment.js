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

async function searchInPdf(pdfPath, term) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(it => it.str).join(' ').toLowerCase();
    if (text.includes(term)) {
      return i;
    }
  }
  return null;
}

async function main() {
  const species = process.argv.slice(2).join(' ');
  if (!species) {
    console.error('Usage: node search_flora_segment.js "Genus species"');
    process.exit(1);
  }
  const [genus, ...rest] = species.split(/\s+/);
  const epithet = rest.join(' ');
  const segmentPath = path.join('assets', 'flora_gallica_segments', `${norm(genus)}.pdf`);
  if (!fs.existsSync(segmentPath)) {
    console.error('Segment not found for genus', genus);
    process.exit(1);
  }
  const page = await searchInPdf(segmentPath, norm(epithet));
  if (page) {
    console.log(`Found in ${segmentPath} page ${page}`);
  } else {
    console.log('Not found');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
