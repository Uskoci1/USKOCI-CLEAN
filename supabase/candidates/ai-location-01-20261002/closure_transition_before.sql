-- AI-LOCATION-01: bounded technical inventory transition, no legal policy update.
-- Hold the existing closure rows still while this transaction checks and rebinds
-- the reviewed program. Nothing here executes erasure or retention work.
lock table private.closure_executions_v5,private.closure_source_v5,private.closure_erasure_source_v5 in share row exclusive mode;
create temporary table location_ai_cert_before(
 certified text,program text,source_def text,program_def text,ready_def text,ready_masked text,
 old_claim_acl text,old_status_acl text) on commit drop;
do $cert_pre$ declare ready text;begin
 if md5(pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure)) is distinct from '8a99d5e1246f5f6cfe07d3f927c2f3ac' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.closure_source_digest_v5';end if;
 if md5(pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure)) is distinct from 'a98bd71c6457f54c8fec50affcfa3b7e' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.closure_erasure_program_digest_v5';end if;
 if md5(pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure)) is distinct from 'f8fb9f2e24f2432b302d7ee87c83a814' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.retention_ai_source_ready';end if;
 if md5(pg_get_functiondef('private.closure_erasure_binding_v5()'::regprocedure)) is distinct from '6c1b9fa576fcba9754f19be2ecdf0fb5' then raise exception 'LOCATION_AI_CERT_BODY_DRIFT' using errcode='PT409',detail='private.closure_erasure_binding_v5';end if;
 if private.closure_source_digest_v5() is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 or (select sha256 from private.closure_source_v5 where singleton) is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 or private.closure_erasure_program_digest_v5() is distinct from '2fe2edc126edc9a9b08b4e3cfce758ff928c99d377a0df3b04bd49961cc4a078'
 or private.retention_ai_source_ready() is distinct from true
 or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431'
 then raise exception 'LOCATION_AI_CERT_PREDECESSOR_DRIFT' using errcode='PT409';end if;
 if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'LOCATION_AI_CLOSURE_INFLIGHT' using errcode='PT409';end if;
 select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if length(ready)-length(replace(ready,'0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431',''))<>64 then raise exception 'LOCATION_AI_READY_CONSTANT_DRIFT' using errcode='PT409';end if;
 insert into location_ai_cert_before values('0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431','2fe2edc126edc9a9b08b4e3cfce758ff928c99d377a0df3b04bd49961cc4a078',
 pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure),pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure),
 pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure),md5(replace(ready,'0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431','<CERTIFIED>')),
 (select proacl::text from pg_proc where oid='public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)'::regprocedure),
 (select proacl::text from pg_proc where oid='private.ai_need_turn_status(uuid,uuid,uuid)'::regprocedure));
end $cert_pre$;
