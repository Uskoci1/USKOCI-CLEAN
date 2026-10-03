// Pure source assembly for a loopback fixture. This is NOT the historical DEV migration.
// The existing migration and its live pins remain byte-identical in the repository.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const md5=x=>createHash('md5').update(x).digest('hex');
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
export function buildLocationFixture(application,prior,readyPreimage,equivalence){
 assert.equal(process.env.PUSH_SINGLE_TARGET_DISPOSABLE,'SINGLE_TARGET_V1');
 assert.deepEqual(equivalence.semanticDifferences,[],'FIXTURE_SEMANTIC_DIFFERENCE');
 assert.ok(equivalence.catalogIdentityDifferences.length>0,'FIXTURE_IDENTITY_EVIDENCE_REQUIRED');
 const oidKeys=['ownerOid','languageOid','argsOid','resultOid','oid','pronamespace','proowner','prolang','proargtypes','prorettype'];
 assert.ok(equivalence.catalogIdentityDifferences.every(d=>oidKeys.includes(d.field)),'UNCLASSIFIED_DIFFERENCE');
 assert.equal(sha(application),'e4a44a9bba6de1d671aa0698a1a9fa45685a7054f17c8d3dcc68c6ddc8a13b61');
 assert.equal(md5(readyPreimage),'f8fb9f2e24f2432b302d7ee87c83a814');
 assert.match(prior.digest,/^[a-f0-9]{64}$/);assert.equal(prior.source,prior.digest);assert.equal(prior.erasure,prior.digest);assert.equal(prior.bindingSource,prior.digest);assert.equal(prior.ready,true);
 const oldDev='0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431';
 const mask=(d,s)=>{assert.equal(d.split(s).length,2,'ONE_READINESS_LITERAL');return d.replace(s,'<CERTIFIED>');};
 assert.equal(mask(prior.definition,prior.digest),mask(readyPreimage,oldDev),'READINESS_BEHAVIOR_DIFFERENCE');
 const pre=application.match(/do \$pre\$[\s\S]*?end \$pre\$;/)?.[0];assert.ok(pre);
 const table=application.match(/create temporary table location_ai_cert_before\([\s\S]*?on commit drop;/)?.[0];assert.ok(table);
 const marker='create function private.ai_location_context_valid(v jsonb) returns boolean';assert.equal(application.split(marker).length,2);
 const tail=application.slice(application.indexOf(marker));assert.equal((tail.match(/^(?:create|CREATE) (?:or replace |OR REPLACE )?function /gmi)??[]).length,13,'EXACT_AFTER_DEFINITION_COUNT');
 assert.match(tail,/end \$cert_rebind\$;\r\nnotify pgrst,'reload schema';\r\ncommit;\r\n$/);
 const prefix=`-- LOOPBACK CURRENT99 FIXTURE ASSEMBLY; NOT A DEV MIGRATION OR PIN VARIANT.\nbegin;\nset local search_path=pg_catalog;set local lock_timeout='5s';set local statement_timeout='30s';
${pre}
lock table private.closure_executions_v5,private.closure_source_v5,private.closure_erasure_source_v5 in share row exclusive mode;
${table}
do $fixture_pre$ declare ready text;begin
 if current_user<>'postgres' then raise exception 'FIXTURE_POSTGRES_REQUIRED';end if;
 if md5(pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure))<>'8a99d5e1246f5f6cfe07d3f927c2f3ac'
 or md5(pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure))<>'a98bd71c6457f54c8fec50affcfa3b7e'
 or md5(pg_get_functiondef('private.closure_erasure_binding_v5()'::regprocedure))<>'6c1b9fa576fcba9754f19be2ecdf0fb5' then raise exception 'FIXTURE_PREDECESSOR_DEFINITION_DRIFT';end if;
 if private.closure_source_digest_v5() is distinct from ${q(prior.digest)}
 or (select sha256 from private.closure_source_v5 where singleton) is distinct from ${q(prior.digest)}
 or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from ${q(prior.digest)}
 or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from ${q(prior.digest)}
 or private.retention_ai_source_ready() is distinct from true
 or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) is distinct from ${q(prior.definition)}
 or exists(select 1 from private.closure_executions_v5 where state='EXECUTING') then raise exception 'FIXTURE_CERTIFICATE_DRIFT';end if;
 select prosrc into strict ready from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 insert into location_ai_cert_before values(${q(prior.digest)},private.closure_erasure_program_digest_v5(),
 pg_get_functiondef('private.closure_source_digest_v5()'::regprocedure),pg_get_functiondef('private.closure_erasure_program_digest_v5()'::regprocedure),
 pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure),md5(replace(ready,${q(prior.digest)},'<CERTIFIED>')),
 (select proacl::text from pg_proc where oid='public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)'::regprocedure),
 (select proacl::text from pg_proc where oid='private.ai_need_turn_status(uuid,uuid,uuid)'::regprocedure));
end $fixture_pre$;
`;
 return {text:prefix+tail,applicationSha256:sha(application),originalPreconditionSha256:sha(pre),afterDefinitionsAndRebindSha256:sha(tail),fixtureAssemblySha256:sha(prefix+tail),historicalLedgerApplied:false,assemblyKind:'EXACT_AFTER_DEFINITIONS_LOCAL_CERTIFICATE_FIXTURE'};
}
