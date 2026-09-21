-- PKG-029d candidate. Deep read 6.2. Owner approval 2026-09-21: "dozvoljavam sve" to the command
-- "sve ostale greške iz dubinskog pregleda: svaku prvo dokaži na privremenoj bazi, pa je primeni na DEV".
-- Contract/proof: docs/implementation/v5-ai-first/pkg029/PKG029_SERVER_ROUND.md
--
-- 6.2: rpc_request_data_export accepted a request although no export can be delivered while
--      private.data_export_policy_binding() is null (no active retention policy set), and nothing would ever fulfil
--      it. rpc_start_account_closure_execution refuses honestly in the same situation (CLOSURE_POLICY_NOT_READY);
--      the export request now does the same (DATA_EXPORT_POLICY_NOT_READY). An idempotent replay of a request already
--      made still answers as before, and the one request already waiting on canonical DEV is left alone: the person
--      can cancel it from the screen.
-- Function body only: the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg029d_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg029d_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg029d_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('DATA_EXPORT_POLICY_NOT_READY' in prosrc) from pg_proc
       where oid = to_regprocedure('public.rpc_request_data_export(text)')) > 0 then
    raise exception 'PKG029D_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('public.rpc_request_data_export(text)', '551e16c2f8a4e364ff32bc21f337ad60')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG029D_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg029d_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if to_regprocedure('private.data_export_policy_binding()') is null then
    raise exception 'PKG029D_PREDECESSOR_MISSING';
  end if;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG029D_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg029d_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg029d_patch values
(1, 'public.rpc_request_data_export(text)',
$a$  select * into open_request from public.data_export_requests d
$a$,
$b$  -- PKG-029d (deep read 6.2): without a delivery policy no export can ever be delivered; say so instead of
  -- accepting a request that nothing would fulfil.
  if private.data_export_policy_binding() is null then
    raise exception 'DATA_EXPORT_POLICY_NOT_READY' using errcode='55000';
  end if;

  select * into open_request from public.data_export_requests d
$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg029d_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG029D_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg029d_before loop
    expected := s.prosrc;
    for p in select * from pkg029d_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG029D_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG029D_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select source_digest from pkg029d_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG029D_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
