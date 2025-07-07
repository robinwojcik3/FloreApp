const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const swPath = path.join(__dirname, '..', 'sw.js');
const cacheName = `plantid-v${pkg.version}`;

const swData = fs.readFileSync(swPath, 'utf8');
const updated = swData.replace(/const CACHE_NAME = "[^"]+";/, `const CACHE_NAME = "${cacheName}";`);
fs.writeFileSync(swPath, updated);
console.log(`Updated CACHE_NAME to ${cacheName}`);
