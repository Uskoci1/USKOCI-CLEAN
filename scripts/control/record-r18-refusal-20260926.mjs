import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE = '348c2ec6ac0d3afe2e51e5a15e7620b023646ca5';
export const RUN = 36240045849;
export const BRANCH = 'work/uskoci-ui-unification-20260924';
const REPORT = 'docs/implementation/release-hardening-20260926/E01_E02_RECOVERY.md';
const CHECKS = 'docs/implementation/release-hardening-20260926/E01_E02_CHECKS.json';
const requiredTests = [
  'a SQLSTATE-bound refusal is settled immediately',
  'shows allowlisted eligibility guidance and correction links',
  'a known refusal of the retried command permits a reset',
  'eligibility message without proof plus a fresh collection read cannot release',
  'reused key plus a fresh collection read cannot release',
];
export function validateEvidence(meta, focused, full, sql, schema) {
  assert.equal(meta.id, RUN, 'Wrong proof run');
  assert.equal(meta.head_sha, SOURCE, 'Wrong proof source');
  assert.equal(meta.head_branch, BRANCH, 'Wrong proof branch');
  assert.equal(meta.status, 'completed', 'Proof is not complete');
  assert.equal(meta.conclusion, 'success', 'Proof did not pass');
  assert.equal(schema.trim(), '147/20260913081242', 'Historical DB boundary changed');
  const stats = (j, minimum) => {
    assert.equal(j.success, true);
    assert.equal(j.numFailedTests, 0);
    assert.equal(j.numFailedTestSuites, 0);
    assert.ok(Number.isSafeInteger(j.numPassedTests) && j.numPassedTests >= minimum);
    assert.ok(Number.isSafeInteger(j.numPassedTestSuites) && j.numPassedTestSuites > 0);
    return { passedSuites: j.numPassedTestSuites, passedTests: j.numPassedTests,
      failedSuites: j.numFailedTestSuites, failedTests: j.numFailedTests,
      pendingTests: j.numPendingTests ?? null };
  };
  const focusedStats = stats(focused, 139), fullStats = stats(full, 6300);
  const assertions = focused.testResults.flatMap(t => t.assertionResults);
  for (const name of requiredTests) assert.ok(assertions.some(a => a.fullName.includes(name) && a.status === 'passed'), name);
  assert.equal(sql.result, 'PASS');
  assert.equal(sql.sourceSha, SOURCE);
  assert.equal(sql.history, schema.trim());
  assert.equal(sql.liveAccess, false);
  assert.equal(sql.providerCalled, false);
  assert.ok(Array.isArray(sql.checks) && sql.checks.length === 9);
  assert.ok(sql.checks.every(c => c.result === 'PASS'));
  return { source: SOURCE, workflowRunId: RUN, workflowUrl: `https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/${RUN}`,
    focused: focusedStats, full: fullStats, historicalSql: { checks: sql.checks.length, migrations: 147, liveAccess: false, providerCalled: false },
    status: 'CLIENT_CI_PASS_DEVICE_PENDING', devApplied: false, edgeApplied: false,
    deviceTestPerformed: false, dashboardRemotePublication: 'NOT_PERFORMED' };
}
export function updateTracker(rows, evidence) {
  const copy = JSON.parse(JSON.stringify(rows));
  const target = copy.redovi.filter(row => row.id === 'B09');
  assert.equal(target.length, 1, 'Expected one B09');
  const row = target[0];
  const marker = 'R18-E01/E02 CI 26.09';
  if ((row.sledece ?? '').includes(marker)) throw new Error('Evidence already recorded');
  const result = `${marker}: kod ${SOURCE.slice(0, 8)}; TypeScript i ${evidence.focused.passedTests} ciljanih / ${evidence.full.passedTests} ukupnih testova prolaze. Potvrđeno odbijanje više nije prikazano kao nepoznat ishod, a poruka nije sakrivena opštom greškom. Tekst greške bez dokaza i ponovljen ključ ne oslobađaju sačuvan zahtev. Telefon i native prolaz još čekaju. Dokaz: ${REPORT}. `;
  row.sledece = result + (row.sledece ?? '');
  // Preserve unrelated findings and their dates; only supersede the E01/E02 paragraph.
  const at = (row.problem ?? '').indexOf('R18-E01/E02:');
  const current = 'R18-E01/E02: klijentsko razlikovanje potvrđenog odbijanja i nepoznatog ishoda provereno u CI-ju; tačan novi APK/telefon nije proveren. Novi paket ne potvrđuje stare navode o serverskoj ceni.';
  row.problem = at >= 0 ? row.problem.slice(0, at) + current : (row.problem ? row.problem + ' ' : '') + current;
  assert.deepEqual(copy.redovi.filter(r => r.id !== 'B09'), rows.redovi.filter(r => r.id !== 'B09'));
  return copy;
}
function main() {
  const root = process.cwd();
  const dir = resolve(process.argv[2] ?? '/tmp/r18-refusal-evidence');
  const json = name => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  assert.equal(process.env.GITHUB_REF, `refs/heads/${BRANCH}`);
  assert.equal(process.env.GITHUB_REPOSITORY, 'Uskoci1/USKOCI-CLEAN');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  assert.equal(git('rev-parse', 'HEAD'), process.env.GITHUB_SHA);
  const changed = git('diff', '--name-only', SOURCE, 'HEAD').split('\n').filter(Boolean);
  const allowed = p => p.startsWith('docs/') || p === 'AGENTS.md' || p === 'scripts/control/record-r18-refusal-20260926.mjs'
    || p === 'scripts/control/record-r18-refusal-20260926.test.mjs' || p === '.github/workflows/r18-refusal-evidence-20260926.yml';
  assert.ok(changed.every(allowed), 'Unverified runtime or build source changed since proof');
  assert.ok(!existsSync(CHECKS), 'One-shot evidence already exists');
  const evidence = validateEvidence(json('run.json'), json('pkg006-focused-jest.json'), json('pkg006-full-jest.json'),
    json('pkg006-proof-report.json'), readFileSync(join(dir, 'pkg006-schema.txt'), 'utf8'));
  evidence.recordedAt = new Date().toISOString();
  evidence.evidenceRecorderHead = process.env.GITHUB_SHA;
  evidence.artifactHashes = Object.fromEntries(['pkg006-focused-jest.json', 'pkg006-full-jest.json', 'pkg006-proof-report.json']
    .map(name => [name, createHash('sha256').update(readFileSync(join(dir, name))).digest('hex')]));
  const rowsPath = join(root, 'docs/control/redovi.json');
  const before = JSON.parse(readFileSync(rowsPath, 'utf8'));
  const rows = updateTracker(before, evidence);
  mkdirSync(join(root, 'docs/implementation/release-hardening-20260926'), { recursive: true });
  writeFileSync(rowsPath, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(CHECKS, JSON.stringify(evidence, null, 2) + '\n');
  const note = `# R18-E01/E02 — popravka oporavka prijave\n\nStatus: **CLIENT_CI_PASS_DEVICE_PENDING**.\n\nIzvor aplikacije i ispravljenog CI pravila: ${SOURCE}.\n\n## Stvarni problem i popravka\n\nHook je već znao da je određena prijava odbijena, ali je ekran zadržavao pending.reconciled=false i zato opet prikazivao Proveri ishod. Ekran sada usklađuje tu zastavicu samo iz usko potvrđene odbijene komande u istom fokusu. Uspeh i dalje pripada potvrdi editora; zaostali uspeh posle napuštanja ekrana ne preskače novo čitanje. Drugo, opšta poruka iz hook-a zaklanjala je rečenicu Ova ponuda nije primljena; potvrđeni ishod sada ima prednost.\n\nNisu menjani kriterijumi odbijanja, RPC argumenti, trajni dnevnik, cena, profil, nalog, sesija, server ili Edge. Nepoznat ishod i IDEMPOTENCY_KEY_REUSED ne postaju dokaz odbijanja. Raniji testovi nisu uklonjeni niti ublaženi.\n\n## Provere\n\n- TypeScript: PASS u [CI-ju](${evidence.workflowUrl}).\n- Ciljani testovi: ${evidence.focused.passedSuites} grupe / ${evidence.focused.passedTests} testova, bez padova.\n- Ceo Jest: ${evidence.full.passedSuites} grupe / ${evidence.full.passedTests} testova, bez padova.\n- Istorijski disposable SQL: 9 provera na 147 migracija. Ovo **nije** dokaz jednakosti sa kanonskim DEV-om od 202 migracije.\n- Ranije neuspešne provere sačuvane: [TypeScript pad](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36237862251) i [tri pada testova ponašanja](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36238087977) i [regresija zaostalog odgovora](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36239846013).\n- CI putanja je promenjena sa uglastih zagrada na glob koji stvarno obuhvata dinamički direktorijum; types i ciljani testovi sada idu pre skupog SQL replay-a. JSON rezultati su sačuvani kao artefakti.\n\n## Granice dokaza\n\nNovi APK nije napravljen niti instaliran. Prolaz profil → povratak → prijava na fizičkom telefonu ostaje otvoren. Novi paket ne dokazuje sve reset/storage-failure/race scenarije. Stari navodi o ceni i preostale NEXT stavke nisu zatvoreni ovim testovima.\n\nSveža read-only provera DEV-a u ovom razgovoru: 2026-09-26T11:44:16.659405Z, 202 migracije, poslednja 20260924202023, 0 push attempts, 0 active push devices, 0 readiness redova. dev_snapshot.json zadržava svoju istorijsku oznaku vremena; nije lažno osvežen ovom parcijalnom proverom.\n\nMedia deploy i stvarni push čekaju posebno primeni. Ne koristiti kratko globalno uključivanje transporta kao garanciju jednog push-a: buduća proba mora dokazivo ograničiti nalog, uređaj, događaj i broj slanja. Staru pretpostavku o kill-switch-u ne predstavljati kao očitanu env vrednost.\n\nKontrolna tabla: ažuriran samo relevantan B09, zatim ponovo generisana postojećim scripts/control/osvezi.mjs. Spoljni Claude Artifact prikaz nije objavljen; generisani HTML je artefakt ovog posla.\n`;
  writeFileSync(REPORT, note);
  const nextPath = 'docs/implementation/design-system/r19-task-agreement-20260925/NEXT.md';
  let next = readFileSync(nextPath, 'utf8');
  const start = next.indexOf('1. **Feedback truth: R18-E01/E02.**');
  const end = next.indexOf('2. **Native continuity/accessibility.**', start);
  assert.ok(start >= 0 && end > start, 'NEXT section changed; reconcile manually');
  next = next.slice(0, start) + `1. **Feedback truth: R18-E01/E02 — client CI pass, device pending.** Source ${SOURCE} passes types, ${evidence.focused.passedTests} focused tests and ${evidence.full.passedTests} full-suite tests. The conclusive refusal now settles both route and editor flags and keeps its authored outcome visible. Message-only failures and reused keys retain uncertainty. Read \`${REPORT}\` and \`${CHECKS}\`. Do not rebuild this fix; next prove the exact APK/profile-return flow and separately test storage-clear failure/retained reset races. No DEV/Edge change or real push was made.\n\n` + next.slice(end);
  writeFileSync(nextPath, next);
  const agentsPath = 'AGENTS.md';
  let agents = readFileSync(agentsPath, 'utf8');
  const heading = '# USKOČI — repository entry map\n\n';
  assert.ok(agents.startsWith(heading));
  agents = heading + `R18 REFUSAL RECOVERY CLIENT CI PASS (2026-09-26): tested source ${SOURCE}; read\n\`${REPORT}\` and E01_E02_CHECKS.json. The route no longer overrides a proven refusal with its stale pending flag; authored outcome copy is visible. Types, ${evidence.focused.passedTests} focused and ${evidence.full.passedTests} full Jest tests pass. Historical SQL proof remains 147 migrations, not live202 parity. Device/APK acceptance stays pending. No DEV/Edge/provider/push changes.\n\n` + agents.slice(heading.length);
  writeFileSync(agentsPath, agents);
  console.log(JSON.stringify({ source: SOURCE, focused: evidence.focused, full: evidence.full, trackerRow: 'B09', deviceAccepted: false }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
