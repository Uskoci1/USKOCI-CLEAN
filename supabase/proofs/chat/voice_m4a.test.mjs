import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectVoiceM4a, VoiceM4aError, VOICE_M4A_LIMITS } from '../../functions/_shared/voiceM4a.mjs';

const be32=n=>Uint8Array.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
const ascii=s=>Uint8Array.from([...s].map(c=>c.charCodeAt(0)));
const cat=(...parts)=>{const n=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;};
const box=(type,...payload)=>{const body=cat(...payload);return cat(be32(body.length+8),ascii(type),body);};
function fixture(durationMs=90_000,{brand='M4A ',codec=true,mdat=32}={}){
  const timescale=1000,duration=durationMs;
  const ftyp=box('ftyp',ascii(brand),be32(0),ascii('isom'),ascii('M4A '));
  const mvhd=box('mvhd',Uint8Array.of(0,0,0,0),be32(0),be32(0),be32(timescale),be32(duration));
  const marker=box('trak',codec?ascii('xxxxmp4axxxx'):ascii('xxxxxxxxxxxx'));
  const moov=box('moov',mvhd,marker);
  const media=box('mdat',new Uint8Array(mdat).fill(7));
  return cat(ftyp,moov,media);
}
const code=(work,expected)=>assert.throws(work,e=>e instanceof VoiceM4aError&&e.code===expected);

test('admits bounded AAC/M4A structure and returns server-owned duration',()=>{
  assert.deepEqual(inspectVoiceM4a(fixture(61_234)),{durationMs:61_234,byteSize:fixture(61_234).byteLength,contentType:'audio/mp4'});
});
test('boundary durations are admitted',()=>{
  assert.equal(inspectVoiceM4a(fixture(VOICE_M4A_LIMITS.minDurationMs)).durationMs,VOICE_M4A_LIMITS.minDurationMs);
  assert.equal(inspectVoiceM4a(fixture(VOICE_M4A_LIMITS.maxDurationMs)).durationMs,VOICE_M4A_LIMITS.maxDurationMs);
});
test('too short and too long are refused',()=>{
  code(()=>inspectVoiceM4a(fixture(299)),'VOICE_DURATION_INVALID');
  code(()=>inspectVoiceM4a(fixture(300001)),'VOICE_DURATION_INVALID');
});
test('requires supported MP4/M4A brand and mp4a marker',()=>{
  code(()=>inspectVoiceM4a(fixture(1000,{brand:'zzzz'})),'VOICE_FORMAT_UNSUPPORTED');
  code(()=>inspectVoiceM4a(fixture(1000,{codec:false})),'VOICE_FORMAT_UNSUPPORTED');
});
test('requires ftyp first plus moov and non-empty mdat',()=>{
  const normal=fixture(1000),top=normal.slice(24);
  code(()=>inspectVoiceM4a(top),'VOICE_CONTAINER_INVALID');
  code(()=>inspectVoiceM4a(fixture(1000,{mdat:0})),'VOICE_CONTAINER_INVALID');
});
test('truncated or forged box lengths fail closed',()=>{
  const x=fixture(1000); code(()=>inspectVoiceM4a(x.slice(0,-3)),'VOICE_CONTAINER_INVALID');
  const y=fixture(1000); y.set(be32(0x7fffffff),0); code(()=>inspectVoiceM4a(y),'VOICE_CONTAINER_INVALID');
});
test('non-bytes and oversize inputs fail before parsing',()=>{
  code(()=>inspectVoiceM4a(new Uint8Array(8)),'VOICE_SIZE_INVALID');
  code(()=>inspectVoiceM4a(new Uint8Array(VOICE_M4A_LIMITS.maxBytes+1)),'VOICE_SIZE_INVALID');
  code(()=>inspectVoiceM4a(new ArrayBuffer(64)),'VOICE_SIZE_INVALID');
});
test('limits are the reviewed V1 voice contract',()=>{
  assert.deepEqual(VOICE_M4A_LIMITS,{maxBytes:4*1024*1024,minDurationMs:300,maxDurationMs:300000});
});
