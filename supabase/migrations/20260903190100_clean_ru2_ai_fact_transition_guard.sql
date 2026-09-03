-- USKOČI RU-2 repair: explicit AI fact transition guard.
--
-- The predecessor guard had an ambient "any non-null uskoci.ai_mutation"
-- bypass and also made subject_need_id absolutely immutable. RU-2 needs one
-- legitimate transition after Human Review: confirmed NEED_FACT_V2 facts are
-- bound from NULL to the newly created owner DRAFT Need. This migration removes
-- the ambient bypass and models every allowed UPDATE structurally.

begin;

do $precondition$
declare
  v_guard text:=pg_get_functiondef('private.guard_ai_fact_write()'::regprocedure);
begin
  if position('FACT_SUBJECT_IMMUTABLE' in v_guard)=0
     or position('uskoci.ai_mutation' in v_guard)=0 then
    raise exception 'RU2_FACT_GUARD_PREDECESSOR_MISMATCH';
  end if;
  if has_table_privilege('authenticated','public.ai_structured_facts','UPDATE') then
    raise exception 'RU2_FACT_GUARD_PRECONDITION_DIRECT_UPDATE_EXPOSED';
  end if;
end
$precondition$;

create or replace function private.guard_ai_fact_write()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text:=auth.role();
  v_only_subject_binding boolean;
  v_only_supersede_start boolean;
  v_only_supersede_link boolean;
  v_need_owner uuid;
  v_need_status text;
  v_conv_account uuid;
  v_conv_schema text;
  v_conv_status text;
  v_conv_bound_need uuid;
begin
  -- This trigger guards UPDATE only.
  if tg_op<>'UPDATE' then return new; end if;

  -- ------------------------------------------------------------
  -- 1) RU-2 canonical DRAFT binding.
  -- Exactly one field may change: subject_need_id NULL -> one newly selected
  -- DRAFT Need owned by the same account. The V2 conversation must still be
  -- OPEN and unbound; rpc_save_need_draft_from_review binds the conversation
  -- only after every fact has passed this guard.
  -- ------------------------------------------------------------
  v_only_subject_binding:=
       old.fact_schema_version='NEED_FACT_V2'
   and new.fact_schema_version='NEED_FACT_V2'
   and old.subject_need_id is null
   and new.subject_need_id is not null
   and (to_jsonb(new)-'subject_need_id') is not distinct from (to_jsonb(old)-'subject_need_id');

  if v_only_subject_binding then
    if v_uid is null or new.account_id is distinct from v_uid then
      raise exception 'FACT_SUBJECT_BIND_REQUIRES_OWNER_COMMAND' using errcode='42501';
    end if;

    select n.requester_account_id,n.status
      into v_need_owner,v_need_status
      from public.needs n
     where n.id=new.subject_need_id;
    if not found
       or v_need_owner is distinct from new.account_id
       or v_need_status<>'DRAFT' then
      raise exception 'FACT_SUBJECT_BIND_TARGET_INVALID' using errcode='42501';
    end if;

    select c.account_id,c.fact_schema_version,c.status,c.bound_need_id
      into v_conv_account,v_conv_schema,v_conv_status,v_conv_bound_need
      from public.ai_conversations c
     where c.id=new.conversation_id;
    if not found
       or v_conv_account is distinct from new.account_id
       or v_conv_schema<>'NEED_FACT_V2'
       or v_conv_status<>'OPEN'
       or v_conv_bound_need is not null then
      raise exception 'FACT_SUBJECT_BIND_CONVERSATION_INVALID' using errcode='42501';
    end if;

    return new;
  end if;

  -- ------------------------------------------------------------
  -- 2) Supersession start.
  -- Old live fact becomes superseded. No content/provenance field may change.
  -- This is used both by owner typed correction and the service-only V2 writer.
  -- ------------------------------------------------------------
  v_only_supersede_start:=
       old.superseded_at is null
   and new.superseded_at is not null
   and new.superseded_by is not distinct from old.superseded_by
   and (to_jsonb(new)-'superseded_at'-'superseded_by')
       is not distinct from
       (to_jsonb(old)-'superseded_at'-'superseded_by');

  if v_only_supersede_start then
    if not (
      (v_uid is not null and new.account_id=v_uid)
      or v_role='service_role'
    ) then
      raise exception 'FACT_SUPERSEDE_REQUIRES_OWNER_OR_SERVICE' using errcode='42501';
    end if;
    return new;
  end if;

  -- ------------------------------------------------------------
  -- 3) Supersession link.
  -- After the replacement fact exists, the already-superseded row may receive
  -- only superseded_by, and that target must be the live replacement for the
  -- same account/conversation/key/schema.
  -- ------------------------------------------------------------
  v_only_supersede_link:=
       old.superseded_at is not null
   and new.superseded_at is not distinct from old.superseded_at
   and old.superseded_by is null
   and new.superseded_by is not null
   and (to_jsonb(new)-'superseded_by') is not distinct from (to_jsonb(old)-'superseded_by');

  if v_only_supersede_link then
    if not (
      (v_uid is not null and new.account_id=v_uid)
      or v_role='service_role'
    ) then
      raise exception 'FACT_SUPERSEDE_LINK_REQUIRES_OWNER_OR_SERVICE' using errcode='42501';
    end if;
    if not exists (
      select 1
        from public.ai_structured_facts r
       where r.id=new.superseded_by
         and r.account_id=new.account_id
         and r.conversation_id=new.conversation_id
         and r.fact_key=new.fact_key
         and r.fact_schema_version=new.fact_schema_version
         and r.superseded_at is null
    ) then
      raise exception 'FACT_SUPERSEDE_LINK_TARGET_INVALID' using errcode='42501';
    end if;
    return new;
  end if;

  -- ------------------------------------------------------------
  -- 4) Human confirmation. Existing semantics preserved: owner only, immutable
  -- fact content, one allowed status transition, confirmation metadata derived.
  -- ------------------------------------------------------------
  if new.account_id is distinct from v_uid then
    raise exception 'FACT_NOT_OWNED_BY_CALLER' using errcode='42501';
  end if;

  if new.fact_key is distinct from old.fact_key then raise exception 'FACT_KEY_IMMUTABLE' using errcode='42501'; end if;
  if new.fact_value is distinct from old.fact_value then raise exception 'FACT_VALUE_IMMUTABLE' using errcode='42501'; end if;
  if new.source is distinct from old.source then raise exception 'FACT_SOURCE_IMMUTABLE' using errcode='42501'; end if;
  if new.evidence_excerpt is distinct from old.evidence_excerpt then raise exception 'FACT_EVIDENCE_IMMUTABLE' using errcode='42501'; end if;
  if new.scope is distinct from old.scope then raise exception 'FACT_SCOPE_IMMUTABLE' using errcode='42501'; end if;
  if new.confidence is distinct from old.confidence then raise exception 'FACT_CONFIDENCE_IMMUTABLE' using errcode='42501'; end if;
  if new.conversation_id is distinct from old.conversation_id then raise exception 'FACT_CONVERSATION_IMMUTABLE' using errcode='42501'; end if;
  if new.subject_need_id is distinct from old.subject_need_id then raise exception 'FACT_SUBJECT_IMMUTABLE' using errcode='42501'; end if;
  if new.fact_schema_version is distinct from old.fact_schema_version then raise exception 'FACT_SCHEMA_IMMUTABLE' using errcode='42501'; end if;
  if new.value_type is distinct from old.value_type then raise exception 'FACT_VALUE_TYPE_IMMUTABLE' using errcode='42501'; end if;
  if new.display_value is distinct from old.display_value then raise exception 'FACT_DISPLAY_IMMUTABLE' using errcode='42501'; end if;
  if new.superseded_at is distinct from old.superseded_at
     or new.superseded_by is distinct from old.superseded_by then
    raise exception 'FACT_SUPERSESSION_REQUIRES_CANONICAL_PATH' using errcode='42501';
  end if;

  if new.status is distinct from old.status then
    if not (old.status in ('NEEDS_CONFIRMATION','INFERRED','UNKNOWN') and new.status='CONFIRMED') then
      raise exception 'INVALID_FACT_STATUS_TRANSITION'
        using errcode='22023',detail=old.status||' -> '||new.status;
    end if;
    new.confirmed_by_user_id:=v_uid;
    new.confirmed_at:=statement_timestamp();
  elsif new.confirmed_at is distinct from old.confirmed_at
     or new.confirmed_by_user_id is distinct from old.confirmed_by_user_id then
    raise exception 'CONFIRMED_METADATA_REQUIRES_STATUS_TRANSITION' using errcode='42501';
  end if;

  return new;
end
$function$;

revoke all on function private.guard_ai_fact_write()
from public,anon,authenticated,service_role;

comment on function private.guard_ai_fact_write() is
  'RU-2 explicit AI fact transition guard: owner confirmation, owner/service supersession, and one-time owner V2 NULL->DRAFT Need binding only. No ambient mutation-token bypass.';

do $postcondition$
declare v_guard text:=pg_get_functiondef('private.guard_ai_fact_write()'::regprocedure);
begin
  if position('FACT_SUBJECT_BIND_REQUIRES_OWNER_COMMAND' in v_guard)=0
     or position('FACT_SUPERSEDE_REQUIRES_OWNER_OR_SERVICE' in v_guard)=0
     or position('FACT_SCHEMA_IMMUTABLE' in v_guard)=0
     or position('uskoci.ai_mutation' in v_guard)>0 then
    raise exception 'RU2_FACT_GUARD_POSTCONDITION_FAILED';
  end if;
  if has_table_privilege('authenticated','public.ai_structured_facts','UPDATE')
     or has_function_privilege('authenticated','private.guard_ai_fact_write()','EXECUTE')
     or has_function_privilege('service_role','private.guard_ai_fact_write()','EXECUTE') then
    raise exception 'RU2_FACT_GUARD_PRIVILEGE_POSTCONDITION_FAILED';
  end if;
end
$postcondition$;

commit;
