CREATE OR REPLACE FUNCTION private.need_location_review_document(cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  with material as (
    select c.id,c.account_id,c.status,c.bound_need_id,
      coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'key',f.fact_key,'value',f.fact_value,'status',f.status,
          'subjectNeedId',f.subject_need_id) order by f.fact_key)
        from public.ai_structured_facts f where f.conversation_id=c.id and f.superseded_at is null
          and f.fact_schema_version='NEED_FACT_V2'
          and f.fact_key in ('need.task_country_code','need.task_geography','need.exact_address','need.access_notes','need.resolved_location')),'[]'::jsonb) as facts
    from public.ai_conversations c where c.id=cid and c.purpose='NEED_INTAKE' and c.fact_schema_version='NEED_FACT_V2'
  ), projected as (
    select *,jsonb_build_object('taskCountryCode',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.task_country_code'),'geography',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.task_geography'),
      'exactAddress',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.exact_address'),
      'accessNotes',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.access_notes'),
      'resolvedLocation',(select f->'value' from jsonb_array_elements(facts) f where f->>'key'='need.resolved_location')) as value from material
  ) select jsonb_build_object('accountId',account_id,'conversationId',id,'editable',status='OPEN',
    'confirmed',value->'taskCountryCode'<>'null'::jsonb and value->'geography'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(facts) f where f->>'status'<>'CONFIRMED'),
    'value',value,'revision',encode(extensions.digest(jsonb_build_object('id',id,'status',status,'boundNeedId',bound_need_id,'facts',facts)::text,'sha256'),'hex'))
    from projected;
$function$
