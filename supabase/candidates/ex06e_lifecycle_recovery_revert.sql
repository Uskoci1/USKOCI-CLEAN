-- EX-06E Lifecycle Recovery exact revert — SOURCE ONLY / NOT APPLIED TO LIVE DEV.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table ex06e_revert_before(signature text primary key,metadata jsonb not null) on commit drop;
create temporary table ex06e_revert_closure(digest text not null) on commit drop;

do $pre$
declare r record;
begin
  if to_regprocedure('private.need_search_time_admitted_v1(uuid,timestamptz)') is null
     or to_regprocedure('public.rpc_reopen_remaining_search(uuid,integer,text,text)') is null then
    raise exception 'EX06E_REVERT_PACKAGE_NOT_PRESENT';
  end if;

  for r in
    select * from (values
      ('private.dispatch_next_wave(uuid)', 'c37d672ccaf44e86b5e83b117156cdb8'),
      ('private.dispatch_tick(integer,timestamptz)', '8798cb6b6f004ecd5d88dd472cd6de0b'),
      ('private.guard_remaining_search_close_fields()', 'c2d5e8ad7398f25a026d9bfd333efa8b'),
      ('public.rpc_cancel_agreement(uuid,text)', 'f23a499bdd57d68476c126232645a139')
    ) x(signature, expected_md5)
  loop
    if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_md5 then
      raise exception 'EX06E_REVERT_PREDECESSOR_DRIFT: %',r.signature;
    end if;
    insert into ex06e_revert_before
    select r.signature,to_jsonb(p)-'prosrc' from pg_proc p where p.oid=to_regprocedure(r.signature);
  end loop;

  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06E_REVERT_CLOSURE_NOT_READY';
  end if;
  insert into ex06e_revert_closure values(private.closure_source_digest_v5());
end
$pre$;

do $restore$
declare def text;
begin
  def:=pg_get_functiondef('private.dispatch_next_wave(uuid)'::regprocedure);
  def:=replace(def,
$replacement$  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;

  if n.remaining_search_closed_at is not null then
    return jsonb_build_object('status','STOPPED','reason','REMAINING_SEARCH_CLOSED','inserted',0);
  end if;

  if not private.need_search_time_admitted_v1(n.id, statement_timestamp()) then
    return jsonb_build_object('status','STOPPED','reason','SEARCH_WINDOW_CLOSED','inserted',0);
  end if;
$replacement$,
$anchor$  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;
$anchor$);
  execute def;

  def:=pg_get_functiondef('private.dispatch_tick(integer,timestamptz)'::regprocedure);
  def:=replace(def,
$replacement$      elsif reason in ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                       'RESPONSE_TARGET_AND_COVERAGE_REACHED','REMAINING_SEARCH_CLOSED',
                       'SEARCH_WINDOW_CLOSED') then
$replacement$,
$anchor$      elsif reason in ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                       'RESPONSE_TARGET_AND_COVERAGE_REACHED') then
$anchor$);
  execute def;

  def:=pg_get_functiondef('private.guard_remaining_search_close_fields()'::regprocedure);
  def:=replace(def,
$replacement$    if current_setting('uskoci.need_lifecycle', true) is distinct from 'CLOSE_REMAINING_SEARCH'
       and current_setting('uskoci.need_lifecycle', true) is distinct from 'REOPEN_REMAINING_SEARCH' then
      raise exception 'REMAINING_SEARCH_STATE_IS_SERVER_OWNED' using errcode='42501';
    end if;
$replacement$,
$anchor$    if current_setting('uskoci.need_lifecycle', true) is distinct from 'CLOSE_REMAINING_SEARCH' then
      raise exception 'REMAINING_SEARCH_STATE_IS_SERVER_OWNED' using errcode='42501';
    end if;
$anchor$);
  execute def;

  def:=pg_get_functiondef('public.rpc_cancel_agreement(uuid,text)'::regprocedure);
  def:=replace(def,
$replacement$  if v_covered < v_need.required_slots
     and v_need.status in ('ACTIVE','SELECTION')
     and not private.closure_account_restricted(v_need.requester_account_id) then
    -- Coverage truth changes even when search authority says do not search.
    perform set_config('uskoci.need_lifecycle', 'CANCEL_AGREEMENT', true);
    update public.needs set status = 'SELECTION' where id = v_need.id;

    -- Human search authority is independent from coverage. Cancellation never clears it.
    -- Time authority is also independent: no matching is reanimated after the admitted window.
    if v_need.remaining_search_closed_at is null
       and private.need_search_time_admitted_v1(v_need.id, statement_timestamp()) then
      perform private.enqueue_dispatch(v_need.id, statement_timestamp());
    end if;
  end if;
$replacement$,
$anchor$  if v_covered < v_need.required_slots
     and v_need.status in ('ACTIVE','SELECTION')
     and not private.closure_account_restricted(v_need.requester_account_id) then
    perform set_config('uskoci.need_lifecycle', 'CANCEL_AGREEMENT', true);
    update public.needs set status = 'SELECTION' where id = v_need.id;
    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
$anchor$);
  execute def;
end
$restore$;

drop function public.rpc_reopen_remaining_search(uuid,integer,text,text);
drop function private.need_search_time_admitted_v1(uuid,timestamptz);

do $post$
declare r record; actual jsonb;
begin
  for r in
    select * from (values
      ('private.dispatch_next_wave(uuid)', '1fd8c51ef026ece24471e2f68250ecc5'),
      ('private.dispatch_tick(integer,timestamptz)', 'e568b033b9457736869fc5829ffc5511'),
      ('private.guard_remaining_search_close_fields()', 'ce59ad1cdee98518950e289aa5c329a4'),
      ('public.rpc_cancel_agreement(uuid,text)', 'f3ca4d5f8bdf324d5773d887d0a2d093')
    ) x(signature, expected_md5)
  loop
    if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected_md5 then
      raise exception 'EX06E_REVERT_POST_BODY_MISMATCH: %',r.signature;
    end if;
    select to_jsonb(p)-'prosrc' into actual from pg_proc p where p.oid=to_regprocedure(r.signature);
    if actual is distinct from (select metadata from ex06e_revert_before where signature=r.signature) then
      raise exception 'EX06E_REVERT_TARGET_METADATA_CHANGED: %',r.signature;
    end if;
  end loop;

  if to_regprocedure('private.need_search_time_admitted_v1(uuid,timestamptz)') is not null
     or to_regprocedure('public.rpc_reopen_remaining_search(uuid,integer,text,text)') is not null then
    raise exception 'EX06E_REVERT_NEW_OBJECT_REMAINS';
  end if;

  if private.closure_source_digest_v5() is distinct from (select digest from ex06e_revert_closure)
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
     or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06E_REVERT_CLOSURE_MOVED';
  end if;
end
$post$;

notify pgrst,'reload schema';
commit;
