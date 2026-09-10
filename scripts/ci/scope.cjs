'use strict';
const { execFileSync, spawnSync } = require('node:child_process');
const { readFileSync, appendFileSync } = require('node:fs');
const { resolve } = require('node:path');

const DOMAINS = ['auth', 'export', 'retention', 'consent', 'processors', 'policy', 'calendar', 'availability', 'location', 'capability'];
const W02 = ['calendar', 'availability', 'location', 'capability'];
const TESTS = {
  auth: /auth|password-recovery|session|return-target|entry-|w01Native/i,
  export: /p2-data-export|cb1-receipt/i,
  retention: /p3-retention/i,
  consent: /p1-legal/i,
  processors: /p4-processor/i,
  policy: /publication|cb1-need-lifecycle|ru4-need-edit|ru2-ai-v2|r02-ai/i,
  calendar: /calendar|agreement|selection|atomski|zavrsetak|completion/i,
  availability: /availability|calendarTime/i,
  location: /location|task-detail-read|ru2-ai-v2/i,
  capability: /capability|profile|ru2-ai-v2/i,
};
const CRITICAL = /session-epoch|return-target-ownership|cb1-receipt-boundary|m04-privatnost-kontakt|selectionIdempotency/;
const SOURCE = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/;
const BUILD = /^(?:package(?:-lock)?\.json|(?:babel|metro|jest|app)\.config\.[cm]?js|tsconfig.*\.json|index\.js|plugins\/|vendor\/)/;

function classify(paths) {
  const domains = new Set();
  const add = (...items) => items.forEach(item => domains.add(item));
  for (const path of paths) {
    if (path.startsWith('scripts/ci/') || path === '.github/workflows/pre-p4-integrity.yml') { add(...DOMAINS); continue; }
    if (BUILD.test(path) || /^src\/(?:store\/|data\/(?:supabaseClient|serverReceipt|ports\.ts)|app\/_layout)/.test(path)) { add(...DOMAINS); continue; }
    if (/^supabase\/migrations\/.*\.sql$/.test(path)) {
      if (/clean_w02_.*(?:calendar|interval|flexible)/.test(path) || /clean_p0e_/.test(path)) add(...W02);
      else if (/clean_w02_.*availability/.test(path)) add('calendar', 'availability');
      else if (/clean_w02_.*(?:location|regional)/.test(path)) add('location', 'capability');
      else if (/clean_w02_.*capability/.test(path)) add('location', 'capability', 'availability');
      else if (/clean_p2_/.test(path)) add('export');
      else if (/clean_p3_/.test(path)) add('retention');
      else if (/clean_p1_/.test(path)) add('consent');
      else if (/clean_p4_/.test(path)) add('processors');
      else if (/clean_d0140/.test(path)) add('policy');
      else add(...DOMAINS); // Unknown SQL is not assumed unrelated to security.
      continue;
    }
    if (/^supabase\/proofs\/(?:ru5_device|notifications\/n0[78])/.test(path) ||
        /^supabase\/proofs\/legal\/(?:p3_retention_pending|pending_)/.test(path)) { add(...DOMAINS); continue; }
    if (/^supabase\/functions\//.test(path)) { add(...DOMAINS); continue; }
    if (/^src\/(?:app\/(?:auth|oporavak|\+native-intent)|hooks\/usePasswordRecovery|ui\/auth\/|data\/(?:auth|passwordRecovery)|data\/__tests__\/(?:auth|password-recovery))/.test(path) || /^supabase\/proofs\/auth\//.test(path)) add('auth');
    if (/dataExport|p2_data_export|p2-data-export/.test(path)) add('export');
    if (/retention|p3-retention/.test(path)) add('retention');
    if (/legalConsent|legalClient|contracts\/legal|p1_legal|p1-legal/.test(path)) add('consent');
    if (/processorMap|p4_processor|p4-processor/.test(path)) add('processors');
    if (/publication|d0140|cb1-need-lifecycle|ru4-need-edit/.test(path)) add('policy');
    if (/calendar|Calendar|agreementClient|calendarErrors|m02-atomski/.test(path)) add('calendar');
    if (/Availability|availability|calendarTime/.test(path)) add('calendar', 'availability');
    if (/location|Location|needFactsV2|aiNeedV2Ui|needClientService/.test(path)) add('location');
    if (/capability|Capability|workerProfile|capabilityTerms/.test(path) || path.endsWith('/ports.ts')) add('capability', 'location');
    if (/^src\/data\/supabaseIzvor\.ts$/.test(path)) add(...W02, 'auth', 'export');
    // Changing a proof workflow must execute that proof once at the ready boundary.
    if (/\.github\/workflows\/w01-/.test(path)) add('auth');
    if (/\.github\/workflows\/w02-/.test(path)) add(...W02);
  }
  return DOMAINS.filter(domain => domains.has(domain));
}

function makePlan(paths, { full = false, unknownBase = false, domain = null } = {}) {
  if (domain && !DOMAINS.includes(domain) && domain !== 'w02') throw new Error('UNKNOWN_TEST_DOMAIN');
  const selected = domain === 'w02' ? W02 : domain ? [domain] : full || unknownBase ? DOMAINS : classify(paths);
  return {
    mode: full || unknownBase || paths.some(path => BUILD.test(path)) ? 'full' : 'targeted',
    migrationRequired: full || unknownBase || paths.some(path => path.startsWith('supabase/migrations/')),
    domains: selected,
    changed: paths,
    unknownBase,
  };
}

function git(args) { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim(); }
function fromEnvironment(env = process.env) {
  const head = git(['rev-parse', 'HEAD']);
  if (env.GITHUB_SHA && env.GITHUB_SHA !== head) throw new Error('CHECKOUT_SOURCE_MISMATCH');
  const event = env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) : {};
  const base = event.pull_request?.base?.sha ?? event.before ?? env.CI_BASE_SHA;
  let changed = [], unknownBase = false;
  try {
    if (!/^[a-f0-9]{40}$/.test(base ?? '') || /^0+$/.test(base)) throw new Error('NO_BASE');
    git(['cat-file', '-e', base + '^{commit}']);
    changed = git(['diff', '--name-only', '--no-renames', '-z', base, head, '--']).split('\0').filter(Boolean);
  } catch { unknownBase = true; }
  const full = env.CI_LEVEL === 'release';
  return { ...makePlan(changed, { full, unknownBase }), sourceSha: head, baseSha: base ?? null,
    runDomains: full || (env.GITHUB_EVENT_NAME === 'workflow_dispatch' && env.CI_LEVEL !== 'fast') ||
      (env.GITHUB_EVENT_NAME === 'pull_request' && event.pull_request?.draft === false) };
}

function testArguments(plan, tracked) {
  if (plan.mode === 'full') return ['--runInBand'];
  const tests = tracked.filter(path => TEST_FILE.test(path) && !path.endsWith('.cjs') &&
    (CRITICAL.test(path) || plan.domains.some(domain => TESTS[domain].test(path))));
  const sources = plan.changed.filter(path => SOURCE.test(path) && tracked.includes(path));
  const targets = [...new Set([...tests, ...sources])].filter(path => !path.startsWith('-'));
  if (!targets.length) throw new Error('NO_TARGETED_TESTS_SELECTED');
  return ['--runInBand', '--findRelatedTests', ...targets];
}

if (require.main === module) {
  try {
    const command = process.argv[2];
    if (command === 'validate-w02') {
      const scope = process.env.W02_SCOPE ?? 'all';
      if (scope !== 'all' && (!scope || scope.split(',').some(item => !W02.includes(item)))) throw new Error('INVALID_W02_SCOPE');
    } else if (command === 'plan') {
      const plan = fromEnvironment();
      console.log(JSON.stringify(plan, null, 2));
      if (process.env.GITHUB_OUTPUT) {
        const outputs = { migration: String(plan.migrationRequired), mode: plan.mode,
          w02: String(plan.runDomains && plan.domains.some(domain => W02.includes(domain))),
          w02_scope: plan.domains.filter(domain => W02.includes(domain)).join(','),
          ...Object.fromEntries(DOMAINS.map(domain => [domain, String(plan.runDomains && plan.domains.includes(domain))])) };
        appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
      }
    } else if (command === 'test') {
      const domain = process.argv[3];
      const plan = domain ? makePlan([], { domain }) : fromEnvironment();
      const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
      const args = testArguments(plan, tracked);
      console.log(JSON.stringify({ mode: plan.mode, domains: plan.domains, sourceSha: git(['rev-parse', 'HEAD']), targets: args.slice(1) }));
      const result = spawnSync(process.execPath, [resolve('node_modules/jest/bin/jest.js'), ...args], { stdio: 'inherit' });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    } else throw new Error('Use plan or test [domain]');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { classify, makePlan, testArguments, fromEnvironment, DOMAINS, W02 };
