-- USKOČI privacy P0 candidate.
-- Purpose: keep exact address/access notes inside the private Need boundary after they
-- have been persisted, instead of replaying them to an external AI provider on every
-- later turn. The CURRENT user message is unchanged, so the AI may still structure an
-- address/access note the person explicitly types in that turn.
--
-- Candidate only. Do not place in the frozen source-147 migration inventory.
begin;

do $privacy_p0$
declare
  d text;
  needle text := $n$where f.value->>'fact_key' not in('need.resolved_location','need.public_photo_paths','need.verified_identity_required');$n$;
  replacement text := $n$where f.value->>'fact_key' not in('need.resolved_location','need.public_photo_paths','need.verified_identity_required','need.exact_address','need.access_notes');$n$;
  before_acl aclitem[];
  before_owner oid;
  before_definer boolean;
  before_config text[];
  before_volatility "char";
  before_language oid;
  readiness_before boolean;
begin
  select p.proacl,p.proowner,p.prosecdef,p.proconfig,p.provolatile,p.prolang
    into before_acl,before_owner,before_definer,before_config,before_volatility,before_language
  from pg_proc p where p.oid='private.ai_need_turn_context(uuid)'::regprocedure;

  readiness_before := private.retention_ai_source_ready();
  if readiness_before is distinct from true then
    raise exception 'PRIVACY_P0_RETENTION_SOURCE_NOT_READY_BEFORE';
  end if;

  d:=pg_get_functiondef('private.ai_need_turn_context(uuid)'::regprocedure);
  if length(d)-length(replace(d,needle,''))<>length(needle) then
    raise exception 'PRIVACY_P0_CONTEXT_PREDECESSOR_DRIFT';
  end if;
  execute replace(d,needle,replacement);

  select pg_get_functiondef('private.ai_need_turn_context(uuid)'::regprocedure) into d;
  if length(d)-length(replace(d,replacement,''))<>length(replacement)
     or strpos(d,$x$not in('need.resolved_location','need.public_photo_paths','need.verified_identity_required');$x$)>0 then
    raise exception 'PRIVACY_P0_CONTEXT_POSTCONDITION_FAILED';
  end if;

  if exists(
    select 1 from pg_proc p
    where p.oid='private.ai_need_turn_context(uuid)'::regprocedure
      and (p.proacl is distinct from before_acl
        or p.proowner is distinct from before_owner
        or p.prosecdef is distinct from before_definer
        or p.proconfig is distinct from before_config
        or p.provolatile is distinct from before_volatility
        or p.prolang is distinct from before_language)
  ) then
    raise exception 'PRIVACY_P0_CONTEXT_AUTHORITY_DRIFT';
  end if;

  if private.retention_ai_source_ready() is distinct from true then
    raise exception 'PRIVACY_P0_RETENTION_SOURCE_NOT_READY_AFTER';
  end if;
end
$privacy_p0$;

notify pgrst,'reload schema';
commit;
