// P6 world-boundary and helper-cost proof - DISPOSABLE LOCAL TARGET ONLY.
// Closes two gaps the rollout v3 proof (p6_rollout_v3_candidate_proof.mjs) left open; master plan row P6-03 ("equality/negative tests against the old rule;
// plans/BUFFERS in the relevant roles"):
//  (1) The REAL/TEST world boundary of the DEPLOYED rollout v3 was never exercised end-to-end through the readers with real rows. Every runtime fixture
//      so far held two unclassified (REAL) accounts, canonical DEV holds only TEST-world accounts, and the only semantic check of v3 is the in-transaction
//      truth table (private.accounts_same_world against the helper set). This proof seeds accounts of every lineage kind - the five lineage rows shaped
//      exactly like canonical DEV (p6_rollout_v3_live_observation.json), unclassified accounts and one explicit REAL_USER row - and, for each owner, published
//      tasks with a public point / without a point / remote / in SELECTION plus a DRAFT, a CANCELLED and a closed-remaining-search task that must never
//      appear. Then, as every viewer (TEST, REAL, REAL_USER, each owner) and as anon, it drives rpc_discovery_v1 PAGE (scope ALL, all pages), MAP (world
//      bounds), PLACES (all pages) and EXACT_PUBLIC, and the legacy reader rpc_list_open_tasks_v3 (all pages), and checks set equality by id against the OLD
//      RULE (private.accounts_same_world, evaluated as postgres over the whole table), against the lineage rule written in the plan (pure JS) and between the two
//      readers; counts, MAP buckets/bounds and PLACES facets never reveal the other world; EXACT_PUBLIC of a cross-world or unpublished id is "not found"
//      (an empty item list, never an empty successful item); anon is refused (42501) everywhere; no account id, description or exact address crosses.
//      The same equality is proved again with the classifier CHANGED (PKG-029e taken back: the two OWNER lineages leave the TEST world) inside a rolled-back
//      transaction - the owner-world tasks must then belong to the REAL world for every viewer.
//  (2) The RLS helper rls_private.p6_discovery_test_world_accounts() calls the SECURITY DEFINER classifier once per lineage row (uncorrelated InitPlan,
//      evaluated once per statement) on EVERY authenticated read of public.needs. Canonical DEV has five lineage rows; production could carry many REAL_USER
//      rows. This proof seeds REAL_USER lineage rows in bulk AFTER the rollout (the rollout's own truth table is quadratic in lineage rows and must see the DEV
//      shape) and measures, at 5 / 10 000 / 100 000 rows, the helper alone, a plain scan of the lineage table, one PAGE (limit 50) and one legacy page as a REAL
//      viewer, with one EXPLAIN (ANALYZE, BUFFERS) of the helper's query per size. Timings never fail the proof; only functional assertions do.
// It is not native acceptance, not a live apply, not an SLA and not a concurrency test. No canonical DEV access.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { URL } from 'node:url';
import os from 'node:os';

const out = '/tmp/p6-discovery-evidence';
const privateOut = process.env.PRE_V3_ARTIFACT_DIR ?? '/tmp/p6-discovery-private';
const rollout = 'supabase/candidates/p6_discovery_rollout_v3.sql';
const liveObservation = 'supabase/proofs/discovery/p6_rollout_v3_live_observation.json';
const workflow = '.github/workflows/p6-world-boundary-proof.yml';
const own = 'supabase/proofs/discovery/p6_world_boundary_proof.mjs';
const sources = [rollout, liveObservation, own, workflow, 'package.json', 'package-lock.json'];
// The DEPLOYED rollout (blob sha256 recorded by Round71's drift confirmation, p6_load_30k_v3.py PINNED_SHA256) and canonical DEV's readback values
// (receipt 20260930_p6_rollout_v3_application: md5(replace(prosrc,E'\r\n',E'\n')) of rpc_discovery_v1 and md5(pg_get_functiondef) of the helper).
const ROLLOUT_V3_SHA256 = 'ec92c2ee50b3191655f8036ae2391c6bacd0f571cc7a1f2c3252c891122cecc9';
const RPC_BODY_MD5 = '1c60224483697732c496df5b9207f08f';
const HELPER_DEF_MD5 = '4ee16169f4ee6ba7f79f4bd11b172ad8';
const functions = [
  'public.p6_discovery_trim(text)', 'public.p6_discovery_key(text)', 'public.p6_discovery_unquote(text)',
  'public.p6_discovery_area(text,text,boolean)', 'public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)',
  'public.p6_discovery_civil(text)', 'public.rpc_discovery_v1(jsonb)',
];
const POLICIES = ['needs_public_discovery', 'v5_closed_account_visibility'];
const HELPER = 'rls_private.p6_discovery_test_world_accounts()';
const LEGACY = 'public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)';
// The lineage CHECK constraint of private.account_lineage_v5 (ledger 20260917053239_dev_alpha_pkg015_account_lineage.sql).
const LINEAGES = ['OWNER_PERSONAL', 'OWNER_BUSINESS', 'DEV_ACCEPTANCE_QA', 'SYNTHETIC_ACCEPTANCE_FIXTURE', 'OPERATOR', 'REAL_USER'];
// The two classifier shapes: what canonical DEV runs (PKG-029e, the owner's two lineages share the TEST world while testing) and the PKG-015B original.
const TEST_LINEAGES = {
  DEV: ['DEV_ACCEPTANCE_QA', 'SYNTHETIC_ACCEPTANCE_FIXTURE', 'OPERATOR', 'OWNER_PERSONAL', 'OWNER_BUSINESS'],
  PRE029E: ['DEV_ACCEPTANCE_QA', 'SYNTHETIC_ACCEPTANCE_FIXTURE', 'OPERATOR'],
};
// The exact public projection of both readers (rpc_discovery_v1 `projected`, rpc_list_open_tasks_v3 P0 form). Anything else in an item is a defect.
const ALLOWED_ITEM_KEYS = new Set(['id', 'revision', 'sortAt', 'publishedAt', 'title', 'category', 'status', 'urgent', 'scheduleKind', 'startsAt', 'endsAt',
  'executionLocationMode', 'taskCountryCode', 'taskTimezone', 'verifiedIdentityRequired', 'approximateCity', 'approximateArea', 'pin', 'requiredSlots',
  'coveredSlots', 'requiredSkills', 'requiredTools', 'requiredVehicles', 'requiredLicenses', 'minimumExperienceYears', 'priceMode', 'requesterPriceRsd',
  'priceBasis', 'requesterProfileId', 'responseDeadline', 'acceptsApplications', 'publicTopology', 'criticalConditions']);
const FORBIDDEN_KEY_PATTERN = /account|description|close_reason|closeReason|closed_by|closedBy|exact|sensitive/i;
const DISCOVERABLE = ['point', 'nopoint', 'remote', 'selection'];
const HIDDEN = ['draft', 'cancelled', 'closedsearch'];
const COST_SIZES = [5, 10000, 100000];
const WARMUPS = 3; const SAMPLES = 15; const LEGACY_WARMUPS = 1; const LEGACY_SAMPLES = 5;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const lf = (text) => text.replace(/\r\n/g, '\n');
const q = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const sorted = (list) => [...list].sort();
const uniq = (list) => sorted(new Set(list));
const intersect = (a, b) => { const s = new Set(b); return sorted(a.filter((x) => s.has(x))); };
const report = { unit: 'P6_WORLD_BOUNDARY_AND_HELPER_COST', sourceSha: process.env.GITHUB_SHA, result: 'FAIL', sourceHashes: {},
  liveAccess: false, serverApplied: false, providerCalled: false, native: false, productionWired: false, p6Finished: false };
const detail = { unit: report.unit, viewers: {}, changedClassifier: {}, cost: [] };
let stage = 'ADMISSION';

const psql = (input, timeout = 240000) => spawnSync('psql', [process.env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
  { input, encoding: 'utf8', timeout, maxBuffer: 64 * 1024 * 1024 });
function mustSql(input, timeout) {
  const run = psql(input, timeout);
  if (run.status !== 0) { const e = new Error('P6_WB_SQL_REFUSED'); e.stderr = run.stderr; e.signal = run.signal; throw e; }
  return run.stdout.trim();
}
const jsonLines = (raw) => raw.split('\n').filter((x) => x.startsWith('{')).map((x) => JSON.parse(x));
const lastJson = (raw) => jsonLines(raw).at(-1);
const tagged = (lines, tag) => lines.filter((x) => x.tag === tag);
function applyFile(path) {
  return spawnSync('psql', [process.env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', path],
    { encoding: 'utf8', timeout: 240000, maxBuffer: 20 * 1024 * 1024 });
}
const sqlState = (stderr) => String(stderr ?? '').match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/)?.[1] ?? null;
const catalogSql = () => {
  const fn = functions.map((x) => "'" + x.replaceAll("'", "''") + "'").join(',');
  const pol = POLICIES.map((x) => `'${x}'`).join(',');
  return `select jsonb_build_object(
  'rpcPresent',to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null,
  'rpcBodyMd5',(select md5(replace(p.prosrc,E'\\r\\n',E'\\n')) from pg_proc p where p.oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')),
  'legacyBodyMd5',(select md5(replace(p.prosrc,E'\\r\\n',E'\\n')) from pg_proc p where p.oid=to_regprocedure('${LEGACY}')),
  'legacyDefiner',(select p.prosecdef from pg_proc p where p.oid=to_regprocedure('${LEGACY}')),
  'legacyAnon',has_function_privilege('anon','${LEGACY}','EXECUTE'),
  'cert',(select sha256 from private.closure_source_v5 where singleton),
  'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
  'digest',private.closure_source_digest_v5(),
  'ready',private.retention_ai_source_ready(),
  'needsAcl',(select relacl::text from pg_class where oid='public.needs'::regclass),
  'authTableSelect',has_table_privilege('authenticated','public.needs','SELECT'),
  'anonTableSelect',has_table_privilege('anon','public.needs','SELECT'),
  'privateReadable',exists(select 1 from unnest(array['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason']) c
    where has_column_privilege('authenticated','public.needs',c,'SELECT') or has_column_privilege('anon','public.needs',c,'SELECT')),
  'policyCount',(select count(*) from pg_policies where schemaname='public' and tablename='needs'),
  'policies',(select coalesce(jsonb_object_agg(policyname,md5(qual)),'{}'::jsonb) from pg_policies
     where schemaname='public' and tablename='needs' and policyname in (${pol})),
  'policyUsesHelper',position('p6_discovery_test_world_accounts' in coalesce((select qual from pg_policies where schemaname='public' and tablename='needs' and policyname='needs_public_discovery'),''))>0,
  'helper',(select jsonb_build_object('defMd5',md5(pg_get_functiondef(p.oid)),'definer',p.prosecdef,'volatility',p.provolatile,'settings',p.proconfig,
     'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
     'serviceRole',has_function_privilege('service_role',p.oid,'EXECUTE'))
     from pg_proc p where p.oid=to_regprocedure('${HELPER}')),
  'lineageRows',(select count(*) from private.account_lineage_v5),
  'lineageByKind',(select coalesce(jsonb_object_agg(x.lineage,x.n),'{}'::jsonb) from (select lineage,count(*) n from private.account_lineage_v5 group by 1) x),
  'needsRows',(select count(*) from public.needs),
  'functions',(select coalesce(jsonb_object_agg(sig,jsonb_build_object(
     'present',p.oid is not null,
     'definer',p.prosecdef,'settings',p.proconfig,
     'authenticated',case when p.oid is null then false else has_function_privilege('authenticated',p.oid,'EXECUTE') end,
     'anon',case when p.oid is null then false else has_function_privilege('anon',p.oid,'EXECUTE') end,
     'serviceRole',case when p.oid is null then false else has_function_privilege('service_role',p.oid,'EXECUTE') end
   ) order by sig),'{}'::jsonb)
   from unnest(array[${fn}]) sig left join pg_proc p on p.oid=to_regprocedure(sig))
 )`;
};
const catalog = () => JSON.parse(mustSql(catalogSql()));

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Fixture: eight accounts (every lineage kind that exists on canonical DEV, plus the two REAL kinds), five owners x seven tasks. Ids are generated here so
// the expectations can be derived independently of the database.
// ---------------------------------------------------------------------------------------------------------------------------------------------------
const prefix = 'P6WB_' + randomBytes(4).toString('hex').toUpperCase();
const secret = 'PRIVATE_' + randomBytes(12).toString('hex');
const addressSecret = 'ADDRESS_' + randomBytes(12).toString('hex');
const accounts = {
  ownerPersonal: { id: randomUUID(), lineage: 'OWNER_PERSONAL', owner: true, tag: 'OWNP' },
  ownerBusiness: { id: randomUUID(), lineage: 'OWNER_BUSINESS', owner: false, tag: 'OWNB' },
  qa: { id: randomUUID(), lineage: 'DEV_ACCEPTANCE_QA', owner: true, tag: 'QA' },
  fixtureA: { id: randomUUID(), lineage: 'SYNTHETIC_ACCEPTANCE_FIXTURE', owner: true, tag: 'FIXA' },
  fixtureB: { id: randomUUID(), lineage: 'SYNTHETIC_ACCEPTANCE_FIXTURE', owner: false, tag: 'FIXB' },
  realUser: { id: randomUUID(), lineage: 'REAL_USER', owner: true, tag: 'REALU', lineageRowAfterApply: true },
  unclassifiedOwner: { id: randomUUID(), lineage: null, owner: true, tag: 'UNC' },
  unclassifiedViewer: { id: randomUUID(), lineage: null, owner: false, tag: 'UNCV' },
};
const OWNERS = Object.keys(accounts).filter((k) => accounts[k].owner);
const VIEWERS = Object.keys(accounts);
const tasks = Object.fromEntries(OWNERS.map((k) => [k, Object.fromEntries([...DISCOVERABLE, ...HIDDEN].map((v) => [v, randomUUID()]))]));
const worldOf = (key, scenario) => (TEST_LINEAGES[scenario].includes(accounts[key].lineage ?? 'UNCLASSIFIED') ? 'TEST' : 'REAL');
const ownersOfWorld = (world, scenario) => OWNERS.filter((k) => worldOf(k, scenario) === world);
const discoverableOf = (ownerKey) => DISCOVERABLE.map((v) => tasks[ownerKey][v]);
const hiddenOf = (ownerKey) => HIDDEN.map((v) => tasks[ownerKey][v]);
const fixtureDiscoverable = sorted(OWNERS.flatMap(discoverableOf));
const fixtureHidden = sorted(OWNERS.flatMap(hiddenOf));
const fixtureAll = sorted([...fixtureDiscoverable, ...fixtureHidden]);
const accountIds = Object.values(accounts).map((a) => a.id);
const secrets = [...accountIds, secret, addressSecret];
// What the plan's lineage rule says a viewer must see of the fixture, computed without the database.
const planVisible = (viewerKey, scenario) => sorted(ownersOfWorld(worldOf(viewerKey, scenario), scenario).flatMap(discoverableOf));
const firstOtherOwner = (viewerKey, scenario) => ownersOfWorld(worldOf(viewerKey, scenario), scenario).find((k) => k !== viewerKey);
const otherWorldOwner = (viewerKey, scenario) => ownersOfWorld(worldOf(viewerKey, scenario) === 'TEST' ? 'REAL' : 'TEST', scenario)[0];

function seedAccountsSql() {
  const lineageRows = Object.values(accounts).filter((a) => a.lineage && !a.lineageRowAfterApply)
    .map((a) => `(${q(a.id)}::uuid,${q(a.lineage)},'Disposable proof shaped like canonical DEV','p6-world-boundary')`).join(',');
  return `do $seed$
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select id,'authenticated','authenticated','p6-wb-'||id||'@proof.invalid',statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Disposable world boundary proof"}'::jsonb,statement_timestamp(),statement_timestamp()
  from unnest(array[${accountIds.map((x) => q(x) + '::uuid').join(',')}]) id;
  insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values ${lineageRows};
end $seed$;`;
}
// Tasks the way p6_load_30k.sql seeds them (session_replication_role=replica: the row shape is the proof's, the lifecycle triggers are not exercised).
function seedTasksSql() {
  const parts = OWNERS.map((key, k) => {
    const a = accounts[key]; const t = tasks[key];
    const test = worldOf(key, 'DEV') === 'TEST';
    const lat = (test ? 44.80 : 45.25) + 0.01 * k, lng = (test ? 20.45 : 19.83) + 0.01 * k;
    const p = (v) => v.toFixed(2);
    const area = `${prefix} ${test ? 'TEST' : 'REAL'} kvart ${a.tag}`; const city = test ? 'Beograd' : 'Novi Sad';
    const title = (v) => q(`${prefix} ${a.tag} ${v}`);
    const desc = q(`${prefix} ${a.tag} ${secret} private description`);
    const ts = (i) => `statement_timestamp()-interval '2 days'+interval '${k * 7 + i} minutes'`;
    const row = (id, status, kindV, published, mode, la, ln, ar, ci, closed) =>
      `(${q(id)},${q(a.id)},profile_id,${q(status)},${title(kindV.toUpperCase())},${desc},'P6WB','OFFERS',2,1,${q(kindV === 'remote' ? 'REMOTE_ANYTIME' : 'FLEXIBLE')},${published},${q(mode)},${la},${ln},${q(ar)},${q(ci)},'RS','Europe/Belgrade',${closed})`;
    return `
  select id into strict profile_id from public.app_profiles where account_id=${q(a.id)}::uuid and kind='REQUESTER';
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
   schedule_kind,published_at,execution_location_mode,approximate_lat,approximate_lng,approximate_area,approximate_city,task_country_code,task_timezone,remaining_search_closed_at) values
   ${row(t.point, 'PUBLISHED', 'point', ts(0), 'STATIONARY', p(lat), p(lng), area, city, 'null')},
   ${row(t.nopoint, 'PUBLISHED', 'nopoint', ts(1), 'STATIONARY', 'null', 'null', area, city, 'null')},
   ${row(t.remote, 'PUBLISHED', 'remote', ts(2), 'REMOTE', 'null', 'null', prefix + ' Remote', '', 'null')},
   ${row(t.selection, 'SELECTION', 'selection', ts(3), 'STATIONARY', p(lat + 0.10), p(lng + 0.10), area, city, 'null')},
   ${row(t.draft, 'DRAFT', 'draft', 'null', 'STATIONARY', p(lat), p(lng), area, city, 'null')},
   ${row(t.cancelled, 'CANCELLED', 'cancelled', ts(5), 'STATIONARY', p(lat), p(lng), area, city, 'null')},
   ${row(t.closedsearch, 'PUBLISHED', 'closedsearch', ts(6), 'STATIONARY', p(lat), p(lng), area, city, "statement_timestamp()-interval '1 hour'")};
  insert into public.need_sensitive(need_id,exact_address,access_notes,exact_lat,exact_lng)
   values (${q(t.point)},${q(`${prefix} ${addressSecret} Ulica ${k + 1}`)},'Disposable proof',${p(lat)}1234,${p(lng)}1234);`;
  }).join('\n');
  return `begin;
set local session_replication_role=replica;
do $tasks$
declare profile_id uuid;
begin${parts}
end $tasks$;
commit;
analyze public.needs;`;
}

// The OLD RULE, evaluated as postgres over the whole table: what this viewer may see, and everything the readers' answers are compared with.
const expectedSql = (viewerId) => `with vis as (
  select n.id,n.approximate_lat,n.approximate_lng,n.approximate_area,n.approximate_city,n.execution_location_mode,
    (n.execution_location_mode is distinct from 'REMOTE' and n.approximate_lat is not null and n.approximate_lng is not null) as has_point
  from public.needs n
  where n.status in ('PUBLISHED','SELECTION') and n.published_at is not null and n.remaining_search_closed_at is null
    and n.published_at<=statement_timestamp()
    and private.accounts_same_world(n.requester_account_id,${q(viewerId)}::uuid)
)
select jsonb_build_object('tag','expected','viewer',${q(viewerId)},
 'world',private.account_visibility_world(${q(viewerId)}::uuid),
 'ids',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from vis),
 'count',(select count(*) from vis),
 'withPoint',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from vis where has_point),
 'points',(select coalesce(jsonb_agg(distinct jsonb_build_object('lat',approximate_lat,'lng',approximate_lng)),'[]'::jsonb) from vis where has_point),
 'bbox',(select case when count(*)=0 then null else jsonb_build_array(min(approximate_lng),min(approximate_lat),max(approximate_lng),max(approximate_lat)) end from vis where has_point),
 'facets',(select coalesce(jsonb_object_agg(key,n),'{}'::jsonb) from (
    select public.p6_discovery_key(public.p6_discovery_area(approximate_area,approximate_city,false)) as key,count(*) as n
    from vis where execution_location_mode is distinct from 'REMOTE' group by 1) f where key not in ('na daljinu','lokacija nije navedena'))
)::text;`;

// One viewer, impersonated the way the existing proofs do (set local role authenticated + request.jwt.claim.sub), reading through both readers.
function viewerSql(viewerId, probes) {
  return `set local role authenticated;
do $viewer$
declare
  v uuid:=${q(viewerId)}::uuid; f jsonb:='{"text":"","price":"all","where":"any","places":1,"when":"any","dates":null,"place":null}'::jsonb;
  req jsonb; resp jsonb; anchor jsonb; cursor_doc jsonb; page_text text; s text;
  secrets text[]:=array[${secrets.map(q).join(',')}];
  ids uuid[]:='{}'; pages integer:=0; keys text[]:='{}'; leak boolean:=false; first_counts jsonb;
  legacy_ids uuid[]:='{}'; legacy_pages integer:=0; legacy_keys text[]:='{}'; legacy_leak boolean:=false; before_at timestamptz; before_id uuid;
  map_resp jsonb; map_sum bigint; map_task_ids uuid[]; map_points jsonb; map_member_bounds jsonb; map_leak boolean:=false;
  places_resp jsonb; facets jsonb:='{}'::jsonb; places_pages integer:=0; everywhere bigint; in_area jsonb; places_leak boolean:=false;
  probes jsonb:=${q(JSON.stringify(probes))}::jsonb; probe record; exact jsonb:='{}'::jsonb; exact_leak boolean:=false; exact_keys text[]:='{}';
begin
  perform set_config('request.jwt.claim.sub',v::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);
  if auth.uid() is distinct from v then raise exception 'P6_WB_IMPERSONATION'; end if;
  if current_user<>'authenticated' or not row_security_active('public.needs') or current_setting('row_security')<>'on'
     or current_setting('session_replication_role')<>'origin' then raise exception 'P6_WB_AUTHORITY_REQUIRED'; end if;

  -- rpc_discovery_v1 PAGE, scope ALL, every page.
  anchor:='null'::jsonb; cursor_doc:='null'::jsonb;
  loop
    req:=jsonb_build_object('mode','PAGE','filter',f,'anchor',anchor,'scope','{"kind":"ALL"}'::jsonb,'limit',100,'after',cursor_doc);
    resp:=public.rpc_discovery_v1(req); pages:=pages+1;
    if pages>500 then raise exception 'P6_WB_PAGE_RUNAWAY'; end if;
    if pages=1 then first_counts:=resp->'counts'; end if;
    anchor:=resp->'anchor';
    select ids||coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) into ids from jsonb_array_elements(resp->'items') x;
    select keys||coalesce(array_agg(distinct k),'{}'::text[]) into keys from jsonb_array_elements(resp->'items') x,jsonb_object_keys(x) k;
    page_text:=resp::text;
    foreach s in array secrets loop if position(s in page_text)>0 then leak:=true; end if; end loop;
    if (resp->>'hasMore')::boolean then cursor_doc:=resp->'nextCursor'; else exit; end if;
  end loop;

  -- rpc_list_open_tasks_v3 (the legacy reader), every page.
  before_at:=null; before_id:=null;
  loop
    resp:=public.rpc_list_open_tasks_v3(null,'{}'::jsonb,200,before_at,before_id); legacy_pages:=legacy_pages+1;
    if legacy_pages>500 then raise exception 'P6_WB_LEGACY_PAGE_RUNAWAY'; end if;
    select legacy_ids||coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) into legacy_ids from jsonb_array_elements(resp->'items') x;
    select legacy_keys||coalesce(array_agg(distinct k),'{}'::text[]) into legacy_keys from jsonb_array_elements(resp->'items') x,jsonb_object_keys(x) k;
    page_text:=resp::text;
    foreach s in array secrets loop if position(s in page_text)>0 then legacy_leak:=true; end if; end loop;
    if (resp->>'hasMore')::boolean then
      select (x->>'sortAt')::timestamptz,(x->>'id')::uuid into before_at,before_id from jsonb_array_elements(resp->'items') x
       order by (x->>'sortAt')::timestamptz,(x->>'id')::uuid limit 1;
    else exit; end if;
  end loop;

  -- MAP over the whole world.
  req:=jsonb_build_object('mode','MAP','filter',f,'anchor','null'::jsonb,'bounds','[-180,-90,180,90]'::jsonb,'grid',24);
  map_resp:=public.rpc_discovery_v1(req);
  select coalesce(sum(case when x->>'kind'='TASK' then 1 else (x->>'taskCount')::bigint end),0),
         coalesce(array_agg((x->>'taskId')::uuid) filter (where x->>'kind'='TASK'),'{}'::uuid[]),
         coalesce(jsonb_agg(x->'point'),'[]'::jsonb),
         coalesce(jsonb_agg(x->'memberBounds') filter (where x->>'kind'='CLUSTER'),'[]'::jsonb)
    into map_sum,map_task_ids,map_points,map_member_bounds from jsonb_array_elements(map_resp->'buckets') x;
  page_text:=map_resp::text;
  foreach s in array secrets loop if position(s in page_text)>0 then map_leak:=true; end if; end loop;

  -- PLACES, no prefix, no facet area, every page.
  anchor:='null'::jsonb; cursor_doc:='null'::jsonb;
  loop
    req:=jsonb_build_object('mode','PLACES','filter',f,'anchor',anchor,'prefix','','facetArea','null'::jsonb,'limit',30,'after',cursor_doc);
    places_resp:=public.rpc_discovery_v1(req); places_pages:=places_pages+1;
    if places_pages>500 then raise exception 'P6_WB_PLACES_RUNAWAY'; end if;
    anchor:=places_resp->'anchor';
    select facets||coalesce(jsonb_object_agg(x->>'key',(x->>'count')::bigint),'{}'::jsonb) into facets from jsonb_array_elements(places_resp->'items') x;
    everywhere:=(places_resp#>>'{counts,everywhere}')::bigint; in_area:=places_resp#>'{counts,inArea}';
    page_text:=places_resp::text;
    foreach s in array secrets loop if position(s in page_text)>0 then places_leak:=true; end if; end loop;
    if (places_resp->>'hasMore')::boolean then cursor_doc:=places_resp->'nextCursor'; else exit; end if;
  end loop;

  -- EXACT_PUBLIC and the legacy exact landing for every probe.
  for probe in select key as label,value as need_id from jsonb_each_text(probes) loop
    resp:=public.rpc_discovery_v1(jsonb_build_object('mode','EXACT_PUBLIC','needId',probe.need_id));
    page_text:=resp::text;
    foreach s in array secrets loop if position(s in page_text)>0 then exact_leak:=true; end if; end loop;
    select exact_keys||coalesce(array_agg(distinct k),'{}'::text[]) into exact_keys from jsonb_array_elements(resp->'items') x,jsonb_object_keys(x) k;
    exact:=exact||jsonb_build_object(probe.label,jsonb_build_object(
      'p6Items',jsonb_array_length(resp->'items'),'p6FirstId',resp#>>'{items,0,id}','p6Keys',(select jsonb_agg(k order by k) from jsonb_object_keys(resp) k),
      'legacyItems',(select jsonb_array_length(l->'items') from public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',probe.need_id),50,null,null) l),
      'legacyFirstId',(select l#>>'{items,0,id}' from public.rpc_list_open_tasks_v3(null,jsonb_build_object('needId',probe.need_id),50,null,null) l)));
  end loop;

  perform set_config('p6wb.out',jsonb_build_object('tag','viewer','viewer',v,
    'p6',jsonb_build_object('ids',to_jsonb(ids),'pages',pages,'keys',(select coalesce(jsonb_agg(distinct k),'[]'::jsonb) from unnest(keys) k),'leak',leak,
      'listed',first_counts->'listed','mapped',first_counts->'mapped','withoutPoint',first_counts->'withoutPoint'),
    'legacy',jsonb_build_object('ids',to_jsonb(legacy_ids),'pages',legacy_pages,'keys',(select coalesce(jsonb_agg(distinct k),'[]'::jsonb) from unnest(legacy_keys) k),'leak',legacy_leak),
    'map',jsonb_build_object('mapped',map_resp#>'{counts,mapped}','withoutPoint',map_resp#>'{counts,withoutPoint}','bucketTaskSum',map_sum,
      'taskIds',to_jsonb(map_task_ids),'points',map_points,'memberBounds',map_member_bounds,'wholeBounds',map_resp->'wholeBounds',
      'buckets',jsonb_array_length(map_resp->'buckets'),'effectiveGrid',map_resp->'effectiveGrid','leak',map_leak),
    'places',jsonb_build_object('facets',facets,'everywhere',everywhere,'inArea',in_area,'pages',places_pages,'leak',places_leak),
    'exact',exact,'exactKeys',(select coalesce(jsonb_agg(distinct k),'[]'::jsonb) from unnest(exact_keys) k),'exactLeak',exact_leak)::text,true);
end $viewer$;
reset role;
select current_setting('p6wb.out');`;
}
function probesFor(viewerKey, scenario) {
  const other = firstOtherOwner(viewerKey, scenario); const cross = otherWorldOwner(viewerKey, scenario);
  const hiddenOwner = other ?? viewerKey;
  const probes = { sameWorld: tasks[other][DISCOVERABLE[0]], crossWorld: tasks[cross][DISCOVERABLE[0]], crossWorldRemote: tasks[cross].remote,
    hiddenDraft: tasks[hiddenOwner].draft, hiddenCancelled: tasks[hiddenOwner].cancelled, hiddenClosedSearch: tasks[hiddenOwner].closedsearch };
  if (accounts[viewerKey].owner) { probes.own = tasks[viewerKey].point; probes.ownDraft = tasks[viewerKey].draft; }
  return probes;
}
// Runs every viewer inside `wrapperHead ... wrapperTail` (one transaction) and returns {viewerKey: {expected, actual}}.
function runViewers(scenario, head, tail, timeout) {
  const script = [head];
  for (const key of VIEWERS) { script.push(expectedSql(accounts[key].id)); script.push(viewerSql(accounts[key].id, probesFor(key, scenario))); }
  script.push(tail);
  const lines = jsonLines(mustSql(script.join('\n'), timeout));
  const expected = tagged(lines, 'expected'); const actual = tagged(lines, 'viewer');
  assert.equal(expected.length, VIEWERS.length); assert.equal(actual.length, VIEWERS.length);
  return Object.fromEntries(VIEWERS.map((key, at) => {
    assert.equal(expected[at].viewer, accounts[key].id); assert.equal(actual[at].viewer, accounts[key].id);
    return [key, { expected: expected[at], actual: actual[at] }];
  }));
}
function assertViewer(key, scenario, { expected, actual }) {
  const label = `${scenario}:${key}`;
  const world = worldOf(key, scenario);
  assert.equal(expected.world, world, `${label}: the classifier must place this account where the plan's lineage rule places it`);
  const expectedIds = sorted(expected.ids);
  const p6Ids = sorted(actual.p6.ids); const legacyIds = sorted(actual.legacy.ids);
  assert.equal(new Set(p6Ids).size, p6Ids.length, `${label}: PAGE must not repeat an id across pages`);
  assert.equal(new Set(legacyIds).size, legacyIds.length, `${label}: the legacy reader must not repeat an id across pages`);
  // Equality against the old rule, and between the two readers.
  assert.deepEqual(p6Ids, expectedIds, `${label}: PAGE ids must equal the old rule (private.accounts_same_world)`);
  assert.deepEqual(legacyIds, expectedIds, `${label}: legacy reader ids must equal the old rule`);
  // Equality against the lineage rule written in the plan, on the fixture.
  const plan = planVisible(key, scenario);
  assert.deepEqual(intersect(p6Ids, fixtureAll), plan, `${label}: exactly the discoverable fixture tasks of this viewer's world`);
  const otherWorld = sorted(ownersOfWorld(world === 'TEST' ? 'REAL' : 'TEST', scenario).flatMap(discoverableOf));
  assert.deepEqual(intersect(p6Ids, otherWorld), [], `${label}: no task of the other world in PAGE`);
  assert.deepEqual(intersect(p6Ids, fixtureHidden), [], `${label}: no DRAFT/CANCELLED/closed-remaining-search task in PAGE`);
  if (accounts[key].owner) for (const id of discoverableOf(key)) assert.ok(p6Ids.includes(id), `${label}: an owner sees its own published tasks`);
  // Counts never reveal the other world.
  assert.equal(Number(actual.p6.listed), expected.count, `${label}: PAGE counts.listed`);
  assert.equal(Number(actual.p6.mapped), expected.count, `${label}: PAGE counts.mapped`);
  assert.equal(Number(actual.p6.withoutPoint), expected.count - expected.withPoint.length, `${label}: PAGE counts.withoutPoint`);
  // MAP: buckets, member counts and bounds come only from this world.
  assert.equal(Number(actual.map.mapped), expected.count, `${label}: MAP counts.mapped`);
  assert.equal(Number(actual.map.withoutPoint), expected.count - expected.withPoint.length, `${label}: MAP counts.withoutPoint`);
  assert.equal(Number(actual.map.bucketTaskSum), expected.withPoint.length, `${label}: MAP buckets account for exactly the visible tasks with a point`);
  for (const id of actual.map.taskIds) assert.ok(expected.withPoint.includes(id), `${label}: a MAP TASK bucket names only a visible task`);
  const pointKey = (p) => `${Number(p.lat)}:${Number(p.lng)}`;
  const expectedPoints = new Set(expected.points.map(pointKey));
  for (const p of actual.map.points) assert.ok(expectedPoints.has(pointKey(p)), `${label}: every MAP bucket point is a visible task's point`);
  if (expected.bbox === null) assert.equal(actual.map.wholeBounds, null, `${label}: MAP wholeBounds is null without visible points`);
  else assert.deepEqual(actual.map.wholeBounds.map(Number), expected.bbox.map(Number), `${label}: MAP wholeBounds equals the visible points' bounds`);
  for (const b of actual.map.memberBounds) {
    const [w, s, e, n] = b.map(Number); const [W, S, E, N] = expected.bbox.map(Number);
    assert.ok(w >= W && s >= S && e <= E && n <= N, `${label}: a CLUSTER memberBounds lies inside the visible points' bounds`);
  }
  assert.ok(actual.map.buckets <= 256, `${label}: MAP bucket bound`);
  // PLACES: facets and totals from this world only.
  const facets = Object.fromEntries(Object.entries(actual.places.facets).map(([k, v]) => [k, Number(v)]));
  const expectedFacets = Object.fromEntries(Object.entries(expected.facets).map(([k, v]) => [k, Number(v)]));
  assert.deepEqual(facets, expectedFacets, `${label}: PLACES facets equal the visible localities and their counts`);
  assert.equal(Number(actual.places.everywhere), expected.count, `${label}: PLACES counts.everywhere`);
  assert.equal(actual.places.inArea, null, `${label}: PLACES counts.inArea is null for scope ALL`);
  // EXACT_PUBLIC: same world found, cross world / unpublished not found, never an empty successful item.
  const ex = actual.exact; const probes = probesFor(key, scenario);
  assert.equal(ex.sameWorld.p6Items, 1, `${label}: EXACT_PUBLIC finds a same-world task`); assert.equal(ex.sameWorld.p6FirstId, probes.sameWorld);
  assert.equal(ex.sameWorld.legacyItems, 1); assert.equal(ex.sameWorld.legacyFirstId, probes.sameWorld);
  for (const name of ['crossWorld', 'crossWorldRemote', 'hiddenDraft', 'hiddenCancelled', 'hiddenClosedSearch', ...(accounts[key].owner ? ['ownDraft'] : [])]) {
    assert.equal(ex[name].p6Items, 0, `${label}: EXACT_PUBLIC ${name} is not found (empty item list)`); assert.equal(ex[name].p6FirstId, null);
    assert.equal(ex[name].legacyItems, 0, `${label}: legacy exact ${name} is not found`); assert.equal(ex[name].legacyFirstId, null);
  }
  if (accounts[key].owner) { assert.equal(ex.own.p6Items, 1, `${label}: an owner lands on its own task`); assert.equal(ex.own.p6FirstId, probes.own); }
  // EXACT_PUBLIC returns the PAGE document minus anchor/filterKey/counts/availability: a not-found answer is an empty `items`, never a hollow item.
  for (const name of Object.keys(ex)) assert.deepEqual(sorted(ex[name].p6Keys), ['asOf', 'hasMore', 'items', 'mode', 'nextCursor', 'version'], `${label}: EXACT_PUBLIC ${name} answer shape`);
  // Nothing private crosses: item keys are the public projection; no account id, description or exact address anywhere in any answer.
  for (const k of [...actual.p6.keys, ...actual.legacy.keys, ...actual.exactKeys]) {
    assert.ok(ALLOWED_ITEM_KEYS.has(k), `${label}: item key ${k} is not in the public projection`);
    assert.ok(!FORBIDDEN_KEY_PATTERN.test(k), `${label}: item key ${k}`);
  }
  assert.ok(actual.p6.keys.includes('id') && actual.legacy.keys.includes('id'), `${label}: items carry ids`);
  for (const [what, flag] of [['PAGE', actual.p6.leak], ['legacy', actual.legacy.leak], ['MAP', actual.map.leak], ['PLACES', actual.places.leak], ['EXACT_PUBLIC', actual.exactLeak]]) {
    assert.equal(flag, false, `${label}: ${what} answer contains a fixture account id, the private description or the exact address`);
  }
  return { world, expectedCount: expected.count, p6Count: p6Ids.length, legacyCount: legacyIds.length, p6Pages: actual.p6.pages, legacyPages: actual.legacy.pages,
    fixtureVisible: plan.length, withPoint: expected.withPoint.length, mapBuckets: actual.map.buckets, facets: Object.keys(facets).length,
    exact: Object.fromEntries(Object.entries(ex).map(([n, e]) => [n, { p6Items: e.p6Items, legacyItems: e.legacyItems }])) };
}

// Anon (and an authenticated session without a JWT) against every function, one psql session each: the SQLSTATE comes from psql's verbose stderr.
function refusal(role, statement) {
  const run = psql(`begin;\nset local role ${role};\n${statement};\nrollback;`);
  return { refused: run.status !== 0, sqlState: sqlState(run.stderr), tag: run.stderr.match(/P6_[A-Z0-9_]+|AUTH_REQUIRED|permission denied[^\n]*/)?.[0]?.slice(0, 120) ?? null };
}

// The bulk lineage rows for the helper-cost measurement (REAL_USER: the lineage production would carry), the way the DEV-shaped rows are created.
function seedRealUsers(n) {
  mustSql(`set statement_timeout to 0;
do $bulk$
declare ids uuid[]:=array(select gen_random_uuid() from generate_series(1,${n}));
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select id,'authenticated','authenticated','p6-wb-real-'||id||'@proof.invalid',statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Disposable helper-cost lineage row"}'::jsonb,statement_timestamp(),statement_timestamp()
  from unnest(ids) id;
  insert into private.account_lineage_v5(account_id,lineage,reason,source_ref)
  select id,'REAL_USER','Disposable helper-cost measurement row','p6-world-boundary' from unnest(ids) id;
end $bulk$;`, 45 * 60 * 1000);
}
const timingLoop = (varName, iterations, body) => `
  ms:='{}';
  for i in 1..${iterations} loop
    t0:=clock_timestamp(); ${body} ms:=ms||round((extract(epoch from clock_timestamp()-t0)*1000)::numeric,3);
  end loop;
  perform set_config(${q(varName)},to_jsonb(ms)::text,true);`;
function measureCost(realViewerId) {
  const raw = mustSql(`set statement_timeout to 0;
analyze private.account_lineage_v5;
begin;
select jsonb_build_object('tag','env','postgres',current_setting('server_version'),'jit',current_setting('jit'),'workMem',current_setting('work_mem'),
 'sharedBuffers',current_setting('shared_buffers'),'maxParallelWorkersPerGather',current_setting('max_parallel_workers_per_gather'),
 'lineageRows',(select count(*) from private.account_lineage_v5),
 'lineageByKind',(select coalesce(jsonb_object_agg(x.lineage,x.n),'{}'::jsonb) from (select lineage,count(*) n from private.account_lineage_v5 group by 1) x),
 'lineageRelationBytes',pg_total_relation_size('private.account_lineage_v5'),
 'needsRows',(select count(*) from public.needs))::text;
do $helper$
declare t0 timestamptz; ms numeric[]; r uuid[]; n bigint; i integer;
begin
  ${timingLoop('p6wb.helper', WARMUPS + SAMPLES, 'select rls_private.p6_discovery_test_world_accounts() into r;')}
  perform set_config('p6wb.helperCardinality',cardinality(r)::text,true);
  ${timingLoop('p6wb.scan', WARMUPS + SAMPLES, 'select count(*) into n from private.account_lineage_v5;')}
end $helper$;
set local role authenticated;
do $page$
declare t0 timestamptz; ms numeric[]; resp jsonb; i integer; v uuid:=${q(realViewerId)}::uuid;
  req jsonb:=jsonb_build_object('mode','PAGE','filter','{"text":"","price":"all","where":"any","places":1,"when":"any","dates":null,"place":null}'::jsonb,
    'anchor','null'::jsonb,'scope','{"kind":"ALL"}'::jsonb,'limit',50,'after','null'::jsonb);
begin
  perform set_config('request.jwt.claim.sub',v::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated')::text,true);
  if auth.uid() is distinct from v or current_user<>'authenticated' or not row_security_active('public.needs') then raise exception 'P6_WB_AUTHORITY_REQUIRED'; end if;
  ${timingLoop('p6wb.page', WARMUPS + SAMPLES, 'resp:=public.rpc_discovery_v1(req);')}
  perform set_config('p6wb.pageListed',resp#>>'{counts,listed}',true);
  perform set_config('p6wb.pageItems',jsonb_array_length(resp->'items')::text,true);
  ${timingLoop('p6wb.legacy', LEGACY_WARMUPS + LEGACY_SAMPLES, "resp:=public.rpc_list_open_tasks_v3(null,'{}'::jsonb,50,null,null);")}
  perform set_config('p6wb.legacyItems',jsonb_array_length(resp->'items')::text,true);
end $page$;
reset role;
do $plan$
declare plan text;
begin
  execute $x$explain (analyze, buffers, format json) select coalesce(array_agg(l.account_id order by l.account_id),array[]::uuid[])
    from private.account_lineage_v5 l where private.account_visibility_world(l.account_id)='TEST'$x$ into plan;
  perform set_config('p6wb.plan',plan,true);
end $plan$;
select jsonb_build_object('tag','cost','helperMs',current_setting('p6wb.helper')::jsonb,'helperCardinality',current_setting('p6wb.helperCardinality')::integer,
 'scanMs',current_setting('p6wb.scan')::jsonb,'pageMs',current_setting('p6wb.page')::jsonb,'pageListed',current_setting('p6wb.pageListed')::bigint,
 'pageItems',current_setting('p6wb.pageItems')::integer,'legacyMs',current_setting('p6wb.legacy')::jsonb,'legacyItems',current_setting('p6wb.legacyItems')::integer,
 'plan',current_setting('p6wb.plan')::jsonb)::text;
rollback;`, 90 * 60 * 1000);
  const lines = jsonLines(raw);
  const env = tagged(lines, 'env')[0]; const cost = tagged(lines, 'cost')[0];
  assert.ok(env && cost, 'P6_WB_COST_OUTPUT');
  return { env, cost };
}
function stats(samples, warmups) {
  const measured = samples.slice(warmups).map(Number).sort((a, b) => a - b);
  const n = measured.length; const at = (p) => measured[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
  return { n, warmups, medianMs: n % 2 ? measured[(n - 1) / 2] : Number(((measured[n / 2 - 1] + measured[n / 2]) / 2).toFixed(3)),
    minMs: measured[0], p95Ms: at(0.95), maxMs: measured[n - 1] };
}
function cpuModel() {
  try { return readFileSync('/proc/cpuinfo', 'utf8').split('\n').find((x) => x.startsWith('model name'))?.split(':')[1]?.trim() ?? os.cpus()[0]?.model ?? 'unknown'; }
  catch { return os.cpus()[0]?.model ?? 'unknown'; }
}

// `--print-sql` writes the generated SQL of every stage to stdout and exits without touching any database (review aid; CI never uses it).
if (process.argv.includes('--print-sql')) {
  const demoProbes = probesFor('fixtureB', 'DEV');
  const sections = [['-- SEED ACCOUNTS', seedAccountsSql()], ['-- SEED TASKS', seedTasksSql()], ['-- EXPECTED (viewer fixtureB)', expectedSql(accounts.fixtureB.id)],
    ['-- VIEWER (fixtureB)', viewerSql(accounts.fixtureB.id, demoProbes)], ['-- CATALOG', catalogSql()]];
  for (const [title, sql] of sections) console.log(`${title}\n${sql}\n`);
  process.exit(0);
}

try {
  assert.equal(process.env.CI, '1'); assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.P6_PUBLIC_ARTIFACT_DIR, out);
  const u = new URL(process.env.DB_URL);
  assert.equal(u.hostname, '127.0.0.1'); assert.equal(u.port, '54322'); assert.equal(u.pathname, '/postgres'); assert.equal(u.username, 'postgres');
  assert.equal(process.env.DB_URL, process.env.RU5_DEVICE_DB_URL);
  mkdirSync(out, { recursive: true }); mkdirSync(privateOut, { recursive: true });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(head, report.sourceSha);
  for (const path of sources) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', head + ':' + path]));
    report.sourceHashes[path] = sha256(bytes);
  }
  assert.equal(sha256(Buffer.from(lf(readFileSync(rollout, 'utf8')))), ROLLOUT_V3_SHA256, 'PIN: the DEPLOYED rollout v3');
  report.rolloutV3Sha256 = ROLLOUT_V3_SHA256;
  const live = JSON.parse(readFileSync(liveObservation, 'utf8'));
  // The fixture's five lineage rows are exactly canonical DEV's shape, and the classifier list this proof assumes is the one DEV runs.
  const fixtureLineageCounts = {};
  for (const a of Object.values(accounts)) if (a.lineage && !a.lineageRowAfterApply) fixtureLineageCounts[a.lineage] = (fixtureLineageCounts[a.lineage] ?? 0) + 1;
  assert.deepEqual(fixtureLineageCounts, live.accountLineageCounts, 'P6_WB_FIXTURE_NOT_DEV_SHAPED');
  assert.deepEqual(sorted(live.classifierTestLineages), sorted(TEST_LINEAGES.DEV), 'P6_WB_CLASSIFIER_LIST_NOT_DEV');
  for (const a of Object.values(accounts)) if (a.lineage) assert.ok(LINEAGES.includes(a.lineage));
  report.fixture = { prefix, accounts: Object.fromEntries(Object.entries(accounts).map(([k, a]) => [k, { lineage: a.lineage ?? 'UNCLASSIFIED', owner: a.owner,
    worldOnDev: worldOf(k, 'DEV'), worldPre029e: worldOf(k, 'PRE029E'), lineageRowAfterApply: !!a.lineageRowAfterApply }])),
    tasksPerOwner: { discoverable: DISCOVERABLE, hidden: HIDDEN }, tasks: { discoverable: fixtureDiscoverable.length, hidden: fixtureHidden.length },
    lineageRowsAtApply: fixtureLineageCounts };

  stage = 'PKG045B_PRECONDITION';
  const pre = catalog();
  assert.equal(pre.rpcPresent, false); assert.equal(pre.helper, null);
  assert.equal(pre.authTableSelect, false); assert.equal(pre.anonTableSelect, false); assert.equal(pre.privateReadable, false);
  assert.equal(pre.ready, true); assert.equal(pre.cert, pre.erasure); assert.equal(pre.cert, pre.digest);
  assert.equal(pre.policyCount, 6);
  for (const name of POLICIES) assert.equal(pre.policies[name], live.needsPolicyQualMd5[name], `PREDECESSOR_POLICY_DRIFT:${name}`);
  assert.equal(pre.legacyDefiner, false, 'the legacy reader is SECURITY INVOKER (RLS applies to it)'); assert.equal(pre.legacyAnon, false);
  // The legacy reader in its Discovery P0 form (the body md5 pinned by discovery_p0_exact_public_landing.sql and pkg045b_task_column_privileges_p0.sql).
  assert.equal(pre.legacyBodyMd5, '602113d52d64c775893752ff74bfc324', 'P6_WB_LEGACY_READER_NOT_P0');
  const preTestWorld = Number(mustSql(`select count(*) from private.account_lineage_v5 l where private.account_visibility_world(l.account_id)='TEST'`));
  report.localPredecessor = { pkg045bRestricted: true, cert: pre.cert, policyQualMd5: pre.policies, matchesCanonicalDevPolicies: true,
    preExistingLineageRows: pre.lineageRows, preExistingTestWorldAccounts: preTestWorld, preExistingNeeds: pre.needsRows, legacyBodyMd5: pre.legacyBodyMd5 };

  stage = 'FIXTURE_ACCOUNTS';
  mustSql(seedAccountsSql());
  const afterAccounts = catalog();
  assert.equal(afterAccounts.lineageRows, pre.lineageRows + 5);
  stage = 'FIXTURE_TASKS';
  mustSql(seedTasksSql());
  const seededTasks = Number(mustSql(`select count(*) from public.needs where id=any(${'array[' + fixtureAll.map((x) => q(x) + '::uuid').join(',') + ']'})`));
  assert.equal(seededTasks, fixtureAll.length);
  assert.equal(Number(mustSql(`select count(*) from public.need_sensitive where exact_address like ${q('%' + addressSecret + '%')}`)), OWNERS.length);

  stage = 'DEPLOYED_ROLLOUT_V3_APPLY';
  const applied = applyFile(rollout);
  if (applied.status !== 0) { const error = new Error('P6_WB_ROLLOUT_V3_APPLY_LOCAL'); error.stderr = applied.stderr; throw error; }
  stage = 'POST_APPLY_READBACK';
  const post = catalog();
  assert.equal(post.rpcPresent, true); assert.equal(post.ready, true);
  assert.equal(post.cert, pre.cert); assert.equal(post.erasure, pre.erasure); assert.equal(post.digest, pre.digest);
  assert.equal(post.needsAcl, pre.needsAcl); assert.equal(post.authTableSelect, false); assert.equal(post.anonTableSelect, false); assert.equal(post.privateReadable, false);
  assert.equal(post.policyCount, 6); assert.equal(post.policyUsesHelper, true);
  assert.equal(post.rpcBodyMd5, RPC_BODY_MD5, 'the RPC body must be the one canonical DEV read back');
  assert.equal(post.helper.defMd5, HELPER_DEF_MD5, 'the helper must be the one canonical DEV read back');
  assert.equal(post.helper.definer, true); assert.equal(post.helper.volatility, 's'); assert.equal(post.helper.authenticated, true); assert.equal(post.helper.anon, false);
  for (const [signature, value] of Object.entries(post.functions)) {
    assert.equal(value.present, true, signature); assert.equal(value.definer, false, signature); assert.deepEqual(value.settings, ['search_path=pg_catalog'], signature);
    assert.equal(value.authenticated, true, signature); assert.equal(value.anon, false, signature); assert.equal(value.serviceRole, false, signature);
  }
  assert.equal(post.legacyBodyMd5, pre.legacyBodyMd5, 'the rollout does not touch the legacy reader');
  report.postApply = { certificateUnchanged: true, needsAclUnchanged: true, rpcBodyMd5: post.rpcBodyMd5, helperDefMd5: post.helper.defMd5, policyCount: post.policyCount,
    lineageRowsSeenByTheTruthTable: post.lineageRows, lineageByKind: post.lineageByKind };

  stage = 'HELPER_COST_DEV_SHAPE';
  const costRuns = [];
  const recordCost = (label) => {
    const { env, cost } = measureCost(accounts.unclassifiedViewer.id);
    assert.equal(cost.helperCardinality, 5 + preTestWorld, 'the TEST-world set stays the five DEV-shaped accounts (plus any the replayed target already held) at every size');
    const row = { label, lineageRows: Number(env.lineageRows), lineageByKind: env.lineageByKind, lineageRelationBytes: Number(env.lineageRelationBytes), needsRows: Number(env.needsRows),
      helper: stats(cost.helperMs, WARMUPS), scan: stats(cost.scanMs, WARMUPS), page: stats(cost.pageMs, WARMUPS), legacy: stats(cost.legacyMs, LEGACY_WARMUPS),
      pageListed: Number(cost.pageListed), pageItems: cost.pageItems, legacyItems: cost.legacyItems,
      planTotalMs: cost.plan?.[0]?.['Execution Time'], planningMs: cost.plan?.[0]?.['Planning Time'], plan: cost.plan };
    costRuns.push(row); detail.cost.push({ label, env, cost });
    report.environment ??= { postgres: env.postgres, jit: env.jit, workMem: env.workMem, sharedBuffers: env.sharedBuffers, maxParallelWorkersPerGather: env.maxParallelWorkersPerGather,
      cpuModel: cpuModel(), cpuCount: os.cpus().length, os: `${os.platform()} ${os.release()}`, runner: process.env.RUNNER_NAME ?? null,
      method: `server-side clock_timestamp around each call in one backend; ${WARMUPS} warm-ups then ${SAMPLES} samples (legacy reader ${LEGACY_WARMUPS}+${LEGACY_SAMPLES}); median reported; helper and scan as postgres, PAGE/legacy as the REAL (unclassified) viewer under RLS; EXPLAIN (ANALYZE, BUFFERS) of the helper's body query as postgres` };
    return row;
  };
  recordCost('DEV shape (the five TEST-world lineage rows, before the REAL_USER row)');

  stage = 'REAL_USER_ROW';
  mustSql(`insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values (${q(accounts.realUser.id)}::uuid,'REAL_USER','An ordinary account, explicitly classified','p6-world-boundary');`);
  stage = 'CLASSIFIER_SHAPE';
  const worlds = JSON.parse(mustSql(`select jsonb_object_agg(a.id::text,private.account_visibility_world(a.id)) from unnest(array[${accountIds.map((x) => q(x) + '::uuid').join(',')}]) a(id)`));
  for (const [key, a] of Object.entries(accounts)) assert.equal(worlds[a.id], worldOf(key, 'DEV'), `the disposable classifier (PKG-029e replayed) places ${key} like canonical DEV`);
  const sets = lastJson(mustSql(`select jsonb_build_object(
 'helper',(select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from unnest(rls_private.p6_discovery_test_world_accounts()) x),
 'classifier',(select coalesce(jsonb_agg(l.account_id order by l.account_id),'[]'::jsonb) from private.account_lineage_v5 l where private.account_visibility_world(l.account_id)='TEST'))`));
  assert.deepEqual(sets.helper, sets.classifier);
  assert.deepEqual(intersect(sets.helper, accountIds), sorted(Object.keys(accounts).filter((k) => worldOf(k, 'DEV') === 'TEST').map((k) => accounts[k].id)));
  report.classifierShape = { worlds: Object.fromEntries(Object.entries(accounts).map(([k, a]) => [k, worlds[a.id]])), helperEqualsClassifier: true, testWorldAccounts: sets.helper.length };

  stage = 'WORLD_BOUNDARY_DEV_CLASSIFIER';
  const dev = runViewers('DEV', 'begin;', 'rollback;', 30 * 60 * 1000);
  report.viewers = {};
  for (const key of VIEWERS) { report.viewers[key] = assertViewer(key, 'DEV', dev[key]); detail.viewers[key] = dev[key]; }
  const seenAnywhere = uniq(VIEWERS.flatMap((k) => dev[k].actual.p6.ids));
  assert.deepEqual(intersect(seenAnywhere, fixtureAll), fixtureDiscoverable, 'every discoverable fixture task is seen by its own world and no hidden one by anybody');
  const testViewer = dev.fixtureB.actual.p6.ids, realViewer = dev.unclassifiedViewer.actual.p6.ids, realUser = dev.realUser.actual.p6.ids;
  assert.deepEqual(intersect(testViewer, realViewer), [], 'TEST and REAL viewers share no task');
  assert.deepEqual(sorted(realUser), sorted(realViewer), 'an explicit REAL_USER and an unclassified account see the same REAL world');
  assert.deepEqual(sorted(dev.ownerBusiness.actual.p6.ids), sorted(testViewer), 'on DEV the owner lineage sees the TEST world (PKG-029e)');
  report.worldBoundary = { classifier: 'DEV (PKG-029e: OWNER_PERSONAL/OWNER_BUSINESS in the TEST world)', viewers: VIEWERS.length,
    testWorldVisible: testViewer.length, realWorldVisible: realViewer.length, everyViewerEqualsOldRule: true, everyViewerEqualsLegacyReader: true, hiddenNeverAppear: true, privateNeverCrosses: true };

  stage = 'WORLD_BOUNDARY_CHANGED_CLASSIFIER';
  // What taking PKG-029e back looks like (the v3 proof's HELPER_FOLLOWS_A_CHANGED_CLASSIFIER, now through the readers): rolled back.
  const changedHead = `begin;
create or replace function private.account_visibility_world(p_account_id uuid) returns text language sql stable security definer set search_path to 'pg_catalog' as $w$
  select case when coalesce(private.account_lineage(p_account_id),'UNCLASSIFIED') in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR') then 'TEST' else 'REAL' end;
$w$;`;
  const changed = runViewers('PRE029E', changedHead, 'rollback;', 30 * 60 * 1000);
  report.changedClassifierViewers = {};
  for (const key of VIEWERS) { report.changedClassifierViewers[key] = assertViewer(key, 'PRE029E', changed[key]); detail.changedClassifier[key] = changed[key]; }
  const ownerTasks = discoverableOf('ownerPersonal');
  for (const key of ['unclassifiedViewer', 'realUser', 'unclassifiedOwner', 'ownerBusiness', 'ownerPersonal']) {
    for (const id of ownerTasks) assert.ok(changed[key].actual.p6.ids.includes(id), `changed classifier: ${key} (now REAL) sees the owner-world tasks`);
  }
  for (const key of ['fixtureB', 'qa', 'fixtureA']) assert.deepEqual(intersect(changed[key].actual.p6.ids, ownerTasks), [], `changed classifier: ${key} (TEST) no longer sees the owner-world tasks`);
  assert.deepEqual(sorted(changed.ownerBusiness.actual.p6.ids), sorted(changed.unclassifiedViewer.actual.p6.ids), 'changed classifier: an owner-lineage viewer sees exactly the REAL world');
  assert.deepEqual(lastJson(mustSql(`select jsonb_build_object('helper',(select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from unnest(rls_private.p6_discovery_test_world_accounts()) x))`)).helper, sets.helper,
    'the rolled-back experiment leaves the classifier and the helper as they were');
  report.changedClassifier = { classifier: 'PRE-029e (only DEV_ACCEPTANCE_QA/SYNTHETIC_ACCEPTANCE_FIXTURE/OPERATOR are TEST), inside a rolled-back transaction',
    ownerWorldTasksMovedToReal: true, everyViewerEqualsOldRule: true, everyViewerEqualsLegacyReader: true, rolledBack: true };

  stage = 'ANON_AND_NO_JWT_REFUSED';
  const probeId = tasks.qa.point;
  const anonCalls = {
    'public.p6_discovery_trim(text)': "select public.p6_discovery_trim('x')",
    'public.p6_discovery_key(text)': "select public.p6_discovery_key('x')",
    'public.p6_discovery_unquote(text)': "select public.p6_discovery_unquote('x')",
    'public.p6_discovery_area(text,text,boolean)': "select public.p6_discovery_area('a','b',false)",
    'public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)': "select public.p6_discovery_days('FLEXIBLE',null,null,'UTC',statement_timestamp())",
    'public.p6_discovery_civil(text)': "select public.p6_discovery_civil('2026-01-01')",
    'public.rpc_discovery_v1(jsonb) EXACT_PUBLIC': `select public.rpc_discovery_v1(jsonb_build_object('mode','EXACT_PUBLIC','needId',${q(probeId)}))`,
    'public.rpc_discovery_v1(jsonb) PAGE': `select public.rpc_discovery_v1('{"mode":"PAGE","filter":{"text":"","price":"all","where":"any","places":1,"when":"any","dates":null,"place":null},"anchor":null,"scope":{"kind":"ALL"},"limit":10,"after":null}'::jsonb)`,
    [HELPER]: 'select rls_private.p6_discovery_test_world_accounts()',
    [LEGACY]: "select public.rpc_list_open_tasks_v3(null,'{}'::jsonb,50,null,null)",
    'table public.needs': 'select count(*) from public.needs',
  };
  report.anon = {};
  for (const [name, statement] of Object.entries(anonCalls)) {
    const r = refusal('anon', statement);
    assert.equal(r.refused, true, `anon: ${name} must be refused`); assert.equal(r.sqlState, '42501', `anon: ${name} must be refused with 42501, got ${r.sqlState} (${r.tag})`);
    report.anon[name] = r.sqlState;
  }
  report.authenticatedWithoutJwt = {};
  for (const [name, statement, expected] of [
    ['public.rpc_discovery_v1(jsonb)', anonCalls['public.rpc_discovery_v1(jsonb) EXACT_PUBLIC'], '28000'],
    [LEGACY, anonCalls[LEGACY], '28000'],
    ['table public.needs', anonCalls['table public.needs'], '42501'],
  ]) {
    const r = refusal('authenticated', statement);
    assert.equal(r.refused, true, `authenticated without a JWT: ${name}`); assert.equal(r.sqlState, expected, `authenticated without a JWT: ${name} got ${r.sqlState} (${r.tag})`);
    report.authenticatedWithoutJwt[name] = r.sqlState;
  }

  stage = 'HELPER_COST_SCALE';
  let current = Number(mustSql('select count(*) from private.account_lineage_v5'));
  for (const target of COST_SIZES.slice(1)) {
    stage = `HELPER_COST_SEED_${target}`;
    while (current < target) { const batch = Math.min(10000, target - current); seedRealUsers(batch); current += batch; }
    assert.equal(Number(mustSql('select count(*) from private.account_lineage_v5')), current);
    stage = `HELPER_COST_MEASURE_${target}`;
    const row = recordCost(`${target} lineage rows (REAL_USER bulk + the DEV shape + the fixture's REAL_USER)`);
    assert.equal(row.lineageRows, target);
    assert.equal(row.pageListed, dev.unclassifiedViewer.expected.count, 'the REAL viewer still sees exactly its world during the measurement');
  }
  report.helperCost = { sizes: costRuns.map((r) => r.lineageRows), rows: costRuns.map(({ plan, ...rest }) => rest), plans: costRuns.map((r) => ({ lineageRows: r.lineageRows, plan: r.plan })),
    timingsAreMeasurementsNotGates: true,
    note: 'The helper body calls the SECURITY DEFINER classifier once per lineage row; the policy references it in two uncorrelated InitPlans per scan of public.needs (one scan in rpc_discovery_v1 PAGE, three in the legacy reader). Compare page/legacy medians with the helper median at each size.' };
  console.log('\nsize | helper median ms (min..max) | plain scan median ms | PAGE limit50 median ms | legacy page median ms');
  for (const r of costRuns) console.log(`${r.lineageRows} | ${r.helper.medianMs} (${r.helper.minMs}..${r.helper.maxMs}) | ${r.scan.medianMs} | ${r.page.medianMs} | ${r.legacy.medianMs}`);
  report.result = 'PASS';
} catch (error) {
  report.failure = { stage, category: 'PROOF_REFUSED', message: /^P6_[A-Z0-9_]+$/.test(error.message) ? error.message : 'P6_WB_PROOF_FAILED', assertion: String(error.message).slice(0, 600) };
  if (typeof error.stderr === 'string') {
    const state = sqlState(error.stderr); if (state) report.failure.sqlState = state;
    const diagnostic = error.stderr.match(/(P6_[A-Z0-9_]+(?::[^\n]*)?)/); if (diagnostic) report.failure.diagnostic = diagnostic[1].slice(0, 240);
    report.failure.stderrTail = error.stderr.split('\n').filter(Boolean).slice(-6).join('\n').slice(0, 1200);
  }
  if (error.signal) report.failure.signal = error.signal;
  process.exitCode = 1;
} finally {
  report.limits = [
    'Disposable local target only (live79 + historical replay through PKG045b P0 form + the DEPLOYED rollout v3 applied locally); canonical DEV was not read or written.',
    'The world boundary is proved through SQL calls of the two readers under the authenticated role with RLS active, impersonated by request.jwt.claim.sub as every existing proof does; PostgREST/HTTP, the native client and the OPERATOR lineage (absent on canonical DEV) are not exercised; a closed (restricted) viewer account is not exercised.',
    'Equality against the old rule is private.accounts_same_world evaluated as postgres over the whole table (including any rows the replayed target already held); the fixture-level assertions use the lineage rule written in the plan, computed without the database.',
    'Timings are measurements on one warm GitHub runner backend (medians of ' + SAMPLES + ' after ' + WARMUPS + ' warm-ups; legacy reader ' + LEGACY_SAMPLES + ' after ' + LEGACY_WARMUPS + '); they never fail this proof and are not an SLA, a concurrency result or a hosted-project measurement.',
    'The bulk lineage rows are inserted directly (auth.users with its profile trigger, then private.account_lineage_v5) as the v3 proof and the Round71 harness do; the service writer rpc_admit_account_lineage_service is not exercised here.',
  ];
  writeFileSync(out + '/p6-world-boundary-receipt.json', JSON.stringify(report, null, 2) + '\n');
  try { writeFileSync(privateOut + '/p6-world-boundary-detail.json', JSON.stringify(detail, null, 2) + '\n'); } catch { /* the private directory is optional */ }
  console.log(report.result + ' P6_WORLD_BOUNDARY_AND_HELPER_COST' + (report.failure ? ` stage=${report.failure.stage} ${report.failure.assertion}` : ''));
}
