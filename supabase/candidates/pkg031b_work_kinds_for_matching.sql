-- PKG-031b candidate. Deep read 9.2/9.3. Owner decision 2026-09-21: "odobravam sve" to the proposal "people never see
-- or choose a category; behind the scenes a short hidden list of kinds of work, used only to match a task with the
-- right worker".
-- Contract/proof: docs/implementation/v5-ai-first/pkg031/PKG031_OWNER_RULES.md
--
-- 9.2/9.3: the category and the skills are whatever text the AI or the person wrote (canonical DEV: 18 tasks in 10
--          spellings, "transport_selidbe" / "Selidbe i transport" / "Prevoz"), and matching compares that text
--          exactly after lowercasing. So a worker who excluded "selidbe" was still offered "transport_selidbe", and a
--          task needing "čišćenje stana" never met a worker with "Ciscenje stana".
--
-- This candidate adds private.work_kinds_v5(text[]): the hidden list. It reads any spelling (Serbian with or without
-- diacritics, English, snake_case) and returns the kinds of work it names, from a closed set of eleven. Text that
-- names none returns nothing, so an unknown word never matches another unknown word. The two places matching
-- compares skills and exclusions keep the exact comparison and also compare kinds:
--   - private.match_detail_without_calendar (the hard PROFILE_EXCLUSION gate and the service match);
--   - private.dispatch_cheap_candidate_admitted (the same two tests in the dispatch prefilter).
-- No stored row changes: the kind is read from the existing text at every match, and nothing shows it to people.
-- A new function plus two function bodies: nothing on the certified erasure list, no trigger function, no table, so
-- the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg031b_before(signature text primary key, prosrc text not null, acl text,
  secdef boolean not null, config text) on commit drop;
create temporary table pkg031b_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg031b_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if to_regprocedure('private.work_kinds_v5(text[])') is not null then
    raise exception 'PKG031B_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.match_detail_without_calendar(uuid,uuid)', '02d7063424dbbe3df6cd97c0a64bd8b1'),
    ('private.dispatch_cheap_candidate_admitted(uuid,uuid)', '72a078453c9b28b6a23690bf9fff2473')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG031B_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg031b_before
      select pin.signature, p.prosrc, p.proacl::text, p.prosecdef, p.proconfig::text
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG031B_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg031b_closure values (private.closure_source_digest_v5());
end
$pre$;

-- The hidden list. Each kind is recognised by word stems, after lowercasing and folding č ć š đ ž to c c s d z.
create function private.work_kinds_v5(p_values text[])
returns text[]
language sql
immutable
parallel safe
set search_path to 'pg_catalog'
as $function$
  select coalesce(array_agg(distinct k order by k), '{}'::text[])
  from unnest(coalesce(p_values, '{}'::text[])) v
  cross join lateral (select translate(lower(btrim(v)), 'čćšđžČĆŠĐŽ', 'ccsdzccsdz') t) f
  cross join lateral unnest(array[
    case when t ~ '(selid|prevoz|transport|kombi|moving|removal)' then 'SELIDBE_PREVOZ' end,
    case when t ~ '(fizick|nosenj|nosac|utovar|istovar|iznosenj|unosenj|labou?r|loading)' then 'FIZICKI_POSLOVI' end,
    case when t ~ '(montaz|sklapanj|namestaj|ikea|furniture|assembl)' then 'MONTAZA_NAMESTAJA' end,
    case when t ~ '(popravk|majstor|handyman|repair)' then 'SITNE_POPRAVKE' end,
    case when t ~ '(moler|krecenj|farbanj|gletovanj|painting|painter)' then 'MOLERSKI_RADOVI' end,
    case when t ~ '(elektr|electr|struj|uticnic|prekidac|rasvet|sijalic)' then 'ELEKTRO' end,
    case when t ~ '(vodoinst|vodovod|slavin|odvod|bojler|plumb)' then 'VODOINSTALATER' end,
    case when t ~ '(cisc|odrzavanj|clean|usisav)' then 'CISCENJE' end,
    case when t ~ '(pegl|pranje vesa|laundry|ironing)' then 'PRANJE_PEGLANJE' end,
    case when t ~ '(bast|dvorist|kosenj|travnjak|garden|lawn)' then 'BASTA_DVORISTE' end,
    case when t ~ '(dostav|kurir|delivery|courier)' then 'DOSTAVA' end
  ]) k
  where v is not null and k is not null;
$function$;
revoke all on function private.work_kinds_v5(text[]) from public, anon, authenticated, service_role;
comment on function private.work_kinds_v5(text[]) is
  'PKG-031b: the hidden kinds of work named by free text (category, skills, exclusions). Used only by matching.';

insert into pkg031b_patch values
(1, 'private.match_detail_without_calendar(uuid,uuid)',
$a$  svc := cardinality(n.required_skills) = 0
         or private.lower_arr(p.skills) && private.lower_arr(n.required_skills);
$a$,
$b$  svc := cardinality(n.required_skills) = 0
         or private.lower_arr(p.skills) && private.lower_arr(n.required_skills)
         -- PKG-031b (deep read 9.3): the same kind of work in other words ("Ciscenje stana" / "čišćenje stana").
         or private.work_kinds_v5(p.skills) && private.work_kinds_v5(n.required_skills);
$b$),
(2, 'private.match_detail_without_calendar(uuid,uuid)',
$a$  if private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category, n.required_skills))
    then hard := array_append(hard,'PROFILE_EXCLUSION'); end if;
$a$,
$b$  if private.lower_arr(p.exclusions) && private.lower_arr(array_prepend(n.category, n.required_skills))
     -- PKG-031b (deep read 9.2/9.3): an exclusion holds for the same kind of work in any spelling
     -- ("selidbe" also keeps out "transport_selidbe").
     or private.work_kinds_v5(p.exclusions) && private.work_kinds_v5(array_prepend(n.category, n.required_skills))
    then hard := array_append(hard,'PROFILE_EXCLUSION'); end if;
$b$),
(3, 'private.dispatch_cheap_candidate_admitted(uuid,uuid)',
$a$      and (cardinality(n.required_skills) = 0
           or private.lower_arr(p.skills) && private.lower_arr(n.required_skills))
$a$,
$b$      and (cardinality(n.required_skills) = 0
           or private.lower_arr(p.skills) && private.lower_arr(n.required_skills)
           or private.work_kinds_v5(p.skills) && private.work_kinds_v5(n.required_skills))
$b$),
(4, 'private.dispatch_cheap_candidate_admitted(uuid,uuid)',
$a$      and not (private.lower_arr(p.exclusions)
               && private.lower_arr(array_prepend(n.category, n.required_skills)))
$a$,
$b$      and not (private.lower_arr(p.exclusions)
               && private.lower_arr(array_prepend(n.category, n.required_skills))
               or private.work_kinds_v5(p.exclusions)
               && private.work_kinds_v5(array_prepend(n.category, n.required_skills)))
$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg031b_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG031B_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg031b_before loop
    expected := s.prosrc;
    for p in select * from pkg031b_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc, pr.proacl::text acl, pr.prosecdef secdef, pr.proconfig::text config
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG031B_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.acl, actual.secdef, actual.config) is distinct from (s.acl, s.secdef, s.config) then
      raise exception 'PKG031B_PRIVILEGES_CHANGED: %', s.signature;
    end if;
  end loop;
  if has_function_privilege('anon', 'private.work_kinds_v5(text[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.work_kinds_v5(text[])', 'EXECUTE')
     or has_function_privilege('service_role', 'private.work_kinds_v5(text[])', 'EXECUTE') then
    raise exception 'PKG031B_KINDS_EXECUTABLE_BY_CLIENTS';
  end if;
  -- Every spelling canonical DEV holds on 2026-09-21 names the kind it means, and unknown text names none.
  if private.work_kinds_v5(array['transport_selidbe']) <> array['SELIDBE_PREVOZ']
     or private.work_kinds_v5(array['Selidbe i transport']) <> array['SELIDBE_PREVOZ']
     or private.work_kinds_v5(array['Prevoz']) <> array['SELIDBE_PREVOZ']
     or private.work_kinds_v5(array['transport_and_assembly']) <> array['MONTAZA_NAMESTAJA', 'SELIDBE_PREVOZ']
     or private.work_kinds_v5(array['"Fizički poslovi"']) <> array['FIZICKI_POSLOVI']
     or private.work_kinds_v5(array['Moleraj']) <> array['MOLERSKI_RADOVI']
     or private.work_kinds_v5(array['MOLERSKI_RADOVI']) <> array['MOLERSKI_RADOVI']
     or private.work_kinds_v5(array['Čišćenje i održavanje']) <> array['CISCENJE']
     or private.work_kinds_v5(array['Dostava']) <> array['DOSTAVA']
     or private.work_kinds_v5(array['Montaža nameštaja']) <> array['MONTAZA_NAMESTAJA']
     or private.work_kinds_v5(array['Ciscenje stana', 'electrician', 'plumber', 'Peglanje'])
          <> array['CISCENJE', 'ELEKTRO', 'PRANJE_PEGLANJE', 'VODOINSTALATER']
     or private.work_kinds_v5(array['nešto sasvim drugo', null, '']) <> '{}'::text[]
     or private.work_kinds_v5(null) <> '{}'::text[] then
    raise exception 'PKG031B_KINDS_WRONG';
  end if;
  if (select source_digest from pkg031b_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG031B_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
commit;
