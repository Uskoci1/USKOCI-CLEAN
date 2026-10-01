"""Generator for the EX-04 S3 (RC-03: the rating state of a finished Dogovor) server candidate, its exact revert and its read-only DEV postflight.

Two existing readers are replaced IN PLACE, by additive edits of their exact DEV bodies, so the diff to the predecessor is the whole change:
  - rpc_list_my_agreements_page: every item gains `ratingDue` (D01),
  - rpc_home_attention:          the answer gains `ratings: {due, dueAgreementId}` (A01).
Both answer, in one pass, what rpc_get_my_agreement_review(...).eligible answers per Dogovor, so the client stops asking once per finished Dogovor.
The old bodies are rebuilt byte for byte from repository sources and checked against the DEV md5s; the new bodies are those old bodies plus anchored edits (each anchor must occur
exactly once). The candidate, the revert and the postflight are generated; `--check` fails on any difference.

    python supabase/proofs/ex04/build_ex04c.py            # write the three files
    python supabase/proofs/ex04/build_ex04c.py --check    # fail if a file differs
"""
import hashlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CANDIDATE = ROOT / 'supabase' / 'candidates' / 'ex04c_rating_state.sql'
REVERT = ROOT / 'supabase' / 'candidates' / 'ex04c_rating_state_revert.sql'
POSTFLIGHT = ROOT / 'supabase' / 'proofs' / 'ex04' / 'ex04c_postflight.readonly.sql'
PKG023A = ROOT / 'supabase' / 'candidates' / 'pkg023a_own_reads_paged.sql'
PKG024A = ROOT / 'supabase' / 'candidates' / 'pkg024a_agreement_profile_ids.sql'
PKG035A = ROOT / 'supabase' / 'candidates' / 'pkg035a_selectable_application_counts.sql'
PKG042A = ROOT / 'supabase' / 'candidates' / 'pkg042a_cancelled_agreement_read_parity.sql'
LEDGER_023J = ROOT / 'supabase' / 'operations' / 'dev-alpha' / 'ledger' / '20260919221214_dev_alpha_pkg023j_home_attention.sql'

LIST_SIGNATURE = 'public.rpc_list_my_agreements_page(text,integer,timestamp with time zone,uuid)'
HOME_SIGNATURE = 'public.rpc_home_attention()'
LIST_HEAD = ("create or replace function public.rpc_list_my_agreements_page(p_scope text default 'ALL'::text, p_limit integer default 30, "
             "p_before_at timestamp with time zone default null::timestamp with time zone, p_before_id uuid default null::uuid) "
             "returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as ")
HOME_HEAD = "create or replace function public.rpc_home_attention() returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as "

# The exact DEV predecessor bodies (LF-normalised md5), read from canonical DEV on 2026-10-01. The last five are what the new bodies lean on: the authority that is mirrored,
# the closure predicate, the account gate, and the helpers Pocetna's attention already used.
LIST_OLD_MD5 = 'c5239ccdc2ffe8f54c661fb7cbf2e335'
HOME_OLD_MD5 = '8a8feab5eb2ba727c637322b0ef044c1'
PINS = [
    (LIST_SIGNATURE, LIST_OLD_MD5),
    (HOME_SIGNATURE, HOME_OLD_MD5),
    ('public.rpc_get_my_agreement_review(uuid)', '75a8b78ec8a5e6334f42366b4461c14c'),
    ('private.closure_account_restricted(uuid)', 'f4999250c315e0253374d4611291c7ad'),
    ('public.rpc_storage_account_open()', '7350621ef256678e209aa6a28c79b58b'),
    ('private.my_application_state(text,integer,integer,text,boolean)', '236c6c9c9625e4fb92522c6c3a1bfe03'),
    ('public.covered_slots(public.needs)', 'cbeb8f2a3da7d08965ef0386cfc437ba'),
    ('public.selectable_application_count(public.needs)', 'fe53442f8b661d6f33d22a54e2a468a8'),
]


def md5(text):
    return hashlib.md5(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def read(path):
    return io.open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def function_body(source, signature_regex, tag='$function$'):
    match = re.search(signature_regex, source)
    assert match, signature_regex
    start = source.index(tag, match.end()) + len(tag)
    return source[start:source.index(tag, start)]


def old_list_body():
    """The DEV body: the PKG-023a text with the PKG-024a insertion of the two profile ids."""
    base = function_body(read(PKG023A), r'create function public\.rpc_list_my_agreements_page\(')
    assert md5(base) == 'f834365bd8dd43b1eac6c8213624e1dc', 'the pkg023a source is not the body that pkg024a patched'
    anchor = "'workerAccountId', a.worker_account_id,"
    assert base.count(anchor) == 1
    body = base.replace(anchor, anchor + " 'requesterProfileId', a.requester_profile_id, 'workerProfileId', a.worker_profile_id,")
    assert md5(body) == LIST_OLD_MD5, 'the reconstructed agreements page is not the DEV predecessor body'
    return body


def old_home_body():
    """The DEV body: the PKG-023j text, then the PKG-035a selectable-count replacement, then the PKG-042a cancelled-Agreement replacement."""
    base = function_body(read(LEDGER_023J), r'create function public\.rpc_home_attention\(\)')
    assert md5(base) == '7371d4cddcebead2cb86d8f795d2ee01', 'the pkg023j ledger text is not the body that pkg035a patched'
    pairs = re.findall(r'anchor text:=\$anchor\$(.*?)\$anchor\$;.*?execute replace\(def,anchor,\$replacement\$(.*?)\$replacement\$\);', read(PKG035A), re.S)
    anchor, replacement = [pair for pair in pairs if 'Compatibility count' in pair[0]][0]
    assert base.count(anchor) == 1
    step = base.replace(anchor, replacement)
    assert md5(step) == '239f2477ae58ec92254edfdeda0455e7', 'the pkg035a replacement does not give the reviewed body'
    row = re.search(r"\(1, 'public\.rpc_home_attention\(\)', '([0-9a-f]{32})', '([0-9a-f]{32})', \$a\$(.*?)\$a\$, \$b\$(.*?)\$b\$\)", read(PKG042A), re.S)
    before, after, anchor, replacement = row.groups()
    assert before == '239f2477ae58ec92254edfdeda0455e7' and step.count(anchor) == 1
    body = step.replace(anchor, replacement)
    assert md5(body) == after == HOME_OLD_MD5, 'the reconstructed home attention is not the DEV predecessor body'
    return body


def edit(body, anchor, replacement):
    assert body.count(anchor) == 1, ('anchor is not unique', anchor[:60], body.count(anchor))
    return body.replace(anchor, replacement)


def new_list_body():
    body = old_list_body()
    body = edit(body, "  v_items jsonb;\nbegin\n", "  v_items jsonb;\n  v_restricted boolean;\nbegin\n")
    body = edit(body, "  select coalesce(jsonb_agg(x.payload order by x.created_at desc, x.id desc), '[]'::jsonb) into v_items\n",
                "  -- EX-04 S3 (RC-03): whether MY rating of a finished Dogovor is still due is part of the page, so the client never has to ask once per Dogovor. It is exactly the answer of\n"
                "  -- rpc_get_my_agreement_review(...).eligible: no review of mine yet, my account is not under a closure restriction, and the Dogovor and its execution are COMPLETED.\n"
                "  v_restricted := private.closure_account_restricted(v_uid);\n"
                "  select coalesce(jsonb_agg(x.payload order by x.created_at desc, x.id desc), '[]'::jsonb) into v_items\n")
    body = edit(body, "        'createdAt', a.created_at\n      ) as payload\n",
                "        'createdAt', a.created_at,\n"
                "        'ratingDue', coalesce(a.status = 'COMPLETED' and ae.state = 'COMPLETED' and not v_restricted\n"
                "          and not exists (select 1 from private.agreement_reviews rv where rv.agreement_id = a.id and rv.reviewer_account_id = v_uid), false)\n"
                "      ) as payload\n")
    return body


def new_home_body():
    body = old_home_body()
    body = edit(body, "  v_result jsonb;\nbegin\n", "  v_result jsonb;\n  v_restricted boolean;\nbegin\n")
    body = edit(body, "  end if;\n\n  with own_needs as materialized (\n",
                "  end if;\n  v_restricted := private.closure_account_restricted(v_uid);\n\n  with own_needs as materialized (\n")
    body = edit(body, "  ), attention as materialized (\n",
                "  ), rating_due as materialized (\n"
                "    -- EX-04 S3 (RC-03): the finished Dogovori that wait for MY rating, by the answer of rpc_get_my_agreement_review(...).eligible, in one bounded pass.\n"
                "    select a.id from public.agreements a\n"
                "      join public.agreement_execution ae on ae.agreement_id = a.id and ae.state = 'COMPLETED'\n"
                "    where v_uid in (a.requester_account_id, a.worker_account_id) and a.status = 'COMPLETED' and not v_restricted\n"
                "      and not exists (select 1 from private.agreement_reviews rv where rv.agreement_id = a.id and rv.reviewer_account_id = v_uid)\n"
                "  ), attention as materialized (\n")
    body = edit(body, "        ('SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED')) as application_count\n  )\n  select jsonb_build_object(\n",
                "        ('SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED')) as application_count,\n"
                "      (select count(*) from rating_due) as ratings_due,\n"
                "      (select case when count(*) = 1 then (array_agg(id))[1] end from rating_due) as rating_due_agreement_id\n"
                "  )\n  select jsonb_build_object(\n")
    body = edit(body, "      'activitiesMore', greatest(0, t.need_count + t.application_count - 5))\n  ) into v_result from totals t;\n",
                "      'activitiesMore', greatest(0, t.need_count + t.application_count - 5)),\n"
                "    'ratings', jsonb_build_object('due', t.ratings_due, 'dueAgreementId', t.rating_due_agreement_id)\n"
                "  ) into v_result from totals t;\n")
    return body


def fill(template, **values):
    for key, value in values.items():
        template = template.replace('{{' + key + '}}', value)
    assert '{{' not in template, 'unfilled placeholder'
    return template


def pin_values():
    return ',\n'.join("    ('%s','%s')" % pin for pin in PINS)


CANDIDATE_TEMPLATE = """-- EX-04 S3 (RC-03: the rating state of a finished Dogovor): two existing readers completed IN PLACE. NOT APPLIED to DEV: it needs the owner's explicit "primeni".
-- GENERATED by supabase/proofs/ex04/build_ex04c.py: do not edit by hand (`--check` fails on any difference).
-- Canonical basis: LIVE Master Plan cards A01 ("dopuni postojeću serversku projekciju potrebnim statusom ocene ili bounded agregatom ... ne uvodi novi dashboard") and D01 ("u postojeći bounded
-- odgovor uvedi činjenicu koja je potrebna za čekanje ocene; ne preuzimaj celu istoriju radi badge-a"), chapter 6.7 ("jedan zbirni Home broj ne sme zavisiti od cele istorije ocena"), P6 closure L10,
-- EX04 plan section 6 (S3). Additive keys only, so every older client keeps working: rpc_list_my_agreements_page items gain `ratingDue`, rpc_home_attention gains `ratings` {due, dueAgreementId}.
-- Both are the answer of rpc_get_my_agreement_review(...).eligible, computed in one pass: no review of mine yet, my account is not under a closure restriction, the Dogovor and its execution are COMPLETED.
-- One atomic DO statement: exact DEV predecessor pins, the closure certificate checked unchanged, exact delta accounting (two bodies replaced, nothing else changed, no function added).
-- No table, column, constraint, trigger, policy, index, privilege or data change.
do $ex04c$
declare
  list_signature constant text := '{{list_signature}}';
  home_signature constant text := '{{home_signature}}';
  list_body constant text := ${{list_tag}}${{list_body}}${{list_tag}}$;
  home_body constant text := ${{home_tag}}${{home_body}}${{home_tag}}$;
  pin record; prior record; actual jsonb; digest_before text; list_oid oid; home_oid oid; fresh oid[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04C_OWNER_REQUIRED' using errcode = '55000'; end if;
  list_oid := to_regprocedure(list_signature)::oid; home_oid := to_regprocedure(home_signature)::oid;
  if (select prosrc from pg_proc where oid = list_oid) = list_body or (select prosrc from pg_proc where oid = home_oid) = home_body then
    raise exception 'EX04C_ALREADY_APPLIED' using errcode = '55000';
  end if;
  for pin in select * from (values
{{pins}}
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'EX04C_PREDECESSOR_DRIFT: %', pin.signature using errcode = '55000';
    end if;
  end loop;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04C_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex04c_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');

  -- The two readers, replaced in place (same signature, same owner, same ACL, the comment of rpc_home_attention stays).
  execute format($c${{list_head}}%L$c$, list_body);
  execute format($c${{home_head}}%L$c$, home_body);

  -- Delta accounting: the certificate did not move, only the two readers changed (bodies only), nothing else changed, no function was added.
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04C_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex04c_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX04C_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid in (list_oid, home_oid) then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' then
        raise exception 'EX04C_ATTRIBUTE_DELTA: %', prior.signature using errcode = '55000';
      end if;
      if actual ->> 'prosrc' is not distinct from prior.metadata ->> 'prosrc'
         or actual ->> 'prosrc' is distinct from (case when prior.oid = list_oid then list_body else home_body end) then
        raise exception 'EX04C_BODY_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX04C_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex04c_functions f where f.oid = p.oid);
  if fresh <> '{}'::oid[] then raise exception 'EX04C_FUNCTION_ROSTER_DELTA' using errcode = '55000'; end if;
  if has_function_privilege('anon', list_signature, 'EXECUTE') or has_function_privilege('anon', home_signature, 'EXECUTE')
     or has_function_privilege('service_role', list_signature, 'EXECUTE') or has_function_privilege('service_role', home_signature, 'EXECUTE')
     or not has_function_privilege('authenticated', list_signature, 'EXECUTE') or not has_function_privilege('authenticated', home_signature, 'EXECUTE') then
    raise exception 'EX04C_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
end
$ex04c$;
"""

REVERT_TEMPLATE = """-- EX-04 S3 revert: the exact inverse of ex04c_rating_state.sql. NOT APPLIED. It needs its own explicit "primeni".
-- GENERATED by supabase/proofs/ex04/build_ex04c.py: do not edit by hand (`--check` fails on any difference).
-- It restores the two DEV predecessor bodies byte for byte (md5 {{list_old_md5}} for rpc_list_my_agreements_page, the PKG-023a text with the PKG-024a insertion; md5 {{home_old_md5}} for rpc_home_attention,
-- the PKG-023j text with the PKG-035a and PKG-042a replacements). It refuses unless the two readers are exactly what the application produced. No data is touched.
do $ex04c_revert$
declare
  list_signature constant text := '{{list_signature}}';
  home_signature constant text := '{{home_signature}}';
  list_new constant text := ${{list_new_tag}}${{list_new}}${{list_new_tag}}$;
  home_new constant text := ${{home_new_tag}}${{home_new}}${{home_new_tag}}$;
  list_old constant text := ${{list_old_tag}}${{list_old}}${{list_old_tag}}$;
  home_old constant text := ${{home_old_tag}}${{home_old}}${{home_old_tag}}$;
  prior record; actual jsonb; digest_before text; list_oid oid; home_oid oid; fresh oid[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX04C_REVERT_OWNER_REQUIRED' using errcode = '55000'; end if;
  list_oid := to_regprocedure(list_signature)::oid; home_oid := to_regprocedure(home_signature)::oid;
  if (select prosrc from pg_proc where oid = list_oid) is distinct from list_new or (select prosrc from pg_proc where oid = home_oid) is distinct from home_new then
    raise exception 'EX04C_REVERT_STATE_NOT_THE_APPLIED_ONE' using errcode = '55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX04C_REVERT_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex04c_revert_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');
  execute format($c${{list_head}}%L$c$, list_old);
  execute format($c${{home_head}}%L$c$, home_old);
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX04C_REVERT_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex04c_revert_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX04C_REVERT_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid in (list_oid, home_oid) then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc'
         or actual ->> 'prosrc' is distinct from (case when prior.oid = list_oid then list_old else home_old end) then
        raise exception 'EX04C_REVERT_BODY_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX04C_REVERT_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex04c_revert_functions f where f.oid = p.oid);
  if fresh <> '{}'::oid[]
     or (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = list_oid) is distinct from '{{list_old_md5}}'
     or (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = home_oid) is distinct from '{{home_old_md5}}' then
    raise exception 'EX04C_REVERT_POSTCONDITION' using errcode = '55000';
  end if;
end
$ex04c_revert$;
"""

POSTFLIGHT_TEMPLATE = """-- EX-04 S3 DEV postflight. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right after the application (and at any time later).
-- GENERATED by supabase/proofs/ex04/build_ex04c.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON: every part of the applied state that does not hold ("problems": an empty array means the application is exactly in place).
with
  pins(signature, body_md5) as (values
    ('{{list_signature}}','{{list_md5}}'),
    ('{{home_signature}}','{{home_md5}}'),
{{dependency_pins}}
  ),
  problems as (
    select 'BODY_DRIFT' as kind, pin.signature as detail
    from pins pin
    where (select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5
    union all
    select 'READER_ATTRIBUTES', signature
    from (values ('{{list_signature}}'), ('{{home_signature}}')) r(signature)
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure(r.signature) and p.prosecdef and p.provolatile = 's'
      and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres,authenticated=X/postgres}'
      and p.prorettype = 'jsonb'::regtype and not p.proretset)
    union all
    select 'AUTHORITY', 'anon or service_role can execute a reader, or authenticated cannot'
    where has_function_privilege('anon', '{{list_signature}}', 'EXECUTE') or has_function_privilege('anon', '{{home_signature}}', 'EXECUTE')
      or has_function_privilege('service_role', '{{list_signature}}', 'EXECUTE') or has_function_privilege('service_role', '{{home_signature}}', 'EXECUTE')
      or not has_function_privilege('authenticated', '{{list_signature}}', 'EXECUTE') or not has_function_privilege('authenticated', '{{home_signature}}', 'EXECUTE')
    union all
    select 'HOME_COMMENT_LOST', '{{home_signature}}'
    where obj_description(to_regprocedure('{{home_signature}}'), 'pg_proc') is null
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready and bound'
    where private.retention_ai_source_ready() is distinct from true
      or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
  )
select jsonb_build_object(
  'unit', 'EX04C_RATING_STATE_DEV_POSTFLIGHT',
  'pinsChecked', (select count(*) from pins),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as postflight;
"""


def candidate_text():
    return fill(CANDIDATE_TEMPLATE, list_signature=LIST_SIGNATURE, home_signature=HOME_SIGNATURE, list_tag='list_body', home_tag='home_body',
                list_body=new_list_body(), home_body=new_home_body(), pins=pin_values(), list_head=LIST_HEAD, home_head=HOME_HEAD)


def revert_text():
    return fill(REVERT_TEMPLATE, list_signature=LIST_SIGNATURE, home_signature=HOME_SIGNATURE, list_new_tag='list_new', home_new_tag='home_new', list_old_tag='list_old', home_old_tag='home_old',
                list_new=new_list_body(), home_new=new_home_body(), list_old=old_list_body(), home_old=old_home_body(), list_head=LIST_HEAD, home_head=HOME_HEAD,
                list_old_md5=LIST_OLD_MD5, home_old_md5=HOME_OLD_MD5)


def postflight_text():
    return fill(POSTFLIGHT_TEMPLATE, list_signature=LIST_SIGNATURE, home_signature=HOME_SIGNATURE, list_md5=md5(new_list_body()), home_md5=md5(new_home_body()),
                dependency_pins=',\n'.join("    ('%s','%s')" % pin for pin in PINS[2:]))


FILES = [(CANDIDATE, candidate_text), (REVERT, revert_text), (POSTFLIGHT, postflight_text)]


def main(argv):
    check = '--check' in argv
    failed = False
    bodies = [new_list_body(), new_home_body(), old_list_body(), old_home_body()]
    for tag in ('list_body', 'home_body', 'list_new', 'home_new', 'list_old', 'home_old'):
        assert all('$' + tag + '$' not in body for body in bodies), 'dollar-quote tag collision: ' + tag
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
    print('list body md5', md5(new_list_body()), 'home body md5', md5(new_home_body()), '| old', LIST_OLD_MD5, HOME_OLD_MD5)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
