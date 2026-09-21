-- PKG-031a candidate. Deep read 7.16. Owner decision 2026-09-21: "odobravam sve" to the proposal "once the worker
-- says the work is done, the requester cannot cancel; they confirm completion or report a problem; with no answer the
-- work completes on its own after 48 hours".
-- Contract/proof: docs/implementation/v5-ai-first/pkg031/PKG031_OWNER_RULES.md
--
-- 7.16: after the worker taps "gotovo" (execution AWAITING_REQUESTER) the requester was still offered "Otkaži
--       Dogovor", and rpc_cancel_agreement accepted it. Cancelling then stopped the 48-hour auto-completion and left
--       the worker with no completed job and no right to rate. Now:
--       - private.agreement_action_state offers cancel in AWAITING_REQUESTER to the worker only;
--       - rpc_cancel_agreement refuses the requester there with AGREEMENT_WORK_REPORTED_DONE.
--       Before the worker says done, both parties cancel as before; the worker's own path is unchanged.
-- Function bodies only: neither function is on the certified erasure list or a trigger function, so the certified
-- closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg031a_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg031a_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg031a_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('AGREEMENT_WORK_REPORTED_DONE' in prosrc) from pg_proc
       where oid = to_regprocedure('public.rpc_cancel_agreement(uuid,text)')) > 0 then
    raise exception 'PKG031A_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.agreement_action_state(uuid,uuid)', 'f57cf9b340eab74ab3704605fcc706dd'),
    ('public.rpc_cancel_agreement(uuid,text)', '17dad1631c4cfe9fba6c2f05a3030062')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG031A_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg031a_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG031A_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg031a_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg031a_patch values
(1, 'private.agreement_action_state(uuid,uuid)',
$a$   'canCancel',a.status='CONFIRMED' and x.state in ('CONFIRMED','AWAITING_REQUESTER'),
$a$,
$b$   'canCancel',a.status='CONFIRMED' and (x.state='CONFIRMED' or (x.state='AWAITING_REQUESTER' and p_actor=a.worker_account_id)),
$b$),
(2, 'public.rpc_cancel_agreement(uuid,text)',
$a$  if v_agr.status = 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;
$a$,
$b$  if v_agr.status = 'COMPLETED' then
    raise exception 'ALREADY_COMPLETED' using errcode = 'P0001';
  end if;
  -- PKG-031a (deep read 7.16): once the worker has said the work is done, the requester confirms completion or
  -- reports a problem. Cancelling would take the finished job, and its rating, from the worker.
  if uid = v_agr.requester_account_id and exists (select 1 from public.agreement_execution x
       where x.agreement_id = v_agr.id and x.state = 'AWAITING_REQUESTER') then
    raise exception 'AGREEMENT_WORK_REPORTED_DONE' using errcode = 'P0001';
  end if;
$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg031a_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG031A_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg031a_before loop
    expected := s.prosrc;
    for p in select * from pkg031a_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG031A_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG031A_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select source_digest from pkg031a_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG031A_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
