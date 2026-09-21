-- PKG-029a candidate. Deep read 4.1, 1.2 and 12.9. Owner approval 2026-09-21: "dozvoljavam sve" to the command
-- "sve ostale greške iz dubinskog pregleda: svaku prvo dokaži na privremenoj bazi, pa je primeni na DEV".
-- Contract/proof: docs/implementation/v5-ai-first/pkg029/PKG029_SERVER_ROUND.md
--
-- 4.1: emit_event takes the preference row of the event's role, and when there is none it switches push off. A
--      person who switched push on as a worker never got a push as a requester. A role without its own row now
--      takes the push choice of the account's other role.
-- 1.2: rpc_tick_auto_completion completes an Agreement after the requester's deadline and tells nobody. The worker
--      is now told, with the same event and the same dedupe key as when the requester confirms.
-- 12.9: rpc_close_remaining_search expires every open application of the task and tells no applicant. Each is now
--      told, as rpc_cancel_need does.
-- Function bodies only: the certified closure source digest must not move (asserted below).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg029a_before(signature text primary key, prosrc text not null,
  anon boolean not null, authenticated boolean not null, service boolean not null) on commit drop;
create temporary table pkg029a_patch(ord integer primary key, signature text not null, anchor text not null,
  replacement text not null) on commit drop;
create temporary table pkg029a_closure(source_digest text not null) on commit drop;

do $pre$
declare pin record;
begin
  if (select position('PKG-029a' in prosrc) from pg_proc
       where oid = to_regprocedure('public.rpc_tick_auto_completion()')) > 0 then
    raise exception 'PKG029A_ALREADY_APPLIED';
  end if;
  for pin in select * from (values
    ('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)', '15f77e4ba4aec29a0df69a50b17409d2'),
    ('public.rpc_tick_auto_completion()', '14562ad2e73df556242e6cb5f94566cb'),
    ('public.rpc_close_remaining_search(uuid,integer,text,text)', 'b3eed19d2bae33d81930116b604c6625')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(pin.signature)) is distinct from pin.digest then
      raise exception 'PKG029A_PREDECESSOR_DRIFT: %', pin.signature;
    end if;
    insert into pkg029a_before
      select pin.signature, p.prosrc,
        has_function_privilege('anon', p.oid, 'EXECUTE'),
        has_function_privilege('authenticated', p.oid, 'EXECUTE'),
        has_function_privilege('service_role', p.oid, 'EXECUTE')
      from pg_proc p where p.oid = to_regprocedure(pin.signature);
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG029A_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg029a_closure values (private.closure_source_digest_v5());
end
$pre$;

insert into pkg029a_patch values
(1, 'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)',
$a$    v_prefs.in_app_enabled := true;
    v_prefs.push_enabled := false;
$a$,
$b$    v_prefs.in_app_enabled := true;
    -- PKG-029a (deep read 4.1): a role without its own row takes the push choice of the account's other role.
    -- A person who switched push on once expects it on; it was off for every event of the other role.
    v_prefs.push_enabled := coalesce((select np.push_enabled from public.notification_preferences np
                                       where np.user_id = p_recipient order by np.role_context limit 1), false);
$b$),
(2, 'public.rpc_tick_auto_completion()',
$a$   perform private.sync_need_completion(a.need_id);
   done:=done+1;$a$,
$b$   perform private.sync_need_completion(a.need_id);
   -- PKG-029a (deep read 1.2): the worker is told the job closed, exactly as when the requester confirms (same
   -- event, same dedupe key, so the two paths can never both notify).
   perform private.emit_event(a.worker_account_id, 'WORKER', 'EXECUTION_STATE_CHANGED', 'AGREEMENT', a.id, a.current_version,
     'Dogovor je završen', 'Rok za potvrdu je istekao, pa je završetak potvrđen automatski.',
     'completed:worker:' || a.id::text || ':' || a.current_version::text, 'NORMAL',
     jsonb_build_object('completedAt', at_time, 'automatic', true), null);
   done:=done+1;$b$),
(3, 'public.rpc_close_remaining_search(uuid,integer,text,text)',
$a$  update public.marketplace_responses
     set status = 'EXPIRED'
   where need_id = v_need.id
     and status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE','STALE_REVIEW_REQUIRED');
  get diagnostics v_affected = row_count;$a$,
$b$  -- PKG-029a (deep read 12.9): every applicant whose application closes here is told, as rpc_cancel_need does.
  with closed as (
    update public.marketplace_responses
       set status = 'EXPIRED'
     where need_id = v_need.id
       and status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE','STALE_REVIEW_REQUIRED')
     returning worker_account_id
  )
  select count(*)::integer into v_affected
    from closed c
    cross join lateral (select private.emit_event(c.worker_account_id, 'WORKER', 'NEED_CANCELLED', 'NEED', v_need.id,
      v_need.revision, 'Potraga je zatvorena',
      'Onaj ko je objavio zadatak zatvorio je potragu. Tvoja prijava više nije aktivna.',
      'search-closed:' || v_need.id::text || ':' || v_need.revision::text || ':worker:' || c.worker_account_id::text,
      'NORMAL', jsonb_build_object('reason', 'REMAINING_SEARCH_CLOSED'), null)) e;$b$);

do $patch$
declare p record; def text;
begin
  for p in select * from pkg029a_patch order by ord loop
    def := pg_get_functiondef(to_regprocedure(p.signature));
    if (length(def) - length(replace(def, p.anchor, ''))) <> length(p.anchor) then
      raise exception 'PKG029A_ANCHOR: % #%', p.signature, p.ord;
    end if;
    execute replace(def, p.anchor, p.replacement);
  end loop;
end
$patch$;

do $post$
declare s record; p record; expected text; actual record;
begin
  for s in select * from pkg029a_before loop
    expected := s.prosrc;
    for p in select * from pkg029a_patch where signature = s.signature order by ord loop
      expected := replace(expected, p.anchor, p.replacement);
    end loop;
    select pr.prosrc,
      has_function_privilege('anon', pr.oid, 'EXECUTE') anon,
      has_function_privilege('authenticated', pr.oid, 'EXECUTE') authenticated,
      has_function_privilege('service_role', pr.oid, 'EXECUTE') service
      into actual from pg_proc pr where pr.oid = to_regprocedure(s.signature);
    if actual.prosrc is distinct from expected then
      raise exception 'PKG029A_BODY_MISMATCH: %', s.signature;
    end if;
    if (actual.anon, actual.authenticated, actual.service) is distinct from (s.anon, s.authenticated, s.service) then
      raise exception 'PKG029A_GRANTS_CHANGED: %', s.signature;
    end if;
  end loop;
  if (select count(*) from pkg029a_before) <> 3 or (select count(*) from pkg029a_patch) <> 3 then
    raise exception 'PKG029A_PATCH_SET_CHANGED';
  end if;
  if (select source_digest from pkg029a_closure) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG029A_CHANGED_CLOSURE_SOURCE';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
