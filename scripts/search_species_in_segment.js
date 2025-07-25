const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

function usage() {
  console.log('Usage: node scripts/search_species_in_segment.js <Genus> <epithet>');
  process.exit(1);
}

const [, , genus, epithet] = process.argv;
if (!genus || !epithet) usage();

const filePath = path.join('assets', 'flora_gallica_segments', `${genus.toLowerCase()}.pdf`);
if (!fs.existsSync(filePath)) {
  console.error('Segment not found:', filePath);
  process.exit(1);
}

pdf(fs.readFileSync(filePath)).then(data => {
  const pages = data.text.split(/\n\s*\n/);
  const regex = new RegExp(`\\b${epithet}\\b`, 'i');
  const hits = [];
  pages.forEach((text, idx) => {
    if (regex.test(text)) hits.push(idx + 1);
  });
  if (hits.length) {
    console.log('Found on page(s):', hits.join(', '));
  } else {
    console.log('No match found');
  }
}).catch(err => {
  console.error('Error reading PDF:', err);
  process.exit(1);
});
