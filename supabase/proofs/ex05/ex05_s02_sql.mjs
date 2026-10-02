// EX-05 S02 (RC-02 media-cancel lock order): the pure SQL / text layer of the proof. ASCII only, LF only.
// Nothing in this file touches a database: it builds the statements the proof sends to psql sessions, parses what the sessions answer,
// and rewrites function definitions for the named scratch controls and for the B24 conversion of the chain. Every builder validates its
// input (a UUID is a UUID, a literal is printable ASCII) so that a typo can never turn into SQL.
import {createHash} from 'node:crypto';

export const UNIT = 'EX05_S02_RC02_MEDIA_CANCEL_LOCK_ORDER';
export const SCRATCH_SCHEMA = 'ex05_scratch';
export const APP_PREFIX = 'ex05-s02:';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const HEX64_RE = /^[0-9a-f]{64}$/;

export function assertUuid(value, what = 'uuid') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new Error('BAD_UUID:' + what);
  return value;
}
/** A validated uuid as a typed SQL literal. */
export const U = (value, what = 'uuid') => "'" + assertUuid(value, what) + "'::uuid";

export function sqlLiteral(text) {
  if (typeof text !== 'string' || !/^[\x20-\x7e]*$/.test(text)) throw new Error('BAD_LITERAL');
  return "'" + text.replaceAll("'", "''") + "'";
}
export function intIn(value, min, max, what = 'integer') {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error('BAD_INTEGER:' + what);
  return value;
}
export function assertAscii(text, what = 'text') {
  if (typeof text !== 'string' || !/^[\x09\x0a\x20-\x7e]*$/.test(text)) throw new Error('NOT_ASCII:' + what);
  return text;
}
export const md5Hex = text => createHash('md5').update(text, 'utf8').digest('hex');
export const sha256Hex = text => createHash('sha256').update(text, 'utf8').digest('hex');

// ---------------------------------------------------------------------------------------------------------------------------------
// Session scripts. One psql process per transaction: the head sets the session up, the body is the statement(s), the tail commits.
// ---------------------------------------------------------------------------------------------------------------------------------
export const ROLES = Object.freeze(['postgres', 'authenticated', 'service_role']);
export const APP_NAME_RE = /^ex05-s02:[0-9]{1,4}:[A-Za-z0-9_-]{1,24}$/;

export function claimsJson(role, claims) {
  if (role === 'service_role') return '{"role":"service_role"}';
  if (role === 'authenticated') {
    assertUuid(claims?.sub, 'claims.sub');
    assertUuid(claims?.session_id, 'claims.session_id');
    return JSON.stringify({sub: claims.sub, role: 'authenticated', session_id: claims.session_id});
  }
  throw new Error('NO_CLAIMS_FOR_ROLE:' + role);
}

export function sessionHead({app, role, claims = null, deadlockMs = null, statementMs = 30000}) {
  if (!APP_NAME_RE.test(app)) throw new Error('BAD_APP_NAME');
  if (!ROLES.includes(role)) throw new Error('BAD_ROLE');
  const lines = ['begin;', `set local application_name = '${app}';`, `set local statement_timeout = '${intIn(statementMs, 1000, 120000, 'statementMs')}ms';`];
  if (deadlockMs !== null && deadlockMs !== undefined) lines.push(`set local deadlock_timeout = '${intIn(deadlockMs, 200, 60000, 'deadlockMs')}ms';`);
  if (role !== 'postgres') {
    lines.push(`set local role ${role};`);
    const json = claimsJson(role, claims);
    if (json.includes("'")) throw new Error('CLAIMS_CONTAIN_QUOTE');
    lines.push(`do $ex05$ begin perform set_config('request.jwt.claims', '${json}', true); end $ex05$;`);
  }
  return lines.join('\n') + '\n';
}

export const readyStatement = "select 'READY|' || pg_backend_pid();";
const call = (tag, expression) => {
  if (!/^[A-Za-z0-9_]{1,24}$/.test(tag)) throw new Error('BAD_TAG');
  return `select 'RES|${tag}|' || (${expression})::text;`;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// What the two upload families look like.
// ---------------------------------------------------------------------------------------------------------------------------------
export const KINDS = Object.freeze({
  photo: Object.freeze({
    kind: 'photo', table: 'private.agreement_photo_uploads_v5', uploadFn: 'public.rpc_agreement_photo_upload_service_v5', uploadRpc: 'rpc_agreement_photo_upload_service_v5',
    keyFn: 'private.agreement_photo_key_v5', sendRpc: 'rpc_send_agreement_photo_message_v5', perMinute: 12,
    claimInput: c => ({sha256: c.sha, byteSize: 2048, contentType: 'image/jpeg'}),
    stageInput: c => ({attemptId: c.attempt, sha256: c.stageSha, width: 800, height: 600, byteSize: 1024}),
    settleInput: c => ({sha256: c.stageSha, outcome: 'STORED'}),
  }),
  voice: Object.freeze({
    kind: 'voice', table: 'private.agreement_voice_uploads_v1', uploadFn: 'public.rpc_agreement_voice_upload_service_v1', uploadRpc: 'rpc_agreement_voice_upload_service_v1',
    keyFn: 'private.agreement_voice_key_v1', sendRpc: 'rpc_send_agreement_voice_message_v1', perMinute: 6,
    claimInput: c => ({sha256: c.sha, byteSize: 4096, contentType: 'audio/mp4'}),
    stageInput: c => ({attemptId: c.attempt, sha256: c.sha, byteSize: 4096, durationMs: 4200}),
    settleInput: c => ({sha256: c.sha, outcome: 'STORED'}),
  }),
});
const kindOf = c => {
  const info = KINDS[c?.kind];
  if (!info) throw new Error('BAD_KIND');
  return info;
};
const jsonLiteral = value => {
  const text = JSON.stringify(value);
  if (!/^[\x20-\x7e]*$/.test(text) || text.includes("'")) throw new Error('BAD_JSON_LITERAL');
  return `'${text}'::jsonb`;
};

/** One upload-service call (the service-role protocol of the Agreement photo and voice uploads). */
export function agreementOp(c, operation, input = {}, fn = null) {
  const info = kindOf(c);
  if (!['CLAIM', 'READ', 'CANCEL', 'LIST', 'STAGE', 'DISPATCH', 'SETTLE', 'FAIL'].includes(operation)) throw new Error('BAD_OPERATION');
  return `${fn ?? info.uploadFn}(${U(c.owner.id, 'owner')}, ${U(c.owner.session, 'session')}, '${operation}', ${U(c.agreement, 'agreement')}, 1, ${U(c.key, 'key')}, ${jsonLiteral(input)})`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The statements of the interleavings: name -> {role, build(ctx)}. A statement answers with one RES|tag|json line.
// ---------------------------------------------------------------------------------------------------------------------------------
const taskAssetArgs = c => `${U(c.owner.id, 'owner')}, ${U(c.asset, 'asset')}`;
export const STATEMENTS = Object.freeze({
  taskCancel: Object.freeze({role: 'authenticated', build: c => call('cancel', `public.rpc_cancel_media_upload(${U(c.conv, 'conv')}, ${U(c.key, 'key')})`)}),
  taskCancelConvFirst: Object.freeze({role: 'authenticated', build: c => call('cancel', `${SCRATCH_SCHEMA}.rpc_cancel_media_upload_conv_first(${U(c.conv, 'conv')}, ${U(c.key, 'key')})`)}),
  taskRemove: Object.freeze({role: 'authenticated', build: c => call('remove', `public.rpc_remove_task_photo(${U(c.conv, 'conv')}, ${U(c.asset, 'asset')})`)}),
  taskComplete: Object.freeze({role: 'service_role', build: c => call('complete', `public.rpc_complete_media_upload_service(${taskAssetArgs(c)}, ${sqlLiteral(c.stageSha)})`)}),
  taskSettle: Object.freeze({role: 'service_role', build: c => call('settle', `public.rpc_settle_media_upload_service(${taskAssetArgs(c)}, ${sqlLiteral(c.stageSha)}, 'STORED')`)}),
  taskClaim: Object.freeze({role: 'service_role', build: c => call('claim', `public.rpc_claim_media_upload_service(${U(c.owner.id, 'owner')}, 'TASK', ${U(c.conv, 'conv')}, ${U(c.key, 'key')}, ${sqlLiteral(c.sha)}, 2048, 'image/jpeg')`)}),
  agrCancel: Object.freeze({role: 'service_role', build: c => call('cancel', agreementOp(c, 'CANCEL'))}),
  agrCancelInverted: Object.freeze({role: 'service_role', build: c => call('cancel', agreementOp(c, 'CANCEL', {}, `${SCRATCH_SCHEMA}.${kindOf(c).uploadRpc}_inverted`))}),
  agrSettle: Object.freeze({role: 'service_role', build: c => call('settle', agreementOp(c, 'SETTLE', kindOf(c).settleInput(c)))}),
  agrClaim: Object.freeze({role: 'service_role', build: c => call('claim', agreementOp(c, 'CLAIM', kindOf(c).claimInput(c)))}),
  agrSend: Object.freeze({role: 'authenticated', build: c => {
    const info = kindOf(c);
    if (info.kind === 'voice') {
      return call('send', `public.${info.sendRpc}(${U(c.owner.id, 'owner')}, ${U(c.agreement, 'agreement')}, 1, ${sqlLiteral(c.cmid)}, ${U(c.asset, 'asset')})`);
    }
    return call('send', `public.${info.sendRpc}(${U(c.owner.id, 'owner')}, ${U(c.agreement, 'agreement')}, 1, ${sqlLiteral(c.cmid)}, '', array[${U(c.asset, 'asset')}])`);
  }}),
  prepareClosure: Object.freeze({role: 'authenticated', build: c => call('prepare', `public.rpc_prepare_account_closure(${U(c.owner.id, 'owner')}, 0, ${U(c.prepareId, 'prepareId')})`)}),
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Gates: a plain session (the login role of the disposable database) that holds ONE lock a real caller needs. The proof parks callers behind
// it, in a chosen queue order, and releases it. The gates never write product data (closureKeyRestrict inserts one closure row of the
// disposable owner and the proof deletes it afterwards).
// ---------------------------------------------------------------------------------------------------------------------------------
// A row gate that locked no row would hold nothing and the proof would test nothing: the gate prints how many rows it locked and the engine refuses zero.
const lockedRows = lockingSelect => `select 'LOCKED|' || count(*) from (${lockingSelect}) g;`;
export const GATES = Object.freeze({
  conversationRow: c => [lockedRows(`select id from public.ai_conversations where id = ${U(c.conv, 'conv')} for update`)],
  assetRow: c => [lockedRows(`select id from private.owned_media_assets where id = ${U(c.asset, 'asset')} for update`)],
  uploadRow: c => [lockedRows(`select id from ${kindOf(c).table} where id = ${U(c.asset, 'asset')} for update`)],
  agreementRow: c => [lockedRows(`select id from public.agreements where id = ${U(c.agreement, 'agreement')} for update`)],
  taskAdvisory: c => [`select pg_advisory_xact_lock(hashtextextended('uskoci:media-upload:' || ${sqlLiteral(assertUuid(c.owner.id, 'owner'))} || ':' || ${sqlLiteral(assertUuid(c.key, 'key'))}, 130));`],
  agreementAdvisory: c => [`select pg_advisory_xact_lock(${kindOf(c).keyFn}(${U(c.owner.id, 'owner')}));`],
  closureKey: c => [`select pg_advisory_xact_lock(private.closure_account_key(${U(c.owner.id, 'owner')}));`],
  closureKeyRestrict: c => [
    `select pg_advisory_xact_lock(private.closure_account_key(${U(c.owner.id, 'owner')}));`,
    `insert into private.account_closure_requests(account_id, state, revision) values (${U(c.owner.id, 'owner')}, 'READY', 1);`,
  ],
});
export const CLEANUPS = Object.freeze({
  closureRequest: c => `delete from private.account_closure_requests where account_id = ${U(c.owner.id, 'owner')};`,
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Final-state queries (one jsonb text line).
// ---------------------------------------------------------------------------------------------------------------------------------
export function taskStateSql(c) {
  const where = `account_id = ${U(c.owner.id, 'owner')} and client_request_id = ${U(c.key, 'key')}`;
  return `select jsonb_build_object(
    'rows', (select count(*) from private.owned_media_assets where ${where}),
    'state', (select state from private.owned_media_assets where ${where}),
    'selected', (select selected from private.owned_media_assets where ${where}),
    'dispatch', (select dispatch_state || '/' || coalesce(dispatch_outcome, '-') from private.owned_media_assets where ${where}),
    'tombstone', coalesce((select state = 'CANCELLED' and input_sha256 is null from private.owned_media_assets where ${where}), false),
    'inRefs', coalesce((select a.storage_path = any(private.media_task_refs(${U(c.conv, 'conv')})) from private.owned_media_assets a where a.${where.replaceAll(' and ', ' and a.')}), false),
    'closure', (select state from private.account_closure_requests where account_id = ${U(c.owner.id, 'owner')})
  )::text;`;
}
export function agreementStateSql(c) {
  const info = kindOf(c);
  const where = `account_id = ${U(c.owner.id, 'owner')} and client_request_id = ${U(c.key, 'key')}`;
  return `select jsonb_build_object(
    'rows', (select count(*) from ${info.table} where ${where}),
    'state', (select state from ${info.table} where ${where}),
    'attached', coalesce((select attached_message_id is not null from ${info.table} where ${where}), false),
    'cancelled', coalesce((select cancelled_at is not null from ${info.table} where ${where}), false),
    'dispatch', (select dispatch_state || '/' || coalesce(dispatch_outcome, '-') from ${info.table} where ${where}),
    'messages', (select count(*) from public.agreement_messages m where m.sender_account_id = ${U(c.owner.id, 'owner')} and m.client_message_id = ${sqlLiteral(c.cmid)}),
    'closure', (select state from private.account_closure_requests where account_id = ${U(c.owner.id, 'owner')})
  )::text;`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Observation: what every session of the proof is waiting for, as seen by a separate connection.
// ---------------------------------------------------------------------------------------------------------------------------------
export function observeSql() {
  return `select coalesce(jsonb_agg(to_jsonb(x) order by x.pid), '[]'::jsonb)::text from (
    select a.pid, a.application_name, a.state, a.wait_event_type, a.wait_event, pg_blocking_pids(a.pid) as blocked_by, left(a.query, 200) as query_head,
      (select coalesce(jsonb_agg(jsonb_build_object('locktype', l.locktype, 'mode', l.mode,
          'relation', case when l.relation is null then null else l.relation::regclass::text end,
          'key', case when l.locktype = 'advisory' then ((l.classid::bigint << 32) | l.objid::bigint)::text else null end,
          'xid', l.transactionid::text) order by l.locktype, l.mode), '[]'::jsonb)
         from pg_locks l where l.pid = a.pid and not l.granted) as waiting_on
    from pg_stat_activity a where a.application_name like '${APP_PREFIX}%') x;`;
}
export function pidSql(app) {
  if (!APP_NAME_RE.test(app)) throw new Error('BAD_APP_NAME');
  return `select coalesce((select pid::text from pg_stat_activity where application_name = '${app}' limit 1), '');`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Parsing what a psql session printed.
// ---------------------------------------------------------------------------------------------------------------------------------
const tryJson = text => {
  try { return JSON.parse(text); } catch { return text; }
};
const SECTION_RE = /^(DETAIL|HINT|CONTEXT|LOCATION|QUERY|STATEMENT|SCHEMA NAME|TABLE NAME|COLUMN NAME|DATATYPE NAME|CONSTRAINT NAME):\s*(.*)$/;
// psql prefixes an error with "psql:<file>:<line>: " when it reads a script file; a piped stdin has no prefix. Both forms are accepted.
const ERROR_LINE_RE = /^(?:psql:\S+:\d+:\s*)?ERROR:\s+([0-9A-Z]{5}):\s*(.*)$/;

/** The error block of a psql run with VERBOSITY=verbose: first ERROR line, then labelled sections whose continuation lines have no label. */
export function parseErrorBlock(stderr) {
  const lines = String(stderr ?? '').split('\n');
  const start = lines.findIndex(line => ERROR_LINE_RE.test(line));
  if (start < 0) return null;
  const head = ERROR_LINE_RE.exec(lines[start]);
  const block = {sqlstate: head[1], message: head[2].trim(), sections: {}};
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (/^(?:psql:\S+:\d+:\s*)?(ERROR|FATAL):/.test(line)) break;
    const section = SECTION_RE.exec(line);
    if (section) {
      current = section[1];
      block.sections[current] = [section[2].trim()];
    } else if (current && line.trim().length) {
      block.sections[current].push(line.trim());
    }
  }
  return block;
}

/** Edges of a 40P01 DETAIL: "Process A waits for ShareLock on transaction T; blocked by process B." */
export function deadlockEdges(detailLines) {
  const text = Array.isArray(detailLines) ? detailLines.join('\n') : String(detailLines ?? '');
  return [...text.matchAll(/Process (\d+) waits for (\w+) on (.+?); blocked by process (\d+)\./g)]
    .map(match => ({waiterPid: Number(match[1]), mode: match[2], on: match[3].trim(), holderPid: Number(match[4])}));
}

export function parseSession({code = null, signal = null, stdout = '', stderr = ''}) {
  const out = {exitCode: code, signal, ok: code === 0, results: {}, pid: null, sqlstate: null, message: null, detail: [], context: []};
  for (const line of String(stdout).split('\n')) {
    const result = /^RES\|([A-Za-z0-9_]+)\|(.*)$/.exec(line);
    if (result) out.results[result[1]] = tryJson(result[2]);
    const ready = /^READY\|(\d+)$/.exec(line);
    if (ready) out.pid = Number(ready[1]);
  }
  const block = parseErrorBlock(stderr);
  if (block) {
    out.sqlstate = block.sqlstate;
    out.message = block.message;
    out.detail = (block.sections.DETAIL ?? []).slice(0, 12);
    out.context = (block.sections.CONTEXT ?? []).slice(0, 14);
    out.hint = (block.sections.HINT ?? []).slice(0, 3);
    out.location = (block.sections.LOCATION ?? []).slice(0, 2);
    if (out.sqlstate === '40P01') out.edges = deadlockEdges(out.detail);
    out.ok = false;
  } else if (code !== 0) {
    out.sqlstate = 'NO_ERROR_LINE';
    out.message = String(stderr ?? '').split('\n').find(line => line.trim()) ?? 'psql exited with a non-zero status';
  }
  return out;
}

/** "SQLSTATE:MESSAGE" of a failed session, the form the expectations use. */
export const errorKey = parsed => (parsed.ok ? null : `${parsed.sqlstate}:${String(parsed.message ?? '').split(/[ ,(]/)[0]}`);

// ---------------------------------------------------------------------------------------------------------------------------------
// Function-definition rewrites. All of them demand each anchor EXACTLY once and return the expected body, so the proof can compare the
// md5 of what the database stored with what was intended.
// ---------------------------------------------------------------------------------------------------------------------------------
const countOf = (text, needle) => (needle.length ? text.split(needle).length - 1 : 0);
const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function bodyOfDef(def) {
  const open = def.indexOf('$function$');
  const close = def.lastIndexOf('$function$');
  if (open < 0 || close <= open) throw new Error('DEF_HAS_NO_BODY');
  return def.slice(open + '$function$'.length, close);
}
export function renameDef(def, fromQualified, toQualified) {
  const needle = 'FUNCTION ' + fromQualified + '(';
  if (countOf(def, needle) !== 1) throw new Error('DEF_NAME_ANCHOR_COUNT:' + countOf(def, needle));
  return def.replace(needle, () => 'FUNCTION ' + toQualified + '(');
}
export function replaceBody(def, newBody) {
  const open = def.indexOf('$function$') + '$function$'.length;
  const close = def.lastIndexOf('$function$');
  return def.slice(0, open) + newBody + def.slice(close);
}

/** B24: the quoted SQLSTATE 40001 of every deterministic conflict becomes PT409 (the transformation of the b24 candidates). */
export function convertB24(def) {
  const sites = countOf(def, "'40001'");
  if (sites < 1) throw new Error('B24_NOTHING_TO_CONVERT');
  const sql = def.replaceAll("'40001'", "'PT409'");
  if (sql.includes('40001')) throw new Error('B24_40001_LEFT');
  return {sql, sites, body: bodyOfDef(sql)};
}

/** Positive control (scratch copy, NOT a candidate): rpc_cancel_media_upload takes the CONVERSATION row first, the order of its siblings. */
export const CANCEL_CONV_ANCHOR = 'select * into c from public.ai_conversations where id=p_conversation_id and account_id=v_uid;';
export function mutateCancelConvFirst(def) {
  const body = bodyOfDef(def);
  if (countOf(body, CANCEL_CONV_ANCHOR) !== 1) throw new Error('CANCEL_ANCHOR_COUNT:' + countOf(body, CANCEL_CONV_ANCHOR));
  const expectedBody = body.replace(CANCEL_CONV_ANCHOR, () => CANCEL_CONV_ANCHOR.replace(/;$/, ' for update;'));
  const renamed = renameDef(def, 'public.rpc_cancel_media_upload', SCRATCH_SCHEMA + '.rpc_cancel_media_upload_conv_first');
  return {sql: replaceBody(renamed, expectedBody), expectedBody, originalBody: body};
}

/** Negative control (scratch copy): the Agreement upload service takes the UPLOAD ROW before the per-account advisory lock (the wrong order). */
export const INVERT_ANCHORS = Object.freeze({
  photo: Object.freeze({
    adv: 'perform pg_advisory_xact_lock(private.agreement_photo_key_v5(p_account_id));',
    row: 'select * into a from private.agreement_photo_uploads_v5 where account_id=p_account_id and client_request_id=p_key for update;',
  }),
  voice: Object.freeze({
    adv: 'perform pg_advisory_xact_lock(private.agreement_voice_key_v1(p_account_id));',
    row: 'select * into a from private.agreement_voice_uploads_v1 where account_id = p_account_id and client_request_id = p_key for update;',
  }),
});
export function mutateUploadServiceInverted(def, kind) {
  const info = KINDS[kind];
  const anchors = INVERT_ANCHORS[kind];
  if (!info || !anchors) throw new Error('BAD_KIND');
  const body = bodyOfDef(def);
  if (countOf(body, anchors.adv) !== 1 || countOf(body, anchors.row) !== 1) throw new Error('UPLOAD_ANCHOR_COUNT:' + countOf(body, anchors.adv) + ':' + countOf(body, anchors.row));
  const pattern = new RegExp(escapeRe(anchors.adv) + '(\\s+)' + escapeRe(anchors.row));
  if (!pattern.test(body)) throw new Error('UPLOAD_ANCHORS_NOT_ADJACENT');
  const expectedBody = body.replace(pattern, (_all, gap) => anchors.row + gap + anchors.adv);
  const renamed = renameDef(def, info.uploadFn, SCRATCH_SCHEMA + '.' + info.uploadRpc + '_inverted');
  return {sql: replaceBody(renamed, expectedBody), expectedBody, originalBody: body};
}

/** The body of one function as the repository source writes it (between the dollar quotes of its create statement), used by the offline ties. */
export function sourceBody(sourceText, qualifiedName) {
  const header = new RegExp('create (?:or replace )?function ' + escapeRe(qualifiedName) + '\\s*\\(', 'i').exec(sourceText);
  if (!header) throw new Error('SOURCE_FUNCTION_NOT_FOUND:' + qualifiedName);
  const tagMatch = /\$[A-Za-z_]*\$/.exec(sourceText.slice(header.index + header[0].length));
  if (!tagMatch) throw new Error('SOURCE_DELIMITER_NOT_FOUND:' + qualifiedName);
  const tag = tagMatch[0];
  const bodyStart = header.index + header[0].length + tagMatch.index + tag.length;
  const bodyEnd = sourceText.indexOf(tag, bodyStart);
  if (bodyEnd < 0) throw new Error('SOURCE_BODY_NOT_CLOSED:' + qualifiedName);
  return sourceText.slice(bodyStart, bodyEnd);
}
/** A pg_get_functiondef-shaped definition built from a source body (offline tests; the proof reads the real one from the chain). */
export function defFromSource({qualifiedName, args, returns = 'jsonb', body}) {
  return `CREATE OR REPLACE FUNCTION ${qualifiedName}(${args})\n RETURNS ${returns}\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$${body}$function$\n`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The catalog and fixture statements of the proof (all of them are emitted for the pglast syntax check).
// ---------------------------------------------------------------------------------------------------------------------------------
const nonLoginRole = role => {
  if (!['authenticated', 'service_role'].includes(role)) throw new Error('BAD_ROLE');
  return role;
};
const profileKind = kind => {
  if (!['REQUESTER', 'WORKER'].includes(kind)) throw new Error('BAD_PROFILE_KIND');
  return kind;
};
export const CATALOG_SQL = Object.freeze({
  probeDeadlock: () => "begin; set local deadlock_timeout = '1500ms'; rollback;",
  probeRole: role => `begin; set local role ${nonLoginRole(role)}; rollback;`,
  cronJobs: () => 'select jobname, active from cron.job order by jobname',
  cronPause: () => "select cron.alter_job(j.jobid, active := false) from cron.job j where j.active and j.jobname like 'uskoci%'",
  functionRow: signature => `select md5(p.prosrc) as md5, p.prosecdef as secdef, coalesce(array_to_string(p.proconfig, ','), '') as config from pg_proc p where p.oid = to_regprocedure(${sqlLiteral(signature)})`,
  functionDef: signature => `select pg_get_functiondef(to_regprocedure(${sqlLiteral(signature)}))`,
  triggerRow: (schema, relation, trigger) => `select md5(pg_get_triggerdef(t.oid)) as md5 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${sqlLiteral(schema)} and c.relname = ${sqlLiteral(relation)} and t.tgname = ${sqlLiteral(trigger)} and not t.tgisinternal`,
  closureState: () => "select private.closure_source_digest_v5() as live, (select sha256 from private.closure_source_v5 where singleton) as certified, private.retention_ai_source_ready() as ready",
  census: pattern => `select n.nspname || '.' || p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosrc ~* ${sqlLiteral(pattern)} group by 1 order by 1`,
  remaining40001: signatures => `select s as sig from unnest(array[${signatures.map(sqlLiteral).join(', ')}]::text[]) s where (select p.prosrc like '%40001%' from pg_proc p where p.oid = to_regprocedure(s)) is true`,
  scratchSetup: () => `create schema if not exists ${SCRATCH_SCHEMA}; grant usage on schema ${SCRATCH_SCHEMA} to authenticated, service_role;`,
  scratchGrant: (signature, role) => `grant execute on function ${signature} to ${nonLoginRole(role)}`,
  scratchStored: signature => `select md5(prosrc) as md5 from pg_proc where oid = to_regprocedure(${sqlLiteral(signature)})`,
  scratchDrop: () => `drop schema if exists ${SCRATCH_SCHEMA} cascade`,
  profileId: (account, kind) => `select id from public.app_profiles where account_id = ${U(account, 'account')} and kind = ${sqlLiteral(profileKind(kind))}`,
  workerProfileUpdate: profile => `update public.app_profiles set city = 'Novi Sad', skills = '{"Fizicki poslovi"}' where id = ${U(profile, 'profile')}`,
  needInsert: ({id, requester, requesterProfile, title}) => `begin; select set_config('uskoci.need_lifecycle', 'PUBLISH', true);
insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, approximate_city, approximate_area, mode, required_slots, schedule_kind, response_deadline, published_at)
values (${U(id, 'need')}, ${U(requester, 'requester')}, ${U(requesterProfile, 'profile')}, 'PUBLISHED', ${sqlLiteral(title)}, 'Disposable lock-order proof', 'PROOF', 'Novi Sad', 'Liman', 'OFFERS', 1, 'FLEXIBLE', statement_timestamp() + interval '2 days', statement_timestamp());
commit;`,
  uploadBudget: (table, owner) => {
    if (!Object.values(KINDS).some(info => info.table === table)) throw new Error('BAD_TABLE');
    return `select count(*) from ${table} where account_id = ${U(owner, 'owner')} and admitted_at > clock_timestamp() - interval '1 minute'`;
  },
});

/** Every statement the proof can send, for a dummy context (the checker parses them with pglast). */
export function emitSqlTemplates() {
  const u = n => '00000000-0000-4000-8000-00000000000' + n;
  const owner = {id: u(1), session: u(2), claims: {sub: u(1), role: 'authenticated', session_id: u(2)}};
  const base = {owner, conv: u(3), key: u(4), asset: u(5), agreement: u(6), attempt: u(7), prepareId: u(8), sha: 'a'.repeat(64), stageSha: 'b'.repeat(64), cmid: 'ex05_' + 'c'.repeat(32)};
  const out = {};
  for (const [name, statement] of Object.entries(STATEMENTS)) {
    for (const kind of Object.keys(KINDS)) {
      const ctx = {...base, kind};
      try { out[`statement:${name}:${kind}`] = statement.build(ctx); } catch (error) { throw new Error('TEMPLATE_FAILED:' + name + ':' + error.message); }
    }
  }
  for (const [name, gate] of Object.entries(GATES)) {
    for (const kind of Object.keys(KINDS)) out[`gate:${name}:${kind}`] = gate({...base, kind}).join('\n');
  }
  for (const [name, cleanup] of Object.entries(CLEANUPS)) out['cleanup:' + name] = cleanup(base);
  out['state:task'] = taskStateSql(base);
  for (const kind of Object.keys(KINDS)) out['state:' + kind] = agreementStateSql({...base, kind});
  const sig = 'public.rpc_cancel_media_upload(uuid,uuid)';
  out['catalog:probeDeadlock'] = CATALOG_SQL.probeDeadlock();
  out['catalog:probeRole:authenticated'] = CATALOG_SQL.probeRole('authenticated');
  out['catalog:probeRole:service_role'] = CATALOG_SQL.probeRole('service_role');
  out['catalog:cronJobs'] = CATALOG_SQL.cronJobs();
  out['catalog:cronPause'] = CATALOG_SQL.cronPause();
  out['catalog:functionRow'] = CATALOG_SQL.functionRow(sig);
  out['catalog:functionDef'] = CATALOG_SQL.functionDef(sig);
  out['catalog:triggerRow'] = CATALOG_SQL.triggerRow('private', 'owned_media_assets', 'media_evidence_asset_v5');
  out['catalog:closureState'] = CATALOG_SQL.closureState();
  out['catalog:census'] = CATALOG_SQL.census('(update|delete from|insert into)[[:space:]]+private[.](owned_media_assets)');
  out['catalog:remaining40001'] = CATALOG_SQL.remaining40001([sig, 'private.media_task_refs(uuid)']);
  out['catalog:scratchSetup'] = CATALOG_SQL.scratchSetup();
  out['catalog:scratchGrant'] = CATALOG_SQL.scratchGrant('ex05_scratch.rpc_cancel_media_upload_conv_first(uuid,uuid)', 'authenticated');
  out['catalog:scratchStored'] = CATALOG_SQL.scratchStored('ex05_scratch.rpc_cancel_media_upload_conv_first(uuid,uuid)');
  out['catalog:scratchDrop'] = CATALOG_SQL.scratchDrop();
  out['catalog:profileId'] = CATALOG_SQL.profileId(u(1), 'WORKER');
  out['catalog:workerProfileUpdate'] = CATALOG_SQL.workerProfileUpdate(u(2));
  out['catalog:needInsert'] = CATALOG_SQL.needInsert({id: u(3), requester: u(1), requesterProfile: u(2), title: 'EX-05 S02 voice'});
  for (const kind of Object.keys(KINDS)) out['catalog:uploadBudget:' + kind] = CATALOG_SQL.uploadBudget(KINDS[kind].table, u(1));
  out.observe = observeSql();
  out.pid = pidSql('ex05-s02:1:A');
  out['head:postgres'] = sessionHead({app: 'ex05-s02:1:H', role: 'postgres', deadlockMs: 3000}) + readyStatement;
  out['head:authenticated'] = sessionHead({app: 'ex05-s02:1:X', role: 'authenticated', claims: owner.claims, deadlockMs: 3000}) + 'commit;';
  out['head:service_role'] = sessionHead({app: 'ex05-s02:1:Y', role: 'service_role'}) + 'commit;';
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('ex05_s02_sql.mjs') && process.argv.includes('--emit-sql')) {
  process.stdout.write(JSON.stringify(emitSqlTemplates()) + '\n');
}
