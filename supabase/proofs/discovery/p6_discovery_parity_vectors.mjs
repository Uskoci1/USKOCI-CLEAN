// SOURCE ONLY. Generates SQL assertions from the actual checked-out pure client code.
// No database, network, provider or filesystem writes. Redirect stdout to a temporary
// SQL file, then pass its absolute path as p6_vectors_path to the disposable proof.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript'); // Existing repository dependency; no install.
const sources = ['src/data/marketplaceView.ts', 'src/lib/calendarTime.ts', 'src/lib/location.ts',
  'src/lib/market.ts', 'src/ui/calendar/calendarPresentation.ts'];
const allowed = new Set(sources.map(path => resolve(root, path)));
const loaded = new Map();
function load(path) {
  if (!allowed.has(path)) throw new Error('P6_ORACLE_IMPORT_NOT_ALLOWED');
  if (loaded.has(path)) return loaded.get(path).exports;
  const module = { exports: {} }; loaded.set(path, module);
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'exports', 'module', compiled)(specifier => {
    if (!specifier.startsWith('.')) throw new Error('P6_ORACLE_EXTERNAL_IMPORT');
    return load(resolve(dirname(path), `${specifier}.ts`));
  }, module.exports, module);
  return module.exports;
}
const view = load(resolve(root, sources[0]));
const location = load(resolve(root, 'src/lib/location.ts'));
const sql = value => value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
let count = 0;
function assertion(expression, expected) {
  count++;
  console.log(`do $p6_vector$ begin if (${expression}) is distinct from ${typeof expected === 'boolean' ? expected : sql(expected)} then raise exception 'P6_CLIENT_PARITY_${count}'; end if; end $p6_vector$;`);
}
console.log('-- Generated only from the allowlisted current client sources. No SQL result is invented.');
for (const path of sources) console.log(`-- SHA256 ${createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')} ${path}`);
for (const [area, city] of [[null, null], ['„Vračar, Beograd“', 'Beograd'], ['"Vračar" i "Zvezdara"', 'Beograd'],
  ['  Novi\u00a0 Sad  ', 'NOVI SAD'], ["'Bor'", 'Bor'], ['Kod Sabornog hrama', 'Bor'], ['“ČUKARICA”', 'Beograd']]) {
  assertion(`public.p6_discovery_area(${sql(area)},${sql(city)},false)`, location.podrucjeTekst(area, city));
}
for (const text of [' NOVI\u00a0\u00a0SAD\ufeff', 'ČĆŠĐŽ čćšđž', 'İ I ı', 'ΟΣ Σ', '100%_literal', '\u2028Novi\u2029Sad\u3000']) {
  assertion(`public.p6_discovery_key(${sql(text)})`, view.placeKey(text));
}
const schedules = [
  ['FIXED_WINDOW', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00.000999Z'],
  ['FIXED_WINDOW', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00.001000Z'],
  ['FIXED_WINDOW', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z'],
  ['FIXED_WINDOW', null, '2026-09-27T00:00:00Z'], ['FIXED_WINDOW', '2026-09-27T09:00:00Z', null],
  ['FLEXIBLE', '2026-09-27T09:00:00Z', null], ['FLEXIBLE', null, '2026-09-27T00:00:00Z'],
  ...['FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE', 'FIXED_WINDOW'].map(kind => [kind, null, null]),
];
const at = '2026-09-27T12:00:00.000Z';
for (const zone of ['UTC', 'Europe/Belgrade', 'Pacific/Apia']) {
  for (const [kind, startsAt, endsAt] of schedules) {
    const item = { schedule: { kind, startsAt, endsAt }, taskTimezone: zone };
    for (const day of ['2026-03-29', '2026-03-30', '2026-09-27', '2026-09-28', '2026-10-25']) {
      const expected = view.happensBetween(item, { from: day, to: day }, new Date(at));
      const days = `public.p6_discovery_days(${sql(kind)},${sql(startsAt)}::timestamptz,${sql(endsAt)}::timestamptz,${sql(zone)},${sql(at)}::timestamptz)`;
      assertion(`coalesce((${days})[1]<=${sql(day)} and (${days})[2]>=${sql(day)},false)`, expected);
    }
  }
}
console.log(`\\echo 'PASS P6_CURRENT_CLIENT_ORACLE_${count}_VECTORS'`);
