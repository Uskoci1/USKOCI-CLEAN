#!/usr/bin/env node
// USKOČI control table: node scripts/control/osvezi.mjs
// Reads docs/control/redovi.json (curated rows) and docs/control/dev_snapshot.json (read-only DEV catalog),
// scans the app source, and writes docs/control/stanje.json plus docs/control/out/tabla.html (the page to publish).
// No network except an optional `gh run list`; no secrets; nothing is written outside docs/control.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTROL = join(ROOT, 'docs', 'control');
const rel = p => relative(ROOT, p).split(sep).join('/');
const read = p => readFileSync(p, 'utf8');

const rows = JSON.parse(read(join(CONTROL, 'redovi.json')));
const snap = JSON.parse(read(join(CONTROL, 'dev_snapshot.json')));
const rpcAll = new Set(snap.rpc_all), rpcAuth = new Set(snap.rpc_authenticated);
const edges = new Set(snap.edge.map(e => e.slug));
// Edge functions that only the server's own tick calls; the app is not supposed to call them.
const SERVER_WORKERS = new Set(['uskoci-push-transport', 'uskoci-data-export-worker', 'uskoci-account-closure-worker']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(p, out); }
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const appFiles = {}, testFiles = {}, edgeFiles = {};
for (const p of walk(join(ROOT, 'src'))) {
  const r = rel(p);
  if (r.includes('dizajn-pregled')) continue;
  ((r.includes('__tests__') || /\.test\.tsx?$/.test(r)) ? testFiles : appFiles)[r] = read(p);
}
for (const p of walk(join(ROOT, '__tests__'))) testFiles[rel(p)] = read(p);
for (const p of walk(join(ROOT, 'supabase', 'functions'))) edgeFiles[rel(p)] = read(p);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refs = (token, pool) => {
  const re = new RegExp(`['"\`/]${esc(token)}['"\`?/]`);
  return Object.keys(pool).filter(k => re.test(pool[k]));
};
function routeFile(route) {
  const parts = route === '/' ? [] : route.replace(/^\//, '').split('/');
  for (const prefix of ['src/app/(app)/', 'src/app/']) {
    const cands = parts.length ? [`${prefix}${parts.join('/')}.tsx`, `${prefix}${parts.join('/')}/index.tsx`] : [`${prefix}index.tsx`];
    for (const c of cands) if (existsSync(join(ROOT, c))) return c;
  }
  return null;
}
const serviceFile = name => Object.keys(appFiles).find(k => k.split('/').pop().replace(/\.tsx?$/, '') === name) ?? null;
// Which modules a screen can actually reach: follow relative imports from every route file under src/app.
function resolveImport(from, spec) {
  const base = join(ROOT, dirname(from), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    const r = rel(cand);
    if (appFiles[r] !== undefined) return r;
  }
  return null;
}
const reachable = new Set();
const queue = Object.keys(appFiles).filter(k => k.startsWith('src/app/'));
while (queue.length) {
  const file = queue.pop();
  if (reachable.has(file)) continue;
  reachable.add(file);
  for (const m of appFiles[file].matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = resolveImport(file, m[1]);
    if (target && !reachable.has(target)) queue.push(target);
  }
}

const G = 'zeleno', Y = 'zuto', R = 'crveno', N = 'nema', S = 'sivo';
const computed = rows.redovi.map(row => {
  const note = {};
  const deps = row.server.filter(d => !d.startsWith('NOVO:'));
  const novo = row.server.filter(d => d.startsWith('NOVO:')).map(d => d.slice(5).trim());
  // Ekran
  let ekran = N;
  if (row.ekrani.length) {
    const missing = row.ekrani.filter(r => !routeFile(r));
    ekran = missing.length ? R : G;
    if (missing.length) note.ekran = `Nema fajla za: ${missing.join(', ')}`;
  }
  // Server
  let server = N;
  // Every rpc the row's own service files call must exist too, not only the ones listed in the row.
  const svcCalls = [...new Set(row.servisi.map(serviceFile).filter(Boolean)
    .flatMap(f => [...appFiles[f].matchAll(/['"`](rpc_[a-z0-9_]+)['"`]/g)].map(m => m[1])))];
  const brokenCalls = svcCalls.filter(r => !rpcAll.has(r));
  if (deps.length || novo.length || brokenCalls.length) {
    const missing = deps.filter(d => d.startsWith('rpc_') ? !rpcAll.has(d) : d.startsWith('uskoci-') ? !edges.has(d) : false);
    server = missing.length || novo.length || brokenCalls.length ? R : G;
    const parts = [];
    if (missing.length) parts.push(`Na serveru ne postoji: ${missing.join(', ')}`);
    if (brokenCalls.length) parts.push(`Aplikacija poziva, a na serveru nema: ${brokenCalls.join(', ')}`);
    if (novo.length) parts.push(`Treba nova serverska funkcija: ${novo.join('; ')}`);
    if (parts.length) note.server = parts.join(' · ');
  }
  // Kod
  let kod = N;
  const callable = deps.filter(d => (d.startsWith('rpc_') && rpcAuth.has(d)) || (d.startsWith('uskoci-') && !SERVER_WORKERS.has(d)));
  const svcMissing = row.servisi.filter(s => !serviceFile(s));
  const unreachable = row.servisi.filter(s => serviceFile(s) && !reachable.has(serviceFile(s)));
  if (callable.length || row.servisi.length) {
    const notCalled = callable.filter(d => !refs(d, appFiles).length);
    const calledOnlyUnreachable = callable.filter(d => { const f = refs(d, appFiles); return f.length && !f.some(x => reachable.has(x)); });
    if (callable.length && notCalled.length === callable.length) kod = R;
    else if (notCalled.length || svcMissing.length || unreachable.length || calledOnlyUnreachable.length) kod = Y;
    else kod = G;
    const parts = [];
    if (notCalled.length) parts.push(`Aplikacija ne poziva: ${notCalled.join(', ')}`);
    if (calledOnlyUnreachable.length) parts.push(`Poziva se samo iz koda do kog nijedan ekran ne stiže: ${calledOnlyUnreachable.join(', ')}`);
    if (svcMissing.length) parts.push(`Nema servisa: ${svcMissing.join(', ')}`);
    if (unreachable.length) parts.push(`Nijedan ekran ne stiže do: ${unreachable.join(', ')}`);
    if (parts.length) note.kod = parts.join(' · ');
    else note.kod = `Ekran stiže do koda; poziva ${callable.length} serverskih funkcija`;
  }
  if (row.override?.kod) { kod = row.override.kod; note.kod = row.override.razlog ?? note.kod; }
  // Test
  let test = N;
  const tokens = [...callable, ...row.servisi];
  if (tokens.length) {
    const files = [...new Set(tokens.flatMap(t => refs(t, testFiles).concat(Object.keys(testFiles).filter(k => new RegExp(`/${esc(t)}['"]`).test(testFiles[k])))))];
    test = files.length ? G : Y;
    note.test = files.length ? `${files.length} test fajl(ova)` : 'Nijedan test ne dodiruje ovaj deo';
  }
  // Telefon i nacrt
  const telefon = row.telefon?.stanje === 'DOKAZANO' ? G : row.telefon?.stanje === 'DELIMIČNO' ? Y : S;
  const nacrt = row.nacrt ? G : S;
  const lights = { nacrt, ekran, kod, server, test, telefon };
  const auto = [ekran, kod, server, test].filter(v => v !== N);
  const ukupno = row.problem || auto.includes(R) || auto.includes(Y) ? 'PROBLEM'
    : telefon === G ? 'GOTOVO' : 'NA TELEFONU NIJE PROVERENO';
  return { id: row.id, grupa: row.grupa, naslov: row.naslov, nacrt_ref: row.nacrt, stari: row.stari, ekrani: row.ekrani,
    servisi: row.servisi, server_deps: row.server, lights, note, telefon_dokaz: row.telefon?.dokaz ?? '', problem: row.problem, sledece: row.sledece, ukupno };
});

// Server functions a signed-in user may call that the app never calls (directly or through an Edge function).
const serverOnly = [...rpcAuth].filter(r => !refs(r, appFiles).length).map(r => ({ rpc: r, preko_edge: refs(r, edgeFiles).length > 0 }));
// Functions the app calls that do not exist on the server: a broken call.
const called = new Set();
for (const text of Object.values(appFiles)) for (const m of text.matchAll(/['"`](rpc_[a-z0-9_]+)['"`]/g)) called.add(m[1]);
const appCallsMissing = [...called].filter(r => !rpcAll.has(r)).sort();

const sh = (file, args) => { try { return execFileSync(file, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } };
let ci = null;
const ciRaw = sh('gh', ['run', 'list', '--limit', '12', '--json', 'databaseId,workflowName,headSha,status,conclusion,createdAt']);
if (ciRaw) try { ci = JSON.parse(ciRaw).map(r => ({ id: r.databaseId, ime: r.workflowName, sha: r.headSha.slice(0, 8), stanje: r.status, ishod: r.conclusion, vreme: r.createdAt })); } catch { ci = null; }

const meta = {
  osvezeno: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  grana: sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']), head: sh('git', ['rev-parse', '--short=8', 'HEAD']), head_poruka: sh('git', ['log', '-1', '--format=%s']),
  server: { snimljeno: snap.generated_at, migracije: snap.ledger_total, dev_alpha: snap.ledger_dev_alpha, poslednja: snap.ledger_last,
    sertifikat_ok: snap.certificate_live === snap.certificate_certified && snap.retention_ai_ready === true,
    cron: snap.cron, cron_24h: snap.cron_runs_24h, cron_greske_24h: snap.cron_failures_24h, edge: snap.edge },
  pravilo_gotovo: rows.pravilo_gotovo,
};
const counts = computed.reduce((a, r) => (a[r.ukupno] = (a[r.ukupno] ?? 0) + 1, a), {});
const stanje = { meta, counts, redovi: computed, server_ume_aplikacija_ne_koristi: serverOnly, aplikacija_zove_a_server_nema: appCallsMissing,
  blokade: rows.blokade, prodavnice: rows.prodavnice, test_dva_telefona: rows.test_dva_telefona, test_dva_telefona_izvrseno: rows.test_dva_telefona_izvrseno, ci };

writeFileSync(join(CONTROL, 'stanje.json'), JSON.stringify({ ...stanje, meta: { ...meta, osvezeno: undefined } }, null, 1) + '\n');
mkdirSync(join(CONTROL, 'out'), { recursive: true });
const tpl = read(join(CONTROL, 'tabla.template.html'));
writeFileSync(join(CONTROL, 'out', 'tabla.html'), tpl.replace('__STANJE__', JSON.stringify(stanje).replace(/</g, '\\u003c')));
console.log(`Redova: ${computed.length}`, counts);
console.log(`Server ume, aplikacija ne koristi: ${serverOnly.filter(x => !x.preko_edge).length} (+${serverOnly.filter(x => x.preko_edge).length} preko Edge)`);
console.log(`Aplikacija zove, server nema: ${appCallsMissing.length}${appCallsMissing.length ? ' → ' + appCallsMissing.join(', ') : ''}`);
console.log(`Strana: ${rel(join(CONTROL, 'out', 'tabla.html'))}`);
