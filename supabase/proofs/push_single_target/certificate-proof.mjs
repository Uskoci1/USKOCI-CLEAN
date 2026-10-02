// Disposable-only closure integration. Reuses the existing digest-roster and literal-rebind pattern.
// It is not an unrestricted DEV recertifier. The caller must first enforce loopback and exact source.
import assert from 'node:assert/strict';

export const EXTRA = Object.freeze([
 'public.rpc_claim_push_transport(text)', 'public.rpc_begin_push_send(uuid,uuid)',
 'public.rpc_complete_push_transport(uuid,uuid,text,text)', 'private.push_session_valid(uuid,uuid)',
 'private.push_suppression(public.notification_deliveries)',
 'private.admit_push_single_target_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,bigint,uuid,timestamptz,timestamptz)',
 'public.rpc_claim_push_single_target(uuid)', 'public.rpc_claim_push_single_target_receipt(uuid)',
 'private.revoke_push_single_target_v1(uuid)',
]);
const sourceSignature = 'private.closure_source_digest_v5()';
const programSignature = 'private.closure_erasure_program_digest_v5()';
export const READY = 'private.retention_ai_source_ready()';
const q = x => "'" + String(x).replaceAll("'", "''") + "'";
const statement = x => x.trimEnd().replace(/;$/, '') + ';';
function once(text, from, to) {
 assert.equal(text.split(from).length, 2, 'CERTIFICATE_ANCHOR_NOT_UNIQUE');
 return text.replace(from, to);
}
export function extendRosters(source, program) {
 for (const signature of EXTRA) assert.ok(!source.includes(q(signature)), 'ALREADY_CERTIFIED_TARGET');
 const counts = [...source.matchAll(/having count\(\*\)=(\d+)/g)];
 assert.equal(counts.length, 1, 'SOURCE_ROSTER_COUNT_ANCHOR');
 const sourceNext = once(once(source, ']) signature', ',' + EXTRA.map(q).join(',') + ']) signature'),
  counts[0][0], 'having count(*)=' + (Number(counts[0][1]) + EXTRA.length));
 const programNext = once(program, "}'::text[]) x)", ',' + EXTRA.map(x => '"' + x + '"').join(',') + "}'::text[]) x)");
 return {sourceNext, programNext, priorCount: Number(counts[0][1]), nextCount: Number(counts[0][1]) + EXTRA.length};
}
export function snapshot(rt) {
 return rt.rows(`select private.closure_source_digest_v5() digest, private.retention_ai_source_ready() ready,
  private.closure_erasure_binding_v5() binding,
  (select to_jsonb(x) from private.closure_source_v5 x where singleton) source_row,
  (select to_jsonb(x) from private.closure_erasure_source_v5 x where singleton) erasure_row,
  pg_get_functiondef(${q(sourceSignature)}::regprocedure) source_definition,
  pg_get_functiondef(${q(programSignature)}::regprocedure) program_definition,
  pg_get_functiondef(${q(READY)}::regprocedure) ready_definition,
  (select jsonb_agg(to_jsonb(x) order by data_class) from private.closure_dataset_catalog_v5 x) datasets,
  private.data_export_dataset_catalog() export_catalog`)[0];
}
function boundaries(body) {
 assert.ok(body.includes('\nbegin;\n') && body.endsWith('\ncommit;\n'), 'PACKAGE_TRANSACTION_BOUNDARIES');
 return body.slice(0, -'commit;\n'.length);
}
export function installWithCertificate(body, before, manifest) {
 assert.equal(before.ready, true); assert.equal(before.source_row.sha256, before.digest);
 assert.equal(before.erasure_row.sha256, before.digest); assert.equal(before.binding.sourceSha256, before.digest);
 assert.equal(before.ready_definition.split(before.digest).length, 2, 'READINESS_LITERAL_UNIQUE');
 const patch = extendRosters(before.source_definition, before.program_definition);
 const bodyPins = Object.entries(manifest.newFunctionBodyMd5).map(([s,h])=>'('+q(s)+','+q(h)+')').join(',');
 const pre = `
 set local uskoci.single_target_disposable='SINGLE_TARGET_V1';
 set local lock_timeout='5s'; set local statement_timeout='60s';
 lock table private.closure_executions_v5 in share mode;
 lock table private.closure_source_v5,private.closure_erasure_source_v5,private.closure_dataset_catalog_v5 in share row exclusive mode;
 do $pre$ begin
 if exists(select 1 from private.closure_executions_v5 where state='EXECUTING')
  or private.closure_source_digest_v5() is distinct from ${q(before.digest)}
  or private.retention_ai_source_ready() is distinct from true
  or (select to_jsonb(x) from private.closure_source_v5 x where singleton) is distinct from ${q(JSON.stringify(before.source_row))}::jsonb
  or (select to_jsonb(x) from private.closure_erasure_source_v5 x where singleton) is distinct from ${q(JSON.stringify(before.erasure_row))}::jsonb
 then raise exception 'SINGLE_TARGET_CERTIFICATE_PRECONDITION'; end if;
 end $pre$;
 `;
 let text = boundaries(body).replace('\nbegin;\n', '\nbegin;\n'+pre);
 text += `
do $post$ declare r record; begin
 for r in select * from (values ${bodyPins}) x(signature,expected) loop
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.expected
  then raise exception 'SINGLE_TARGET_INSTALLED_BODY_DRIFT: %',r.signature; end if;
 end loop;
 if private.retention_ai_source_ready() is distinct from false or private.closure_erasure_binding_v5() is not null
 then raise exception 'SINGLE_TARGET_SCHEMA_CHANGE_NOT_CLOSED'; end if;
end $post$;
${statement(patch.sourceNext)}
${statement(patch.programNext)}
do $rebind$ declare fresh text; affected integer; begin
 fresh:=private.closure_source_digest_v5();
 if fresh is null or fresh=${q(before.digest)} or fresh!~'^[0-9a-f]{64}$' then raise exception 'SINGLE_TARGET_DIGEST_INVALID'; end if;
 update private.closure_source_v5 set sha256=fresh where singleton and sha256=${q(before.digest)};
 get diagnostics affected=row_count; if affected<>1 then raise exception 'SINGLE_TARGET_CERTIFICATE_CARDINALITY'; end if;
 update private.closure_erasure_source_v5 set sha256=fresh where singleton and sha256=${q(before.digest)};
 get diagnostics affected=row_count; if affected<>1 then raise exception 'SINGLE_TARGET_ERASURE_CERTIFICATE_CARDINALITY'; end if;
 execute replace(${q(before.ready_definition)},${q(before.digest)},fresh);
 if private.retention_ai_source_ready() is distinct from true or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from fresh
 then raise exception 'SINGLE_TARGET_REBIND_FAILED'; end if;
end $rebind$;
commit;
`;
 return {text, roster: {before: patch.priorCount, after: patch.nextCount}};
}
export function revertWithCertificate(body, before, installed) {
 assert.ok(before.digest && installed.digest && before.digest!==installed.digest);
 let text = boundaries(body).replace('\nbegin;\n', `\nbegin;\nset local uskoci.single_target_disposable='SINGLE_TARGET_V1';
 lock table private.closure_executions_v5 in share mode;
 lock table private.closure_source_v5,private.closure_erasure_source_v5 in share row exclusive mode;
 do $pre$ begin
 if exists(select 1 from private.closure_executions_v5 where state='EXECUTING') or private.closure_source_digest_v5() is distinct from ${q(installed.digest)}
 then raise exception 'SINGLE_TARGET_REVERT_CERTIFICATE_DRIFT'; end if; end $pre$;
`);
 return text + `
${statement(before.source_definition)}
${statement(before.program_definition)}
${statement(before.ready_definition)}
update private.closure_source_v5 set sha256=${q(before.digest)} where singleton and sha256=${q(installed.digest)};
update private.closure_erasure_source_v5 set sha256=${q(before.digest)} where singleton and sha256=${q(installed.digest)};
do $post$ begin
 if private.closure_source_digest_v5() is distinct from ${q(before.digest)} or private.retention_ai_source_ready() is distinct from true
  or (select to_jsonb(x) from private.closure_source_v5 x where singleton) is distinct from ${q(JSON.stringify(before.source_row))}::jsonb
  or (select to_jsonb(x) from private.closure_erasure_source_v5 x where singleton) is distinct from ${q(JSON.stringify(before.erasure_row))}::jsonb
 then raise exception 'SINGLE_TARGET_REVERT_FAILED'; end if;
end $post$;
commit;
`;
}
