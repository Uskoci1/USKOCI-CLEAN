// Dry run of supabase/proofs/ex07/s06/ex07_s06_proof.mjs against an in-process PostgreSQL (PGlite) model of the chain, with a fake proof runtime (no Auth, no PostgREST: an account is a pair of profile rows and a
// usage:  PGLITE_DIR=/tmp/pg node supabase/proofs/ex07/s06/offline/dry.mjs <repository root> <empty output folder>   (PGLITE_DIR: a folder whose node_modules holds @electric-sql/pglite; never added to package.json)
// client is `set local role authenticated` + the JWT claims). The point is to execute the PROOF's own logic once before CI; it is NOT the CI proof and proves nothing about the real chain.
import {createRequire} from 'node:module';
import {readFileSync, mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const require = createRequire((process.env.PGLITE_DIR ?? process.cwd()) + '/');
const {PGlite} = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
const {BODIES} = await import('./mock_bodies.mjs');

const ROOT = process.argv[2];
const OUT = process.argv[3];
mkdirSync(OUT, {recursive: true});
const read = p => readFileSync(ROOT + '/' + p, 'utf8');
const devBody = read('supabase/proofs/ex07/s06/ex07_s06_dev_body.txt');
const DIGEST = '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431';
const TARGET = 'public.rpc_read_safety_target(uuid)';
const OLD_COMMENT = "PKG-047 resolves a public profile the caller can see into the safety target of the person behind it, plus the caller's own block revision. Null whenever the public profile itself would be hidden. Never discloses an incoming block and never writes.";

const db = new PGlite();
await db.exec(`set check_function_bodies = off;
  create schema private; create schema rls_private; create schema auth; create schema extensions; create schema supabase_migrations;
  create role anon; create role authenticated; create role service_role;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table supabase_migrations.schema_migrations(version text, name text, statements text[], created_by text, idempotency_key text unique, rollback text[]);
  create table public.app_profiles(id uuid primary key, account_id uuid not null, kind text not null, display_name text not null, profile_status text not null, avatar_path text, city text, headline text, bio text, skills text[]);
  create table public.agreements(requester_profile_id uuid, worker_profile_id uuid, status text);
  create table private.account_blocks(blocker_account_id uuid not null, blocked_account_id uuid not null, active boolean not null, revision integer not null, last_blocked_at timestamptz, updated_at timestamptz not null default now(), primary key (blocker_account_id, blocked_account_id));
  create table private.account_closure_requests(account_id uuid primary key, state text not null, revision integer not null default 1);
  create table private.account_lineage_v5(account_id uuid primary key, lineage text not null, reason text, source_ref text);
  create table private.safety_reports(id uuid);
  create table private.closure_source_v5(singleton boolean primary key default true, sha256 text not null);
  create table private.closure_erasure_source_v5(singleton boolean primary key default true, sha256 text not null);
  insert into private.closure_source_v5 values (true, '${DIGEST}'); insert into private.closure_erasure_source_v5 values (true, '${DIGEST}');
  create function private.account_reputation(a uuid) returns jsonb language sql stable as $$ select '{"averageRating":null,"reviewCount":0}'::jsonb $$;
  create function private.closure_source_digest_v5() returns text language sql stable security definer set search_path to pg_catalog as $$ select '${DIGEST}'::text $$;
  create function private.closure_erasure_program_digest_v5() returns text language sql stable as $$ select 'program'::text $$;
  create function private.closure_schema_digest_v5_139() returns text language sql stable as $$ select 'schema'::text $$;
  create function private.closure_erasure_binding_v5() returns jsonb language sql stable as $$ select jsonb_build_object('sourceSha256', '${DIGEST}') $$;
  create function private.agreement_invalidation_surface_v1() returns text language sql stable as $$ select 'inv'::text $$;
  create function private.agreement_voice_surface_v1() returns text language sql stable as $$ select 'voice'::text $$;
  create function private.retention_ai_source_ready() returns boolean language sql stable security definer set search_path to pg_catalog as $$ select true $$;`);
const md5 = t => require('node:crypto').createHash('md5').update(t).digest('hex');
for (const [sig, f] of Object.entries(BODIES)) {
  if (md5(f.body) !== f.md5) throw new Error('mock body md5 ' + sig);
  const [schema, rest] = sig.split('.'), name = rest.split('(')[0];
  await db.exec(`create function ${schema}.${name}(${f.args}) returns ${f.returns} language ${f.language ?? 'plpgsql'} ${name === 'rpc_submit_safety_report' ? 'volatile' : 'stable'} security definer set search_path to 'pg_catalog' as $function$${f.body}$function$;
    revoke all on function ${sig} from public;`);
  if (schema === 'public') await db.exec(`grant execute on function ${sig} to authenticated`);
}
await db.exec(`create function public.rpc_read_safety_target(p_profile_id uuid) returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$${devBody}$function$;
  revoke all on function ${TARGET} from public, anon, authenticated, service_role;
  grant execute on function ${TARGET} to authenticated;
  comment on function ${TARGET} is $c$${OLD_COMMENT}$c$;
  create function public.rpc_complete_worker_profile(p_profile_id uuid) returns jsonb language plpgsql volatile security definer set search_path to 'pg_catalog' as $f$
    begin update public.app_profiles set profile_status = 'ACTIVE' where id = p_profile_id and account_id = auth.uid() and kind = 'WORKER'; return jsonb_build_object('profileId', p_profile_id); end $f$;
  create function public.rpc_set_account_block(p_target_account_id uuid, p_blocked boolean, p_expected_revision integer, p_client_request_id uuid) returns jsonb language plpgsql volatile security definer set search_path to 'pg_catalog' as $f$
    declare u uuid := auth.uid(); r private.account_blocks;
    begin
      select * into r from private.account_blocks where blocker_account_id = u and blocked_account_id = p_target_account_id;
      if coalesce(r.revision, 0) <> p_expected_revision then raise exception 'BLOCK_REVISION_CONFLICT' using errcode = 'PT409'; end if;
      insert into private.account_blocks(blocker_account_id, blocked_account_id, active, revision) values (u, p_target_account_id, p_blocked, p_expected_revision + 1)
        on conflict (blocker_account_id, blocked_account_id) do update set active = excluded.active, revision = excluded.revision;
      return jsonb_build_object('accountId', u, 'targetAccountId', p_target_account_id, 'blocked', p_blocked, 'revision', p_expected_revision + 1, 'clientRequestId', p_client_request_id, 'idempotentReplay', false, 'authoritative', true);
    end $f$;
  revoke all on function public.rpc_complete_worker_profile(uuid), public.rpc_set_account_block(uuid, boolean, integer, uuid) from public;
  grant execute on function public.rpc_complete_worker_profile(uuid), public.rpc_set_account_block(uuid, boolean, integer, uuid) to authenticated;
  set check_function_bodies = on;`);

// ---- the fake runtime
const q = x => "'" + String(x).replaceAll("'", "''") + "'";
const fmt = value => value === null || value === undefined ? '' : typeof value === 'boolean' ? (value ? 't' : 'f') : typeof value === 'object' ? JSON.stringify(value) : String(value);
const render = results => {
  const lines = [];
  for (const result of [].concat(results)) if (result.fields && result.fields.length) for (const row of result.rows) lines.push(result.fields.map(field => fmt(row[field.name])).join('|'));
  return lines.join('\n').trim();
};
const sql = async text => { try { return render(await db.exec(text)); } catch (e) { try { await db.exec('rollback'); } catch {} throw new Error(String(e.message)); } };
const rows = async query => JSON.parse(await sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${query}) r`));
const literal = v => v === null ? 'null' : typeof v === 'boolean' || typeof v === 'number' ? String(v) : q(v);
const callAs = async (role, accountId, name, args) => {
  const call = `public.${name}(${Object.entries(args).map(([key, value]) => `${key} := ${literal(value)}`).join(', ')})`;
  try {
    const results = await db.exec(`begin; set local role ${role}; select set_config('request.jwt.claim.sub', ${q(accountId ?? '')}, true); select ${call} as r; commit;`);
    const last = results.find(r => r.fields && r.fields.some(f => f.name === String.fromCharCode(114)));
    return {data: last.rows[0].r ?? null, error: null};
  } catch (e) { try { await db.exec('rollback'); } catch {} return {data: null, error: {code: e.code ?? 'XX000', message: String(e.message)}}; }
};
const rt = {
  assert, q, randomUUID, sql, rows,
  env: {GITHUB_SHA: 'a'.repeat(40), RU5_DEVICE_SUPABASE_URL: 'http://127.0.0.1:54321', PRE_V3_ARTIFACT_DIR: OUT},
  ok: async promise => { const r = await promise; if (r.error) throw new Error('LOCAL_RPC:' + r.error.code + ':' + r.error.message); return r.data; },
  denied: async (promise, message) => { const r = await promise; assert.ok(r.error, 'EXPECTED_DENIAL:' + message); if (message) assert.equal(r.error.message, message); return r.error; },
  actor: async label => {
    const id = randomUUID();
    await db.query(`insert into public.app_profiles(id, account_id, kind, display_name, profile_status) values ($1,$2,'REQUESTER',$3,'ACTIVE'), ($4,$2,'WORKER',$3,'DRAFT')`, [randomUUID(), id, label, randomUUID()]);
    return {id, client: {rpc: (name, args) => callAs('authenticated', id, name, args)}};
  },
  anon: {rpc: (name, args) => callAs('anon', null, name, args)},
  service: {rpc: (name, args) => callAs('service_role', null, name, args)},
};
const {run} = await import(pathToFileURL(ROOT + '/supabase/proofs/ex07/s06/ex07_s06_proof.mjs').href);
const report = await run(rt, {root: ROOT, outDir: OUT, psqlC: async text => { await db.exec(text); return ''; }});
console.log('DRY RUN', report.result, 'checks', report.checks.length);
console.log(JSON.stringify(report.limitation));
