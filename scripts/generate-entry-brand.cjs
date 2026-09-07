'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const names = [...Array.from({length: 7}, (_, i) => 'entry-mark-' + i), ...Array.from({length: 4}, (_, i) => 'entry-word-' + i)];
const svgs = Object.fromEntries(names.map(name => {
  const svg = fs.readFileSync(path.join(root, 'assets/brand', name + '.svg'), 'utf8');
  if (/<script|<foreignObject|(?:href|src)=["']https?:/i.test(svg)) throw new Error('External/active SVG content: ' + name);
  return [name, svg];
}));
fs.writeFileSync(path.join(root, 'src/ui/entry/brandSvg.ts'), '// Generated from the bundled Figma SVGs by scripts/generate-entry-brand.cjs.\nexport const brandSvg = ' + JSON.stringify(svgs, null, 2) + ';\n');
console.log('Bundled ' + names.length + ' static SVGs. No remote asset dependency.');

