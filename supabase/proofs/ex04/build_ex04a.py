"""Generator for the EX-04 S1 (A09 Moji zadaci) server candidate, its exact revert and its read-only DEV postflight.

The two function bodies live HERE, once; the candidate, the revert and the postflight are generated from them, so the exact bytes that the disposable proof
runs are the bytes that a DEV application would send. `--check` fails on any difference between the generated text and the files in the repository.

    python supabase/proofs/ex04/build_ex04a.py            # write the three files
    python supabase/proofs/ex04/build_ex04a.py --check    # fail if a file differs
"""
import hashlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CANDIDATE = ROOT / 'supabase' / 'candidates' / 'ex04a_own_tasks_page.sql'
REVERT = ROOT / 'supabase' / 'candidates' / 'ex04a_own_tasks_page_revert.sql'
POSTFLIGHT = ROOT / 'supabase' / 'proofs' / 'ex04' / 'ex04a_postflight.readonly.sql'
OLD_BODY_SOURCE = ROOT / 'supabase' / 'candidates' / 'pkg045a_task_read_contract.sql'

PAGE_SIGNATURE = 'public.rpc_list_my_needs_page(text,integer,timestamp with time zone,uuid)'
HELPER_SIGNATURE = 'private.own_task_counts(uuid)'
PAGE_HEAD = ("create or replace function public.rpc_list_my_needs_page(p_scope text default 'ALL'::text, p_limit integer default 30, "
             "p_before_at timestamp with time zone default null::timestamp with time zone, p_before_id uuid default null::uuid) "
             "returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as ")

# The exact DEV predecessor bodies (LF-normalised md5), read from canonical DEV on 2026-10-01 and equal to the PKG-045a / PKG-042a / PKG-035 sources.
PINS = [
    (PAGE_SIGNATURE, 'dad1de3234e72d4e2f44be5e920eda61'),
    ('public.rpc_list_my_tasks()', '2a8ff0fa8a1211414e5e1fc69c6fb4f7'),
    ('public.rpc_read_task(uuid)', '1e01db5140248f27ab374187f01fded3'),
    ('public.selectable_application_count(public.needs)', 'fe53442f8b661d6f33d22a54e2a468a8'),
    ('public.covered_slots(public.needs)', 'cbeb8f2a3da7d08965ef0386cfc437ba'),
    ('public.rpc_storage_account_open()', '7350621ef256678e209aa6a28c79b58b'),
    ('private.need_candidate_states_v5(uuid)', '6d65e304f41f3e130228f58874757f0d'),
]

PAGE_BODY = """
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ACTIVE','DRAFTS','HISTORY','WAITING') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;

  if not public.rpc_storage_account_open() then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if;

  -- EX-04 S1 (A09). Every item IS the rpc_read_task document that rpc_list_my_tasks returns, so the card, the price basis and the selectable count
  -- cannot drift from the ordinary read; sortAt is the keyset value. The scopes are the client's own sections: Aktivni = PUBLISHED, SELECTION, ACTIVE;
  -- Nacrti = DRAFT; Istorija = COMPLETED, CANCELLED, EXPIRED, ARCHIVED; WAITING = an active task with a place left and a selectable application.
  with page as materialized (
    select n.created_at, n.id
    from public.needs n
    where n.requester_account_id = v_uid
      and (p_before_at is null or (n.created_at, n.id) < (p_before_at, p_before_id))
      and case p_scope
            when 'ALL' then true
            when 'ACTIVE' then n.status in ('PUBLISHED','SELECTION','ACTIVE')
            when 'DRAFTS' then n.status = 'DRAFT'
            when 'HISTORY' then n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
            else n.status in ('PUBLISHED','SELECTION','ACTIVE')
              and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0
              and coalesce(public.selectable_application_count(n), 0) > 0
          end
    order by n.created_at desc, n.id desc
    limit p_limit + 1
  )
  select coalesce(jsonb_agg(public.rpc_read_task(p.id) || jsonb_build_object('sortAt', p.created_at) order by p.created_at desc, p.id desc), '[]'::jsonb)
    into v_items from page p;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    -- The five counts of the tabs ride with the first page; a later page does not pay for them again.
    'counts', case when p_before_at is null then private.own_task_counts(v_uid) end,
    'asOf', statement_timestamp());
end
"""

HELPER_BODY = """
  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where n.status in ('PUBLISHED','SELECTION','ACTIVE')),
    'drafts', count(*) filter (where n.status = 'DRAFT'),
    'history', count(*) filter (where n.status in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')),
    'waiting', count(*) filter (where n.status in ('PUBLISHED','SELECTION','ACTIVE')
      and greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) > 0
      and coalesce(public.selectable_application_count(n), 0) > 0))
  from public.needs n where n.requester_account_id = a
"""


def md5(text):
    return hashlib.md5(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def old_page_body():
    text = io.open(OLD_BODY_SOURCE, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    match = re.search(r'CREATE OR REPLACE FUNCTION public\.rpc_list_my_needs_page\(', text)
    tag = '$function$'
    start = text.index(tag, match.end()) + len(tag)
    body = text[start:text.index(tag, start)]
    assert md5(body) == PINS[0][1], 'the pkg045a source is not the DEV predecessor body'
    return body


def pin_values():
    return ',\n'.join("    ('%s','%s')" % pin for pin in PINS)


def candidate_text():
    return """-- EX-04 S1 (A09 Moji zadaci): the existing paged own-task reader completed IN PLACE. NOT APPLIED to DEV: it needs the owner's explicit "primeni".
-- GENERATED by supabase/proofs/ex04/build_ex04a.py: do not edit by hand (`--check` fails on any difference).
-- Canonical basis: LIVE Master Plan card A09 ("dopuni postojeću projekciju price-basis i selectable count ... jednu paging instancu sa deterministic tie-breaker-om ...
-- sačuvaj tab Aktivni/Nacrti/Istorija ... ne preuzimati celu istoriju radi badge-a"), P6 closure L7, EX04 plan section 6 (S1). No client calls rpc_list_my_needs_page today,
-- so completing it in place cannot regress a build. Each item IS the rpc_read_task document that rpc_list_my_tasks returns (the card, the price basis and the selectable count
-- cannot drift) plus sortAt; scopes ALL | ACTIVE | DRAFTS | HISTORY | WAITING; the first page also carries the five counts of the tabs (private.own_task_counts, reusable by Pocetna).
-- One atomic DO statement: exact DEV predecessor pins, the closure certificate checked unchanged, exact delta accounting. No table, column, constraint, trigger, policy, index or data change.
do $ex04a$
declare
  page_signature constant text := '%(page_signature)s';
  helper_signature constant text := '%(helper_signature)s';
  page_body constant text := $page_body$%(page_body)s$page_body$;
  helper_body constant text := $helper_body$%(helper_body)s$helper_body$;
  pin record; prior record; actual jsonb; digest_before text; page_oid oid; fresh oid[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04A_OWNER_REQUIRED' using errcode = '55000'; end if;
  if to_regprocedure(helper_signature) is not null then raise exception 'EX04A_ALREADY_APPLIED' using errcode = '55000'; end if;
  for pin in select * from (values
%(pins)s
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'EX04A_PREDECESSOR_DRIFT: %%', pin.signature using errcode = '55000';
    end if;
  end loop;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04A_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  page_oid := to_regprocedure(page_signature)::oid;
  create temporary table ex04a_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');

  -- The helper: private, no client privilege of any kind.
  execute format($c$create function private.own_task_counts(a uuid) returns jsonb language sql stable security definer set search_path = pg_catalog as %%L$c$, helper_body);
  execute 'revoke all on function private.own_task_counts(uuid) from public, anon, authenticated, service_role';
  -- The reader, replaced in place (same signature, same owner, same ACL).
  execute format($c$%(page_head)s%%L$c$, page_body);

  -- Delta accounting: the certificate did not move, only the reader changed, only the helper is new.
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04A_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex04a_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX04A_FUNCTION_REMOVED: %%', prior.signature using errcode = '55000'; end if;
    if prior.oid = page_oid then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' then
        raise exception 'EX04A_PAGE_ATTRIBUTE_DELTA' using errcode = '55000';
      end if;
      if actual ->> 'prosrc' is distinct from page_body or actual ->> 'prosrc' is not distinct from prior.metadata ->> 'prosrc' then
        raise exception 'EX04A_PAGE_BODY_MISMATCH' using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX04A_UNRELATED_FUNCTION_DELTA: %%', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex04a_functions f where f.oid = p.oid);
  if fresh is distinct from array[to_regprocedure(helper_signature)::oid] then
    raise exception 'EX04A_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = to_regprocedure(helper_signature) and p.prosrc = helper_body and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}'
      and p.prokind = 'f' and p.prorettype = 'jsonb'::regtype and not p.proretset) then
    raise exception 'EX04A_HELPER_DELTA' using errcode = '55000';
  end if;
  if has_function_privilege('anon', helper_signature, 'EXECUTE') or has_function_privilege('authenticated', helper_signature, 'EXECUTE')
     or has_function_privilege('service_role', helper_signature, 'EXECUTE')
     or has_function_privilege('anon', page_signature, 'EXECUTE') or not has_function_privilege('authenticated', page_signature, 'EXECUTE') then
    raise exception 'EX04A_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
end
$ex04a$;
""" % {
        'page_signature': PAGE_SIGNATURE, 'helper_signature': HELPER_SIGNATURE, 'page_body': PAGE_BODY, 'helper_body': HELPER_BODY,
        'pins': pin_values(), 'page_head': PAGE_HEAD}


def revert_text():
    old = old_page_body()
    return """-- EX-04 S1 revert: the exact inverse of ex04a_own_tasks_page.sql. NOT APPLIED. It needs its own explicit "primeni".
-- GENERATED by supabase/proofs/ex04/build_ex04a.py: do not edit by hand (`--check` fails on any difference).
-- It restores the DEV predecessor body of rpc_list_my_needs_page byte for byte (md5 %(old_md5)s, the PKG-045a text) and drops private.own_task_counts. It refuses unless the
-- reader and the helper are exactly what the application produced. No data is touched.
do $ex04a_revert$
declare
  page_signature constant text := '%(page_signature)s';
  helper_signature constant text := '%(helper_signature)s';
  new_body constant text := $new_body$%(page_body)s$new_body$;
  old_body constant text := $old_body$%(old_body)s$old_body$;
  helper_body constant text := $helper_body$%(helper_body)s$helper_body$;
  prior record; actual jsonb; digest_before text; page_oid oid; helper_oid oid;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04A_REVERT_OWNER_REQUIRED' using errcode = '55000'; end if;
  page_oid := to_regprocedure(page_signature)::oid; helper_oid := to_regprocedure(helper_signature)::oid;
  if helper_oid is null or (select prosrc from pg_proc where oid = page_oid) is distinct from new_body
     or (select prosrc from pg_proc where oid = helper_oid) is distinct from helper_body then
    raise exception 'EX04A_REVERT_STATE_NOT_THE_APPLIED_ONE' using errcode = '55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04A_REVERT_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex04a_revert_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and p.oid <> helper_oid;
  execute format($c$%(page_head)s%%L$c$, old_body);
  execute 'drop function private.own_task_counts(uuid)';
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04A_REVERT_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex04a_revert_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX04A_REVERT_FUNCTION_REMOVED: %%', prior.signature using errcode = '55000'; end if;
    if prior.oid = page_oid then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' or actual ->> 'prosrc' is distinct from old_body then
        raise exception 'EX04A_REVERT_PAGE_MISMATCH' using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX04A_REVERT_UNRELATED_FUNCTION_DELTA: %%', prior.signature using errcode = '55000';
    end if;
  end loop;
  if (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = page_oid) is distinct from '%(old_md5)s'
     or to_regprocedure(helper_signature) is not null then
    raise exception 'EX04A_REVERT_POSTCONDITION' using errcode = '55000';
  end if;
end
$ex04a_revert$;
""" % {'page_signature': PAGE_SIGNATURE, 'helper_signature': HELPER_SIGNATURE, 'page_body': PAGE_BODY, 'old_body': old, 'helper_body': HELPER_BODY,
       'page_head': PAGE_HEAD, 'old_md5': PINS[0][1]}


def postflight_text():
    return """-- EX-04 S1 DEV postflight. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right after the application (and at any time later).
-- GENERATED by supabase/proofs/ex04/build_ex04a.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON: every part of the applied state that does not hold ("problems": an empty array means the application is exactly in place).
with
  pins(signature, body_md5) as (values
    ('%(page_signature)s','%(page_md5)s'),
    ('%(helper_signature)s','%(helper_md5)s'),
%(dependency_pins)s
  ),
  problems as (
    select 'BODY_DRIFT' as kind, pin.signature as detail
    from pins pin
    where (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5
    union all
    select 'PAGE_ATTRIBUTES', '%(page_signature)s'
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure('%(page_signature)s') and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres,authenticated=X/postgres}')
    union all
    select 'HELPER_ATTRIBUTES', '%(helper_signature)s'
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure('%(helper_signature)s') and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}')
    union all
    select 'AUTHORITY', 'a client role can execute the helper, or anon the reader'
    where has_function_privilege('anon', '%(helper_signature)s', 'EXECUTE') or has_function_privilege('authenticated', '%(helper_signature)s', 'EXECUTE')
      or has_function_privilege('service_role', '%(helper_signature)s', 'EXECUTE') or has_function_privilege('anon', '%(page_signature)s', 'EXECUTE')
      or not has_function_privilege('authenticated', '%(page_signature)s', 'EXECUTE')
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready and bound'
    where private.retention_ai_source_ready() is distinct from true
      or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  )
select jsonb_build_object(
  'unit', 'EX04A_OWN_TASKS_PAGE_DEV_POSTFLIGHT',
  'pinsChecked', (select count(*) from pins),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as postflight;
""" % {'page_signature': PAGE_SIGNATURE, 'helper_signature': HELPER_SIGNATURE, 'page_md5': md5(PAGE_BODY), 'helper_md5': md5(HELPER_BODY),
       'dependency_pins': ',\n'.join("    ('%s','%s')" % pin for pin in PINS[1:])}


FILES = [(CANDIDATE, candidate_text), (REVERT, revert_text), (POSTFLIGHT, postflight_text)]


def main(argv):
    check = '--check' in argv
    failed = False
    for path, make in FILES:
        text = make()
        assert '\r' not in text
        if check:
            current = io.open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n') if path.exists() else None
            if current != text:
                print('DIFFERS', path.relative_to(ROOT).as_posix())
                failed = True
            else:
                print('EQUAL  ', path.relative_to(ROOT).as_posix(), hashlib.sha256(text.encode('utf-8')).hexdigest())
        else:
            io.open(path, 'w', encoding='utf-8', newline='').write(text)
            print('wrote', path.relative_to(ROOT).as_posix(), len(text.encode('utf-8')), 'bytes', hashlib.sha256(text.encode('utf-8')).hexdigest())
    print('page body md5', md5(PAGE_BODY), 'helper body md5', md5(HELPER_BODY), 'old page md5', PINS[0][1])
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
