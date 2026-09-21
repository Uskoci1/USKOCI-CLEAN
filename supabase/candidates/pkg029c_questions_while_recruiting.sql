-- PKG-029c candidate. Deep read 7.47 and 12.5. Owner approval 2026-09-21: "dozvoljavam sve" to the command
-- "sve ostale greške iz dubinskog pregleda: svaku prvo dokaži na privremenoj bazi, pa je primeni na DEV".
-- Contract/proof: docs/implementation/v5-ai-first/pkg029/PKG029_SERVER_ROUND.md
--
-- 7.47: every Q&A function allowed PUBLISHED and ACTIVE and refused SELECTION. A task with one person chosen and
--       places still open (SELECTION) is still recruiting, yet its questions closed; a fully staffed task (ACTIVE),
--       which nobody new can join, kept them open. Questions now follow recruiting: PUBLISHED and SELECTION.
-- 12.5: the contact filter refused any run of seven or more digit-like characters as a phone number, so
--       "Da li može 12.10.2026 posle podne?" and "Cena 15000 - 20000 je ok?" were refused. A phone number now has to
--       start like one (0, 00, + or 381) and hold 8 to 13 digits, and a date shape is not one.
-- Function bodies only: the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg029c_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
-- occurrences: how many times the anchor must occur; every occurrence is replaced.
create temporary table pkg029c_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null, occurrences integer not null) on commit drop;
create temporary table pkg029c_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('PKG-029c' in prosrc) from pg_proc
       where oid = to_regprocedure('private.ru4b_public_floor_reason(text)')) > 0 then
    raise exception 'PKG029C_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text)', '83f4220f2b8f4ec8bea2e4a55cd6d676'),
    ('public.rpc_read_preselection_qa_context(uuid,uuid)', '2bebe4c512fe0587d3b31093131bdd74'),
    ('public.rpc_ru4b_answer_preselection_question(uuid,text,uuid)', 'fad7e68181d15eed98ab977bd5900dfb'),
    ('public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid)', 'b28bc16c63153ea8fa53a7f0c905a26a'),
    ('public.rpc_ru4b_public_preselection_qa(uuid)', '1936e78e5390c13697849a801b5fe4e7'),
    ('private.ru4b_public_floor_reason(text)', '51ae92967178a41216ccb74c1ec138d3')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG029C_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg029c_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG029C_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg029c_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg029c_patch values
(1, 'public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text)', $a$'PUBLISHED','ACTIVE'$a$, $b$'PUBLISHED','SELECTION'$b$, 1),
(2, 'public.rpc_read_preselection_qa_context(uuid,uuid)', $a$'PUBLISHED','ACTIVE'$a$, $b$'PUBLISHED','SELECTION'$b$, 4),
(3, 'public.rpc_ru4b_answer_preselection_question(uuid,text,uuid)', $a$'PUBLISHED','ACTIVE'$a$, $b$'PUBLISHED','SELECTION'$b$, 1),
(4, 'public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid)', $a$'PUBLISHED','ACTIVE'$a$, $b$'PUBLISHED','SELECTION'$b$, 1),
(5, 'public.rpc_ru4b_public_preselection_qa(uuid)', $a$'PUBLISHED','ACTIVE'$a$, $b$'PUBLISHED','SELECTION'$b$, 1),
(6, 'private.ru4b_public_floor_reason(text)',
$a$  if v ~ '(\+?[0-9][0-9 ()/.\-]{6,}[0-9])' then return 'PHONE_NOT_PUBLIC'; end if;$a$,
$b$  -- PKG-029c (deep read 12.5): a phone number starts like one (0, 00, + or 381) and holds 8 to 13 digits; a date
  -- ("01.10.2026") and a price range ("15000 - 20000") are not phone numbers.
  if exists (select 1 from regexp_matches(v, '(\+?[0-9][0-9 ()/.\-]{6,}[0-9])', 'g') m
              where regexp_replace(m[1], '[^0-9+]', '', 'g') ~ '^(\+|00|0|381)'
                and length(regexp_replace(m[1], '[^0-9]', '', 'g')) between 8 and 13
                and m[1] !~ '^[0-9]{1,2}[./][0-9]{1,2}[./][0-9]{2,4}') then return 'PHONE_NOT_PUBLIC'; end if;$b$, 1);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg029c_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) * p.occurrences then
      raise exception 'PKG029C_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg029c_before loop
    expected := s.prosrc;
    for p in select * from pkg029c_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG029C_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG029C_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select count(*) from pkg029c_before) <> 6 or (select count(*) from pkg029c_patch) <> 6 then
    raise exception 'PKG029C_PATCH_SET_CHANGED';
  end if;
  -- The filter, on the sentences the deep read measured and on real phone shapes.
  if private.ru4b_public_floor_reason('Da li može 12.10.2026 posle podne?') is not null
     or private.ru4b_public_floor_reason('Da li može 01.10.2026 posle podne?') is not null
     or private.ru4b_public_floor_reason('Cena 15000 - 20000 je ok?') is not null
     or private.ru4b_public_floor_reason('Treba 2 radnika od 8 do 16h') is not null
     or private.ru4b_public_floor_reason('Zovi me na 064 123 4567') is distinct from 'PHONE_NOT_PUBLIC'
     or private.ru4b_public_floor_reason('Broj: +381 64 123 45 67') is distinct from 'PHONE_NOT_PUBLIC'
     or private.ru4b_public_floor_reason('064/123-456') is distinct from 'PHONE_NOT_PUBLIC'
     or private.ru4b_public_floor_reason('0641234567') is distinct from 'PHONE_NOT_PUBLIC' then
    raise exception 'PKG029C_PHONE_RULE';
  end if;
  if (select source_digest from pkg029c_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG029C_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
