"""Generator for the EX-04 S2 (B10 Moje prijave) server candidate, its exact revert and its read-only DEV postflight.

The two function bodies live HERE, once; the candidate, the revert and the postflight are generated from them, so the exact bytes that the disposable proof
runs are the bytes that a DEV application would send. `--check` fails on any difference between the generated text and the files in the repository.

    python supabase/proofs/ex04/build_ex04b.py            # write the three files
    python supabase/proofs/ex04/build_ex04b.py --check    # fail if a file differs
"""
import hashlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CANDIDATE = ROOT / 'supabase' / 'candidates' / 'ex04b_own_applications_page.sql'
REVERT = ROOT / 'supabase' / 'candidates' / 'ex04b_own_applications_page_revert.sql'
POSTFLIGHT = ROOT / 'supabase' / 'proofs' / 'ex04' / 'ex04b_postflight.readonly.sql'
PKG023A = ROOT / 'supabase' / 'candidates' / 'pkg023a_own_reads_paged.sql'
PKG042A = ROOT / 'supabase' / 'candidates' / 'pkg042a_cancelled_agreement_read_parity.sql'

OLD_SIGNATURE = 'public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid)'
PAGE_SIGNATURE = 'public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)'
ROWS_SIGNATURE = 'private.own_application_rows(uuid)'
OLD_ARGUMENTS = ("p_scope text DEFAULT 'ALL'::text, p_limit integer DEFAULT 30, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, "
                 "p_before_id uuid DEFAULT NULL::uuid")
NEW_ARGUMENTS = OLD_ARGUMENTS + ", p_before_rank integer DEFAULT NULL::integer"
OLD_HEAD = ("create function public.rpc_list_my_applications_page(p_scope text default 'ALL'::text, p_limit integer default 30, "
            "p_before_at timestamp with time zone default null::timestamp with time zone, p_before_id uuid default null::uuid) "
            "returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as ")
NEW_HEAD = ("create function public.rpc_list_my_applications_page(p_scope text default 'ALL'::text, p_limit integer default 30, "
            "p_before_at timestamp with time zone default null::timestamp with time zone, p_before_id uuid default null::uuid, "
            "p_before_rank integer default null::integer) "
            "returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as ")
ROWS_HEAD = ("create function private.own_application_rows(p_account uuid) returns table(application_id uuid, sort_at timestamp with time zone, need_id uuid, "
             "current_need_revision integer, submitted_against_need_revision integer, current_version integer, raw_response_status text, price_rsd integer, "
             "covered_slots integer, scope_note text, submitted_at timestamp with time zone, title text, description text, raw_need_status text, "
             "approximate_city text, approximate_area text, starts_at timestamp with time zone, ends_at timestamp with time zone, schedule_kind text, "
             "execution_location_mode text, task_timezone text, price_mode text, price_basis text, required_slots integer, agreement_id uuid, "
             "application_state text, application_rank integer) language sql stable security definer set search_path = pg_catalog as ")

# The exact DEV predecessor bodies (LF-normalised md5), read from canonical DEV on 2026-10-01 and equal to the PKG-023a + PKG-042a / RU5 / PKG-042a sources.
PINS = [
    (OLD_SIGNATURE, '0e0b1c3fc0cf0612d734c8b3071b1f44'),
    ('public.rpc_list_my_applications()', 'fb0f3053c6b9d3cf0464c433f0504f3b'),
    ('private.my_application_state(text,integer,integer,text,boolean)', '236c6c9c9625e4fb92522c6c3a1bfe03'),
]

# The attributes of the replaced reader on DEV (everything except its arguments, its body and its oid). The replacement keeps all of them.
OLD_ATTRIBUTES = ("'{\"procost\": 100, \"prokind\": \"f\", \"prorows\": 0, \"proretset\": false, \"prosecdef\": true, \"proisstrict\": false, \"proparallel\": \"u\", "
                  "\"provolatile\": \"s\", \"proleakproof\": false, \"proconfig\": [\"search_path=pg_catalog\"], "
                  "\"proacl\": [\"postgres=X/postgres\", \"authenticated=X/postgres\"]}'::jsonb")

ROWS_BODY = """
  -- EX-04 S2 (B10): the ONE builder of "my applications". Every column of rpc_list_my_applications() and of the page, plus the facts of the task that the card needs
  -- (full term, execution mode, price mode and basis, people), the one state function, the one rank. The page and the counts read it, so a count can never differ from the list.
  select r.id, coalesce(r.submitted_at, r.created_at), r.need_id, n.revision, r.submitted_against_need_revision, r.current_version, r.status,
         r.price_rsd, r.covered_slots, r.scope_note, r.submitted_at,
         n.title, n.description, n.status, n.approximate_city, n.approximate_area, n.starts_at, n.ends_at, n.schedule_kind, n.execution_location_mode, n.task_timezone,
         n.mode, n.price_basis, n.required_slots,
         ag.id, st.state,
         case when st.state in ('STALE_REVIEW_REQUIRED','SELECTED') then 0 when st.state in ('SUBMITTED','VIEWED','SHORTLISTED') then 1 else 2 end
  from public.marketplace_responses r
  join public.needs n on n.id = r.need_id
  left join lateral (select a.id from public.agreements a where a.selected_response_id = r.id order by a.created_at desc, a.id desc limit 1) ag on true
  cross join lateral (select private.my_application_state(r.status, r.submitted_against_need_revision, n.revision, n.status,
    ag.id is not null and not exists (select 1 from public.agreements x where x.id = ag.id and x.status = 'CANCELLED')) as state) st
  where r.worker_account_id = p_account and r.status <> 'DRAFT'
"""

PAGE_BODY = """
declare
  v_actor uuid := auth.uid();
  v_items jsonb;
  v_counts jsonb;
  v_scope_rank integer;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or (p_before_at is null) <> (p_before_id is null) or (p_before_at is null) <> (p_before_rank is null)
     or (p_before_rank is not null and p_before_rank not in (0, 1, 2)) then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('ALL','ATTENTION','ACTIVE','HISTORY') then
    raise exception 'INVALID_SCOPE' using errcode = '22023';
  end if;
  -- ATTENTION = what waits for the applicant (rank 0), ACTIVE = a still-open application (rank 1), HISTORY = the rest (rank 2): the three sections of the screen.
  v_scope_rank := case p_scope when 'ATTENTION' then 0 when 'ACTIVE' then 1 when 'HISTORY' then 2 end;
  if p_before_rank is not null and v_scope_rank is not null and p_before_rank <> v_scope_rank then
    raise exception 'INVALID_PAGE' using errcode = '22023';
  end if;

  -- EX-04 S2 (B10 Moje prijave). The order is the one rpc_list_my_applications() has always had: what waits for me first, then the open ones, then the rest, each
  -- newest submission first, the id as the last tie-breaker. The keyset carries all three values of that order (rank, sortAt, id), so a page boundary can fall anywhere,
  -- inside a tie or between two sections, and no application is skipped or repeated for a reason of the order itself.
  with own as materialized (
    select * from private.own_application_rows(v_actor)
  ), page as (
    select o.* from own o
    where (v_scope_rank is null or o.application_rank = v_scope_rank)
      and (p_before_at is null
           or o.application_rank > p_before_rank
           or (o.application_rank = p_before_rank and (o.sort_at < p_before_at or (o.sort_at = p_before_at and o.application_id > p_before_id))))
    order by o.application_rank, o.sort_at desc, o.application_id
    limit p_limit + 1
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object(
        'applicationId', p.application_id, 'id', p.application_id, 'sortAt', p.sort_at,
        'needId', p.need_id, 'needRevision', p.current_need_revision,
        'submittedNeedRevision', p.submitted_against_need_revision, 'version', p.current_version,
        'state', p.application_state, 'title', p.title, 'description', p.description,
        'approximateCity', nullif(btrim(p.approximate_city), ''), 'approximateArea', nullif(btrim(p.approximate_area), ''),
        'startsAt', p.starts_at, 'endsAt', p.ends_at, 'scheduleKind', p.schedule_kind,
        'executionLocationMode', p.execution_location_mode, 'taskTimezone', p.task_timezone,
        'priceMode', p.price_mode, 'priceBasis', p.price_basis, 'requiredSlots', p.required_slots,
        'priceRsd', p.price_rsd, 'coveredSlots', p.covered_slots,
        'scopeNote', coalesce(p.scope_note, ''), 'agreementId', p.agreement_id,
        'requiresStaleReview', p.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', p.application_state in ('STALE_REVIEW_REQUIRED','SELECTED'),
        'canWithdraw',
          p.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and p.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and p.submitted_against_need_revision = p.current_need_revision
          and p.raw_need_status in ('PUBLISHED','SELECTION')
          and p.agreement_id is null,
        'submittedAt', p.submitted_at
      ) order by p.application_rank, p.sort_at desc, p.application_id), '[]'::jsonb) from page p),
    -- The four counts of the tabs ride with the first page; a later page does not pay for them again.
    case when p_before_at is null then (select jsonb_build_object(
        'total', count(*),
        'attention', count(*) filter (where o.application_rank = 0),
        'active', count(*) filter (where o.application_rank = 1),
        'finished', count(*) filter (where o.application_rank = 2)) from own o) end
  into v_items, v_counts;

  return jsonb_build_object(
    'items', case when jsonb_array_length(v_items) > p_limit then v_items - p_limit else v_items end,
    'hasMore', jsonb_array_length(v_items) > p_limit,
    'counts', v_counts,
    'asOf', statement_timestamp());
end
"""


def md5(text):
    return hashlib.md5(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def old_page_body():
    """The exact DEV body of the replaced reader: the PKG-023a text with the one PKG-042a replacement applied (both are repository sources)."""
    created = io.open(PKG023A, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    match = re.search(r'create function public\.rpc_list_my_applications_page\(', created)
    tag = '$function$'
    start = created.index(tag, match.end()) + len(tag)
    base = created[start:created.index(tag, start)]
    patch = io.open(PKG042A, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    row = re.search(r"\(2, 'public\.rpc_list_my_applications_page\(text,integer,timestamp with time zone,uuid\)', '([0-9a-f]{32})', '([0-9a-f]{32})', "
                    r"\$a\$(.*?)\$a\$, \$b\$(.*?)\$b\$\)", patch, re.S)
    before, after, anchor, replacement = row.group(1), row.group(2), row.group(3), row.group(4)
    assert md5(base) == before, 'the pkg023a source is not the body that pkg042a patched'
    assert base.count(anchor) == 1, 'the pkg042a anchor is not unique in the pkg023a body'
    body = base.replace(anchor, replacement)
    assert md5(body) == after == PINS[0][1], 'the reconstructed body is not the DEV predecessor body'
    return body


def literal(text):
    """The text as the inside of a single-quoted SQL string literal."""
    return text.replace("'", "''")


def pin_values():
    return ',\n'.join("    ('%s','%s')" % pin for pin in PINS)


def fill(template, **values):
    for key, value in values.items():
        template = template.replace('{{' + key + '}}', value)
    assert '{{' not in template, 'unfilled placeholder'
    return template


CANDIDATE_TEMPLATE = """-- EX-04 S2 (B10 Moje prijave): the paged own-application reader completed, with ONE shared row builder. NOT APPLIED to DEV: it needs the owner's explicit "primeni".
-- GENERATED by supabase/proofs/ex04/build_ex04b.py: do not edit by hand (`--check` fails on any difference).
-- Canonical basis: LIVE Master Plan card B10 ("uporedi stari read i rpc_list_my_applications_page: order, status, price basis, people, remote, ceo termin; dopuni stvarnu
-- projekciju; mapiraj karticu bez izmisljanja nedostajucih polja; poveži jedan cursor owner po skupu/tabu"), chapter 9.1 ("stabilan redosled, paging, aktivno/istorija semantiku,
-- osnovu cene, broj ljudi i puni raspored"), R18-E03 ("never infer remote from null coordinates"), P6 closure L7, EX04 plan section 6 (S2). No client calls the page today.
-- What changes: (1) the order of rpc_list_my_applications() is kept by the keyset (rank, sortAt, id), rank 0 = what waits for the applicant, 1 = open, 2 = the rest; (2) the items carry
-- the facts of the task that the card needs (full term, execution mode, price mode and basis, people); (3) the scopes are the screen's own sections ALL | ATTENTION | ACTIVE | HISTORY;
-- (4) the first page carries the four counts of the tabs. The reader gains the argument p_before_rank, so the old four-argument signature is dropped in the same statement.
-- One atomic DO statement: exact DEV predecessor pins, the closure certificate checked unchanged, exact delta accounting. No table, column, constraint, trigger, policy, index or data change.
do $ex04b$
declare
  old_signature constant text := '{{old_signature}}';
  page_signature constant text := '{{page_signature}}';
  rows_signature constant text := '{{rows_signature}}';
  page_body constant text := ${{page_tag}}${{page_body}}${{page_tag}}$;
  rows_body constant text := ${{rows_tag}}${{rows_body}}${{rows_tag}}$;
  pin record; prior record; actual jsonb; old_meta jsonb; digest_before text; old_oid oid; page_oid oid; rows_oid oid; fresh oid[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04B_OWNER_REQUIRED' using errcode = '55000'; end if;
  if to_regprocedure(rows_signature) is not null or to_regprocedure(page_signature) is not null then raise exception 'EX04B_ALREADY_APPLIED' using errcode = '55000'; end if;
  for pin in select * from (values
{{pins}}
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'EX04B_PREDECESSOR_DRIFT: %', pin.signature using errcode = '55000';
    end if;
  end loop;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04B_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  old_oid := to_regprocedure(old_signature)::oid;
  select to_jsonb(p) into old_meta from pg_proc p where p.oid = old_oid;
  if old_meta - 'oid' - 'prosrc' - 'pronargs' - 'pronargdefaults' - 'proargtypes' - 'proargnames' - 'proargdefaults' - 'pronamespace' - 'proowner' - 'prolang' - 'prorettype' - 'proname' - 'prosqlbody'
     - 'protrftypes' - 'probin' - 'provariadic' - 'prosupport' - 'proallargtypes' - 'proargmodes' is distinct from {{old_attributes}} - 'proowner' then
    raise exception 'EX04B_REPLACED_READER_ATTRIBUTES' using errcode = '55000';
  end if;
  create temporary table ex04b_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');

  -- The shared row builder: private, no client privilege of any kind.
  execute format($c${{rows_head}}%L$c$, rows_body);
  execute 'revoke all on function private.own_application_rows(uuid) from public, anon, authenticated, service_role';
  -- The reader: the old four-argument signature goes, the five-argument one (the cursor gains its rank) takes its place with the same owner, security and ACL.
  execute 'drop function public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid)';
  execute format($c${{new_head}}%L$c$, page_body);
  execute 'revoke all on function public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer) from public, anon, authenticated, service_role';
  execute 'grant execute on function public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer) to authenticated';

  -- Delta accounting: the certificate did not move, the old reader is gone, the new reader and the builder are the only new functions, nothing else changed.
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04B_CLOSURE_MOVED' using errcode = '55000';
  end if;
  if exists(select 1 from pg_proc p where p.oid = old_oid) then raise exception 'EX04B_OLD_READER_REMAINS' using errcode = '55000'; end if;
  for prior in select * from ex04b_functions where oid <> old_oid loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX04B_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if actual is distinct from prior.metadata then raise exception 'EX04B_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000'; end if;
  end loop;
  page_oid := to_regprocedure(page_signature)::oid; rows_oid := to_regprocedure(rows_signature)::oid;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex04b_functions f where f.oid = p.oid);
  if fresh is distinct from (select array_agg(v.oid order by v.oid) from (values (page_oid), (rows_oid)) v(oid)) then
    raise exception 'EX04B_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  select to_jsonb(p) into actual from pg_proc p where p.oid = page_oid;
  if actual - 'oid' - 'prosrc' - 'pronargs' - 'pronargdefaults' - 'proargtypes' - 'proargnames' - 'proargdefaults'
     is distinct from old_meta - 'oid' - 'prosrc' - 'pronargs' - 'pronargdefaults' - 'proargtypes' - 'proargnames' - 'proargdefaults' then
    raise exception 'EX04B_PAGE_ATTRIBUTE_DELTA' using errcode = '55000';
  end if;
  if actual ->> 'prosrc' is distinct from page_body or (actual ->> 'pronargs')::integer <> 5 or (actual ->> 'pronargdefaults')::integer <> 5
     or actual -> 'proargnames' is distinct from '["p_scope","p_limit","p_before_at","p_before_id","p_before_rank"]'::jsonb
     or pg_get_function_arguments(page_oid) is distinct from '{{new_arguments}}' then
    raise exception 'EX04B_PAGE_DEFINITION_MISMATCH' using errcode = '55000';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'rpc_list_my_applications_page') <> 1 then
    raise exception 'EX04B_READER_OVERLOAD' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = rows_oid and p.prosrc = rows_body and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}'
      and p.prokind = 'f' and p.proretset and p.prolang = (select oid from pg_language where lanname = 'sql')) then
    raise exception 'EX04B_ROWS_DELTA' using errcode = '55000';
  end if;
  if has_function_privilege('anon', rows_signature, 'EXECUTE') or has_function_privilege('authenticated', rows_signature, 'EXECUTE')
     or has_function_privilege('service_role', rows_signature, 'EXECUTE')
     or has_function_privilege('anon', page_signature, 'EXECUTE') or has_function_privilege('service_role', page_signature, 'EXECUTE')
     or not has_function_privilege('authenticated', page_signature, 'EXECUTE') then
    raise exception 'EX04B_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
end
$ex04b$;
"""

REVERT_TEMPLATE = """-- EX-04 S2 revert: the exact inverse of ex04b_own_applications_page.sql. NOT APPLIED. It needs its own explicit "primeni".
-- GENERATED by supabase/proofs/ex04/build_ex04b.py: do not edit by hand (`--check` fails on any difference).
-- It drops the five-argument reader and the shared row builder and restores the DEV predecessor reader byte for byte (md5 {{old_md5}}, the PKG-023a text with the PKG-042a
-- replacement) with its owner, security and ACL. It refuses unless the reader and the builder are exactly what the application produced. No data is touched.
do $ex04b_revert$
declare
  old_signature constant text := '{{old_signature}}';
  page_signature constant text := '{{page_signature}}';
  rows_signature constant text := '{{rows_signature}}';
  new_body constant text := ${{page_tag}}${{page_body}}${{page_tag}}$;
  old_body constant text := ${{old_tag}}${{old_body}}${{old_tag}}$;
  rows_body constant text := ${{rows_tag}}${{rows_body}}${{rows_tag}}$;
  prior record; actual jsonb; digest_before text; page_oid oid; rows_oid oid; old_oid oid; fresh oid[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04B_REVERT_OWNER_REQUIRED' using errcode = '55000'; end if;
  page_oid := to_regprocedure(page_signature)::oid; rows_oid := to_regprocedure(rows_signature)::oid;
  if page_oid is null or rows_oid is null or to_regprocedure(old_signature) is not null
     or (select prosrc from pg_proc where oid = page_oid) is distinct from new_body
     or (select prosrc from pg_proc where oid = rows_oid) is distinct from rows_body then
    raise exception 'EX04B_REVERT_STATE_NOT_THE_APPLIED_ONE' using errcode = '55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04B_REVERT_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex04b_revert_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and p.oid not in (page_oid, rows_oid);
  execute 'drop function public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid,integer)';
  execute 'drop function private.own_application_rows(uuid)';
  execute format($c${{old_head}}%L$c$, old_body);
  execute 'revoke all on function public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid) from public, anon, authenticated, service_role';
  execute 'grant execute on function public.rpc_list_my_applications_page(text,integer,timestamp with time zone,uuid) to authenticated';
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04B_REVERT_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex04b_revert_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX04B_REVERT_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if actual is distinct from prior.metadata then raise exception 'EX04B_REVERT_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000'; end if;
  end loop;
  old_oid := to_regprocedure(old_signature)::oid;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex04b_revert_functions f where f.oid = p.oid);
  if old_oid is null or fresh is distinct from array[old_oid] then raise exception 'EX04B_REVERT_FUNCTION_ROSTER_DELTA' using errcode = '55000'; end if;
  select to_jsonb(p) into actual from pg_proc p where p.oid = old_oid;
  if actual - 'oid' - 'prosrc' - 'pronargs' - 'pronargdefaults' - 'proargtypes' - 'proargnames' - 'proargdefaults' - 'pronamespace' - 'proowner' - 'prolang' - 'prorettype' - 'proname' - 'prosqlbody'
       - 'protrftypes' - 'probin' - 'provariadic' - 'prosupport' - 'proallargtypes' - 'proargmodes' is distinct from {{old_attributes}} - 'proowner'
     or actual ->> 'prosrc' is distinct from old_body or (actual ->> 'pronargs')::integer <> 4 or pg_get_function_arguments(old_oid) is distinct from '{{old_arguments}}'
     or md5(replace(actual ->> 'prosrc', E'\\r\\n', E'\\n')) is distinct from '{{old_md5}}'
     or (select proowner from pg_proc where oid = old_oid) is distinct from 'postgres'::regrole
     or to_regprocedure(page_signature) is not null or to_regprocedure(rows_signature) is not null then
    raise exception 'EX04B_REVERT_POSTCONDITION' using errcode = '55000';
  end if;
end
$ex04b_revert$;
"""

POSTFLIGHT_TEMPLATE = """-- EX-04 S2 DEV postflight. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right after the application (and at any time later).
-- GENERATED by supabase/proofs/ex04/build_ex04b.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON: every part of the applied state that does not hold ("problems": an empty array means the application is exactly in place).
with
  pins(signature, body_md5) as (values
    ('{{page_signature}}','{{page_md5}}'),
    ('{{rows_signature}}','{{rows_md5}}'),
{{dependency_pins}}
  ),
  problems as (
    select 'BODY_DRIFT' as kind, pin.signature as detail
    from pins pin
    where (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5
    union all
    select 'PAGE_ATTRIBUTES', '{{page_signature}}'
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure('{{page_signature}}') and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres,authenticated=X/postgres}'
      and pg_get_function_arguments(p.oid) = '{{new_arguments}}' and pg_get_function_result(p.oid) = 'jsonb')
    union all
    select 'ROWS_ATTRIBUTES', '{{rows_signature}}'
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure('{{rows_signature}}') and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}' and p.proretset)
    union all
    select 'OLD_READER_REMAINS', '{{old_signature}}'
    where to_regprocedure('{{old_signature}}') is not null
    union all
    select 'READER_OVERLOAD', count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname = 'rpc_list_my_applications_page' having count(*) <> 1
    union all
    select 'AUTHORITY', 'a client role can execute the builder, or anon the reader'
    where has_function_privilege('anon', '{{rows_signature}}', 'EXECUTE') or has_function_privilege('authenticated', '{{rows_signature}}', 'EXECUTE')
      or has_function_privilege('service_role', '{{rows_signature}}', 'EXECUTE') or has_function_privilege('anon', '{{page_signature}}', 'EXECUTE')
      or has_function_privilege('service_role', '{{page_signature}}', 'EXECUTE') or not has_function_privilege('authenticated', '{{page_signature}}', 'EXECUTE')
    union all
    -- The order key is submitted_at (the whole-list order), created_at only where it were never stamped: that fallback must stay unused on real data.
    select 'ORDER_KEY_UNSTAMPED', count(*)::text from public.marketplace_responses where status <> 'DRAFT' and submitted_at is null having count(*) > 0
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready and bound'
    where private.retention_ai_source_ready() is distinct from true
      or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  )
select jsonb_build_object(
  'unit', 'EX04B_OWN_APPLICATIONS_PAGE_DEV_POSTFLIGHT',
  'pinsChecked', (select count(*) from pins),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as postflight;
"""


def candidate_text():
    return fill(CANDIDATE_TEMPLATE, old_signature=OLD_SIGNATURE, page_signature=PAGE_SIGNATURE, rows_signature=ROWS_SIGNATURE,
                page_tag='page_body', rows_tag='rows_body', page_body=PAGE_BODY, rows_body=ROWS_BODY, pins=pin_values(),
                rows_head=ROWS_HEAD, new_head=NEW_HEAD, new_arguments=literal(NEW_ARGUMENTS), old_attributes=OLD_ATTRIBUTES)


def revert_text():
    old = old_page_body()
    return fill(REVERT_TEMPLATE, old_signature=OLD_SIGNATURE, page_signature=PAGE_SIGNATURE, rows_signature=ROWS_SIGNATURE,
                page_tag='new_body', old_tag='old_body', rows_tag='rows_body', page_body=PAGE_BODY, old_body=old, rows_body=ROWS_BODY,
                old_head=OLD_HEAD, old_md5=PINS[0][1], old_arguments=literal(OLD_ARGUMENTS), old_attributes=OLD_ATTRIBUTES)


def postflight_text():
    return fill(POSTFLIGHT_TEMPLATE, old_signature=OLD_SIGNATURE, page_signature=PAGE_SIGNATURE, rows_signature=ROWS_SIGNATURE,
                page_md5=md5(PAGE_BODY), rows_md5=md5(ROWS_BODY), new_arguments=literal(NEW_ARGUMENTS),
                dependency_pins=',\n'.join("    ('%s','%s')" % pin for pin in PINS[1:]))


FILES = [(CANDIDATE, candidate_text), (REVERT, revert_text), (POSTFLIGHT, postflight_text)]


def main(argv):
    check = '--check' in argv
    failed = False
    for tag in ('page_body', 'new_body', 'old_body', 'rows_body'):
        for body in (PAGE_BODY, ROWS_BODY, old_page_body()):
            assert '$' + tag + '$' not in body, 'dollar-quote tag collision: ' + tag
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
    print('page body md5', md5(PAGE_BODY), 'rows body md5', md5(ROWS_BODY), 'old page md5', PINS[0][1])
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
