-- EX-06 ex06d-F5: suppress new-opportunity dispatch after an active submitted response. SOURCE ONLY / NOT APPLIED.
-- Fresh canonical DEV preflight 2026-10-04: predecessor e51de37e0883fcd3cd4e6e3c42fb6ee1; predicted 887c8b4c5cdc9062d04277bdd05d2167.
-- One existing function body only; no table/index/trigger/policy/grant/data/cron/Edge change.
do $ex06d_f5$
declare
  sig constant text := 'private.dispatch_cheap_candidate_admitted(uuid,uuid)';
  old_md5 constant text := 'e51de37e0883fcd3cd4e6e3c42fb6ee1';
  new_md5 constant text := '887c8b4c5cdc9062d04277bdd05d2167';
  old_anchor constant text := $old$      and not exists (
        select 1 from public.opportunity_deliveries od
        where od.worker_account_id = p.account_id
          and od.need_id = n.id
          and od.need_revision = n.revision)
$old$;
  new_anchor constant text := $new$      -- EX-06 ex06d-F5: a worker who already submitted an active response for this exact revision
      -- has already acted on the task and must not receive a new-opportunity delivery.
      and not exists (
        select 1 from public.marketplace_responses mr
        where mr.need_id = n.id
          and mr.worker_account_id = p.account_id
          and mr.submitted_against_need_revision = n.revision
          and mr.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED'))
      and not exists (
        select 1 from public.opportunity_deliveries od
        where od.worker_account_id = p.account_id
          and od.need_id = n.id
          and od.need_revision = n.revision)
$new$;
  target oid; digest_before text; def text; before_meta jsonb; after_meta jsonb;
begin
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','60s',true);
  perform set_config('search_path','pg_catalog',true);
  if current_user <> 'postgres' then raise exception 'EX06D_F5_OWNER_REQUIRED' using errcode='55000'; end if;
  target := to_regprocedure(sig)::oid;
  if target is null then raise exception 'EX06D_F5_TARGET_MISSING' using errcode='55000'; end if;
  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=target) = new_md5 then
    raise exception 'EX06D_F5_ALREADY_APPLIED' using errcode='55000';
  end if;
  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=target) is distinct from old_md5 then
    raise exception 'EX06D_F5_PREDECESSOR_DRIFT' using errcode='55000';
  end if;
  if exists(select 1 from pg_proc p where p.oid=target and
      (not p.prosecdef or p.provolatile <> 's' or p.proconfig is distinct from array['search_path=pg_catalog'] or
       p.proowner <> 'postgres'::regrole or p.proacl::text is distinct from '{postgres=X/postgres}')) then
    raise exception 'EX06D_F5_TARGET_ATTRIBUTE_DRIFT' using errcode='55000';
  end if;
  if (select (length(prosrc)-length(replace(prosrc,old_anchor,'')))/nullif(length(old_anchor),0) from pg_proc where oid=target) <> 1 then
    raise exception 'EX06D_F5_ANCHOR_NOT_UNIQUE' using errcode='55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true or private.closure_source_digest_v5() is distinct from
       (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06D_F5_CLOSURE_NOT_READY' using errcode='55000';
  end if;
  if exists(select 1 from pg_trigger where tgfoid=target and not tgisinternal) then raise exception 'EX06D_F5_TARGET_IS_TRIGGER' using errcode='55000'; end if;
  if exists(select 1 from pg_proc p where p.pronamespace='private'::regnamespace and
      p.proname in ('closure_source_digest_v5','closure_erasure_program_digest_v5','closure_schema_digest_v5_139','closure_erasure_binding_v5','agreement_invalidation_surface_v1','agreement_voice_surface_v1','retention_ai_source_ready') and
      position('dispatch_cheap_candidate_admitted' in p.prosrc)>0) then raise exception 'EX06D_F5_TARGET_IS_CERTIFIED' using errcode='55000'; end if;
  digest_before := private.closure_source_digest_v5();
  select to_jsonb(p)-'prosrc' into before_meta from pg_proc p where p.oid=target;
  def := pg_get_functiondef(target);
  execute replace(def,old_anchor,new_anchor);
  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=target) is distinct from new_md5 then
    raise exception 'EX06D_F5_POSTCONDITION' using errcode='55000';
  end if;
  select to_jsonb(p)-'prosrc' into after_meta from pg_proc p where p.oid=target;
  if after_meta is distinct from before_meta then raise exception 'EX06D_F5_TARGET_ATTRIBUTE_DELTA' using errcode='55000'; end if;
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06D_F5_CLOSURE_MOVED' using errcode='55000';
  end if;
end
$ex06d_f5$;
