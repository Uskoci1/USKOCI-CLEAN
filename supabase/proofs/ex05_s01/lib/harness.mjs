// EX05-S01: the shared proof harness of the updated copies. The proof runtime (supabase/proofs/pre_v3/closure_runtime.mjs) is INJECTED as `rt`, so this module imports nothing that
// needs an environment and is unit-tested offline with a fake (harness.test.mjs). What it provides to every proof: a collect-all runner (runner.mjs), the exact-source binding of the
// proof's own files to the tested commit, a read-only CATALOG GUARD (a proof of this package changes no function body, no table authority, no policy, no publication and no
// certificate: it only writes fixture rows), the chain-state preconditions every post-state proof stands on, and the report with the flags that say what was NOT touched.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRunner} from './runner.mjs';

export const defaultIo = () => ({
  readFile: path => readFileSync(path),
  gitShow: (commit, path) => execFileSync('git', ['show', commit + ':' + path]),
  mkdir: path => mkdirSync(path, {recursive: true}),
  writeFile: (path, text) => writeFileSync(path, text),
});

/** sha256 per source file; refuses a working-tree file whose bytes differ from the committed ones (the evidence is bound to the commit, not to a local edit). */
export function sourceBytesFacts(io, commit, paths) {
  const facts = {};
  for (const path of paths) {
    const bytes = io.readFile(path);
    if (Buffer.compare(Buffer.from(bytes), Buffer.from(io.gitShow(commit, path))) !== 0) throw new Error('SOURCE_BYTES_DIFFER:' + path);
    facts[path] = createHash('sha256').update(bytes).digest('hex');
  }
  return facts;
}

/**
 * ONE read-only statement: an md5 over everything a proof of this package must not change: every function row (body, ACL, security, configuration) of public, private and rls_private,
 * the table authority, the policies, the publication membership and the certificate triple with readiness. Compared before and after a proof.
 */
export function catalogDigestSql() {
  return `select md5(jsonb_build_object(
  'functions', (select coalesce(jsonb_agg(jsonb_build_array(p.oid, md5(to_jsonb(p)::text)) order by p.oid), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private', 'rls_private')),
  'tables', (select coalesce(jsonb_agg(jsonb_build_array(c.oid, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity, c.relreplident) order by c.oid), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private', 'rls_private') and c.relkind in ('r', 'p')),
  'policies', (select coalesce(jsonb_agg(to_jsonb(x) order by x.schemaname, x.tablename, x.policyname), '[]'::jsonb)
    from pg_policies x where x.schemaname in ('public', 'private', 'rls_private')),
  'certificate', jsonb_build_array(private.closure_source_digest_v5(), (select to_jsonb(c) from private.closure_source_v5 c where c.singleton),
    (select to_jsonb(e) from private.closure_erasure_source_v5 e where e.singleton), private.retention_ai_source_ready()),
  'publicationTables', (select coalesce(jsonb_agg(to_jsonb(t) order by t.pubname, t.schemaname, t.tablename), '[]'::jsonb) from pg_publication_tables t)
)::text)`;
}

/** The functions whose conflicts B24 converted and that the post-state proofs assert on: none of them may still raise 40001 on the chain. */
export const B24_CRITICAL_FUNCTIONS = Object.freeze(['rpc_send_agreement_message_v2', 'rpc_send_agreement_photo_message_v5', 'rpc_send_agreement_voice_message_v1',
  'rpc_agreement_photo_upload_service_v5', 'rpc_agreement_voice_upload_service_v1', 'rpc_begin_push_send', 'rpc_complete_push_transport', 'rpc_set_notification_preferences',
  'rpc_set_push_device_owned', 'rpc_rotate_push_device_owned', 'agreement_photo_context_v5', 'agreement_voice_context_v1']);

/** What every post-state proof assumes about the chain, and the value each fact must have. A proof asserts them first; a chain that lacks one stops the whole unit. */
export const EXPECTED_CHAIN_FACTS = Object.freeze({
  sendV2ConflictIsPt409: true,
  sendPhotoConflictIsPt409: true,
  voiceSendInstalled: true,
  voiceConflictIsPt409: true,
  readersV2Installed: true,
  resolverInstalled: true,
  beginCarriesEventIdAndPt409: true,
  groupSendInstalled: true,
  invalidationTriggerInstalled: true,
  certificateReady: true,
  certificateEqualsLiveDigest: true,
  chat40001Functions: [],
});

const bodyHas = (signature, like, unlike) => `coalesce((select p.prosrc like '%${like}%' and p.prosrc not like '%${unlike}%' from pg_proc p where p.oid = to_regprocedure('${signature}')), false)`;
export const CHAIN_FACTS_SQL = `select jsonb_build_object(
  'sendV2ConflictIsPt409', ${bodyHas('public.rpc_send_agreement_message_v2(uuid,uuid,text,text)', 'PT409', '40001')},
  'sendPhotoConflictIsPt409', ${bodyHas('public.rpc_send_agreement_photo_message_v5(uuid,uuid,integer,text,text,uuid[])', 'PT409', '40001')},
  'voiceSendInstalled', to_regprocedure('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)') is not null,
  'voiceConflictIsPt409', ${bodyHas('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)', 'PT409', '40001')},
  'readersV2Installed', to_regprocedure('public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)') is not null
    and to_regprocedure('public.rpc_read_agreement_message_window_v2(uuid,uuid,uuid,integer,integer)') is not null,
  'resolverInstalled', to_regprocedure('public.rpc_resolve_activity_message_v1(uuid,uuid)') is not null,
  'beginCarriesEventIdAndPt409', coalesce((select p.prosrc like '%eventId%' and p.prosrc like '%PT409%' and p.prosrc not like '%40001%' from pg_proc p where p.oid = to_regprocedure('public.rpc_begin_push_send(uuid,uuid)')), false),
  'groupSendInstalled', to_regprocedure('public.rpc_send_group_message_v5(uuid,uuid,uuid,text)') is not null,
  'invalidationTriggerInstalled', exists(select 1 from pg_trigger t where t.tgrelid = 'public.agreement_messages'::regclass and t.tgname = 'chat_b3c_invalidation_after_message' and not t.tgisinternal),
  'certificateReady', private.retention_ai_source_ready(),
  'certificateEqualsLiveDigest', private.closure_source_digest_v5() = (select c.sha256 from private.closure_source_v5 c where c.singleton),
  'chat40001Functions', coalesce((select jsonb_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosrc like '%40001%' and p.proname in (${B24_CRITICAL_FUNCTIONS.map(name => "'" + name + "'").join(', ')})), '[]'::jsonb)
)`;

/** Throws one error naming EVERY fact that differs from the assumption. */
export function assertChainFacts(facts) {
  const wrong = Object.entries(EXPECTED_CHAIN_FACTS).filter(([key, expected]) => JSON.stringify(facts?.[key]) !== JSON.stringify(expected)).map(([key]) => key);
  if (wrong.length) throw new Error('CHAIN_FACTS_MISMATCH ' + wrong.join(', ') + ' (read: ' + JSON.stringify(Object.fromEntries(wrong.map(key => [key, facts?.[key]]))) + ')');
  return facts;
}

/**
 * createProofHarness({rt, unit, reportName, sources}) -> {check, characterize, sourceCheck, beginCatalogGuard, catalogGuardCheck, requireChain, setFlag, finish}.
 * `rt` is the proof runtime (sha, out, env, report, sql). finish() writes the report and RETURNS the exit code (0 or 1); the caller sets process.exitCode with it.
 */
export function createProofHarness({rt, unit, reportName, sources = [], io = defaultIo(), print = console.log, printError = console.error}) {
  const runner = createRunner({unit, print, printError});
  const base = rt.report(unit);
  const artifactDir = rt.env?.EX05_S01_ARTIFACT_DIR ?? rt.out;
  const hashes = {};
  const flags = {};
  let chainFacts = null;
  let guardBefore = null;
  let guardState = null;

  async function sourceCheck() {
    await runner.check('SOURCE_BYTES_EQUAL_THE_TESTED_COMMIT', async () => { Object.assign(hashes, sourceBytesFacts(io, rt.sha, sources)); });
  }
  function beginCatalogGuard() { guardBefore = rt.sql(catalogDigestSql()); }
  async function catalogGuardCheck() {
    await runner.check('CATALOG_AND_CERTIFICATE_UNCHANGED_BY_THIS_PROOF', async () => {
      if (guardBefore === null) throw new Error('CATALOG_GUARD_NOT_STARTED');
      const after = rt.sql(catalogDigestSql());
      guardState = after === guardBefore ? 'UNCHANGED' : 'MOVED';
      if (guardState === 'MOVED') throw new Error('CATALOG_MOVED before ' + guardBefore + ' after ' + after);
    });
  }
  /** Runs the named check; true when it passed. The caller stops the unit (finish, then exit) when it did not: nothing after it can mean anything on a chain that is not the assumed one. */
  async function requireChain(name, fn) {
    await runner.check(name, async () => { const facts = await fn(); if (facts && typeof facts === 'object') chainFacts = facts; });
    return runner.summary().checks.find(item => item.name === name).result === 'PASS';
  }
  const setFlag = (key, value) => { flags[key] = value; };

  function finish() {
    const summary = runner.summary();
    const report = {...base, result: summary.result, passed: summary.passed, recorded: summary.recorded, failed: summary.failed, skipped: summary.skipped,
      checks: summary.checks, failures: summary.failures, observations: summary.observations,
      providerCalls: 0, storageCalls: flags.storageCalls ?? 0, devAccess: false, liveAccess: false, providerCalled: false, deviceProven: false,
      certificateMoved: guardState === 'MOVED', catalogUnchanged: guardState === null ? null : guardState === 'UNCHANGED',
      sourceArtifactHashes: hashes, chain: chainFacts, ...flags};
    delete report.migrations;
    io.mkdir(artifactDir);
    io.writeFile(artifactDir + '/' + reportName, JSON.stringify(report, null, 2) + '\n');
    print(summary.result + ' ' + unit + ' (' + summary.passed + ' passed, ' + summary.recorded + ' recorded, ' + summary.failed + ' failed, ' + summary.skipped + ' skipped)');
    for (const item of summary.failures) printError(' - ' + item.name + ': ' + item.message);
    return summary.result === 'PASS' ? 0 : 1;
  }

  return {check: runner.check, characterize: runner.characterize, sourceCheck, beginCatalogGuard, catalogGuardCheck, requireChain, setFlag, finish, artifactDir};
}
