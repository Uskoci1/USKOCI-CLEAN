#!/usr/bin/env node
/**
 * Deterministic composer of the deployable P6 rollout v3 candidate.
 *
 *   node scripts/proofs/build-p6-rollout-v3.mjs            write supabase/candidates/p6_discovery_rollout_v3.sql
 *   node scripts/proofs/build-p6-rollout-v3.mjs --check    fail unless the committed file equals the composition
 *   node scripts/proofs/build-p6-rollout-v3.mjs --stdout   print the composition
 *
 * v3 is v2 (scripts/proofs/build-p6-rollout-v2.mjs) with exactly ONE change, found by the first attempt to apply v2 to canonical DEV (2026-09-30):
 * v2 refused there, atomically, with P6_VISIBILITY_SEMANTIC_MISMATCH:16. The visibility layer's statement-level TEST-world set was a FIXED list of
 * lineages (DEV_ACCEPTANCE_QA, SYNTHETIC_ACCEPTANCE_FIXTURE, OPERATOR), while the account classifier on DEV also puts OWNER_PERSONAL and OWNER_BUSINESS in the
 * TEST world (PKG-029e, the owner's decision "dok testiramo"). A fixed list drifts the moment that decision is taken back (a REAL/TEST boundary defect that no
 * apply-time check could catch), so v3 DERIVES the set from the classifier itself: `private.account_visibility_world(account)='TEST'`. It is still evaluated once per
 * statement (an uncorrelated InitPlan), over the tiny lineage table only, and it equals the classifier for every account by construction (an account without a
 * lineage row is UNCLASSIFIED, hence REAL, in both).
 *
 * Provenance: the output is
 *   1. the FROZEN rollout p6_discovery_rollout.sql byte-for-byte except its final `commit;`,
 *   2. the proven visibility-cost layer p6_discovery_visibility_cost_v1.sql with the helper change above,
 *   3. the proven PLACES-cost layer p6_discovery_places_cost_v1.sql,
 * with the layers' disposable-only guard replaced by a postgres-only guard (the rollout's own preconditions now protect the transaction).
 * Every input is pinned by sha256 (line endings normalised to LF, as CI checks them out). The frozen file is never edited.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const INPUTS = {
  frozen: { path: 'supabase/candidates/p6_discovery_rollout.sql', sha256: 'ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c' },
  visibility: { path: 'supabase/candidates/p6_discovery_visibility_cost_v1.sql', sha256: 'a988f403b419cc70b5c7f1f40101d566c58483781d1663b573910806880ecae3' },
  places: { path: 'supabase/candidates/p6_discovery_places_cost_v1.sql', sha256: '9297c4a1dda330969c79daf0af5a0752b02a496231978b240c35ca6dccb499f9' },
};
export const OUTPUT = 'supabase/candidates/p6_discovery_rollout_v3.sql';

const lf = (text) => text.replace(/\r\n/g, '\n');
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

function load(key) {
  const { path, sha256 } = INPUTS[key];
  const text = lf(readFileSync(path, 'utf8'));
  if (sha(text) !== sha256) throw new Error(`P6_ROLLOUT_V3_INPUT_DRIFT:${key}:${sha(text)}`);
  return text;
}

function once(text, from, to, label) {
  const parts = text.split(from);
  if (parts.length !== 2) throw new Error(`P6_ROLLOUT_V3_ANCHOR:${label}:${parts.length - 1}`);
  return parts.join(to);
}

/** The ONE v3 change: the TEST-world set follows the account classifier instead of a fixed list of lineages. */
export const deriveHelper = (visibilityText) => once(
  visibilityText,
  "  where l.lineage in('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR')\n$f$;",
  "  where private.account_visibility_world(l.account_id)='TEST'\n$f$;",
  'test-world helper',
);

export function compose() {
  const frozen = load('frozen');
  const trimmed = frozen.trimEnd();
  if (!trimmed.endsWith('\ncommit;')) throw new Error('P6_ROLLOUT_V3_FROZEN_TAIL');
  const body = trimmed.slice(0, -'commit;'.length);

  const visibility = deriveHelper(once(
    load('visibility'),
    "  if current_user<>'postgres'\n     or current_setting('p6_discovery.disposable',true) is distinct from 'SOURCE_ONLY_ROLLBACK'\n    then raise exception 'P6_VISIBILITY_DISPOSABLE_ONLY'; end if;",
    "  if current_user<>'postgres'\n    then raise exception 'P6_VISIBILITY_POSTGRES_ONLY'; end if;",
    'visibility guard',
  ));
  const places = once(
    load('places'),
    " if current_user<>'postgres'\n    or current_setting('p6_discovery.disposable',true) is distinct from 'SOURCE_ONLY_ROLLBACK'\n  then raise exception 'P6_PLACES_COST_DISPOSABLE_ONLY'; end if;",
    " if current_user<>'postgres'\n  then raise exception 'P6_PLACES_COST_POSTGRES_ONLY'; end if;",
    'places guard',
  );

  const header = [
    '-- P6 DEPLOYMENT CANDIDATE V3 - NOT APPLIED. Composed by scripts/proofs/build-p6-rollout-v3.mjs; do not edit by hand.',
    '-- One transaction: (1) the FROZEN P6 rollout (sha256 ' + INPUTS.frozen.sha256 + ', bytes unchanged except its final commit),',
    '-- (2) the proven visibility-cost layer (sha256 ' + INPUTS.visibility.sha256 + ') with ONE change: its statement-level TEST-world set is DERIVED from the',
    '--     account classifier (private.account_visibility_world(account)=\'TEST\') instead of a fixed list of lineages, so it follows the classifier by construction.',
    '--     (Canonical DEV holds OWNER_PERSONAL and OWNER_BUSINESS in the TEST world, PKG-029e; the fixed list of v2 was refused there with P6_VISIBILITY_SEMANTIC_MISMATCH:16.)',
    '-- (3) the proven PLACES-cost layer (sha256 ' + INPUTS.places.sha256 + '),',
    '-- with only the layers\' disposable-only guard replaced by a postgres-only guard. Requires PKG045b already restricted.',
    '-- P6 live apply still needs its package-specific authorization/procedure; this file only freezes the composed bytes.',
    '',
  ].join('\n');

  const post = `
-- ===== v3 layer 1: visibility cost (statement-level TEST world set derived from the classifier; REAL/TEST boundary preserved) =====
${visibility.trimEnd()}

-- ===== v3 layer 2: PLACES facets specialised before the wide generic projection =====
${places.trimEnd()}

-- ===== v3 postconditions =====
do $p6_rollout_v3_post$
declare c text;
begin
 select cert into strict c from p6_rollout_before;
 if private.closure_source_digest_v5() is distinct from c
    or (select sha256 from private.closure_source_v5 where singleton) is distinct from c
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from c
    or private.retention_ai_source_ready() is distinct from true
   then raise exception 'P6_ROLLOUT_V3_CERTIFICATE_MOVED'; end if;
 if (select relacl::text from pg_class where oid='public.needs'::regclass) is distinct from (select needs_acl from p6_rollout_before)
   then raise exception 'P6_ROLLOUT_V3_NEEDS_ACL_MOVED'; end if;
 if position('if request_mode=''PLACES'' then' in (select prosrc from pg_proc where oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')))=0
   then raise exception 'P6_ROLLOUT_V3_PLACES_BRANCH_MISSING'; end if;
 if to_regprocedure('rls_private.p6_discovery_test_world_accounts()') is null
   then raise exception 'P6_ROLLOUT_V3_HELPER_MISSING'; end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='needs')<>6
   then raise exception 'P6_ROLLOUT_V3_POLICY_SET_MOVED'; end if;
end $p6_rollout_v3_post$;
commit;
`;
  return header + body + post;
}

function main(argv) {
  const text = compose();
  if (argv.includes('--stdout')) { process.stdout.write(text); return 0; }
  if (argv.includes('--check')) {
    const committed = lf(readFileSync(OUTPUT, 'utf8'));
    if (committed !== text) { console.error(`P6_ROLLOUT_V3_NOT_REPRODUCIBLE: ${OUTPUT} differs from the composition`); return 1; }
    console.log(`OK ${OUTPUT} sha256 ${sha(text)}`);
    return 0;
  }
  writeFileSync(OUTPUT, text, 'utf8');
  console.log(`wrote ${OUTPUT} sha256 ${sha(text)} (${text.length} chars)`);
  return 0;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('build-p6-rollout-v3.mjs')) process.exitCode = main(process.argv.slice(2));
