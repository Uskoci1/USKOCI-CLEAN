-- PRE-V3 P8 forward correction. Candidate119, NOT LIVE.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Existing audit schema must recognize the two new bounded domains. Preserve
-- every predecessor expression; never drop the allowlist or accept arbitrary types.
do $audit_vocabulary$
declare expression text;
begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
  where conrelid='private.marketplace_audit_log'::regclass and conname='marketplace_audit_log_entity_type_check';
 if expression is null or position('SYSTEM' in expression)=0 or position('SAFETY_REPORT' in expression)>0 then
  raise exception 'SAFETY_AUDIT_VOCABULARY_DRIFT'; end if;
 alter table private.marketplace_audit_log drop constraint marketplace_audit_log_entity_type_check;
 execute 'alter table private.marketplace_audit_log add constraint marketplace_audit_log_entity_type_check check (('||expression||') or entity_type in (''ACCOUNT'',''SAFETY_REPORT''))';
end;
$audit_vocabulary$;

commit;
