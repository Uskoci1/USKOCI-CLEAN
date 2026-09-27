import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectVoiceM4a, VoiceM4aError, VOICE_M4A_LIMITS } from '../../functions/_shared/voiceM4a.mjs';

const be16 = n => Uint8Array.of(n >>> 8, n & 255);
const be32 = n => Uint8Array.of(n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255);
const be64 = n => cat(be32(Math.floor(n / 0x100000000)), be32(n >>> 0));
const ascii = text => Uint8Array.from([...text].map(c => c.charCodeAt(0)));
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
};
const box = (type, ...parts) => { const body = cat(...parts); return cat(be32(body.length + 8), ascii(type), body); };
const fullbox = (type, ...parts) => box(type, be32(0), ...parts);
const matrix = cat(...[65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824].map(be32));
const descriptor = (tag, bytes, long = false) => {
  assert.ok(bytes.length < 128);
  return cat(Uint8Array.of(tag), long ? Uint8Array.of(0x80, 0x80, 0x80, bytes.length) : Uint8Array.of(bytes.length), bytes);
};
function clock(type, scale, duration, version = 0) {
  const body = new Uint8Array((type === 'mvhd' ? 100 : 24) + (version ? 12 : 0));
  body[0] = version;
  body.set(be32(scale), version ? 20 : 12);
  body.set(version ? be64(duration) : be32(duration), version ? 24 : 16);
  if (type === 'mvhd') {
    body.set(be32(65536), version ? 32 : 20); body.set(be16(256), version ? 36 : 24);
    body.set(matrix, version ? 48 : 36); body.set(be32(2), body.length - 4);
  } else body.set(be16(0x55c4), body.length - 4); // ISO-639 und.
  return box(type, body);
}
function trackHeader(duration, version = 0) {
  const body = new Uint8Array(84 + (version ? 12 : 0));
  body[0] = version; body[3] = 3;
  body.set(be32(1), version ? 20 : 12);
  body.set(version ? be64(duration) : be32(duration), version ? 28 : 20);
  body.set(be16(256), version ? 48 : 36);
  body.set(matrix, version ? 52 : 40);
  return box('tkhd', body);
}
// These are complete, internally consistent AAC-LC container/config/table fixtures.
// Their mdat access units are opaque synthetic bytes, NOT decoded/native audio proof.
function fixture(options = {}) {
  const { durationMs = 1000, rate = 48000, version = 0, co64 = false, fixedSize = false,
    mdatFirst = false, extendedMdat = false, longDescriptors = false } = options;
  const ticks = Math.round(durationMs * rate / 1000), count = Math.ceil(ticks / 1024);
  const sizes = Array.from({ length: count }, (_, i) => fixedSize ? 5 : 4 + i % 3);
  const chunks = options.twoChunks ? [Math.floor(count / 2), count - Math.floor(count / 2)] : [count];
  const rateIndex = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000].indexOf(rate);
  const asc = options.asc ?? be16(2 << 11 | rateIndex << 7 | 1 << 3);
  const dec = descriptor(4, cat(Uint8Array.of(options.objectType ?? 0x40, 0x15, 0, 0, 0),
    be32(64000), be32(64000), descriptor(5, asc, longDescriptors)), longDescriptors);
  const esds = fullbox('esds', descriptor(3, cat(be16(1), Uint8Array.of(0), dec,
    descriptor(6, Uint8Array.of(2), longDescriptors)), longDescriptors));
  const audio = new Uint8Array(28);
  audio.set(be16(1), 6); audio.set(be16(options.channels ?? 1), 16);
  audio.set(be16(16), 18); audio.set(be32(rate * 65536), 24);
  const stsd = fullbox('stsd', be32(1), box(options.codec ?? 'mp4a', audio, esds, ...(options.extraEntry ?? [])));
  const timing = count > 1 ? [[count - 1, 1024], [1, ticks - (count - 1) * 1024]] : [[1, ticks]];
  const stts = fullbox('stts', be32(timing.length), ...timing.map(([n, d]) => cat(be32(n), be32(d))));
  const stsz = fullbox('stsz', be32(fixedSize ? 5 : 0), be32(count), ...(fixedSize ? [] : sizes.map(be32)));
  const stsc = fullbox('stsc', be32(chunks.length), ...chunks.map((n, i) => cat(be32(i + 1), be32(n), be32(1))));
  const dref = fullbox('dref', be32(1), box('url ', be32(options.externalData ? 0 : 1)));
  const payload = new Uint8Array(sizes.reduce((n, s) => n + s, 0)).fill(7);
  const mdat = extendedMdat ? cat(be32(1), ascii('mdat'), be64(payload.length + 16), payload) : box('mdat', payload);
  const ftyp = box('ftyp', ascii(options.brand ?? 'M4A '), be32(0), ascii(options.compatible ?? 'isom'));
  const makeMoov = offsets => {
    const stco = fullbox(co64 ? 'co64' : 'stco', be32(offsets.length), ...offsets.map(co64 ? be64 : be32));
    const stbl = box('stbl', stsd, stts, stsz, stsc, stco, ...(options.extraStbl ?? []));
    const minf = box('minf', fullbox('smhd', be32(0)), box('dinf', dref), stbl);
    const hdlr = fullbox('hdlr', be32(0), ascii(options.handler ?? 'soun'), new Uint8Array(12), ascii('Voice\0'));
    const mdia = box('mdia', clock('mdhd', rate, ticks, version), hdlr, minf);
    const track = box('trak', trackHeader(durationMs, version), mdia, ...(options.extraTrak ?? []));
    return box('moov', clock('mvhd', 1000, durationMs, version), track,
      ...(options.secondTrack ? [track] : []), ...(options.extraMoov ?? []));
  };
  const provisional = makeMoov(chunks.map(() => 0));
  let offset = ftyp.length + (mdatFirst ? 0 : provisional.length) + (extendedMdat ? 16 : 8), sample = 0;
  const offsets = chunks.map(n => { const start = offset; for (let i = 0; i < n; i++) offset += sizes[sample++]; return start; });
  const moov = makeMoov(offsets);
  return cat(ftyp, ...(mdatFirst ? [mdat, moov] : [moov, mdat]), ...(options.extraTop ?? []));
}
const at = (bytes, type) => {
  const index = Buffer.from(bytes).indexOf(type);
  assert.ok(index >= 4, 'fixture has ' + type);
  return index + 4;
};
const change32 = (bytes, type, offset, value) => { bytes.set(be32(value), at(bytes, type) + offset); return bytes; };
const changeText = (bytes, type, value) => { bytes.set(ascii(value), at(bytes, type) - 4); return bytes; };
const rejected = (work, code) => assert.throws(work, e => e instanceof VoiceM4aError
  && (code ? e.code === code : ['VOICE_CONTAINER_INVALID', 'VOICE_FORMAT_UNSUPPORTED', 'VOICE_DURATION_INVALID'].includes(e.code)));

test('admits one complete self-contained mono AAC-LC structure with bound metadata', () => {
  const bytes = fixture({ durationMs: 61234, twoChunks: true });
  assert.deepEqual(inspectVoiceM4a(bytes), { durationMs: 61234, byteSize: bytes.length, contentType: 'audio/mp4' });
  assert.ok(Object.isFrozen(inspectVoiceM4a(bytes)));
});
for (const options of [
  { version: 1, co64: true, twoChunks: true }, { fixedSize: true, mdatFirst: true },
  { extendedMdat: true, longDescriptors: true }, { rate: 44100 }, { rate: 8000 },
  { brand: 'zzzz', compatible: 'isom' },
]) test('accepts documented container variant ' + JSON.stringify(options), () => {
  assert.equal(inspectVoiceM4a(fixture(options)).durationMs, 1000);
});
test('preserves the exact duration and byte limits', () => {
  assert.deepEqual(VOICE_M4A_LIMITS, { maxBytes: 4194304, minDurationMs: 300, maxDurationMs: 300000 });
  for (const durationMs of [300, 300000]) assert.equal(inspectVoiceM4a(fixture({ durationMs })).durationMs, durationMs);
  for (const durationMs of [299, 300001]) rejected(() => inspectVoiceM4a(fixture({ durationMs })), 'VOICE_DURATION_INVALID');
  rejected(() => inspectVoiceM4a(new Uint8Array(4194305)), 'VOICE_SIZE_INVALID');
  rejected(() => inspectVoiceM4a(new ArrayBuffer(64)), 'VOICE_SIZE_INVALID');
});
test('rejects the former raw mp4a marker fixture, not an actual track hierarchy', () => {
  const bytes = cat(box('ftyp', ascii('M4A '), be32(0), ascii('isom')),
    box('moov', clock('mvhd', 1000, 1000), box('trak', ascii('xxxxmp4axxxx'))), box('mdat', new Uint8Array(32)));
  rejected(() => inspectVoiceM4a(bytes));
});
for (const [name, options] of [
  ['video handler hiding a valid AAC entry', { handler: 'vide' }],
  ['video sample entry hiding an AAC descriptor', { codec: 'avc1' }],
  ['encrypted sample entry', { codec: 'enca' }],
  ['second/mixed track', { secondTrack: true }],
  ['stereo sample entry', { channels: 2 }],
  ['stereo AudioSpecificConfig', { asc: be16(2 << 11 | 3 << 7 | 2 << 3) }],
  ['HE-AAC AudioSpecificConfig', { asc: be16(5 << 11 | 3 << 7 | 1 << 3) }],
  ['unsupported AAC 960-frame flag', { asc: be16(2 << 11 | 3 << 7 | 1 << 3 | 4) }],
  ['wrong decoder object type', { objectType: 0x6b }],
  ['external data reference', { externalData: true }],
  ['edit list', { extraTrak: [box('edts', fullbox('elst', be32(0)))] }],
  ['fragmented layout', { extraTop: [box('moof', new Uint8Array(8))] }],
  ['fragment declaration', { extraMoov: [box('mvex', new Uint8Array(8))] }],
  ['unknown metadata tree', { extraMoov: [box('udta', ascii('mp4a'))] }],
  ['sample encryption data', { extraStbl: [fullbox('senc', be32(0))] }],
  ['protected sample entry', { extraEntry: [box('sinf', ascii('mp4a'))] }],
  ['unsupported brands', { brand: 'zzzz', compatible: 'zz01' }],
]) test('rejects ' + name, () => rejected(() => inspectVoiceM4a(fixture(options))));

test('requires unique structural boxes and one codec description', () => {
  rejected(() => inspectVoiceM4a(fixture({ extraMoov: [clock('mvhd', 1000, 1000)] })));
  rejected(() => inspectVoiceM4a(fixture({ extraTop: [box('mdat', Uint8Array.of(1))] })));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stsd', 4, 2)));
  rejected(() => inspectVoiceM4a(fixture({ extraStbl: [fullbox('stco', be32(1), be32(0))] })));
});
test('bounds box parsing and rejects truncated or forged lengths', () => {
  const bytes = fixture();
  for (const cut of [1, 7, 40]) rejected(() => inspectVoiceM4a(bytes.slice(0, -cut)));
  const huge = fixture(); huge.set(be32(0x7fffffff), 0); rejected(() => inspectVoiceM4a(huge));
  rejected(() => inspectVoiceM4a(fixture({ extraTop: Array.from({ length: 260 }, () => box('free')) })));
});
test('rejects malformed descriptor length, flags and mismatched codec rate', () => {
  const overlong = fixture(); overlong.set(Uint8Array.of(0x80, 0x80, 0x80, 0x80), at(overlong, 'esds') + 5);
  rejected(() => inspectVoiceM4a(overlong));
  const flags = fixture(); flags[at(flags, 'esds') + 8] = 0x80;
  rejected(() => inspectVoiceM4a(flags));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'mp4a', 24, 44100 * 65536)));
});
test('movie, track, media and sample durations must agree', () => {
  rejected(() => inspectVoiceM4a(change32(fixture(), 'mdhd', 16, 49000)), 'VOICE_DURATION_INVALID');
  const movie = change32(change32(fixture(), 'mvhd', 16, 1100), 'tkhd', 20, 1100);
  rejected(() => inspectVoiceM4a(movie), 'VOICE_DURATION_INVALID');
  rejected(() => inspectVoiceM4a(change32(fixture(), 'tkhd', 20, 1001)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stts', 12, 0)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stts', 12, 1025)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stts', 8, 1)), 'VOICE_DURATION_INVALID');
});
test('rejects unsupported header versions, transforms and sample-table versions', () => {
  const version = fixture(); version[at(version, 'mdhd')] = 2; rejected(() => inspectVoiceM4a(version));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'tkhd', 76, 65536)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'mvhd', 36, 0)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stsc', 0, 0x01000000)));
});
test('sample sizes/counts and timing table must describe the same samples', () => {
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stsz', 8, 0xffffffff)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stsz', 12, 0)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stts', 4, 0xffffffff)));
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stsz', 12, 4194304)));
});
test('chunk mapping must use the sole local description and every sample exactly once', () => {
  for (const [offset, value] of [[8, 2], [12, 0], [16, 2]])
    rejected(() => inspectVoiceM4a(change32(fixture(), 'stsc', offset, value)));
  const two = fixture({ twoChunks: true });
  rejected(() => inspectVoiceM4a(change32(two, 'stsc', 20, 1)));
});
test('rejects sample offsets outside mdat, gaps, overlaps and unreferenced media', () => {
  rejected(() => inspectVoiceM4a(change32(fixture(), 'stco', 8, 0)));
  const gap = fixture(); change32(gap, 'stco', 8, at(gap, 'mdat') + 1); rejected(() => inspectVoiceM4a(gap));
  const overlap = fixture({ twoChunks: true }); change32(overlap, 'stco', 12, at(overlap, 'mdat')); rejected(() => inspectVoiceM4a(overlap));
  const extra = fixture(); change32(extra, 'stsz', 12, 3); rejected(() => inspectVoiceM4a(extra));
  const wide = fixture({ co64: true }); change32(wide, 'co64', 8, 0x200000); rejected(() => inspectVoiceM4a(wide));
});
test('does not accept a codec marker merely because it occurs in an unrelated leaf', () => {
  const bytes = changeText(fixture(), 'esds', 'free');
  rejected(() => inspectVoiceM4a(bytes));
});
test('structural admission does not pretend to decode or sanitize opaque sample bytes', () => {
  const bytes = fixture();
  bytes.fill(0, at(bytes, 'mdat'));
  assert.equal(inspectVoiceM4a(bytes).durationMs, 1000);
});
