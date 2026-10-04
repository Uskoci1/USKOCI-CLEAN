-- EX-06 ex06d-F5 REVERT: exact inverse. SOURCE ONLY / NOT APPLIED.
do $ex06d_f5_revert$
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
  if current_user <> 'postgres' then raise exception 'EX06D_F5_REVERT_OWNER_REQUIRED' using errcode='55000'; end if;
  target := to_regprocedure(sig)::oid;
  if target is null then raise exception 'EX06D_F5_REVERT_TARGET_MISSING' using errcode='55000'; end if;
  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=target) is distinct from new_md5 then
    raise exception 'EX06D_F5_REVERT_PREDECESSOR_DRIFT' using errcode='55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true or private.closure_source_digest_v5() is distinct from
       (select sha256 from private.closure_source_v5 where singleton) then raise exception 'EX06D_F5_REVERT_CLOSURE_NOT_READY' using errcode='55000'; end if;
  digest_before := private.closure_source_digest_v5();
  select to_jsonb(p)-'prosrc' into before_meta from pg_proc p where p.oid=target;
  def := pg_get_functiondef(target);
  if (length(def)-length(replace(def,new_anchor,''))) <> length(new_anchor) then raise exception 'EX06D_F5_REVERT_ANCHOR_NOT_UNIQUE' using errcode='55000'; end if;
  execute replace(def,new_anchor,old_anchor);
  if (select md5(replace(prosrc,E'\r','')) from pg_proc where oid=target) is distinct from old_md5 then raise exception 'EX06D_F5_REVERT_POSTCONDITION' using errcode='55000'; end if;
  select to_jsonb(p)-'prosrc' into after_meta from pg_proc p where p.oid=target;
  if after_meta is distinct from before_meta then raise exception 'EX06D_F5_REVERT_TARGET_ATTRIBUTE_DELTA' using errcode='55000'; end if;
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then raise exception 'EX06D_F5_REVERT_CLOSURE_MOVED' using errcode='55000'; end if;
end
$ex06d_f5_revert$;
