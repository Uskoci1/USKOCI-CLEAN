// Offline execution of the generated EX-07 S06 SQL on an in-process PostgreSQL (PGlite) that carries the byte-exact DEV bodies of the target and of its pinned neighbours.
// usage (a scratch folder, NOT a project dependency):  mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite   then, from anywhere:
//   PGLITE_DIR=/tmp/pg node supabase/proofs/ex07/s06/offline/mock.mjs <repository root>
// This is NOT the CI proof (no Auth, no PostgREST, no real chain, closure functions are stubs); it executes every generated statement once so that a plpgsql or logic error shows before CI.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require = createRequire((process.env.PGLITE_DIR ?? process.cwd()) + '/');
const {PGlite} = await import(require.resolve('@electric-sql/pglite').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const {BODIES} = await import('./mock_bodies.mjs');

const ROOT = process.argv[2];
const read = p => readFileSync(ROOT + '/' + p, 'utf8');
const md5 = t => createHash('md5').update(t).digest('hex');
const files = {
  candidate: read('supabase/candidates/ex07_safety_target_name.sql'),
  revert: read('supabase/candidates/ex07_safety_target_name_revert.sql'),
  preflight: read('supabase/proofs/ex07/s06/ex07_s06_preflight.readonly.sql'),
  postflight: read('supabase/proofs/ex07/s06/ex07_s06_postflight.readonly.sql'),
  plainApply: read('supabase/proofs/ex07/s06/guarded/ex07_safety_target_name.plain_guard.sql'),
  plainRevert: read('supabase/proofs/ex07/s06/guarded/ex07_safety_target_name_revert.plain_guard.sql'),
  migrationApply: read('supabase/proofs/ex07/s06/guarded/ex07_safety_target_name.apply_migration_guard.sql'),
  migrationRevert: read('supabase/proofs/ex07/s06/guarded/ex07_safety_target_name_revert.apply_migration_guard.sql'),
};
const devBody = read('supabase/proofs/ex07/s06/ex07_s06_dev_body.txt');
const manifest = JSON.parse(read('supabase/proofs/ex07/s06/ex07_s06_manifest.json'));
const OLD = manifest.pins.oldBodyMd5, NEW = manifest.pins.newBodyMd5;
const OLD_COMMENT = "PKG-047 resolves a public profile the caller can see into the safety target of the person behind it, plus the caller's own block revision. Null whenever the public profile itself would be hidden. Never discloses an incoming block and never writes.";
const DIGEST = '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431';
const TARGET = 'public.rpc_read_safety_target(uuid)';
if (md5(devBody) !== OLD) throw new Error('dev body md5');

let failures = 0, total = 0;
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : x);
const check = (label, got, want) => {
  total++;
  const ok = typeof want === 'function' ? want(got) : (typeof want === 'string' && typeof got === 'string' && want.startsWith('~') ? got.includes(want.slice(1)) : canon(got) === canon(want));
  if (!ok) failures++;
  console.log((ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : '\n       got  ' + JSON.stringify(got) + '\n       want ' + JSON.stringify(want)));
};
const run = async (db, text) => { try { await db.exec(text); return 'OK'; } catch (e) { try { await db.exec('rollback'); } catch {} return 'ERR ' + String(e.message).split('\n')[0]; } };
const q1 = async (db, text, params) => (await db.query(text, params)).rows[0];
const bodyMd5 = async (db, sig) => (await q1(db, `select md5(replace(prosrc, chr(13), '')) m from pg_proc where oid = to_regprocedure($1)`, [sig])).m;
const comment = async (db, sig) => (await q1(db, `select obj_description(to_regprocedure($1), 'pg_proc') c`, [sig])).c;
const acl = async (db, sig) => (await q1(db, `select proacl::text a from pg_proc where oid = to_regprocedure($1)`, [sig])).a;
const catalog = async db => (await db.query(`select p.oid::regprocedure::text as sig, md5(p.prosrc) as m, to_jsonb(p) - 'prosrc' as meta from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','private','rls_private') order by 1`)).rows;

const V = '00000000-0000-4000-8000-0000000000a1', P = '00000000-0000-4000-8000-0000000000a2', X = '00000000-0000-4000-8000-0000000000a3', Y = '00000000-0000-4000-8000-0000000000a4';
const W = '00000000-0000-4000-8000-0000000000a5', C = '00000000-0000-4000-8000-0000000000a6', E = '00000000-0000-4000-8000-0000000000a7', D = '00000000-0000-4000-8000-0000000000a8';
const prof = (n, kind) => `00000000-0000-4000-8000-${(kind === 'REQUESTER' ? '1' : '2') + String(n).padStart(11, '0')}`;
const PROFILES = [[V, 'REQUESTER', 'Viktor Gledalac', 'ACTIVE'], [V, 'WORKER', 'Viktor Majstor', 'DRAFT'], [P, 'REQUESTER', 'Ana Naruciteljka', 'ACTIVE'], [P, 'WORKER', 'Ana Majstor', 'ACTIVE'],
  [X, 'REQUESTER', 'Xenija Blokirana', 'ACTIVE'], [X, 'WORKER', 'Xenija Majstor', 'DRAFT'], [Y, 'REQUESTER', 'Yuri Blokirao', 'ACTIVE'], [Y, 'WORKER', 'Yuri Majstor', 'DRAFT'],
  [W, 'REQUESTER', 'Wanda Test', 'ACTIVE'], [W, 'WORKER', 'Wanda Majstor', 'DRAFT'], [C, 'REQUESTER', 'Cvetko Odlazi', 'ACTIVE'], [C, 'WORKER', 'Cvetko Majstor', 'DRAFT'],
  [E, 'REQUESTER', '   ', 'ACTIVE'], [E, 'WORKER', 'Eva Majstor', 'DRAFT'], [D, 'REQUESTER', 'Dara Naruciteljka', 'ACTIVE'], [D, 'WORKER', 'Dara Nacrt', 'DRAFT']];
const accounts = {V, P, X, Y, W, C, E, D};
const pid = (account, kind) => prof(Object.values(accounts).indexOf(account) + 1, kind);

async function fresh() {
  const db = new PGlite();
  await db.exec(`set check_function_bodies = off;
    create schema private; create schema rls_private; create schema auth; create schema extensions; create schema supabase_migrations;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table supabase_migrations.schema_migrations(version text, name text, statements text[], created_by text, idempotency_key text unique, rollback text[]);
    create table public.app_profiles(id uuid primary key, account_id uuid not null, kind text not null, display_name text not null, profile_status text not null, avatar_path text, city text, headline text, bio text);
    create table public.agreements(requester_profile_id uuid, worker_profile_id uuid, status text);
    create table private.account_blocks(blocker_account_id uuid not null, blocked_account_id uuid not null, active boolean not null, revision integer not null, last_blocked_at timestamptz, updated_at timestamptz not null default now(), primary key (blocker_account_id, blocked_account_id));
    create table private.account_closure_requests(account_id uuid primary key, state text not null, revision integer not null default 1);
    create table private.account_lineage_v5(account_id uuid primary key, lineage text not null);
    create table private.closure_source_v5(singleton boolean primary key default true, sha256 text not null);
    create table private.closure_erasure_source_v5(singleton boolean primary key default true, sha256 text not null);
    insert into private.closure_source_v5 values (true, '${DIGEST}'); insert into private.closure_erasure_source_v5 values (true, '${DIGEST}');
    create function private.account_reputation(a uuid) returns jsonb language sql stable as $$ select '{"averageRating":null,"reviewCount":0}'::jsonb $$;
    create function private.closure_source_digest_v5() returns text language sql stable security definer set search_path to pg_catalog as $$ select '${DIGEST}'::text $$;
    create function private.closure_erasure_program_digest_v5() returns text language sql stable as $$ select 'program'::text $$;
    create function private.closure_schema_digest_v5_139() returns text language sql stable as $$ select 'schema'::text $$;
    create function private.closure_erasure_binding_v5() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create function private.agreement_invalidation_surface_v1() returns text language sql stable as $$ select 'inv'::text $$;
    create function private.agreement_voice_surface_v1() returns text language sql stable as $$ select 'voice'::text $$;
    create function private.retention_ai_source_ready() returns boolean language sql stable security definer set search_path to pg_catalog as $$ select true $$;`);
  for (const [sig, f] of Object.entries(BODIES)) {
    if (md5(f.body) !== f.md5) throw new Error('mock body md5 ' + sig + ' ' + md5(f.body));
    const [schema, rest] = sig.split('.'), name = rest.split('(')[0];
    const volatility = name === 'rpc_submit_safety_report' ? 'volatile' : 'stable';
    await db.exec(`create function ${schema}.${name}(${f.args}) returns ${f.returns} language ${f.language ?? 'plpgsql'} ${volatility} security definer set search_path to 'pg_catalog' as $function$${f.body}$function$;
      revoke all on function ${sig} from public;`);
    if (schema === 'public') await db.exec(`grant execute on function ${sig} to authenticated`);
  }
  await db.exec(`create function public.rpc_read_safety_target(p_profile_id uuid) returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$${devBody}$function$;
    revoke all on function ${TARGET} from public, anon, authenticated, service_role;
    grant execute on function ${TARGET} to authenticated;
    comment on function ${TARGET} is $c$${OLD_COMMENT}$c$;`);
  await db.exec('set check_function_bodies = on');
  for (const [account, kind, name, status] of PROFILES) {
    await db.query(`insert into public.app_profiles(id, account_id, kind, display_name, profile_status) values ($1,$2,$3,$4,$5)`, [pid(account, kind), account, kind, name, status]);
  }
  await db.exec(`insert into private.account_lineage_v5(account_id, lineage) values ('${W}', 'SYNTHETIC_ACCEPTANCE_FIXTURE');
    insert into private.account_closure_requests(account_id, state) values ('${C}', 'READY');
    insert into private.account_blocks(blocker_account_id, blocked_account_id, active, revision) values ('${V}', '${X}', true, 1), ('${Y}', '${V}', true, 1);`);
  return db;
}

const as = async (db, account) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [account ?? '']);
const target = async (db, caller, profile) => { await as(db, caller); return (await q1(db, `select public.rpc_read_safety_target($1::uuid) r`, [profile])).r; };
const publicProfile = async (db, caller, profile) => { await as(db, caller); return (await q1(db, `select public.rpc_get_public_profile($1::uuid) r`, [profile])).r; };
const pf = async (db, text) => (await db.query(text)).rows[0];
const tamper = (text, sig) => { const e = sig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(\\('${e}',\\s*')[0-9a-f]{32}('\\))`); if (!re.test(text)) throw new Error('pin not found ' + sig); return text.replace(re, (w, a, b) => a + '0'.repeat(32) + b); };

// ---------------------------------------------------------------- 1. the predecessor and the refusals
const db = await fresh();
check('model: the target is the DEV predecessor', [await bodyMd5(db, TARGET), await comment(db, TARGET), await acl(db, TARGET)], [OLD, OLD_COMMENT, '{postgres=X/postgres,authenticated=X/postgres}']);
const OLD_DEF = ['CREATE OR REPLACE FUNCTION public.rpc_read_safety_target(p_profile_id uuid)', ' RETURNS jsonb', ' LANGUAGE plpgsql', ' STABLE SECURITY DEFINER', " SET search_path TO 'pg_catalog'", 'AS $function$' + devBody + '$function$', ''].join(String.fromCharCode(10));
check('model: pg_get_functiondef of the predecessor is the text the generator expects', (await q1(db, `select pg_get_functiondef(to_regprocedure($1)) d`, [TARGET])).d, OLD_DEF);
const before = await target(db, V, pid(P, 'REQUESTER'));
check('BEFORE: the predecessor result has no displayName', Object.keys(before).sort(), ['accountId', 'authoritative', 'blocked', 'profileId', 'revision', 'targetAccountId']);
const preflight0 = (await pf(db, files.preflight)).preflight;
console.log('preflight on the predecessor', JSON.stringify(preflight0));
check('preflight on the predecessor is clean', [preflight0.problems, preflight0.informational, preflight0.pinsChecked], [[], [], 8]);
check('postflight on the predecessor reports the body drift (it is not the applied state)', (await pf(db, files.postflight)).postflight.problems.map(p => p.kind).sort(), ['BODY_DRIFT', 'TARGET_ATTRIBUTES']);

check('a CRLF text is refused', await run(db, files.candidate.replace(/\n/g, '\r\n')), '~EX07S06_CRLF_TEXT');
check('revert on the predecessor is refused', await run(db, files.revert), '~EX07S06_REVERT_STATE_NOT_THE_APPLIED_ONE');
for (const [sig] of manifest.pins.neighbours) check('drift of ' + sig + ' is refused', await run(db, tamper(files.candidate, sig)), '~EX07S06_PREDECESSOR_DRIFT: ' + sig);
check('drift of the target pin is refused', await run(db, tamper(files.candidate, TARGET)), '~EX07S06_PREDECESSOR_DRIFT: ' + TARGET);
check('the predecessor is untouched after the refusals', [await bodyMd5(db, TARGET), await comment(db, TARGET)], [OLD, OLD_COMMENT]);

await db.exec(`alter function ${TARGET} volatile`);
check('an attribute drift (volatility) is refused', await run(db, files.candidate), '~EX07S06_TARGET_ATTRIBUTE_DRIFT');
await db.exec(`alter function ${TARGET} stable`);
await db.exec(`grant execute on function ${TARGET} to anon`);
check('an ACL drift is refused', await run(db, files.candidate), '~EX07S06_TARGET_ATTRIBUTE_DRIFT');
await db.exec(`revoke all on function ${TARGET} from anon`);
await db.exec(`comment on function ${TARGET} is 'something else'`);
check('a comment drift is refused', await run(db, files.candidate), '~EX07S06_TARGET_ATTRIBUTE_DRIFT');
await db.exec(`comment on function ${TARGET} is $c$${OLD_COMMENT}$c$`);
await db.exec(`alter table public.app_profiles rename column display_name to display_label`);
check('a relation drift (app_profiles.display_name) is refused', await run(db, files.candidate), '~EX07S06_RELATION_DRIFT');
await db.exec(`alter table public.app_profiles rename column display_label to display_name`);
await db.exec(`alter table private.account_blocks alter column revision type bigint`);
check('a relation drift (account_blocks.revision type) is refused', await run(db, files.candidate), '~EX07S06_RELATION_DRIFT');
await db.exec(`alter table private.account_blocks alter column revision type integer`);
await db.exec(`update private.closure_source_v5 set sha256 = repeat('0', 64)`);
check('an uncertified closure is refused', await run(db, files.candidate), '~EX07S06_CLOSURE_NOT_READY');
await db.exec(`update private.closure_source_v5 set sha256 = '${DIGEST}'`);
await db.exec(`update private.closure_erasure_source_v5 set sha256 = repeat('1', 64)`);
check('an erasure source that differs is refused', await run(db, files.candidate), '~EX07S06_CLOSURE_NOT_READY');
await db.exec(`update private.closure_erasure_source_v5 set sha256 = '${DIGEST}'`);
await db.exec(`create or replace function private.retention_ai_source_ready() returns boolean language sql stable security definer set search_path to pg_catalog as $$ select false $$`);
check('a not-ready certificate is refused', await run(db, files.candidate), '~EX07S06_CLOSURE_NOT_READY');
await db.exec(`create or replace function private.retention_ai_source_ready() returns boolean language sql stable security definer set search_path to pg_catalog as $$ select true $$`);
await db.exec(`create or replace function private.closure_schema_digest_v5_139() returns text language sql stable as $$ select 'rpc_read_safety_target'::text $$`);
check('a certificate function that names the target is refused', await run(db, files.candidate), '~EX07S06_TARGET_IS_CERTIFIED');
await db.exec(`create or replace function private.closure_schema_digest_v5_139() returns text language sql stable as $$ select 'schema'::text $$`);
const preflight1 = (await pf(db, files.preflight)).preflight;
check('after all the refusals the predecessor state still has a clean preflight', preflight1.problems, []);
check('and the body, comment and ACL are unchanged', [await bodyMd5(db, TARGET), await comment(db, TARGET), await acl(db, TARGET)], [OLD, OLD_COMMENT, '{postgres=X/postgres,authenticated=X/postgres}']);

// ---------------------------------------------------------------- 2. the application
const catalogBefore = await catalog(db);
const t0 = Date.now();
check('APPLY', await run(db, files.candidate), 'OK');
console.log('applied in', Date.now() - t0, 'ms');
check('the body is the new md5, the comment the new one, the ACL unchanged', [await bodyMd5(db, TARGET), md5(await comment(db, TARGET)), await acl(db, TARGET)], [NEW, manifest.pins.newCommentMd5, '{postgres=X/postgres,authenticated=X/postgres}']);
const defAfter = (await q1(db, `select pg_get_functiondef(to_regprocedure($1)) d`, [TARGET])).d;
const newBodyExpected = devBody.replace(` return jsonb_build_object('profileId',v_profile.id,'accountId',v_actor,'targetAccountId',v_profile.account_id,\n  'blocked',coalesce(v_block.active,false),'revision',coalesce(v_block.revision,0),'authoritative',true);\n`,
  ` -- EX-07 S06: the displayed name of THE profile that was asked for (the face the caller is looking at, never another face of the same person), written exactly as\n -- rpc_get_public_profile writes it, so it is given where that profile is visible and nowhere else: every case that returned null above still returns null.\n return jsonb_build_object('profileId',v_profile.id,'accountId',v_actor,'targetAccountId',v_profile.account_id,\n  'displayName',nullif(btrim(v_profile.display_name),''),\n  'blocked',coalesce(v_block.active,false),'revision',coalesce(v_block.revision,0),'authoritative',true);\n`);
check('the applied definition is the DEV definition with the body replaced', defAfter, `CREATE OR REPLACE FUNCTION public.rpc_read_safety_target(p_profile_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$${newBodyExpected}$function$\n`);
check('the new body md5 is what the generator pinned', md5(newBodyExpected), NEW);
check('second apply is refused', await run(db, files.candidate), '~EX07S06_ALREADY_APPLIED');
const catalogAfter = await catalog(db);
check('exactly one function changed (its body only); nothing added or removed', (() => {
  const a = new Map(catalogBefore.map(r => [r.sig, r])), b = new Map(catalogAfter.map(r => [r.sig, r]));
  return {added: [...b.keys()].filter(k => !a.has(k)), removed: [...a.keys()].filter(k => !b.has(k)), changed: [...b.keys()].filter(k => a.has(k) && (a.get(k).m !== b.get(k).m || JSON.stringify(a.get(k).meta) !== JSON.stringify(b.get(k).meta)))};
})(), {added: [], removed: [], changed: ['rpc_read_safety_target(uuid)']});
const flight = (await pf(db, files.postflight)).postflight;
check('postflight after the application: problems [] and informational []', [flight.problems, flight.informational, flight.pinsChecked, flight.certifiedSource], [[], [], 8, DIGEST]);
const preAfter = (await pf(db, files.preflight)).preflight;
check('preflight after the application says ALREADY_APPLIED (and nothing else wrong with the body)', preAfter.problems.map(p => p.kind).sort(), ['ALREADY_APPLIED', 'TARGET_ATTRIBUTES']);
check('a CRLF revert is refused', await run(db, files.revert.replace(/\n/g, '\r\n')), '~EX07S06_REVERT_CRLF_TEXT');

// ---------------------------------------------------------------- 3. the behaviour of the new function (the real body, the real helper bodies)
const keys = o => Object.keys(o).sort();
const expectedKeys = ['accountId', 'authoritative', 'blocked', 'displayName', 'profileId', 'revision', 'targetAccountId'];
const vP = await target(db, V, pid(P, 'REQUESTER'));
check('V reads P (REQUESTER face): the name of that face, and nothing else changed', vP, {profileId: pid(P, 'REQUESTER'), accountId: V, targetAccountId: P, displayName: 'Ana Naruciteljka', blocked: false, revision: 0, authoritative: true});
check('the key set is exactly the old keys plus displayName', keys(vP), expectedKeys);
const vPw = await target(db, V, pid(P, 'WORKER'));
check('V reads P (WORKER face, ACTIVE): the name of THAT face (not the other one)', [vPw.displayName, vPw.targetAccountId, vPw.profileId], ['Ana Majstor', P, pid(P, 'WORKER')]);
check('the two faces of one person give two names and one target account', [vP.displayName !== vPw.displayName, vP.targetAccountId === vPw.targetAccountId], [true, true]);
check('parity: the name equals the one rpc_get_public_profile shows for the same profile', [(await publicProfile(db, V, pid(P, 'REQUESTER'))).displayName, (await publicProfile(db, V, pid(P, 'WORKER'))).displayName], [vP.displayName, vPw.displayName]);
check('a draft face (D worker) is null, as the public profile is', [await target(db, V, pid(D, 'WORKER')), await publicProfile(db, V, pid(D, 'WORKER'))], [null, null]);
check('a blank name is null in both, and the target still resolves', [(await publicProfile(db, V, pid(E, 'REQUESTER'))).displayName, (await target(db, V, pid(E, 'REQUESTER'))).displayName, (await target(db, V, pid(E, 'REQUESTER'))).targetAccountId], [null, null, E]);
check('the caller\'s own profile is null (the one deliberate difference from the public profile)', [await target(db, V, pid(V, 'REQUESTER')), (await publicProfile(db, V, pid(V, 'REQUESTER'))).displayName], [null, 'Viktor Gledalac']);
check('a profile the caller blocked is null (and so is the public profile)', [await target(db, V, pid(X, 'REQUESTER')), await publicProfile(db, V, pid(X, 'REQUESTER'))], [null, null]);
check('the blocked person reading the blocker is null as well', await target(db, X, pid(V, 'REQUESTER')), null);
check('a profile of a person who blocked the caller is null (an incoming block is never disclosed)', [await target(db, V, pid(Y, 'REQUESTER')), await publicProfile(db, V, pid(Y, 'REQUESTER'))], [null, null]);
check('another visibility world is null in both directions', [await target(db, V, pid(W, 'REQUESTER')), await target(db, W, pid(V, 'REQUESTER'))], [null, null]);
check('a closing target is null', await target(db, V, pid(C, 'REQUESTER')), null);
check('a closing caller is null', await target(db, C, pid(V, 'REQUESTER')), null);
check('an unknown profile is null', await target(db, V, '00000000-0000-4000-8000-00000000ffff'), null);
await as(db, null);
check('no caller still raises AUTH_REQUIRED', await run(db, `select public.rpc_read_safety_target('${pid(P, 'REQUESTER')}'::uuid)`), '~AUTH_REQUIRED');
await as(db, V);
check('a null profile still raises SAFETY_TARGET_INPUT_INVALID', await run(db, `select public.rpc_read_safety_target(null::uuid)`), '~SAFETY_TARGET_INPUT_INVALID');
const countBlocks = async () => (await q1(db, `select count(*)::int n, coalesce(sum(revision),0)::int r from private.account_blocks`));
const c0 = await countBlocks(); for (let i = 0; i < 5; i++) await target(db, V, pid(P, 'REQUESTER'));
check('reading writes nothing', await countBlocks(), c0);
await db.exec(`update private.account_blocks set active = false, revision = 2 where blocker_account_id = '${V}' and blocked_account_id = '${X}'`);
const afterUnblock = await target(db, V, pid(X, 'REQUESTER'));
check('after an unblock the target returns with the revision the next block needs', [afterUnblock.displayName, afterUnblock.blocked, afterUnblock.revision], ['Xenija Blokirana', false, 2]);
await db.exec(`update private.account_blocks set active = true, revision = 3 where blocker_account_id = '${V}' and blocked_account_id = '${X}'`);
// the documented limitation: the blocked list names a blocked person by the REQUESTER profile first
await db.exec(`insert into private.account_blocks(blocker_account_id, blocked_account_id, active, revision) values ('${V}', '${P}', true, 1)`);
await as(db, V);
const list = (await q1(db, `select public.rpc_list_my_account_blocks(null) r`)).r;
const listed = list.items.find(i => i.targetAccountId === P);
check('LIMITATION (documented): the blocked list names P by the REQUESTER profile first', listed.displayName, 'Ana Naruciteljka');
check('LIMITATION (documented): that is not the name a viewer saw for the WORKER face of P', listed.displayName !== vPw.displayName, true);
await db.exec(`delete from private.account_blocks where blocker_account_id = '${V}' and blocked_account_id = '${P}'`);

// ---------------------------------------------------------------- 4. the revert and the reapply
check('revert', await run(db, files.revert), 'OK');
check('md5, comment and ACL restored', [await bodyMd5(db, TARGET), await comment(db, TARGET), await acl(db, TARGET)], [OLD, OLD_COMMENT, '{postgres=X/postgres,authenticated=X/postgres}']);
check('restored byte for byte (the definition of the predecessor)', (await q1(db, `select prosrc = $1 as t from pg_proc where oid = to_regprocedure($2)`, [devBody, TARGET])).t, true);
check('the whole catalog is restored exactly', await catalog(db), catalogBefore);
check('second revert is refused', await run(db, files.revert), '~EX07S06_REVERT_STATE_NOT_THE_APPLIED_ONE');
const reverted = await target(db, V, pid(P, 'REQUESTER'));
check('after the revert the result is the old one again', keys(reverted), ['accountId', 'authoritative', 'blocked', 'profileId', 'revision', 'targetAccountId']);
// a changed neighbour must not stop the revert; and must stop the application
await run(db, files.candidate);
await db.exec(`create or replace function public.rpc_get_account_block(p_target_account_id uuid) returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$begin return null; end$function$`);
check('revert with a changed neighbour still runs (only reported)', await run(db, files.revert), 'OK');
check('apply with a changed neighbour is refused', await run(db, files.candidate), '~EX07S06_PREDECESSOR_DRIFT: public.rpc_get_account_block(uuid)');
const gab = BODIES['public.rpc_get_account_block(uuid)'];
await db.exec(`create or replace function public.rpc_get_account_block(p_target_account_id uuid) returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$${gab.body}$function$`);
check('reapply', await run(db, files.candidate), 'OK');
check('reapply equals the apply: the same catalog', await catalog(db), catalogAfter);
check('reapply gives the same answer', await target(db, V, pid(P, 'REQUESTER')), vP);
check('postflight clean again', (await pf(db, files.postflight)).postflight.problems, []);
check('revert after the reapply', await run(db, files.revert), 'OK');

// ---------------------------------------------------------------- 5. the guarded forms, on a fresh model each
const wrapperText = (text, tag = 'lCZXaDtNyWkdAfwHPldC') => 'begin;\n\n-- apply sql from post body\n' + text + ';\n\n-- track statements in history table\ninsert into supabase_migrations.schema_migrations as old\n  (version, name, statements, created_by, idempotency_key, rollback)\n'
  + "values (\n  to_char(current_timestamp, 'YYYYMMDDHH24MISS'),\n  $" + tag + '$dev_alpha_ex07_s06$' + tag + '$,\n  array[$' + tag + '$' + text + '$' + tag + '$],\n  $' + tag + '$user$' + tag + '$,\n  null,\n  null\n)\non conflict (idempotency_key) do update set\n  version = EXCLUDED.version;\n\ncommit;';
{
  const g = await fresh();
  check('plain guard: the guarded application runs', await run(g, files.plainApply), 'OK');
  check('plain guard: the body is the new one', await bodyMd5(g, TARGET), NEW);
  check('plain guard: the guarded revert runs', await run(g, files.plainRevert), 'OK');
  check('plain guard: restored', await bodyMd5(g, TARGET), OLD);
  check('plain guard: a trailing connector comment is accepted', await run(g, files.plainApply + '\n-- source: POST /mcp\n-- user: x\n-- date: now\n'), 'OK');
  await run(g, files.revert);
  check('plain guard: a missing final line feed is accepted', await run(g, files.plainApply.replace(/\n$/, '')), 'OK');
  await run(g, files.revert);
  check('plain guard: one changed byte is refused', await run(g, files.plainApply.replace('lock_timeout', 'lock_timeoyt')), '~EX07S06_APPLY_TEXT_INTEGRITY');
  check('plain guard: a statement after the candidate is refused', await run(g, files.plainApply + 'select 1;'), '~EX07S06_APPLY_TEXT_INTEGRITY');
  check('plain guard: a shifted start is refused', await run(g, ' ' + files.plainApply), '~EX07S06_APPLY_TEXT_INTEGRITY');
  check('plain guard: refused texts changed nothing', await bodyMd5(g, TARGET), OLD);
}
{
  const g = await fresh();
  const wrapped = wrapperText(files.migrationApply);
  check('migration guard: the connector wrapper (history insert included) runs the application', await run(g, wrapped), 'OK');
  check('migration guard: the body is the new one and the history row holds the guarded text', [await bodyMd5(g, TARGET), (await q1(g, `select count(*)::int n, bool_or(statements[1] = $1) same from supabase_migrations.schema_migrations`, [files.migrationApply]))], [NEW, {n: 1, same: true}]);
  check('migration guard: the connector wrapper runs the guarded revert', await run(g, wrapperText(files.migrationRevert, 'AbCdEfGhIjKlMnOpQrSt')), 'OK');
  check('migration guard: restored', await bodyMd5(g, TARGET), OLD);
  check('migration guard: one changed byte in the executed copy is refused', await run(g, wrapperText(files.migrationApply).replace('lock_timeout', 'lock_timeoyt')), '~EX07S06_APPLY_TEXT_INTEGRITY');
  const history = wrapperText(files.migrationApply), marker = '-- EX-07 S06 safety target displayed name: DEV application candidate.'; const second = history.indexOf(marker, history.indexOf(marker) + 1);
  check('migration guard: a changed byte in the history copy is refused', await run(g, history.slice(0, second + 2000) + 'X' + history.slice(second + 2001)), '~EX07S06_APPLY_TEXT_INTEGRITY');
  check('migration guard: a statement after the candidate is refused', await run(g, wrapperText(files.migrationApply + 'select 1;\n')), '~EX07S06_APPLY_TEXT_INTEGRITY');
  check('migration guard: the bare guarded text (no connector wrapper, one copy) is refused', await run(g, files.migrationApply), '~EX07S06_APPLY_TEXT_INTEGRITY');
  check('migration guard: nothing was applied by the refusals', await bodyMd5(g, TARGET), OLD);
}

console.log(`\n${total - failures} of ${total} checks passed` + (failures ? `, ${failures} FAILED` : ''));
process.exit(failures ? 1 : 0);
