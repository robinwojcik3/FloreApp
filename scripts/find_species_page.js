const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

function norm(str) {
  return str.toLowerCase().replace(/\s+/g, '');
}

async function findSpecies(genus, epithet) {
  const key = norm(genus);
  const toc = JSON.parse(fs.readFileSync(path.join('assets', 'flora_gallica_toc.json'), 'utf8'));
  const entry = toc[key];
  if (!entry) throw new Error('Genus not found in TOC');
  const segPath = path.join('assets', 'flora_gallica_segments', `${key}.pdf`);
  if (!fs.existsSync(segPath)) throw new Error('Segment PDF not found');
  const data = new Uint8Array(fs.readFileSync(segPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const text = await page.getTextContent();
    const pageStr = text.items.map(it => it.str).join(' ').toLowerCase();
    if (pageStr.includes(epithet.toLowerCase())) {
      return entry.page + i - 1;
    }
  }
  return null;
}

async function main() {
  const [genus, epithet] = process.argv.slice(2);
  if (!genus || !epithet) {
    console.log('Usage: node scripts/find_species_page.js <Genus> <epithet>');
    return;
  }
  const page = await findSpecies(genus, epithet);
  if (page) {
    console.log(`Found at page ${page} in the original PDF.`);
  } else {
    console.log('Not found');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
