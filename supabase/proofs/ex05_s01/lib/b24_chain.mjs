// EX05-S01: the B24 Part 1 CHAIN VARIANT (pure text logic, no I/O; unit-tested in b24_chain.test.mjs).
// B24 (docs/implementation/product-v1-closure-20260926/finalization-20260927/b24/B24_IMPACT.md) turned the code of 110 deterministic conflict raises from SQLSTATE 40001 into PT409
// on canonical DEV: Part 1 (ledger 213, 54 functions / 89 sites, certificate-neutral) and Part 2 (ledger 214, 14 certified functions, certificate re-bound). The disposable chain of
// the D12 workflow carries Part 2 only (relaxed pre-image mode), because Part 1 refuses to run when ANY of its 54 targets is absent and the chain lacks some of them (pkg051a,
// PKG-045b P0, P6 rollout v3 ...). The text proofs for the chat functions (rpc_send_agreement_message_v2, the push transport, the preferences and device writers) therefore ran
// against 40001 bodies. This module derives, from the COMMITTED candidate, a variant that converts exactly the targets that exist on the chain and changes nothing else:
// the committed guards (unique function, pinned quoted-site count, no PT409 yet, body-with-PT409-turned-back equals the old body, attribute tuple unchanged, digest unchanged,
// readiness) all stay and still run; only the target table and the two count literals of the first guard are rewritten. Apply it with b24.preimage = relaxed (the DEV md5 pins
// and the closed list of other 40001 raisers are skipped there; every structural check stays).
import {createHash} from 'node:crypto';

export const CANDIDATE_PATH = 'supabase/candidates/b24_nonretried_conflicts_part1.sql';
export const EXPECTED_TARGETS = 54;
export const EXPECTED_SITES = 89;
/** The Part 1 targets whose PT409 body the chat proofs assert on (text send, the push transport pair, the preference and device writers): a chain that cannot convert one of them cannot host the proofs. */
export const CRITICAL_TARGETS = Object.freeze(['public.rpc_send_agreement_message_v2', 'public.rpc_begin_push_send', 'public.rpc_complete_push_transport',
  'public.rpc_set_notification_preferences', 'public.rpc_set_push_device_owned', 'public.rpc_rotate_push_device_owned']);

const BLOCK_START = 'insert into b24_targets(fn, sites, pre_md5) values';
const ROW_START = /\n[ \t]*\('/g;
const ROW = /\('([a-z_]+\.[a-z0-9_]+)', (\d+), '([a-f0-9]{32})'\)/g;
const GUARD = /\(select count\(\*\) from b24_targets\) <> (\d+) or \(select sum\(sites\) from b24_targets\) <> (\d+) then/;
const NAME = /^(public|private)\.[a-z0-9_]+$/;

function findBlock(sql) {
  const start = sql.indexOf(BLOCK_START);
  if (start < 0) throw new Error('B24_TARGET_BLOCK_NOT_FOUND');
  const terminator = sql.indexOf("');", start);
  if (terminator < 0) throw new Error('B24_TARGET_BLOCK_NOT_FOUND');
  return {start, end: terminator + 3};
}

/** The target table of the Part 1 candidate: [{fn, sites, preMd5}] in file order. Refuses a malformed row or a guard whose counts disagree with the table. */
export function parseB24Part1Targets(sql) {
  const {start, end} = findBlock(sql);
  const block = sql.slice(start, end);
  const targets = [...block.matchAll(ROW)].map(match => ({fn: match[1], sites: Number(match[2]), preMd5: match[3]}));
  const rowStarts = (block.match(ROW_START) ?? []).length;
  if (targets.length === 0 || targets.length !== rowStarts) throw new Error('B24_TARGET_ROW_MALFORMED ' + targets.length + ' parsed of ' + rowStarts);
  const guard = GUARD.exec(sql);
  const sites = targets.reduce((sum, item) => sum + item.sites, 0);
  if (!guard || Number(guard[1]) !== targets.length || Number(guard[2]) !== sites) throw new Error('B24_GUARD_COUNTS_DISAGREE');
  return targets;
}

/**
 * ONE read-only statement (no terminator) that returns a jsonb array with one object per target: how many functions carry that qualified name (`count`), how many quoted '40001' sites the
 * body has (`sites`), whether it already mentions PT409 and whether '40001' occurs anywhere outside the quoted form (`strayMention`): exactly the facts the candidate's own pre-guard checks.
 */
export function targetObservationSql(targets) {
  for (const item of targets) if (!NAME.test(item.fn)) throw new Error('B24_TARGET_NAME_INVALID');
  const values = targets.map(item => "('" + item.fn + "')").join(',\n    ');
  return `select coalesce(jsonb_agg(jsonb_build_object('fn', t.fn, 'count', coalesce(o.n, 0), 'sites', coalesce(o.sites, 0),
  'hasPt409', coalesce(o.has_pt409, false), 'strayMention', coalesce(o.stray, false)) order by t.fn), '[]'::jsonb)
from (values
    ${values}
  ) t(fn)
  left join (
    select n.nspname || '.' || p.proname as fn, count(*)::int as n,
      max((length(p.prosrc) - length(replace(p.prosrc, '''40001''', ''))) / 7)::int as sites,
      bool_or(position('PT409' in p.prosrc) > 0) as has_pt409,
      bool_or(position('40001' in replace(p.prosrc, '''40001''', '')) > 0) as stray
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
    group by 1
  ) o on o.fn = t.fn`;
}

/**
 * Splits the targets into kept (convertible on this chain) and dropped, each drop with its reason: ABSENT (no such function: a package the chain does not carry), NOT_UNIQUE (an overload),
 * ALREADY_PT409, SITE_COUNT_DIFFERS (the chain body is not the DEV pre-image text: the candidate's own guard would abort). A target without an observation is a harness error.
 */
export function selectChainTargets(targets, observations) {
  const byName = new Map(observations.map(item => [item.fn, item]));
  const kept = [], dropped = [];
  for (const target of targets) {
    const seen = byName.get(target.fn);
    if (!seen) throw new Error('B24_OBSERVATION_MISSING ' + target.fn);
    const reason = seen.count === 0 ? 'ABSENT' : seen.count > 1 ? 'NOT_UNIQUE' : seen.hasPt409 ? 'ALREADY_PT409'
      : (seen.sites !== target.sites || seen.strayMention) ? 'SITE_COUNT_DIFFERS' : null;
    if (reason === null) kept.push(target);
    else dropped.push({fn: target.fn, reason, expectedSites: target.sites, observedSites: seen.sites, count: seen.count});
  }
  return {kept, dropped};
}

/**
 * The chain variant of the committed candidate: the target table keeps only `kept` (same row format, last row terminated) and the first guard's two count literals follow it.
 * With every target kept the result is byte-identical to the committed text.
 */
export function deriveChainVariant(sql, kept) {
  if (!Array.isArray(kept) || kept.length === 0) throw new Error('B24_NOTHING_TO_CONVERT');
  const all = parseB24Part1Targets(sql);
  const {start, end} = findBlock(sql);
  const eol = sql.includes('\r\n') ? '\r\n' : '\n';
  const rows = kept.map((item, index) => `  ('${item.fn}', ${item.sites}, '${item.preMd5}')${index === kept.length - 1 ? ';' : ','}`);
  const keptSites = kept.reduce((sum, item) => sum + item.sites, 0);
  const rebuilt = sql.slice(0, start) + BLOCK_START + eol + rows.join(eol) + sql.slice(end);
  const out = rebuilt.replace(GUARD, () => `(select count(*) from b24_targets) <> ${kept.length} or (select sum(sites) from b24_targets) <> ${keptSites} then`);
  return {sql: out, keptCount: kept.length, keptSites, droppedCount: all.length - kept.length};
}

const sha256 = text => createHash('sha256').update(text).digest('hex');

/**
 * The whole derivation as one pure function: parse the committed candidate, select what the chain can convert from the observations, derive the variant, and report. `ok` is false when a
 * CRITICAL target had to be dropped (the chat proofs assert on its PT409 body), in which case the caller must stop the chain build instead of running proofs on a 40001 body.
 */
export function planChainVariant(candidateSql, observations, critical = CRITICAL_TARGETS) {
  const targets = parseB24Part1Targets(candidateSql);
  const selection = selectChainTargets(targets, observations);
  const variant = deriveChainVariant(candidateSql, selection.kept);
  const criticalDropped = selection.dropped.filter(item => critical.includes(item.fn));
  const report = {unit: 'EX05_S01_B24_PART1_CHAIN_VARIANT', candidate: CANDIDATE_PATH, targets: targets.length, kept: variant.keptCount, keptSites: variant.keptSites,
    dropped: selection.dropped, criticalDropped, identicalToCommitted: variant.sql === candidateSql, candidateSha256: sha256(candidateSql), variantSha256: sha256(variant.sql),
    ok: criticalDropped.length === 0,
    note: 'The variant keeps the committed text and every committed guard; only the target table and the two count literals of the first guard differ. It is applied with b24.preimage = relaxed on a disposable chain; it is never applied to DEV.'};
  return {sql: variant.sql, report};
}
