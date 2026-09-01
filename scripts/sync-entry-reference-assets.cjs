'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'docs', 'reference', 'USKOCI_HTML_REFERENCA_IZGLEDA_APP.html');
const outDir = path.join(root, 'assets', 'generated');
const cityPath = path.join(outDir, 'uskoci-entry-city.png');
const fontPath = path.join(outDir, 'uskoci-rounded.ttf');

const html = fs.readFileSync(htmlPath, 'utf8');

function extract(pattern, label) {
  const match = html.match(pattern);
  if (!match?.[1]) {
    throw new Error(`[entry-reference] ${label} not found in canonical HTML`);
  }
  return Buffer.from(match[1], 'base64');
}

const city = extract(/<img alt="" class="bg" src="data:image\/png;base64,([^"]+)"/, 'city PNG');
const font = extract(/font-family:'UskociRounded';\s*src:url\(data:font\/ttf;base64,([^)]+)\)/s, 'UskociRounded TTF');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(cityPath, city);
fs.writeFileSync(fontPath, font);

const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
console.log(`[entry-reference] city ${city.length} bytes sha256=${sha(city)}`);
console.log(`[entry-reference] font ${font.length} bytes sha256=${sha(font)}`);
