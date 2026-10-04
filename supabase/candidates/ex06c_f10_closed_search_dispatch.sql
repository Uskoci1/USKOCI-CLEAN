-- EX-06 ex06c-F10: closed remaining-search dispatch terminal stop. SOURCE ONLY / NOT APPLIED.
-- Finding F10: after an Agreement cancellation, rpc_cancel_agreement can re-enqueue a Need whose
-- remaining search is already closed. dispatch_next_wave then reaches the delivery trigger and raises
-- NEED_REMAINING_SEARCH_CLOSED; dispatch_tick records ERROR and retries every ten minutes forever.
--
-- This package changes exactly TWO existing function bodies in place:
--   1) private.dispatch_next_wave(uuid) returns STOPPED/REMAINING_SEARCH_CLOSED before creating a round;
--   2) private.dispatch_tick(integer,timestamptz) treats that reason as terminal and deletes the schedule row.
--
-- No table/column/trigger/policy/grant/data change. Fresh canonical DEV preflight 2026-10-04:
--   dispatch_next_wave prosrc md5 1fd8c51ef026ece24471e2f68250ecc5
--   dispatch_tick      prosrc md5 e568b033b9457736869fc5829ffc5511
--   closure digest == certified digest 3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23
--   retention ready; neither target is a trigger function nor named by the closure digest helpers.
--
-- DEV application still requires the owner's exact named approval after disposable proof.
do $ex06c_f10$
declare
  wave_sig constant text := 'private.dispatch_next_wave(uuid)';
  tick_sig constant text := 'private.dispatch_tick(integer,timestamptz)';
  wave_old_md5 constant text := '1fd8c51ef026ece24471e2f68250ecc5';
  tick_old_md5 constant text := 'e568b033b9457736869fc5829ffc5511';
  wave_new_md5 constant text := '3cc3af3cdbafbfbc51a491ac2ce6581d';
  tick_new_md5 constant text := '1600e4e3402d59c3ada13e3226a467c1';

  wave_anchor constant text := $wave_anchor$  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;
$wave_anchor$;
  wave_replacement constant text := $wave_replacement$  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;

  -- EX-06 ex06c-F10: a requester already closed the remaining search.
  -- Any later Agreement cancellation may re-enqueue the Need, but dispatch must terminate cleanly.
  if n.remaining_search_closed_at is not null then
    return jsonb_build_object('status','STOPPED','reason','REMAINING_SEARCH_CLOSED','inserted',0);
  end if;
$wave_replacement$;

  tick_anchor constant text := $tick_anchor$      elsif reason in ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                       'RESPONSE_TARGET_AND_COVERAGE_REACHED') then
$tick_anchor$;
  tick_replacement constant text := $tick_replacement$      elsif reason in ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                       'RESPONSE_TARGET_AND_COVERAGE_REACHED','REMAINING_SEARCH_CLOSED') then
$tick_replacement$;

  wave_oid oid;
  tick_oid oid;
  digest_before text;
  rec record;
  def text;
  actual jsonb;
begin
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','60s',true);
  perform set_config('search_path','pg_catalog',true);

  if current_user <> 'postgres' then
    raise exception 'EX06C_F10_OWNER_REQUIRED' using errcode='55000';
  end if;

  wave_oid := to_regprocedure(wave_sig)::oid;
  tick_oid := to_regprocedure(tick_sig)::oid;
  if wave_oid is null or tick_oid is null then
    raise exception 'EX06C_F10_TARGET_MISSING' using errcode='55000';
  end if;

  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=wave_oid) = wave_new_md5
     and (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=tick_oid) = tick_new_md5 then
    raise exception 'EX06C_F10_ALREADY_APPLIED' using errcode='55000';
  end if;

  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=wave_oid) is distinct from wave_old_md5 then
    raise exception 'EX06C_F10_PREDECESSOR_DRIFT: %', wave_sig using errcode='55000';
  end if;
  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=tick_oid) is distinct from tick_old_md5 then
    raise exception 'EX06C_F10_PREDECESSOR_DRIFT: %', tick_sig using errcode='55000';
  end if;

  if exists (
    select 1 from pg_proc p
    where p.oid in (wave_oid,tick_oid)
      and (not p.prosecdef or p.provolatile <> 'v'
           or p.proconfig is distinct from array['search_path=pg_catalog']
           or p.proowner <> 'postgres'::regrole
           or p.proacl::text is distinct from '{postgres=X/postgres}')
  ) then
    raise exception 'EX06C_F10_TARGET_ATTRIBUTE_DRIFT' using errcode='55000';
  end if;

  if (select (length(prosrc)-length(replace(prosrc,wave_anchor,'')))/nullif(length(wave_anchor),0)
        from pg_proc where oid=wave_oid) <> 1 then
    raise exception 'EX06C_F10_WAVE_ANCHOR_NOT_UNIQUE' using errcode='55000';
  end if;
  if (select (length(prosrc)-length(replace(prosrc,tick_anchor,'')))/nullif(length(tick_anchor),0)
        from pg_proc where oid=tick_oid) <> 1 then
    raise exception 'EX06C_F10_TICK_ANCHOR_NOT_UNIQUE' using errcode='55000';
  end if;

  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06C_F10_CLOSURE_NOT_READY' using errcode='55000';
  end if;
  if exists(select 1 from pg_trigger where tgfoid in (wave_oid,tick_oid) and not tgisinternal) then
    raise exception 'EX06C_F10_TARGET_IS_TRIGGER' using errcode='55000';
  end if;
  if exists(
    select 1 from pg_proc p
    where p.pronamespace='private'::regnamespace
      and p.proname in ('closure_source_digest_v5','closure_erasure_program_digest_v5',
                        'closure_schema_digest_v5_139','closure_erasure_binding_v5',
                        'agreement_invalidation_surface_v1','agreement_voice_surface_v1',
                        'retention_ai_source_ready')
      and (position('dispatch_next_wave' in p.prosrc)>0 or position('dispatch_tick' in p.prosrc)>0)
  ) then
    raise exception 'EX06C_F10_TARGET_IS_CERTIFIED' using errcode='55000';
  end if;
  digest_before := private.closure_source_digest_v5();

  create temporary table ex06c_f10_before on commit drop as
    select p.oid, p.oid::regprocedure::text signature, p.prosrc,
           to_jsonb(p) - 'prosrc' as metadata
      from pg_proc p
     where p.oid in (wave_oid,tick_oid);

  def := pg_get_functiondef(wave_oid);
  execute replace(def,wave_anchor,wave_replacement);

  def := pg_get_functiondef(tick_oid);
  execute replace(def,tick_anchor,tick_replacement);

  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=wave_oid) is distinct from wave_new_md5 then
    raise exception 'EX06C_F10_WAVE_POSTCONDITION' using errcode='55000';
  end if;
  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=tick_oid) is distinct from tick_new_md5 then
    raise exception 'EX06C_F10_TICK_POSTCONDITION' using errcode='55000';
  end if;

  for rec in select * from ex06c_f10_before loop
    select to_jsonb(p) - 'prosrc' into actual from pg_proc p where p.oid=rec.oid;
    if actual is distinct from rec.metadata then
      raise exception 'EX06C_F10_TARGET_ATTRIBUTE_DELTA: %', rec.signature using errcode='55000';
    end if;
  end loop;

  if private.closure_source_digest_v5() is distinct from digest_before
     or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06C_F10_CLOSURE_MOVED' using errcode='55000';
  end if;
end
$ex06c_f10$;
