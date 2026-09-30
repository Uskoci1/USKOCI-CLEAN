// Shared proof fixture: a complete, internally consistent mono AAC-LC M4A container (copied verbatim from voice_m4a.test.mjs, which keeps its own copy).
// The mdat access units are opaque synthetic bytes: this is a structural fixture for the B0 validator and for Storage round trips, NOT decoded or native audio.
import assert from 'node:assert/strict';

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

export { fixture as m4aFixture };
