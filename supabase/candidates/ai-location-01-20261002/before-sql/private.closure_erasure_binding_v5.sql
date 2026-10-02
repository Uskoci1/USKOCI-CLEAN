CREATE OR REPLACE FUNCTION private.closure_erasure_binding_v5()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s text;b jsonb;begin
 select sha256 into s from private.closure_erasure_source_v5 where singleton;
 if s is null or s is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then return null;end if;
 b:=jsonb_build_object('adapterVersion','OWNER_AF_D22_EVENT_ERASURE_V1','provenance','OWNER_AF_D22','trigger','CLOSURE_REQUESTED',
  'sourceSha256',s,'authAction','AUTH_IDENTITY_ERASED_SUBJECT_RETAINED','mediaAction','DELETE_UNPROTECTED_OWNED_OBJECTS',
  'relationalAction','ERASE_ORDINARY_PERSONAL_CONTENT','exceptionAction','SCOPED_REVIEW_REQUIRED','legalPolicyAttested',false);
 return b||jsonb_build_object('sha256',encode(extensions.digest(convert_to(b::text,'UTF8'),'sha256'),'hex'));
end $function$
