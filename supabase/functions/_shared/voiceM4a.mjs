const MAX_BYTES = 4 * 1024 * 1024;
const MIN_DURATION_MS = 300;
const MAX_DURATION_MS = 300_000;
const ASCII = /^[\x20-\x7e]{4}$/;
const BRAND = new Set(['M4A ', 'isom', 'iso2', 'mp41', 'mp42']);

export class VoiceM4aError extends Error {
  constructor(code) { super(code); this.name = 'VoiceM4aError'; this.code = code; }
}
const fail = code => { throw new VoiceM4aError(code); };
const u32 = (b,o) => ((b[o]*0x1000000)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3]) >>> 0;
const u64 = (b,o) => {
  const hi=u32(b,o),lo=u32(b,o+4);
  if (hi > 0x1fffff) fail('VOICE_CONTAINER_INVALID');
  return hi * 0x100000000 + lo;
};
const text4 = (b,o) => String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3]);

function boxes(bytes,start,end) {
  const out=[]; let at=start;
  while(at<end){
    if(end-at<8) fail('VOICE_CONTAINER_INVALID');
    let size=u32(bytes,at), header=8;
    const type=text4(bytes,at+4);
    if(!ASCII.test(type)) fail('VOICE_CONTAINER_INVALID');
    if(size===1){
      if(end-at<16) fail('VOICE_CONTAINER_INVALID');
      size=u64(bytes,at+8); header=16;
    } else if(size===0) {
      size=end-at;
    }
    if(size<header || at+size>end || !Number.isSafeInteger(size)) fail('VOICE_CONTAINER_INVALID');
    out.push({type,start:at,data:at+header,end:at+size,size});
    at+=size;
  }
  if(at!==end) fail('VOICE_CONTAINER_INVALID');
  return out;
}
function hasAscii(bytes,start,end,needle){
  outer: for(let i=start;i+needle.length<=end;i++){
    for(let j=0;j<needle.length;j++) if(bytes[i+j]!==needle.charCodeAt(j)) continue outer;
    return true;
  }
  return false;
}
function durationFromMvhd(bytes,box){
  if(box.end-box.data<20) fail('VOICE_CONTAINER_INVALID');
  const version=bytes[box.data];
  let scale,duration;
  if(version===0){
    if(box.end-box.data<20) fail('VOICE_CONTAINER_INVALID');
    scale=u32(bytes,box.data+12); duration=u32(bytes,box.data+16);
  } else if(version===1){
    if(box.end-box.data<32) fail('VOICE_CONTAINER_INVALID');
    scale=u32(bytes,box.data+20); duration=u64(bytes,box.data+24);
  } else fail('VOICE_CONTAINER_INVALID');
  if(!scale || !duration) fail('VOICE_CONTAINER_INVALID');
  const ms=Math.round(duration*1000/scale);
  if(!Number.isSafeInteger(ms) || ms<MIN_DURATION_MS || ms>MAX_DURATION_MS) fail('VOICE_DURATION_INVALID');
  return ms;
}

/** Bounded structural admission for native AAC/M4A voice files. This is validation, not transcoding/sanitization. */
export function inspectVoiceM4a(input) {
  if(!(input instanceof Uint8Array) || input.byteLength<32 || input.byteLength>MAX_BYTES) fail('VOICE_SIZE_INVALID');
  const top=boxes(input,0,input.byteLength);
  const ftyp=top.find(x=>x.type==='ftyp'),moov=top.find(x=>x.type==='moov'),mdat=top.find(x=>x.type==='mdat');
  if(!ftyp||!moov||!mdat||ftyp.start!==0||mdat.size<=8||ftyp.end-ftyp.data<8) fail('VOICE_CONTAINER_INVALID');
  const brands=[text4(input,ftyp.data)];
  for(let p=ftyp.data+8;p+4<=ftyp.end;p+=4) brands.push(text4(input,p));
  if(!brands.some(x=>BRAND.has(x))) fail('VOICE_FORMAT_UNSUPPORTED');
  const children=boxes(input,moov.data,moov.end);
  const mvhd=children.find(x=>x.type==='mvhd');
  if(!mvhd || !hasAscii(input,moov.data,moov.end,'mp4a')) fail('VOICE_FORMAT_UNSUPPORTED');
  const durationMs=durationFromMvhd(input,mvhd);
  return Object.freeze({ durationMs, byteSize: input.byteLength, contentType:'audio/mp4' });
}
export const VOICE_M4A_LIMITS = Object.freeze({ maxBytes:MAX_BYTES,minDurationMs:MIN_DURATION_MS,maxDurationMs:MAX_DURATION_MS });
