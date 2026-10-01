"""Generator for the EX-04 S4 (A11 candidates and comparison) server candidate, its exact revert and its read-only DEV postflight.

TWO NEW functions, nothing replaced and no existing function touched:
  - private.need_candidate_states_v5(uuid, uuid[]): the PKG-035a state function restricted to the given responses. Its body is the exact pkg035a body (md5 pinned) plus ONE anchored edit
    (`and r.id = any(p_response_ids)`), so it cannot drift from the authority; the state of a candidate is computed for the candidates of ONE page only (the per-candidate calendar match and
    price assertion are the expensive part of a state).
  - public.rpc_list_need_candidates_page(uuid, integer, timestamptz, uuid): the candidate list of a task a keyset page at a time, in the arrival order of rpc_list_need_candidates (submission,
    then id), every item the SAME candidate document plus its `sortAt`, the first page carrying the total.
`--check` fails on any difference between the generated text and the files in the repository.

    python supabase/proofs/ex04/build_ex04d.py            # write the three files
    python supabase/proofs/ex04/build_ex04d.py --check    # fail if a file differs
"""
import hashlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CANDIDATE = ROOT / 'supabase' / 'candidates' / 'ex04d_candidates_page.sql'
REVERT = ROOT / 'supabase' / 'candidates' / 'ex04d_candidates_page_revert.sql'
POSTFLIGHT = ROOT / 'supabase' / 'proofs' / 'ex04' / 'ex04d_postflight.readonly.sql'
PKG035A = ROOT / 'supabase' / 'candidates' / 'pkg035a_selectable_application_counts.sql'

STATES_OLD_SIGNATURE = 'private.need_candidate_states_v5(uuid)'
STATES_SIGNATURE = 'private.need_candidate_states_v5(uuid,uuid[])'
PAGE_SIGNATURE = 'public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)'
STATES_HEAD = ("create function private.need_candidate_states_v5(p_need_id uuid, p_response_ids uuid[]) returns table(response_id uuid, candidate_state text) "
               "language plpgsql stable security definer set search_path = 'pg_catalog' as ")
PAGE_HEAD = ("create function public.rpc_list_need_candidates_page(p_need_id uuid, p_limit integer default 30, p_after_at timestamp with time zone default null::timestamp with time zone, "
             "p_after_id uuid default null::uuid) returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as ")
PAGE_ARGUMENTS = ("p_need_id uuid, p_limit integer DEFAULT 30, p_after_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id uuid DEFAULT NULL::uuid")

# The exact DEV predecessors (LF-normalised md5), read from canonical DEV on 2026-10-01: the list this page is the sibling of, the authority the states come from and what they lean on.
PINS = [
    ('public.rpc_list_need_candidates(uuid)', '15cb0fd9d891a4ce6d4fdc7ea79abcd1'),
    (STATES_OLD_SIGNATURE, '6d65e304f41f3e130228f58874757f0d'),
    ('public.rpc_get_public_profile(uuid)', '9ecc0b69096f1167d02e0bb7b9656bc0'),
]


def md5(text):
    return hashlib.md5(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def read(path):
    return io.open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def states_old_body():
    source = read(PKG035A)
    match = re.search(r'create function private\.need_candidate_states_v5\(p_need_id uuid\)', source)
    tag = '$function$'
    start = source.index(tag, match.end()) + len(tag)
    body = source[start:source.index(tag, start)]
    assert md5(body) == PINS[1][1], 'the pkg035a source is not the DEV predecessor body of need_candidate_states_v5'
    return body


def states_body():
    body = states_old_body()
    anchor = "    where r.need_id=n.id and r.status<>'DRAFT'\n  loop\n"
    assert body.count(anchor) == 1
    return body.replace(anchor, "    where r.need_id=n.id and r.status<>'DRAFT' and r.id = any(p_response_ids)\n  loop\n")


PAGE_BODY = """
declare
  v_actor uuid := auth.uid();
  v_need public.needs;
  v_selected_slots integer := 0;
  v_remaining_slots integer := 0;
  v_items jsonb;
  v_has_more boolean;
  v_total bigint;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;
  if p_need_id is null then
    raise exception using errcode='22023', message='NEED_ID_REQUIRED';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_after_at is null) <> (p_after_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  select n.* into v_need
  from public.needs n
  where n.id = p_need_id;

  if not found then
    raise exception using errcode='P0002', message='NEED_NOT_FOUND';
  end if;
  if v_need.requester_account_id <> v_actor then
    raise exception using errcode='42501', message='NOT_REQUESTER';
  end if;

  select coalesce(sum(s.covered_slots),0)::integer
  into v_selected_slots
  from public.need_selections s
  where s.need_id = p_need_id
    and s.status = 'SELECTED';

  v_remaining_slots := greatest(coalesce(v_need.required_slots,1) - v_selected_slots, 0);

  -- EX-04 S4 (A11). The same candidate document rpc_list_need_candidates returns, in its order (submission, then id), one keyset page at a time. The keys of the whole set are read
  -- with no function call; the state, the public profile and the evidence are computed for the candidates of THIS page only, so the work of a page does not grow with the task's applications.
  with keys as materialized (
    select r.id as response_id, coalesce(r.submitted_at, r.created_at) as sort_at
    from public.marketplace_responses r
    where r.need_id = p_need_id
      and r.status <> 'DRAFT'
  ), page as materialized (
    select k.response_id, k.sort_at
    from keys k
    where p_after_at is null or (k.sort_at, k.response_id) > (p_after_at, p_after_id)
    order by k.sort_at, k.response_id
    limit p_limit + 1
  ), shown as materialized (
    select pg.response_id, pg.sort_at
    from page pg
    order by pg.sort_at, pg.response_id
    limit p_limit
  ), candidate_rows as (
    select
      r.id as response_id,
      sh.sort_at,
      r.worker_profile_id,
      r.current_version,
      v.need_revision as version_need_revision,
      v.content_hash,
      v.price_rsd,
      v.covered_slots,
      v.proposed_start_at,
      v.proposed_end_at,
      v.scope_note,
      snap.snapshot_schema,
      snap.worker_team_capacity,
      snap.worker_skills,
      snap.worker_tools,
      snap.worker_licenses,
      snap.worker_vehicles
    from shown sh
    join public.marketplace_responses r on r.id = sh.response_id
    left join public.marketplace_response_versions v
      on v.response_id = r.id
     and v.version = r.current_version
    left join private.response_application_snapshots snap
      on snap.response_id = r.id
     and snap.response_version = r.current_version
  ), classified as (
    select
      c.*,
      states.candidate_state
    from candidate_rows c
    join private.need_candidate_states_v5(p_need_id, (select array_agg(sh.response_id) from shown sh)) states on states.response_id = c.response_id
  )
  select
    (select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'responseId', c.response_id,
          'workerProfileId', c.worker_profile_id,
          'needRevision', v_need.revision,
          'responseNeedRevision', c.version_need_revision,
          'version', c.current_version,
          'contentHash', c.content_hash,
          'state', c.candidate_state,
          'canSelect', c.candidate_state = 'SELECTABLE',
          'priceRsd', c.price_rsd,
          'coveredSlots', c.covered_slots,
          'remainingSlots', v_remaining_slots,
          'proposedStartAt', c.proposed_start_at,
          'proposedEndAt', c.proposed_end_at,
          'scopeNote', coalesce(c.scope_note,''),
          'publicProfile', public.rpc_get_public_profile(c.worker_profile_id),
          'applicationEvidence', case
            when c.snapshot_schema is null then jsonb_build_object(
              'schema','LEGACY_UNPROVEN',
              'teamCapacity',null,
              'skills',null,
              'tools',null,
              'licenses',null,
              'vehicles',null
            )
            else jsonb_build_object(
              'schema',c.snapshot_schema,
              'teamCapacity',c.worker_team_capacity,
              'skills',to_jsonb(c.worker_skills),
              'tools',to_jsonb(c.worker_tools),
              'licenses',to_jsonb(c.worker_licenses),
              'vehicles',to_jsonb(c.worker_vehicles)
            )
          end,
          'sortAt', c.sort_at
        )
        order by c.sort_at, c.response_id
      ),
      '[]'::jsonb) from classified c),
    (select count(*) from page) > p_limit,
    -- The total rides with the first page; a later page does not pay for it again.
    case when p_after_at is null then (select count(*) from keys) end
  into v_items, v_has_more, v_total;

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'counts', case when p_after_at is null then jsonb_build_object('total', v_total) end,
    'asOf', statement_timestamp());
end
"""


def fill(template, **values):
    for key, value in values.items():
        template = template.replace('{{' + key + '}}', value)
    assert '{{' not in template, 'unfilled placeholder'
    return template


def literal(text):
    return text.replace("'", "''")


def pin_values():
    return ',\n'.join("    ('%s','%s')" % pin for pin in PINS)


CANDIDATE_TEMPLATE = """-- EX-04 S4 (A11 candidates and comparison): the candidate list of a task a keyset page at a time, with the state of a candidate computed for the candidates of one page only. NOT APPLIED to DEV:
-- it needs the owner's explicit "primeni". TWO NEW functions, nothing replaced, no existing function touched.
-- GENERATED by supabase/proofs/ex04/build_ex04d.py: do not edit by hand (`--check` fails on any difference).
-- Canonical basis: LIVE Master Plan card A11 ("straniči duži skup po postojećem ugovoru i sačuvaj selekciju/scroll"; DONE: "... bez lažnog statusa ili neograničenih čitanja"), EX04 plan section 6 (S4).
-- rpc_list_need_candidates_page returns the SAME candidate document as rpc_list_need_candidates, in its order (submission, then id), plus `sortAt` (the keyset value); the first page carries `counts.total`.
-- private.need_candidate_states_v5(uuid, uuid[]) is the PKG-035a state function (the exact DEV body, pinned) restricted to the given responses by ONE anchored edit, so a page pays the per-candidate calendar match and
-- price assertion for its own candidates only. The final selection authority (rpc_select_response) and rpc_list_need_candidates are untouched.
-- One atomic DO statement: exact DEV predecessor pins, the closure certificate checked unchanged, exact delta accounting (two new functions, nothing else changed). No table, column, constraint, trigger,
-- policy, index or data change.
do $ex04d$
declare
  states_signature constant text := '{{states_signature}}';
  page_signature constant text := '{{page_signature}}';
  states_body constant text := ${{states_tag}}${{states_body}}${{states_tag}}$;
  page_body constant text := ${{page_tag}}${{page_body}}${{page_tag}}$;
  pin record; prior record; digest_before text; fresh oid[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04D_OWNER_REQUIRED' using errcode = '55000'; end if;
  if to_regprocedure(states_signature) is not null or to_regprocedure(page_signature) is not null then raise exception 'EX04D_ALREADY_APPLIED' using errcode = '55000'; end if;
  for pin in select * from (values
{{pins}}
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'EX04D_PREDECESSOR_DRIFT: %', pin.signature using errcode = '55000';
    end if;
  end loop;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04D_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex04d_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');

  -- The state function for a set of responses: private, no client privilege of any kind (the ACL of the function it restricts).
  execute format($c${{states_head}}%L$c$, states_body);
  execute 'revoke all on function private.need_candidate_states_v5(uuid,uuid[]) from public, anon, authenticated, service_role';
  -- The page reader: authenticated only, like its sibling.
  execute format($c${{page_head}}%L$c$, page_body);
  execute 'revoke all on function public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid) from public, anon, authenticated, service_role';
  execute 'grant execute on function public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid) to authenticated';

  -- Delta accounting: the certificate did not move, nothing that existed changed, the two new functions are exactly what was written.
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04D_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex04d_functions loop
    if (select to_jsonb(p) from pg_proc p where p.oid = prior.oid) is distinct from prior.metadata then
      raise exception 'EX04D_EXISTING_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex04d_functions f where f.oid = p.oid);
  if fresh is distinct from (select array_agg(v.oid order by v.oid) from (values (to_regprocedure(states_signature)::oid), (to_regprocedure(page_signature)::oid)) v(oid)) then
    raise exception 'EX04D_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = to_regprocedure(states_signature) and p.prosrc = states_body and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}'
      and p.prokind = 'f' and p.proretset and p.prolang = (select oid from pg_language where lanname = 'plpgsql')) then
    raise exception 'EX04D_STATES_DELTA' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = to_regprocedure(page_signature) and p.prosrc = page_body and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres,authenticated=X/postgres}'
      and p.prokind = 'f' and not p.proretset and p.prorettype = 'jsonb'::regtype and pg_get_function_arguments(p.oid) = '{{page_arguments}}') then
    raise exception 'EX04D_PAGE_DELTA' using errcode = '55000';
  end if;
  if has_function_privilege('anon', states_signature, 'EXECUTE') or has_function_privilege('authenticated', states_signature, 'EXECUTE')
     or has_function_privilege('service_role', states_signature, 'EXECUTE')
     or has_function_privilege('anon', page_signature, 'EXECUTE') or has_function_privilege('service_role', page_signature, 'EXECUTE')
     or not has_function_privilege('authenticated', page_signature, 'EXECUTE') then
    raise exception 'EX04D_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
end
$ex04d$;
"""

REVERT_TEMPLATE = """-- EX-04 S4 revert: the exact inverse of ex04d_candidates_page.sql. NOT APPLIED. It needs its own explicit "primeni".
-- GENERATED by supabase/proofs/ex04/build_ex04d.py: do not edit by hand (`--check` fails on any difference).
-- It drops the page reader and the state function for a set of responses; nothing else existed to restore. It refuses unless both are exactly what the application produced. No data is touched.
do $ex04d_revert$
declare
  states_signature constant text := '{{states_signature}}';
  page_signature constant text := '{{page_signature}}';
  states_body constant text := ${{states_tag}}${{states_body}}${{states_tag}}$;
  page_body constant text := ${{page_tag}}${{page_body}}${{page_tag}}$;
  prior record; digest_before text; fresh oid[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04D_REVERT_OWNER_REQUIRED' using errcode = '55000'; end if;
  if (select prosrc from pg_proc where oid = to_regprocedure(states_signature)) is distinct from states_body
     or (select prosrc from pg_proc where oid = to_regprocedure(page_signature)) is distinct from page_body then
    raise exception 'EX04D_REVERT_STATE_NOT_THE_APPLIED_ONE' using errcode = '55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04D_REVERT_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex04d_revert_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and p.oid not in (to_regprocedure(states_signature)::oid, to_regprocedure(page_signature)::oid);
  execute 'drop function public.rpc_list_need_candidates_page(uuid,integer,timestamp with time zone,uuid)';
  execute 'drop function private.need_candidate_states_v5(uuid,uuid[])';
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04D_REVERT_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex04d_revert_functions loop
    if (select to_jsonb(p) from pg_proc p where p.oid = prior.oid) is distinct from prior.metadata then
      raise exception 'EX04D_REVERT_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex04d_revert_functions f where f.oid = p.oid);
  if fresh <> '{}'::oid[] or to_regprocedure(states_signature) is not null or to_regprocedure(page_signature) is not null then
    raise exception 'EX04D_REVERT_POSTCONDITION' using errcode = '55000';
  end if;
end
$ex04d_revert$;
"""

POSTFLIGHT_TEMPLATE = """-- EX-04 S4 DEV postflight. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right after the application (and at any time later).
-- GENERATED by supabase/proofs/ex04/build_ex04d.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON: every part of the applied state that does not hold ("problems": an empty array means the application is exactly in place).
with
  pins(signature, body_md5) as (values
    ('{{states_signature}}','{{states_md5}}'),
    ('{{page_signature}}','{{page_md5}}'),
{{dependency_pins}}
  ),
  problems as (
    select 'BODY_DRIFT' as kind, pin.signature as detail
    from pins pin
    where (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5
    union all
    select 'STATES_ATTRIBUTES', '{{states_signature}}'
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure('{{states_signature}}') and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}' and p.proretset)
    union all
    select 'PAGE_ATTRIBUTES', '{{page_signature}}'
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure('{{page_signature}}') and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres,authenticated=X/postgres}'
      and pg_get_function_arguments(p.oid) = '{{page_arguments}}' and pg_get_function_result(p.oid) = 'jsonb')
    union all
    select 'AUTHORITY', 'a client role can execute the state function, or anon / service_role the page reader'
    where has_function_privilege('anon', '{{states_signature}}', 'EXECUTE') or has_function_privilege('authenticated', '{{states_signature}}', 'EXECUTE')
      or has_function_privilege('service_role', '{{states_signature}}', 'EXECUTE') or has_function_privilege('anon', '{{page_signature}}', 'EXECUTE')
      or has_function_privilege('service_role', '{{page_signature}}', 'EXECUTE') or not has_function_privilege('authenticated', '{{page_signature}}', 'EXECUTE')
    union all
    select 'ORDER_KEY_UNSTAMPED', count(*)::text from public.marketplace_responses where status <> 'DRAFT' and submitted_at is null having count(*) > 0
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready and bound'
    where private.retention_ai_source_ready() is distinct from true
      or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  )
select jsonb_build_object(
  'unit', 'EX04D_CANDIDATES_PAGE_DEV_POSTFLIGHT',
  'pinsChecked', (select count(*) from pins),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as postflight;
"""


def candidate_text():
    return fill(CANDIDATE_TEMPLATE, states_signature=STATES_SIGNATURE, page_signature=PAGE_SIGNATURE, states_tag='states_body', page_tag='page_body', states_body=states_body(), page_body=PAGE_BODY,
                pins=pin_values(), states_head=STATES_HEAD, page_head=PAGE_HEAD, page_arguments=literal(PAGE_ARGUMENTS))


def revert_text():
    return fill(REVERT_TEMPLATE, states_signature=STATES_SIGNATURE, page_signature=PAGE_SIGNATURE, states_tag='states_body', page_tag='page_body', states_body=states_body(), page_body=PAGE_BODY)


def postflight_text():
    return fill(POSTFLIGHT_TEMPLATE, states_signature=STATES_SIGNATURE, page_signature=PAGE_SIGNATURE, states_md5=md5(states_body()), page_md5=md5(PAGE_BODY),
                page_arguments=literal(PAGE_ARGUMENTS), dependency_pins=',\n'.join("    ('%s','%s')" % pin for pin in PINS))


FILES = [(CANDIDATE, candidate_text), (REVERT, revert_text), (POSTFLIGHT, postflight_text)]


def main(argv):
    check = '--check' in argv
    failed = False
    for tag in ('states_body', 'page_body'):
        assert '$' + tag + '$' not in PAGE_BODY and '$' + tag + '$' not in states_body(), 'dollar-quote tag collision: ' + tag
    for path, make in FILES:
        text = make()
        assert '\r' not in text
        if check:
            current = read(path) if path.exists() else None
            if current != text:
                print('DIFFERS', path.relative_to(ROOT).as_posix())
                failed = True
            else:
                print('EQUAL  ', path.relative_to(ROOT).as_posix(), hashlib.sha256(text.rstrip('\n').encode('utf-8')).hexdigest())
        else:
            io.open(path, 'w', encoding='utf-8', newline='').write(text)
            print('wrote', path.relative_to(ROOT).as_posix(), len(text.encode('utf-8')), 'bytes', hashlib.sha256(text.rstrip('\n').encode('utf-8')).hexdigest())
    print('states body md5', md5(states_body()), 'page body md5', md5(PAGE_BODY), '| old states', PINS[1][1])
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
