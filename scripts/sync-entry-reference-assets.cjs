'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'docs', 'reference', 'USKOCI_HTML_REFERENCA_IZGLEDA_APP.html');
const outDir = path.join(root, 'assets', 'generated');
const dataDir = path.join(root, 'src', 'ui', 'referenceEntry');
const cityPath = path.join(outDir, 'uskoci-entry-city.webp');
const fontPath = path.join(outDir, 'uskoci-rounded.ttf');
const dataPath = path.join(dataDir, 'entryReferenceData.ts');

const html = fs.readFileSync(htmlPath, 'utf8');

function requireMatch(pattern, label) {
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`[entry-reference] ${label} not found in canonical HTML`);
  }
  return match;
}

function extractBase64(pattern, label, group = 1) {
  const match = requireMatch(pattern, label);
  if (!match[group]) {
    throw new Error(`[entry-reference] ${label} payload missing in canonical HTML`);
  }
  return Buffer.from(match[group], 'base64');
}

function extractText(pattern, label, group = 1) {
  const match = requireMatch(pattern, label);
  if (!match[group]) {
    throw new Error(`[entry-reference] ${label} payload missing in canonical HTML`);
  }
  return match[group];
}

// The accepted HTML currently carries the S01/S02 city artwork as WebP.
// Keep the extractor format-tolerant so the canonical HTML remains the visual owner
// instead of forcing the native build to assume a particular embedded image codec.
const cityMatch = requireMatch(
  /<img\s+alt=""\s+class="bg"\s+src="data:image\/(png|webp|jpeg);base64,([^"]+)"/i,
  'city background image',
);
const cityMime = cityMatch[1].toLowerCase();
if (cityMime !== 'webp') {
  throw new Error(`[entry-reference] canonical city image must be WebP for native binding, got image/${cityMime}`);
}
const city = Buffer.from(cityMatch[2], 'base64');
const font = extractBase64(/font-family:'UskociRounded';\s*src:url\(data:font\/ttf;base64,([^)]+)\)/s, 'UskociRounded TTF');
const logo = extractText(/const ZNAK=(\{.*?\});\s*const PROZORI=/s, 'ZNAK animation data');
const windows = extractText(/const PROZORI=(\[.*?\]);\s*const phone=/s, 'PROZORI animation data');

const fontTag = font.subarray(0, 4);
const sfnt100 = fontTag.equals(Buffer.from([0x00, 0x01, 0x00, 0x00]));
const otto = fontTag.toString('ascii') === 'OTTO';
const trueTypeApple = fontTag.toString('ascii') === 'true';
if (!sfnt100 && !otto && !trueTypeApple) {
  throw new Error(`[entry-reference] canonical UskociRounded payload is not a supported sfnt/TTF font; header=${fontTag.toString('hex')}`);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(cityPath, city);
fs.writeFileSync(fontPath, font);
fs.writeFileSync(
  dataPath,
  `// GENERATED FROM docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html\n` +
    `// Accepted S01/S02 visual source of truth. Do not hand-tune independently.\n\n` +
    `export const ENTRY_LOGO = ${logo} as const;\n\n` +
    `export const ENTRY_WINDOWS = ${windows} as const;\n\n` +
    `export const ENTRY_TIMING = {\n` +
    `  HOLD: 320,\n` +
    `  FLIGHT: 900,\n` +
    `  MARK0: 226,\n` +
    `  MARK1: 39,\n` +
    `  END_FRAME: 116,\n` +
    `  FR: 60,\n` +
    `  CITY_WAKE: 420,\n` +
    `  WORD_JOIN: 430,\n` +
    `  HOME_FADE: 520,\n` +
    `} as const;\n`,
  'utf8',
);

const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
console.log(`[entry-reference] city ${city.length} bytes mime=image/${cityMime} sha256=${sha(city)}`);
console.log(`[entry-reference] font ${font.length} bytes header=${fontTag.toString('hex')} sha256=${sha(font)}`);
console.log('[entry-reference] animation data generated from canonical HTML');
