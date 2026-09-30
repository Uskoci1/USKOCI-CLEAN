// Chain fidelity for the voice DEV application proof: after the admitted chain, the exact B3c application file and B24 part 2 (relaxed pre-image mode), the 14 functions that B24 part 2
// rewrote must have EXACTLY the body md5 that the DEV receipt records after the real apply (ledger 214). If they do, the disposable closure surface is the one DEV has for those functions
// and the DEV application file (which pins the DEV bodies strictly) can run on it byte for byte.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const receiptPath = 'supabase/operations/dev-alpha/ledger/20260930_b24_part2_application.receipt.json';
const dbUrl = process.env.RU5_DEVICE_DB_URL ?? process.env.DB_URL;
assert.ok(dbUrl && /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres$/.test(dbUrl), 'LOCAL_DATABASE_ONLY');
const expected = JSON.parse(readFileSync(receiptPath, 'utf8')).postflight.functions;
const names = Object.keys(expected).sort();
assert.equal(names.length, 14);
const list = names.map(name => "'" + name + "'").join(',');
const output = execFileSync('psql', [dbUrl, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c',
  `select coalesce(jsonb_agg(jsonb_build_object('name',q.name,'md5',q.md5,'count',q.n) order by q.name),'[]') from (
     select n.nspname||'.'||p.proname name, min(md5(p.prosrc)) md5, count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname||'.'||p.proname in (${list}) group by 1) q`], { encoding: 'utf8' }).trim();
const actual = JSON.parse(output);
const mismatches = [];
for (const name of names) {
  const found = actual.find(entry => entry.name === name);
  if (!found || found.count !== 1 || found.md5 !== expected[name].md5) mismatches.push({ name, expected: expected[name].md5, actual: found ? found.md5 : 'MISSING', count: found ? found.count : 0 });
}
const report = { unit: 'CHAT_VOICE_B24_CHAIN_FIDELITY', result: mismatches.length ? 'FAIL' : 'PASS', compared: names.length, mismatches };
writeFileSync((process.env.VOICE_ARTIFACT_DIR ?? '.') + '/chat-voice-b24-fidelity.json', JSON.stringify(report, null, 2) + String.fromCharCode(10));
console.log(report.result + ' CHAT_VOICE_B24_CHAIN_FIDELITY (' + (names.length - mismatches.length) + ' of ' + names.length + ' equal the DEV post-apply body)');
for (const item of mismatches) console.error(' - ' + item.name + ' expected ' + item.expected + ' actual ' + item.actual + ' (count ' + item.count + ')');
if (mismatches.length) process.exitCode = 1;
