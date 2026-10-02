import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const hash = (text, algorithm = 'sha256') => createHash(algorithm).update(text).digest('hex');
const lf = text => text.replace(/\r\n/g, '\n');
const root = 'supabase/proofs/messages_inbox';
const out = resolve(process.env.INBOX_PROOF_ARTIFACT_DIR || '/tmp/messages-inbox-sql-proof');
mkdirSync(out, { recursive: true });
const bindings = JSON.parse(readFileSync(`${root}/bindings.json`, 'utf8'));
if (process.argv[2] === 'report') {
  let checks = [];
  try { checks = JSON.parse(readFileSync(`${out}/checks.json`, 'utf8')); } catch { /* Missing is a failed proof, not green. */ }
  const exitCode = Number(process.argv[3] || 1);
  const passed = exitCode === 0 && Array.isArray(checks) && checks.length === 47 && checks.includes('proof_completed');
  writeFileSync(`${out}/report.json`, JSON.stringify({ package: 'MESSAGES-INBOX-01', scope: 'FOCUSED_POSTGRES_READER_AND_PINNED_HELPERS',
    status: passed ? 'PASS' : 'FAIL', sourceSha: process.env.GITHUB_SHA || null, canonicalDevAccess: false, providerCalls: 0,
    fullMigrationChain: false, goTrueOrPostgrest: false, checks, processExitCode: exitCode }, null, 2) + '\n');
  process.exit(passed ? 0 : 1);
}
const pkg = bindings.packagePath;
const read = path => lf(readFileSync(path, 'utf8'));
const source = read(`${pkg}/function.sql`), candidate = read(`${pkg}/candidate.sql`);
if (hash(source) !== bindings.functionSha256LF) throw new Error('FUNCTION_SOURCE_BINDING_MISMATCH');
const sourceBody = /as \$inbox\$([\s\S]*?)\$inbox\$;/.exec(source)?.[1];
if (!sourceBody || hash(sourceBody, 'md5') !== bindings.bodyMd5) throw new Error('FUNCTION_BODY_BINDING_MISMATCH');
if (!candidate.includes(source.slice(source.indexOf('create function')))) throw new Error('FUNCTION_NOT_EXACT_CANDIDATE_BODY');
const acl = [
  'alter function public.rpc_list_my_conversations_v1(uuid,integer,jsonb) owner to postgres;',
  'revoke all on function public.rpc_list_my_conversations_v1(uuid,integer,jsonb) from public,anon,authenticated,service_role;',
  'grant execute on function public.rpc_list_my_conversations_v1(uuid,integer,jsonb) to authenticated;',
];
if (!acl.every(line => candidate.includes(line))) throw new Error('CANDIDATE_ACL_BINDING_MISMATCH');
let helpers = '-- Exact saved private helper definitions; only the typed dependencies are synthetic.\n';
const recorded = [];
for (const pinned of bindings.helpers) {
  const saved = JSON.parse(readFileSync(`${pkg}/${pinned.file}`, 'utf8'));
  const definition = lf(saved.definition), body = /AS \$function\$([\s\S]*?)\$function\$/.exec(definition)?.[1];
  if (saved.signature !== pinned.signature || saved.body_md5 !== pinned.bodyMd5 || !body || hash(body, 'md5') !== pinned.bodyMd5)
    throw new Error('HELPER_SOURCE_BINDING_MISMATCH');
  helpers += definition + ';\n' + `revoke all on function ${pinned.signature} from public,anon,authenticated,service_role;\n`;
  recorded.push({ signature: pinned.signature, bodyMd5: pinned.bodyMd5, definitionSha256LF: hash(definition) });
}
writeFileSync(`${out}/helpers.sql`, helpers);
writeFileSync(`${out}/install.sql`, source + '\n' + acl.join('\n') + '\n');
writeFileSync(`${out}/verify-helper-bodies.sql`, bindings.helpers.map(p => `do $$ begin if (select md5(prosrc) from pg_proc where oid='${p.signature}'::regprocedure) is distinct from '${p.bodyMd5}' then raise exception 'HELPER_BODY_MISMATCH';end if;end $$;`).join('\n'));
writeFileSync(`${out}/source-binding.json`, JSON.stringify({ sourceSha: process.env.GITHUB_SHA || null,
  functionSha256LF: hash(source), bodyMd5: bindings.bodyMd5, exactCandidateAcl: acl, helpers: recorded,
  fixtureSha256LF: hash(read(`${root}/fixture.sql`)), assertionsSha256LF: hash(read(`${root}/assertions.sql`)),
  limits: ['minimal typed schema', 'fixture request claims', 'no canonical migration/certificate proof', 'no GoTrue/PostgREST', 'no performance claim'] }, null, 2) + '\n');
console.log('PASS source_bindings_only');
