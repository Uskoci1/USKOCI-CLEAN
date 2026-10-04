import fs from 'node:fs';

const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const alertRules = JSON.parse(fs.readFileSync(new URL('./spec/ALERT_RULES.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('./manifest.webmanifest', import.meta.url), 'utf8'));
const sw = fs.readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
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
requireText('data-tab="alertsPanel"', 'alerts navigation');
requireText('ALERT CENTER', 'typed Alert Center');
requireText('DEVELOPMENT INSPECTOR', 'commit/CI inspector');
requireText('RISK RADAR', 'risk radar');
requireText('HEAD_CI_FAILURE', 'current-head CI failure rule');
requireText('manifest.webmanifest', 'PWA manifest');
requireText("serviceWorker.register('./sw.js')", 'service worker registration');
if (manifest.display !== 'standalone') failures.push('PWA display must be standalone');
if (!Array.isArray(manifest.icons) || !manifest.icons.length) failures.push('PWA icon missing');
if (sw.includes('api.github.com')) failures.push('service worker must not cache GitHub API explicitly');
if (!sw.includes("url.origin!==self.location.origin")) failures.push('service worker same-origin cache boundary missing');
if (!Array.isArray(alertRules.rules) || alertRules.rules.length < 9) failures.push('alert rules contract incomplete');
for (const code of ['HEAD_CI_FAILURE','CONTROL_SNAPSHOT_STALE','PHONE_EVIDENCE_GAP','RELEASE_NOT_READY']) {
  if (!alertRules.rules.some(r => r.code === code)) failures.push('missing alert rule: ' + code);
}

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
