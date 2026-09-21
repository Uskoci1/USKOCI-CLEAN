-- PKG-032a candidate. Deep read 7.15. Owner decision 2026-09-21: "odobravam sve" to item 8 of the written list (one
-- round for 7.15 and 12.8, proven on a disposable database first).
-- Contract/proof: docs/implementation/v5-ai-first/pkg032/PKG032_CANCEL_REASON_AND_GUARD.md
--
-- 7.15: the app requires "Razlog otkazivanja" (1-4,000 characters) and rpc_cancel_agreement refuses an empty one,
--       then throws it away: no column holds it, the event payload is {agreementId, state}, and the other party
--       reads a fixed "Druga strana je otkazala Dogovor." Nobody, not the counterpart, not support, can see why.
--
-- The reason is now kept the way a reported problem already is (rpc_report_problem): as the canceller's own message
-- in the Agreement's conversation, which both parties and support read, and which the account-closure erasure
-- already covers (public.agreement_messages is a redaction relation). It is written before the Agreement is
-- cancelled, under the same conditions rpc_report_problem uses (no safety block between the two, neither account
-- in closure), and cut to the 2,000 characters a message holds. The other party's notification says where it is.
-- No table, column or trigger changes, so the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg032a_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg032a_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg032a_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('v_reason_kept' in prosrc) from pg_proc
       where oid = to_regprocedure('public.rpc_cancel_agreement(uuid,text)')) > 0 then
    raise exception 'PKG032A_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('public.rpc_cancel_agreement(uuid,text)', '53577455a31c526c1b373a1ae82e6bb9')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG032A_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg032a_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if to_regprocedure('private.safety_pair_blocked(uuid,uuid)') is null
     or to_regprocedure('private.closure_account_restricted(uuid)') is null then
    raise exception 'PKG032A_PREDECESSOR_MISSING';
  end if;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG032A_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg032a_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg032a_patch values
(1, 'public.rpc_cancel_agreement(uuid,text)',
$a$  v_need public.needs%rowtype;
begin
$a$,
$b$  v_need public.needs%rowtype;
  v_reason_kept boolean := false;
begin
$b$),
(2, 'public.rpc_cancel_agreement(uuid,text)',
$a$  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
$a$,
$b$  -- PKG-032a (deep read 7.15): the reason the app requires is kept where the other party and support read it, as
  -- the canceller's own message in the Agreement's conversation, the way rpc_report_problem keeps a problem.
  if not private.safety_pair_blocked(v_agr.requester_account_id, v_agr.worker_account_id)
     and not private.closure_account_restricted(v_agr.requester_account_id)
     and not private.closure_account_restricted(v_agr.worker_account_id) then
    insert into public.agreement_messages(agreement_id, agreement_version, sender_account_id, body)
    values (v_agr.id, v_agr.current_version, uid, left('Otkazujem Dogovor. Razlog: ' || btrim(p_reason), 2000));
    v_reason_kept := true;
  end if;

  update public.agreements set status = 'CANCELLED' where id = p_agreement_id;
$b$),
(3, 'public.rpc_cancel_agreement(uuid,text)',
$a$    'Dogovor je otkazan','Druga strana je otkazala Dogovor.',
$a$,
$b$    'Dogovor je otkazan',
    case when v_reason_kept then 'Druga strana je otkazala Dogovor. Razlog je u Porukama.'
         else 'Druga strana je otkazala Dogovor.' end,
$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg032a_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG032A_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg032a_before loop
    expected := s.prosrc;
    for p in select * from pkg032a_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG032A_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG032A_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select source_digest from pkg032a_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG032A_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
