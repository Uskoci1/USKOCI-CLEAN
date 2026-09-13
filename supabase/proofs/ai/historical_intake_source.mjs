// Explicit historical executable source, never a replacement RPC response.
// These four files were read verbatim from the preserved pre132 Git commit;
// both Git blob IDs and SHA256 hashes are checked before compiling any byte.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const base=new URL('./fixtures/pre132/',import.meta.url);
const expectedManifest='a7c111c63c4ac7348aef3a4f29cf5f8f967ee06792e60ffb9cc9bcda022a653a';
export function historicalIntakeSource(){
 const raw=readFileSync(new URL('manifest.json',base));
 assert.equal(createHash('sha256').update(raw).digest('hex'),expectedManifest,'HISTORICAL_MANIFEST_CHANGED');
 const manifest=JSON.parse(raw.toString('utf8'));
 assert.equal(manifest.sourceCommit,'67cccb15efc003f154ca472793bd2f704f09b2e5');
 const files=new Map();
 for(const [path,item] of Object.entries(manifest.files)){
  assert.match(item.fixture,/^[a-zA-Z0-9]+[.]ts[.]txt$/);
  const bytes=readFileSync(new URL(item.fixture,base));assert.equal(bytes.length,item.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,'HISTORICAL_BYTES_CHANGED:'+path);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),item.gitBlob,'HISTORICAL_GIT_BLOB_CHANGED:'+path);
  files.set(path,bytes);
 }
 return {read:path=>{assert.ok(files.has(path),'UNADMITTED_HISTORICAL_SOURCE');return files.get(path);},
  binding:{kind:'HISTORICAL_PRE132',sourceCommit:manifest.sourceCommit,manifestSha256:expectedManifest,
   scope:'Actual historical Edge handler for SQL106/114 only; latest handler requires SQL132.',files:manifest.files},
  manifestPath:fileURLToPath(new URL('manifest.json',base))};
}
