import fs from 'node:fs';

const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const failures = [];

const requireText = (needle, label) => {
  if (!html.includes(needle)) failures.push('missing: ' + label);
};

for (const forbidden of [
  'service_role',
  'sb_secret_',
  '.supabase.co',
  'SUPABASE_SERVICE',
  "method:'POST'",
  'method:"POST"',
  "method:'PUT'",
  'method:"PUT"',
  "method:'PATCH'",
  'method:"PATCH"',
  "method:'DELETE'",
  'method:"DELETE"'
]) {
  if (html.includes(forbidden)) failures.push('forbidden browser capability/token marker: ' + forbidden);
}

requireText("Uskoci1/USKOCI-CLEAN", 'canonical repository');
requireText("work/uskoci-ui-unification-20260924", 'canonical branch');
requireText("docs/control/stanje.json", 'control state');
requireText("docs/control/dev_snapshot.json", 'dated DEV snapshot');
requireText("master-plan-live-state.json", 'release projection');
requireText("/actions/runs?branch=", 'CI monitor');
requireText("/commits?sha=", 'development timeline');
requireText("Control snapshot zaostaje", 'stale-state warning');
requireText("nije direktna live DEV veza", 'snapshot/live distinction');
requireText("Nacrt", 'evidence ladder');
requireText("Telefon", 'phone evidence level');

const intervals = [...html.matchAll(/setInterval\([^,]+,(\d+)\)/g)].map(m => Number(m[1]));
if (!intervals.length) failures.push('missing refresh interval');
if (intervals.some(ms => ms < 60000)) failures.push('polling interval under 60 seconds');

const apiHosts = [...html.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase());
const unexpected = [...new Set(apiHosts.filter(h => h !== 'api.github.com'))];
if (unexpected.length) failures.push('unexpected network host(s): ' + unexpected.join(', '));

if (failures.length) {
  console.error('USKOCI CONTROL V0 GUARD FAIL');
  for (const f of failures) console.error('- ' + f);
  process.exit(1);
}
console.log('USKOCI CONTROL V0 GUARD PASS');
console.log('read-only browser source; polling >=60s; stale/live distinction present');
