-- PKG-027c candidate. Owner approval 2026-09-21 ("odobravam sve to"), after the deep read (ledger 8.13).
-- Contract/proof: docs/implementation/v5-ai-first/pkg027/PKG027_OWNER_APPROVED_FIXES.md
--
-- Rule, measured on canonical DEV: the Inbox shows the title and body each emitting function stored, and every
-- notification ever stored addresses the person formally ("Imate", "Vaša", "Vam", "Otvorite") and several use
-- the retired words ("Uskočer", "Naručilac", "Potreba"), some without diacritics. Owner decisions: address the
-- person as "ti"; never "Uskočer", "Naručilac" or "Potreba".
--
-- The texts come from 17 functions. Two of them (private.after_need_revision, private.pre_v3_application_event)
-- are trigger functions on tables inside the certified closure source, so changing their bodies would move the
-- certified digest. This candidate therefore maps the texts in ONE place, private.emit_event, through one copy
-- table, private.notification_copy_v5, and leaves every emitting function untouched. It also corrects the Inbox
-- fallback line and rewrites the texts already stored, by the same table (owner approval covers both).
-- Function bodies and data only: the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg027c_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg027c_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg027c_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if to_regprocedure('private.notification_copy_v5(text)') is not null then
    raise exception 'PKG027C_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)', '8da91a4736e09b10872bd1240d6e0c8c'),
    ('public.rpc_list_inbox(text,integer,timestamptz,uuid)', 'a54e90c2af3e0739d461fb02fb12d7c8')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG027C_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg027c_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG027C_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg027c_closure values (private.closure_source_digest_v5());
end
$pre$;

-- One row per text any server function stores for a person to read. Texts already in the owner's voice
-- ("Dogovor je otkazan", "Druga strana je otkazala Dogovor.", "Nova poruka" ...) are not listed and pass through.
create function private.notification_copy_v5(p_text text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case p_text
    when 'Pregledajte svoju prijavu pre nastavka.' then 'Pregledaj svoju prijavu pre nastavka.'
    when 'Nova prilika koja može da Vam odgovara' then 'Nova prilika koja ti može odgovarati'
    when 'Imate novu prijavu za Zadatak.' then 'Imaš novu prijavu za Zadatak.'
    when 'Pregledajte aktuelne uslove prijave.' then 'Pregledaj aktuelne uslove prijave.'
    when 'Potreba je otkazana' then 'Zadatak je otkazan'
    when 'Narucilac je otkazao Potrebu za koju ste poslali prijavu.' then 'Zadatak za koji imaš prijavu je otkazan.'
    when 'Naručilac je potvrdio završetak.' then 'Završetak Dogovora je potvrđen.'
    when 'Naručilac je pregledao Vašu prijavu.' then 'Tvoja prijava je pregledana.'
    when 'Završetak čeka Vašu potvrdu' then 'Završetak čeka tvoju potvrdu'
    when 'Uskočer je označio Dogovor kao završen.' then 'Dogovor je označen kao završen.'
    when 'Pogledajte predlog i odgovorite u Dogovoru.' then 'Pogledaj predlog i odgovori u Dogovoru.'
    when 'Otvorite Dogovor da vidite prijavljeni problem.' then 'Otvori Dogovor da vidiš prijavljeni problem.'
    when 'Pogledajte važeće uslove u Dogovoru.' then 'Pogledaj važeće uslove u Dogovoru.'
    when 'Naručilac je odgovorio na Vaše pitanje.' then 'Stigao je odgovor na tvoje pitanje.'
    when 'Uskočer je postavio anonimno pitanje o Zadatku.' then 'Stiglo je anonimno pitanje o Zadatku.'
    when 'Vaša prijava je izabrana' then 'Tvoja prijava je izabrana'
    when 'Otvorite Dogovor za detalje zadatka.' then 'Otvori Dogovor za detalje zadatka.'
    when 'Imate novu poruku u Dogovoru.' then 'Imaš novu poruku u Dogovoru.'
    when 'Dobili ste ocenu za završen Dogovor.' then 'Stigla je ocena za završen Dogovor.'
    when 'Prijava je povucena' then 'Prijava je povučena'
    when 'Uskocer je povukao prijavu za Vasu Potrebu.' then 'Jedna prijava za tvoj Zadatak je povučena.'
    when 'Otvorite za trenutne informacije.' then 'Otvori za trenutne informacije.'
    else p_text
  end
$function$;
revoke all on function private.notification_copy_v5(text) from public, anon, authenticated, service_role;
comment on function private.notification_copy_v5(text) is
  'PKG-027c: the single copy table for stored notification texts (address "ti", no retired words).';

insert into pkg027c_patch values
(1, 'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)',
$a$  -- 1) durable event, idempotentno$a$,
$b$  -- PKG-027c: every stored text addresses the person as "ti" and uses the product's words. Two emitting
  -- functions are trigger functions inside the certified closure source, so the texts are mapped here.
  p_title := private.notification_copy_v5(p_title);
  p_body := private.notification_copy_v5(p_body);
  -- 1) durable event, idempotentno$b$),
(2, 'public.rpc_list_inbox(text,integer,timestamptz,uuid)',
$a$    'body',coalesce(d.body,'Otvorite za trenutne informacije.'),$a$,
$b$    'body',coalesce(d.body,'Otvori za trenutne informacije.'),$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg027c_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG027C_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

-- The texts already stored. No insert trigger is re-run: notification_deliveries has insert triggers only.
do $stored$
declare v_rows integer;
begin
  update public.notification_deliveries
     set title = private.notification_copy_v5(title), body = private.notification_copy_v5(body)
   where title is distinct from private.notification_copy_v5(title)
      or body is distinct from private.notification_copy_v5(body);
  get diagnostics v_rows = row_count;
  if exists (select 1 from public.notification_deliveries
              where title is distinct from private.notification_copy_v5(title)
                 or body is distinct from private.notification_copy_v5(body)) then
    raise exception 'PKG027C_STORED_TEXT_NOT_REWRITTEN';
  end if;
  raise notice 'PKG027C_STORED_DELIVERIES_REWRITTEN %', v_rows;
end
$stored$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg027c_before loop
    expected := s.prosrc;
    for p in select * from pkg027c_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG027C_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG027C_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  -- The copy table is total over the texts the emitting functions can store today.
  if private.notification_copy_v5('Imate novu poruku u Dogovoru.') <> 'Imaš novu poruku u Dogovoru.'
     or private.notification_copy_v5('Dogovor je otkazan') <> 'Dogovor je otkazan'
     or private.notification_copy_v5(null) is not null then
    raise exception 'PKG027C_COPY_TABLE_BROKEN';
  end if;
  if has_function_privilege('anon', 'private.notification_copy_v5(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.notification_copy_v5(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'private.notification_copy_v5(text)', 'EXECUTE') then
    raise exception 'PKG027C_GRANTS_MISMATCH';
  end if;
  if (select source_digest from pkg027c_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG027C_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
