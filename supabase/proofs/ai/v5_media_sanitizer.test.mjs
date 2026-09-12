// Real pinned ImageMagick WASM, real JPEG/PNG/WebP bytes; no provider or Storage.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import * as m from '@imagemagick/magick-wasm';
import {imageCodec,configureImageLimits,sanitizeImage} from '../../functions/_shared/mediaImageSanitizer.mjs';
const require=createRequire(import.meta.url);
await m.initializeImageMagick(readFileSync(require.resolve('@imagemagick/magick-wasm/magick.wasm')));
const fixtures={};for(const [name,format] of [['JPEG',m.MagickFormat.Jpeg],['PNG',m.MagickFormat.Png],['WEBP',m.MagickFormat.WebP]]){
 fixtures[name]=m.ImageMagick.read(m.MagickColors.Orange,2400,1200,i=>{
  i.setAttribute('comment','PRIVATE_COMMENT_SENTINEL');
  i.setProfile('xmp',new TextEncoder().encode('<x:xmpmeta xmlns:x="adobe:ns:meta/"><private>PRIVATE_GPS_AND_OWNER</private></x:xmpmeta>'));
  return i.write(format,b=>new Uint8Array(b));
 });
}
// Valid TIFF EXIF Orientation=6 (rotate90), embedded in a real JPEG APP1.
const plain=m.ImageMagick.read(m.MagickColors.Red,320,160,i=>i.write(m.MagickFormat.Jpeg,b=>new Uint8Array(b)));
const exif=new Uint8Array([0x45,0x78,0x69,0x66,0,0,0x49,0x49,0x2a,0,8,0,0,0,1,0,0x12,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
const oriented=new Uint8Array(plain.length+exif.length+4);oriented.set(plain.subarray(0,2));oriented.set([255,225,0,exif.length+2],2);oriented.set(exif,6);oriented.set(plain.subarray(2),6+exif.length);
configureImageLimits(m);
for(const [name,type] of [['JPEG','image/jpeg'],['PNG','image/png'],['WEBP','image/webp']])test(`${name} decodes and strips metadata into real 1600px JPEG`,()=>{
 const result=sanitizeImage(fixtures[name],type,m);assert.equal(result.width,1600);assert.equal(result.height,800);assert.equal(imageCodec(result.bytes),'JPEG');
 assert.ok(!Buffer.from(result.bytes).includes(Buffer.from('PRIVATE_')));
 m.ImageMagick.read(result.bytes,i=>{assert.equal(i.width,1600);assert.equal(i.height,800);assert.deepEqual(i.profileNames,[]);
  assert.ok(!i.attributeNames.some(n=>/exif|gps|xmp|comment/i.test(n)));});
});
test('EXIF orientation is applied before stripping, without upscaling',()=>{
 const out=sanitizeImage(oriented,'image/jpeg',m);assert.equal(out.width,160);assert.equal(out.height,320);
 m.ImageMagick.read(out.bytes,i=>{assert.equal(i.width,160);assert.equal(i.height,320);assert.deepEqual(i.profileNames,[]);});
});
test('unsupported delegates, spoofed MIME, corrupt input, oversized bytes and PNG bomb fail closed',()=>{
 for(const bad of [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),new TextEncoder().encode('%PDF-1.7XXXXXXXX'),new Uint8Array(10485761)])assert.throws(()=>imageCodec(bad));
 assert.throws(()=>sanitizeImage(fixtures.PNG,'image/jpeg',m));assert.throws(()=>sanitizeImage(new Uint8Array([255,216,255,...Array(20).fill(1)]),'image/jpeg',m));
 const bomb=new Uint8Array(fixtures.PNG);new DataView(bomb.buffer).setUint32(16,120000);new DataView(bomb.buffer).setUint32(20,120000);
 assert.throws(()=>sanitizeImage(bomb,'image/png',m));
});
