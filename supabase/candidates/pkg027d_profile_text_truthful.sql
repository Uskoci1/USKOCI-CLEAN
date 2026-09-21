-- PKG-027d candidate. Owner approval 2026-09-21 ("odobravam sve to"), after the deep read (ledger 12.4).
-- Contract/proof: docs/implementation/v5-ai-first/pkg027/PKG027_OWNER_APPROVED_FIXES.md
--
-- Defect, measured on canonical DEV: public.handle_uskoci_auth_user_created writes a headline and a bio the
-- person never wrote into both profiles at sign-up; every live profile still carries one of the two historical
-- versions, the worker one in the masculine ("Spreman da uskočim...", "Dostupan za poslove..."), and
-- rpc_get_public_profile shows the worker's headline and bio to other people as that person's own words.
--
-- This candidate makes sign-up leave both fields empty and empties exactly the seven sentences the server ever
-- invented. Anything a person wrote is left alone. The trigger is on auth.users, outside the certified closure
-- source, and the rest is data: the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg027d_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg027d_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg027d_closure(source_digest text not null) on commit drop;
create temporary table pkg027d_invented(field text not null, sentence text not null) on commit drop;
insert into pkg027d_invented values
  ('headline', 'Tražim pouzdanu pomoć uz jasan dogovor.'),
  ('headline', 'Uskačem kada se dogovor jasno postavi.'),
  ('headline', 'Spreman da uskočim kada se dogovor jasno postavi.'),
  ('bio', 'Nov nalog u USKOČI zajednici.'),
  ('bio', 'Novi član USKOČI zajednice.'),
  ('bio', 'Za poslove koji odgovaraju profilu i kalendaru.'),
  ('bio', 'Dostupan za poslove koji odgovaraju profilu i kalendaru.');
create temporary table pkg027d_untouched(id uuid primary key, headline text not null, bio text not null) on commit drop;

do $pre$
declare pin record;
begin
  for pin in select * from (values
    ('public.handle_uskoci_auth_user_created()', '187aa3a262ce940f39ae7faba720963e')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      if (select position('''Tražim pouzdanu pomoć' in prosrc) from pg_proc where oid = to_regprocedure(pin.signature)) = 0 then
        raise exception 'PKG027D_ALREADY_APPLIED';
      end if;
      raise exception 'PKG027D_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg027d_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG027D_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg027d_closure values (private.closure_source_digest_v5());
  -- Every profile whose text was written by a person, not by the server, must come out unchanged.
  insert into pkg027d_untouched
    select p.id, p.headline, p.bio from public.app_profiles p
     where not exists (select 1 from pkg027d_invented i where i.field = 'headline' and i.sentence = p.headline)
       and not exists (select 1 from pkg027d_invented i where i.field = 'bio' and i.sentence = p.bio);
end
$pre$;

insert into pkg027d_patch values
(1, 'public.handle_uskoci_auth_user_created()',
$a$  -- The profile copy is written in the user's own voice, so it must not assume their
  -- gender. These read identically for everyone.$a$,
$b$  -- PKG-027d: no headline or bio is written for the person. Other people read these fields as the
  -- person's own words, so they start empty and only the person fills them.$b$),
(2, 'public.handle_uskoci_auth_user_created()',
$a$  VALUES(NEW.id,'REQUESTER',profile_name,profile_city,'Tražim pouzdanu pomoć uz jasan dogovor.','Nov nalog u USKOČI zajednici.',10,false)$a$,
$b$  VALUES(NEW.id,'REQUESTER',profile_name,profile_city,'','',10,false)$b$),
(3, 'public.handle_uskoci_auth_user_created()',
$a$  VALUES(NEW.id,'WORKER',profile_name,profile_city,'Uskačem kada se dogovor jasno postavi.','Za poslove koji odgovaraju profilu i kalendaru.',initial_skills,15,false)$a$,
$b$  VALUES(NEW.id,'WORKER',profile_name,profile_city,'','',initial_skills,15,false)$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg027d_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG027D_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $clean$
declare v_headlines integer; v_bios integer;
begin
  update public.app_profiles p set headline = ''
   where exists (select 1 from pkg027d_invented i where i.field = 'headline' and i.sentence = p.headline);
  get diagnostics v_headlines = row_count;
  update public.app_profiles p set bio = ''
   where exists (select 1 from pkg027d_invented i where i.field = 'bio' and i.sentence = p.bio);
  get diagnostics v_bios = row_count;
  raise notice 'PKG027D_EMPTIED headlines=% bios=%', v_headlines, v_bios;
end
$clean$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg027d_before loop
    expected := s.prosrc;
    for p in select * from pkg027d_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG027D_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG027D_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if exists (select 1 from public.app_profiles p join pkg027d_invented i
              on (i.field = 'headline' and i.sentence = p.headline) or (i.field = 'bio' and i.sentence = p.bio)) then
    raise exception 'PKG027D_INVENTED_TEXT_REMAINS';
  end if;
  if exists (select 1 from pkg027d_untouched u join public.app_profiles p on p.id = u.id
              where (p.headline, p.bio) is distinct from (u.headline, u.bio)) then
    raise exception 'PKG027D_PERSON_TEXT_CHANGED';
  end if;
  if (select source_digest from pkg027d_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG027D_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
commit;
