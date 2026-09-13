import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { entryV49Intro, entryV49Intent, entryV49Layout } from '../../ui/entry/entryV49Math';
import { requesterNoteXml, workerNoteXml } from '../../ui/entry/entryV49Notes';
import reference from './fixtures/entry-v49-chrome.json';
import provenance from '../../../assets/brand/entry-v49/provenance.json';

const root = join(__dirname, '../../..');
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
it('binds the four native assets and vector adapter to the exact owner V4.9 bytes', () => {
  expect(reference.sourceSha256).toBe(provenance.sourceSha256);
  expect(provenance.sourceBytes).toBe(2241863);
  for (const asset of provenance.assets) {
    const bytes = readFileSync(join(root, 'assets/brand/entry-v49', asset.name));
    expect(bytes.length).toBe(asset.bytes); expect(sha(bytes)).toBe(asset.sha256);
  }
  expect(sha(requesterNoteXml)).toBe(provenance.assets[2].sha256);
  expect(sha(workerNoteXml)).toBe(provenance.assets[3].sha256);
  expect(requesterNoteXml + workerNoteXml).not.toMatch(/<script|<image|href=|<foreignObject/i);
});
it('names both original portraits by their actual embedded format without re-encoding', () => {
  const requester = provenance.assets[0]; const worker = provenance.assets[1];
  expect(requester).toMatchObject({ name: 'requester.webp', sourceDeclaredMime: 'image/webp', mime: 'image/webp',
    sha256: '0b995b273406eac9ba85b722ceafe506a235783400047c1765a8317c063b5631' });
  expect(worker).toMatchObject({ name: 'worker.jpg', sourceDeclaredMime: 'image/png', mime: 'image/jpeg',
    sha256: 'c25266122c8c47f96994c6cff05f9e5e5b7428de4a9d78521eb6f4084612d3d3' });
  const webp = readFileSync(join(root, 'assets/brand/entry-v49', requester.name));
  const jpeg = readFileSync(join(root, 'assets/brand/entry-v49', worker.name));
  expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(webp.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(jpeg.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  expect(jpeg.subarray(-2).toString('hex')).toBe('ffd9');
  const entry = readFileSync(join(root, 'src/ui/entry/EntryWelcome.tsx'), 'utf8');
  expect(entry).toContain("require('../../../assets/brand/entry-v49/requester.webp')");
  expect(entry).toContain("require('../../../assets/brand/entry-v49/worker.jpg')");
  expect(entry).not.toContain('entry-v49/worker.png');
});
it.each([['normal', reference.layout, 1], ['200%', reference.largeLayout, 2]] as const)('matches real Chrome final V396 measured layout at %s', (_, expected, scale) => {
  const actual = entryV49Layout(expected.width, expected.viewportHeight, scale, expected);
  for (const key of ['photoY', 'photoH', 'photoW', 'copyY', 'noteY', 'noteW', 'footY'] as const) expect(actual[key]).toBeCloseTo(expected[key], 6);
  // The reference's final wrapper adds 12px visually but keeps S37.size.photoH
  // unchanged for the annotation's sweep travel. Both are retained explicitly.
  expect(actual.photoH - actual.motionPhotoH).toBe(12);
});
it.each(reference.intro)('matches Chrome original part/seam wrappers at $timeMs ms', expected => {
  const actual = entryV49Intro(expected.timeMs);
  for (const part of ['copy', 'photo', 'note'] as const) {
    expect(actual[part].opacity).toBeCloseTo(expected[part].opacity, 5);
    expect(actual[part].y).toBeCloseTo(expected[part].y, 4);
  }
  expect(actual.seam).toBeCloseTo(expected.seam, 5);
});
it.each(reference.intent)('matches actual Chrome selected-scene sweep at $timeMs ms', expected => {
  const actual = entryV49Intent(expected.timeMs, 390, reference.layout.photoH - 12);
  for (const key of ['sceneTravel', 'photoScale', 'photoY', 'copyY', 'noteY', 'noteOpacity', 'otherOpacity', 'footerOpacity', 'seamOpacity'] as const)
    expect(actual[key]).toBeCloseTo(expected[key], 3);
  const inset = Number(expected.doorwayClip.match(/inset\(([^%]+)%/)?.[1]);
  expect(100 * (1 - actual.doorwayOpen)).toBeCloseTo(inset, 3);
});
it.each([0, 100, 3730, 4380])('renders all parts immediately under reduced motion at %i ms', time => {
  expect(entryV49Intro(time, true)).toEqual({ copy: { opacity: 1, y: 0 }, photo: { opacity: 1, y: 0 }, note: { opacity: 1, y: 0 }, seam: 1 });
});
it.each([[320, 568, 1], [360, 640, 1], [390, 844, 2], [414, 874, 2], [844, 390, 2]])('keeps measured content ordered and safely scrollable at %i×%i scale%i', (width, height, scale) => {
  const layout = entryV49Layout(width, height, scale, { brand: 244, copy: 160, note: 112, footer: 210 }, 48, 34);
  expect(layout.brandY).toBeGreaterThanOrEqual(48);
  expect(layout.copyY).toBeGreaterThan(layout.brandY + 244);
  expect(layout.photoY).toBeGreaterThan(layout.copyY + 160);
  expect(layout.noteY).toBeGreaterThan(layout.photoY + layout.photoH);
  expect(layout.footY).toBeGreaterThan(layout.noteY + layout.noteH);
  expect(layout.height).toBeGreaterThanOrEqual(layout.footY + 210 + 34);
  expect(layout.photoH).toBeGreaterThan(0);
});
it('does not compress the authored photos to fit larger hit targets or repeatedly apply the V396 delta', () => {
  const normal = entryV49Layout(390, 844, 1, reference.layout);
  const native = entryV49Layout(390, 844, 1, { ...reference.layout, footer: 108 });
  expect(native.photoH).toBe(normal.photoH); expect(native.footY).toBe(normal.footY);
  expect(native.height).toBeGreaterThan(normal.height);
  expect(entryV49Layout(390, 844, 1, { ...reference.layout, footer: 108 })).toEqual(native);
});
