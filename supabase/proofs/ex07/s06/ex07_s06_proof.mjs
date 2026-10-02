// EX-07 S06: the displayed name of a safety target (N06/N07 target identity, gap G11). FAIL-BEFORE / PASS-AFTER proof on a disposable DEV-equivalent chain, with actual Auth and PostgREST.
// NOTHING here ran in CI yet (authored offline; the SQL it sends was executed once on an in-process PostgreSQL with the byte-exact DEV bodies, the proof itself was dry-run against that model).
// One process, six phases on ONE chain (source147 -> PKG-050, the unchanged ex04d/ex06a-proven stages 03-18). ONE function body changes (public.rpc_read_safety_target); nothing else.
//   0 CHAIN FIDELITY  every pin the candidate enforces (the target and seven neighbours) is read on the chain and must equal the DEV md5 (never faked: a difference is a finding and stops here); the DEV preflight
//                     file is clean on the chain; the repository files are clean (LF, ASCII, only errcode 55000, no retried serialization code);
//   1 BEFORE          real accounts (the viewer, a person with two ACTIVE faces, a blocked person, a person who blocked the viewer, an account of the other visibility world, a closing account, a blank name,
//                     a draft face): the answer of the predecessor for every call, without any name;
//   2 APPLY           refusals first (a drifted neighbour or target, a drifted attribute, ACL or comment, a drifted relation, a CRLF text, an uncertified closure, a second application, the revert on the
//                     predecessor), each atomic; then the one atomic DO: exactly ONE function changed (its body), nothing added or removed, ACL and attributes equal, the certificate unchanged in all three places;
//   3 AFTER           every call answers exactly as BEFORE plus the key displayName (the name of THE profile asked for, equal to the one rpc_get_public_profile shows for it, null for a blank name), and every
//                     hidden case (blocked in either direction, other world, own and closing accounts, draft face, unknown profile) is still null;
//   4 REVERT          restores the md5 pins, the whole surface and catalog and every answer; then the guarded forms (psql -c, ONE Query message) apply and revert, and a changed byte is refused;
//   5 REAPPLY         the same bytes again: the same surface, catalog and answers as AFTER.
// The documented limitation (the blocked list names a person by the REQUESTER profile first) is OBSERVED at the end, not changed.
// No DEV, provider or device access: closure_runtime.mjs refuses any target that is not the loopback proof stack.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import * as lib from './ex07_s06_lib.mjs';

const md5 = text => createHash('md5').update(text).digest('hex');
const sha = text => createHash('sha256').update(text).digest('hex');

export async function run(rt, options = {}) {
  const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
  const root = options.root ?? '.';
  const read = path => readFileSync(root + '/' + path, 'utf8');
  const TARGET = lib.TARGET;
  const files = {
    candidate: read('supabase/candidates/ex07_safety_target_name.sql'), revert: read('supabase/candidates/ex07_safety_target_name_revert.sql'),
    preflight: read('supabase/proofs/ex07/s06/ex07_s06_preflight.readonly.sql'), postflight: read('supabase/proofs/ex07/s06/ex07_s06_postflight.readonly.sql'),
    plainApply: read('supabase/proofs/ex07/s06/guarded/ex07_safety_target_name.plain_guard.sql'), plainRevert: read('supabase/proofs/ex07/s06/guarded/ex07_safety_target_name_revert.plain_guard.sql'),
  };
  const manifest = JSON.parse(read('supabase/proofs/ex07/s06/ex07_s06_manifest.json'));
  const devBody = read('supabase/proofs/ex07/s06/ex07_s06_dev_body.txt');
  const OLD_MD5 = manifest.pins.oldBodyMd5, NEW_MD5 = manifest.pins.newBodyMd5, NEW_COMMENT_MD5 = manifest.pins.newCommentMd5, OLD_COMMENT_MD5 = manifest.pins.oldCommentMd5;
  const ACL = '{postgres=X/postgres,authenticated=X/postgres}';
  const outDir = options.outDir ?? env.PRE_V3_ARTIFACT_DIR ?? 'artifacts/ex07-s06';
  mkdirSync(outDir, {recursive: true});
  const reportPath = outDir + '/ex07-s06-report.json';
  const report = {package: 'EX-07 S06: the displayed name of a safety target (public.rpc_read_safety_target, function-only, one body)', sourceSha: env.GITHUB_SHA, disposableDbOnly: true, devAccess: false,
    providerCalls: 0, oldMd5: OLD_MD5, newMd5: NEW_MD5, result: 'RUNNING', checks: [], notProven: [
      'behaviour on DEV data (none touched)', 'a phone or any native client (the client change is proved by Jest, not here)', 'the apply_migration guard against the real connector (proved offline against a model of what it sends)',
      'a chain that differs from DEV in any function the pins do not cover (rpc_set_account_block carries the B24 part 1 body on DEV, the chain has the earlier one: used here only to create block states)',
      'the closure certificate VALUE of DEV (the chain\'s own certificate is chain-internal): only that it does not move and stays ready']};
  const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  const pass = name => { report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name); };
  const say = text => console.log(text);

  // ------------------------------------------------------------------ database reads
  const bodyMd5 = async signature => await sql(`select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = ${q(signature)}::regprocedure`);
  const commentOf = async signature => await sql(`select obj_description(${q(signature)}::regprocedure, 'pg_proc')`);
  const aclOf = async signature => await sql(`select proacl::text from pg_proc where oid = ${q(signature)}::regprocedure`);
  const closure = async () => (await rows(`select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified,
    (select sha256 from private.closure_erasure_source_v5 where singleton) erasure, private.retention_ai_source_ready() ready, private.closure_erasure_binding_v5() ->> 'sourceSha256' binding`))[0];
  const surface = async () => (await sql(readFileSync(root + '/supabase/proofs/pkg023/pkg023_surface.sql', 'utf8'))).split('\n').filter(Boolean);
  const catalog = async () => await rows(`select 'function:' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name, md5(replace(p.prosrc, chr(13), '')) as md5
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')
    union all select 'trigger:' || n.nspname || '.' || c.relname || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and not t.tgisinternal order by 1`);
  const counts = async () => (await rows('select (select count(*) from private.account_blocks) blocks, (select count(*) from private.safety_reports) reports'))[0];
  const refused = async (statement, pattern, label) => {
    let error = null;
    try { await sql(statement); } catch (caught) { error = caught; }
    assert.ok(error, 'EXPECTED_REFUSAL: ' + label);
    assert.match(String(error.message), pattern, label);
  };
  // psql -c sends the whole text as ONE Query message, which is what the plain apply-time guard hashes (the proof runtime's own sql() pipes the text through stdin, one statement at a time)
  const psqlC = options.psqlC ?? (text => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-c', text], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000}).trim());
  const refusedC = async (text, pattern, label) => {
    let error = null;
    try { await psqlC(text); } catch (caught) { error = caught; }
    assert.ok(error, 'EXPECTED_REFUSAL: ' + label);
    assert.match(String(error.stderr ?? error.message), pattern, label);
  };

  try {
    // ================================================================ 0 CHAIN FIDELITY
    assert.deepEqual(lib.textProblems(files.candidate, {marker: lib.APPLY_MARKER}), [], 'the candidate text');
    assert.deepEqual(lib.textProblems(files.revert, {marker: lib.REVERT_MARKER}), [], 'the revert text');
    for (const key of ['preflight', 'postflight', 'plainApply', 'plainRevert']) assert.deepEqual(lib.textProblems(files[key]), [], key + ' text');
    assert.equal(md5(devBody), OLD_MD5);
    const anchor = lib.dollarLiteral(files.candidate, 'anchor'), replacement = lib.dollarLiteral(files.candidate, 'replacement');
    assert.equal(md5(devBody.replace(anchor, replacement)), NEW_MD5, 'THE_PINNED_NEW_BODY_IS_WHAT_THE_EDIT_PRODUCES_ON_THE_STORED_DEV_BODY');
    assert.ok(!devBody.includes('40001') && !devBody.replace(anchor, replacement).includes('40001'), 'no retried serialization code in either body');
    const closureBefore = await closure();
    assert.equal(closureBefore.ready, true);
    assert.equal(closureBefore.live, closureBefore.certified); assert.equal(closureBefore.live, closureBefore.erasure); assert.equal(closureBefore.binding, closureBefore.live);
    report.certificateBefore = closureBefore;
    const pins = lib.parsePins(files.candidate);
    assert.equal(pins.length, 8, 'the target and seven neighbours');
    assert.deepEqual(pins[0], {signature: TARGET, md5: OLD_MD5});
    assert.deepEqual(pins.slice(1).map(pin => [pin.signature, pin.md5]), manifest.pins.neighbours);
    report.chainFidelity = [];
    for (const pin of pins) report.chainFidelity.push({signature: pin.signature, pinDevMd5: pin.md5, chainMd5: await bodyMd5(pin.signature)});
    const differing = report.chainFidelity.filter(item => item.pinDevMd5 !== item.chainMd5);
    report.chainFidelityVerdict = differing.length ? 'CHAIN_DIFFERS_FROM_DEV: ' + differing.map(item => item.signature).join('; ') : 'EQUAL: every pin the candidate enforces (the target + seven neighbours) equals the DEV md5 on the chain';
    report.chainNotes = [{signature: 'public.rpc_set_account_block(uuid,boolean,integer,uuid)', devMd5: '8700f2abf73d2d9add5e02b32b28c6bc', chainMd5: await bodyMd5('public.rpc_set_account_block(uuid,boolean,integer,uuid)'),
      note: 'B24 part 1 body on DEV; not pinned, not read or changed by this candidate; used here only to create block states'}];
    save();
    assert.deepEqual(differing, [], 'CHAIN_FIDELITY_FINDING: the chain does not carry the DEV predecessor; the candidate (exact pins) cannot be proven on it, and nothing is faked');
    assert.equal(await commentOf(TARGET), lib.dollarLiteral(files.revert, 'old_comment'), 'THE_COMMENT_IS_THE_DEV_COMMENT');
    assert.equal(md5(await commentOf(TARGET)), OLD_COMMENT_MD5);
    assert.equal(await aclOf(TARGET), ACL);
    const flightBefore = JSON.parse(await sql(files.preflight));
    assert.deepEqual(flightBefore.problems, [], 'THE_DEV_PREFLIGHT_IS_CLEAN_ON_THE_CHAIN: ' + JSON.stringify(flightBefore.problems));
    assert.deepEqual(flightBefore.informational, []); assert.equal(flightBefore.pinsChecked, 8);
    report.preflight = flightBefore;
    const surfaceBefore = await surface(), catalogBefore = await catalog();
    pass('CHAIN_PREDECESSORS_EQUAL_THE_DEV_PINS_THE_PREFLIGHT_IS_CLEAN_AND_THE_REPOSITORY_FILES_ARE_CLEAN');
    // Digest neutrality is asserted here, not assumed: the target is no trigger function and no function the closure digest concatenates names it (the chain may not carry every one of the seven that DEV carries)
    const certificateNames = ['closure_source_digest_v5', 'closure_erasure_program_digest_v5', 'closure_schema_digest_v5_139', 'closure_erasure_binding_v5', 'agreement_invalidation_surface_v1', 'agreement_voice_surface_v1', 'retention_ai_source_ready'];
    const naming = await rows(`select p.proname, position('rpc_read_safety_target' in p.prosrc) as named_at from pg_proc p where p.pronamespace = 'private'::regnamespace
      and p.proname in (${certificateNames.map(name => q(name)).join(', ')}) order by 1`);
    report.certificateFunctionsOnTheChain = naming.map(row => row.proname);
    assert.ok(['closure_source_digest_v5', 'retention_ai_source_ready', 'closure_erasure_program_digest_v5'].every(name => report.certificateFunctionsOnTheChain.includes(name)), 'THE_CHAIN_CARRIES_THE_CERTIFICATE_FUNCTIONS');
    assert.ok(naming.every(row => Number(row.named_at) === 0), 'NO_CERTIFICATE_FUNCTION_NAMES_THE_TARGET: ' + JSON.stringify(naming));
    assert.equal(await sql(`select count(*) from pg_trigger where tgfoid = ${q(TARGET)}::regprocedure`), '0');
    assert.equal(await sql(`select position('${'rpc_read_safety_target'}' in prosrc) from pg_proc where oid = 'private.closure_source_digest_v5()'::regprocedure`), '0');
    pass('THE_TARGET_IS_NOT_A_TRIGGER_FUNCTION_AND_NO_FUNCTION_OF_THE_CLOSURE_DIGEST_NAMES_IT');

    // ================================================================ 1 BEFORE
    // Real accounts. Every account is born with a REQUESTER face (ACTIVE at once) and a WORKER face (a DRAFT until its owner completes it).
    const viewer = await rt.actor('ex07s06-viewer'), person = await rt.actor('ex07s06-person'), blockedPerson = await rt.actor('ex07s06-blocked');
    const blocker = await rt.actor('ex07s06-blocker'), otherWorld = await rt.actor('ex07s06-other-world'), closing = await rt.actor('ex07s06-closing');
    const blank = await rt.actor('ex07s06-blank'), draft = await rt.actor('ex07s06-draft');
    const faces = async id => Object.fromEntries((await rows(`select kind, id, profile_status status from public.app_profiles where account_id = ${q(id)}`)).map(row => [row.kind, row]));
    const F = {};
    for (const [key, actor] of Object.entries({viewer, person, blockedPerson, blocker, otherWorld, closing, blank, draft})) {
      F[key] = await faces(actor.id);
      assert.deepEqual(Object.keys(F[key]).sort(), ['REQUESTER', 'WORKER'], key + ' has two faces');
      assert.equal(F[key].REQUESTER.status, 'ACTIVE'); assert.equal(F[key].WORKER.status, 'DRAFT');
    }
    // the names (set as the database owner: the guard that keeps a REQUESTER name behind its authority only refuses the `authenticated` role); a BLANK name is spaces only, which btrim removes
    const NAMES = {viewer: 'Viktor Gledalac', personRequester: 'Ana Naručiteljka', personWorker: 'Ana Majstor', blockedPerson: 'Xenija Blokirana', blocker: 'Yuri Blokirao',
      otherWorld: 'Wanda Test', closing: 'Cvetko Odlazi', blank: '   ', draftRequester: 'Dara Naručiteljka', draftWorker: 'Dara Nacrt'};
    const setName = async (profileId, name) => { await sql(`update public.app_profiles set display_name = ${q(name)} where id = ${q(profileId)}`); };
    await setName(F.viewer.REQUESTER.id, NAMES.viewer); await setName(F.person.REQUESTER.id, NAMES.personRequester);
    await setName(F.blockedPerson.REQUESTER.id, NAMES.blockedPerson); await setName(F.blocker.REQUESTER.id, NAMES.blocker); await setName(F.otherWorld.REQUESTER.id, NAMES.otherWorld);
    await setName(F.closing.REQUESTER.id, NAMES.closing); await setName(F.blank.REQUESTER.id, NAMES.blank); await setName(F.draft.REQUESTER.id, NAMES.draftRequester); await setName(F.draft.WORKER.id, NAMES.draftWorker);
    // the person's WORKER face becomes ACTIVE through the product path (as the PKG-050 proof does), so the same person shows two faces with two names
    await sql(`update public.app_profiles set city = 'Novi Sad', skills = '{"Fizicki poslovi"}' where id = ${q(F.person.WORKER.id)};`);
    await ok(person.client.rpc('rpc_complete_worker_profile', {p_profile_id: F.person.WORKER.id}));
    await setName(F.person.WORKER.id, NAMES.personWorker);
    F.person = await faces(person.id);
    assert.equal(F.person.WORKER.status, 'ACTIVE');
    assert.equal(await sql(`select display_name from public.app_profiles where id = ${q(F.person.WORKER.id)}`), NAMES.personWorker);
    assert.equal(await sql(`select display_name from public.app_profiles where id = ${q(F.person.REQUESTER.id)}`), NAMES.personRequester);
    // the other visibility world (a synthetic acceptance fixture), blocks in both directions (through the product path) and a closing account (a closure request in READY)
    await sql(`insert into private.account_lineage_v5(account_id, lineage, reason, source_ref) values (${q(otherWorld.id)}, 'SYNTHETIC_ACCEPTANCE_FIXTURE', 'EX-07 S06 proof: the other visibility world', 'ex07-s06-proof')`);
    assert.equal(await sql(`select private.accounts_same_world(${q(viewer.id)}, ${q(otherWorld.id)})`), 'f');
    assert.equal(await sql(`select private.accounts_same_world(${q(viewer.id)}, ${q(person.id)})`), 't');
    const setBlock = (actor, target, blocked, revision) => ok(actor.client.rpc('rpc_set_account_block', {p_target_account_id: target.id, p_blocked: blocked, p_expected_revision: revision, p_client_request_id: randomUUID()}));
    assert.equal((await setBlock(viewer, blockedPerson, true, 0)).blocked, true);
    assert.equal((await setBlock(blocker, viewer, true, 0)).blocked, true);
    await sql(`insert into private.account_closure_requests(account_id, state, revision) values (${q(closing.id)}, 'READY', 1)`);
    assert.equal(await sql(`select private.closure_account_restricted(${q(closing.id)})`), 't');
    const unknownProfile = randomUUID();
    // every call, who makes it and what it should be: `visible` is the expectation of the PUBLIC PROFILE reader (the authority the target repeats), `name` the stored name of the asked-for profile
    const scenarios = [
      {id: 'PERSON_REQUESTER_FACE', caller: viewer, profile: F.person.REQUESTER.id, target: true, name: NAMES.personRequester},
      {id: 'PERSON_WORKER_FACE', caller: viewer, profile: F.person.WORKER.id, target: true, name: NAMES.personWorker},
      {id: 'BLANK_NAME', caller: viewer, profile: F.blank.REQUESTER.id, target: true, name: NAMES.blank},
      {id: 'DRAFT_FACE', caller: viewer, profile: F.draft.WORKER.id, target: false},
      {id: 'OWN_PROFILE', caller: viewer, profile: F.viewer.REQUESTER.id, target: false, ownProfile: true},
      {id: 'BLOCKED_BY_THE_CALLER', caller: viewer, profile: F.blockedPerson.REQUESTER.id, target: false},
      {id: 'THE_BLOCKED_PERSON_READS_THE_BLOCKER', caller: blockedPerson, profile: F.viewer.REQUESTER.id, target: false},
      {id: 'THE_PROFILE_OF_SOMEONE_WHO_BLOCKED_THE_CALLER', caller: viewer, profile: F.blocker.REQUESTER.id, target: false},
      {id: 'OTHER_WORLD_TARGET', caller: viewer, profile: F.otherWorld.REQUESTER.id, target: false},
      {id: 'OTHER_WORLD_CALLER', caller: otherWorld, profile: F.viewer.REQUESTER.id, target: false},
      {id: 'CLOSING_TARGET', caller: viewer, profile: F.closing.REQUESTER.id, target: false},
      {id: 'CLOSING_CALLER_THE_FUNCTION_ITSELF', caller: closing, profile: F.viewer.REQUESTER.id, target: false, direct: true},
      {id: 'UNKNOWN_PROFILE', caller: viewer, profile: unknownProfile, target: false},
    ];
    const readTarget = async scenario => {
      if (scenario.direct) {
        const line = lib.lastLine(await sql(lib.asAccountSql(scenario.caller.id, `select coalesce(public.rpc_read_safety_target(${q(scenario.profile)}::uuid)::text, 'null')`, q)));
        return JSON.parse(line);
      }
      return await ok(scenario.caller.client.rpc('rpc_read_safety_target', {p_profile_id: scenario.profile}));
    };
    const readAll = async () => { const out = {}; for (const scenario of scenarios) out[scenario.id] = await readTarget(scenario); return out; };
    const publicProfile = (actor, profileId) => ok(actor.client.rpc('rpc_get_public_profile', {p_profile_id: profileId}));
    // the independent authority: the public profile agrees with every scenario's expectation of visibility (so the fixtures are what they claim to be)
    for (const scenario of scenarios.filter(item => !item.direct)) {
      const visible = (await publicProfile(scenario.caller, scenario.profile)) !== null;
      assert.equal(visible, scenario.target || scenario.ownProfile === true, 'SETUP_PUBLIC_PROFILE_VISIBILITY ' + scenario.id);
    }
    const before = await readAll();
    for (const scenario of scenarios) {
      if (scenario.target) {
        assert.deepEqual(Object.keys(before[scenario.id]).sort(), lib.OLD_KEYS, 'BEFORE_KEYS ' + scenario.id);
        assert.equal(before[scenario.id].targetAccountId, {PERSON_REQUESTER_FACE: person, PERSON_WORKER_FACE: person, BLANK_NAME: blank}[scenario.id].id);
      } else assert.equal(before[scenario.id], null, 'BEFORE_NULL ' + scenario.id);
    }
    report.before = before;
    // what the closing account sees through PostgREST is recorded, not asserted: the pre-request guard of a restricted account refuses most calls before the function is reached
    const viaRest = await closing.client.rpc('rpc_read_safety_target', {p_profile_id: F.viewer.REQUESTER.id});
    report.closingCallerThroughPostgrest = {error: viaRest.error ? {code: viaRest.error.code, message: String(viaRest.error.message).slice(0, 120)} : null, data: viaRest.data ?? null};
    assert.ok(viaRest.error || viaRest.data === null, 'a closing caller never gets a target, through PostgREST either');
    pass('BEFORE_THE_PREDECESSOR_ANSWERS_WITHOUT_A_NAME_AND_EVERY_HIDDEN_CASE_IS_NULL');
    await refused(files.revert, /EX07S06_REVERT_STATE_NOT_THE_APPLIED_ONE/, 'the revert on the predecessor');
    assert.deepEqual(await surface(), surfaceBefore); assert.equal(await bodyMd5(TARGET), OLD_MD5);
    pass('REVERT_REFUSES_ON_THE_PREDECESSOR_ATOMICALLY');

    // ================================================================ 2 APPLY
    const intact = async label => {
      assert.deepEqual(await surface(), surfaceBefore, label + ': surface');
      assert.equal(await bodyMd5(TARGET), OLD_MD5, label + ': body'); assert.equal(await commentOf(TARGET), lib.dollarLiteral(files.revert, 'old_comment'), label + ': comment');
      assert.equal(await aclOf(TARGET), ACL, label + ': acl'); assert.deepEqual(await closure(), closureBefore, label + ': certificate');
    };
    for (const pin of pins) {
      const drifted = lib.tamperPin(files.candidate, pin.signature);
      assert.notEqual(drifted, files.candidate);
      await refused(drifted, new RegExp('EX07S06_PREDECESSOR_DRIFT: ' + pin.signature.split('(')[0].replace(/\./g, '\\.')), 'drift of ' + pin.signature);
    }
    await intact('every pin drifted in turn');
    pass('PREDECESSOR_DRIFT_REFUSED_ATOMICALLY_FOR_THE_TARGET_AND_FOR_EACH_OF_THE_SEVEN_NEIGHBOURS');
    await refused(files.candidate.replace(/\n/g, '\r\n'), /EX07S06_CRLF_TEXT/, 'a CRLF text');
    await intact('a CRLF text');
    pass('A_CRLF_TEXT_IS_REFUSED_ATOMICALLY');
    // states the candidate must refuse, made inside a transaction that is never committed
    await refused(`begin; alter function ${TARGET} volatile; ${files.candidate}\nrollback;`, /EX07S06_TARGET_ATTRIBUTE_DRIFT/, 'an attribute drift');
    await refused(`begin; grant execute on function ${TARGET} to anon; ${files.candidate}\nrollback;`, /EX07S06_TARGET_ATTRIBUTE_DRIFT/, 'an ACL drift');
    await refused(`begin; comment on function ${TARGET} is 'drifted'; ${files.candidate}\nrollback;`, /EX07S06_TARGET_ATTRIBUTE_DRIFT/, 'a comment drift');
    await refused(`begin; alter table public.app_profiles rename column display_name to display_label; ${files.candidate}\nrollback;`, /EX07S06_RELATION_DRIFT/, 'a relation drift');
    await refused(`begin; set local session_replication_role = replica; update private.closure_source_v5 set sha256 = repeat('0', 64) where singleton; ${files.candidate}\nrollback;`, /EX07S06_CLOSURE_NOT_READY/, 'an uncertified closure');
    await intact('the states the candidate refuses');
    pass('ATTRIBUTE_ACL_COMMENT_RELATION_AND_CERTIFICATE_DRIFT_REFUSED_ATOMICALLY');

    await sql(files.candidate);
    report.candidateSha256 = sha(files.candidate.replace(/\n$/, '')); report.revertSha256 = sha(files.revert.replace(/\n$/, ''));
    await refused(files.candidate, /EX07S06_ALREADY_APPLIED/, 'a second application');
    pass('APPLIED_ONCE_SECOND_RUN_REFUSED');
    assert.equal(await bodyMd5(TARGET), NEW_MD5);
    const surfaceAfter = await surface(), catalogAfter = await catalog();
    const surfaceDelta = lib.surfaceDelta(surfaceBefore, surfaceAfter);
    assert.equal(surfaceDelta.onlyBodiesChanged, true, 'EXACTLY_ONE_BODY_CHANGED_AND_ONLY_ITS_MD5');
    assert.deepEqual(surfaceDelta.names, ['public.rpc_read_safety_target(p_profile_id uuid)']);
    report.surfaceRemoved = surfaceDelta.removed; report.surfaceAdded = surfaceDelta.added;
    const catalogDelta = lib.diffNamed(catalogBefore, catalogAfter);
    assert.deepEqual([catalogDelta.added, catalogDelta.removed], [[], []]);
    assert.deepEqual(catalogDelta.changed, [{name: 'function:public.rpc_read_safety_target(p_profile_id uuid)', before: OLD_MD5, after: NEW_MD5}]);
    report.catalogChanged = catalogDelta.changed;
    pass('EXACTLY_ONE_FUNCTION_CHANGED_NOTHING_ADDED_NOTHING_REMOVED_ATTRIBUTES_AND_ACL_EQUAL');
    assert.equal(md5(await commentOf(TARGET)), NEW_COMMENT_MD5); assert.equal(await commentOf(TARGET), lib.dollarLiteral(files.candidate, 'new_comment'));
    assert.equal(await aclOf(TARGET), ACL);
    assert.equal(await sql(`select has_function_privilege('anon', ${q(TARGET)}, 'EXECUTE')::text || has_function_privilege('authenticated', ${q(TARGET)}, 'EXECUTE')::text || has_function_privilege('service_role', ${q(TARGET)}, 'EXECUTE')::text`), 'falsetruefalse');
    const attributes = (await rows(`select prosecdef, provolatile, proconfig::text config, proowner::regrole::text owner, prorettype::regtype::text rettype from pg_proc where oid = ${q(TARGET)}::regprocedure`))[0];
    assert.deepEqual(attributes, {prosecdef: true, provolatile: 's', config: '{search_path=pg_catalog}', owner: 'postgres', rettype: 'jsonb'});
    pass('COMMENT_ACL_AND_ATTRIBUTES_AS_WRITTEN');
    assert.deepEqual(await closure(), closureBefore);
    pass('CERTIFICATE_UNCHANGED_AND_READY_IN_ALL_THREE_PLACES_AND_THE_BINDING');
    const flightAfter = JSON.parse(await sql(files.postflight));
    assert.deepEqual(flightAfter.problems, []); assert.deepEqual(flightAfter.informational, []); assert.equal(flightAfter.pinsChecked, 8);
    report.postflight = flightAfter;
    assert.deepEqual(JSON.parse(await sql(files.preflight)).problems.map(problem => problem.kind).sort(), ['ALREADY_APPLIED', 'TARGET_ATTRIBUTES'], 'the preflight says the state is already the applied one');
    pass('DEV_POSTFLIGHT_FILE_EMPTY_ON_THE_CHAIN');
    await refused(files.revert.replace(/\n/g, '\r\n'), /EX07S06_REVERT_CRLF_TEXT/, 'a CRLF revert');
    assert.equal(await bodyMd5(TARGET), NEW_MD5);
    pass('A_CRLF_REVERT_IS_REFUSED_ATOMICALLY');

    // ================================================================ 3 AFTER
    const after = await readAll();
    report.after = after;
    const names = Object.fromEntries(scenarios.map(scenario => [scenario.id, scenario.name]));
    for (const scenario of scenarios) {
      assert.deepEqual(lib.answerDiff(lib.withName(before[scenario.id], names[scenario.id]), after[scenario.id]), [], 'AFTER_EQUALS_BEFORE_PLUS_THE_NAME ' + scenario.id);
      if (scenario.target) assert.deepEqual(Object.keys(after[scenario.id]).sort(), lib.NEW_KEYS, 'AFTER_KEYS ' + scenario.id); else assert.equal(after[scenario.id], null, 'AFTER_NULL ' + scenario.id);
    }
    pass('AFTER_EVERY_CALL_ANSWERS_AS_BEFORE_PLUS_THE_KEY_DISPLAYNAME_AND_EVERY_HIDDEN_CASE_IS_STILL_NULL');
    const byId = Object.fromEntries(scenarios.map(scenario => [scenario.id, scenario]));
    for (const id of ['PERSON_REQUESTER_FACE', 'PERSON_WORKER_FACE', 'BLANK_NAME']) {
      const shown = (await publicProfile(byId[id].caller, byId[id].profile)).displayName;
      assert.equal(after[id].displayName, shown, 'THE_NAME_EQUALS_THE_ONE_THE_PUBLIC_PROFILE_SHOWS ' + id);
    }
    assert.equal(after.PERSON_REQUESTER_FACE.displayName, 'Ana Naručiteljka'); assert.equal(after.PERSON_WORKER_FACE.displayName, 'Ana Majstor');
    assert.equal(after.PERSON_REQUESTER_FACE.targetAccountId, person.id); assert.equal(after.PERSON_WORKER_FACE.targetAccountId, person.id);
    assert.notEqual(after.PERSON_REQUESTER_FACE.displayName, after.PERSON_WORKER_FACE.displayName);
    pass('THE_NAME_IS_THE_NAME_OF_THE_PROFILE_ASKED_FOR_NEVER_ANOTHER_FACE_AND_EQUALS_THE_PUBLIC_PROFILE');
    assert.equal(after.BLANK_NAME.displayName, null); assert.equal(after.BLANK_NAME.targetAccountId, blank.id);
    assert.equal((await publicProfile(viewer, F.blank.REQUESTER.id)).displayName, null);
    pass('A_BLANK_NAME_IS_NULL_IN_BOTH_AND_THE_TARGET_STILL_RESOLVES');
    for (const id of ['OWN_PROFILE', 'BLOCKED_BY_THE_CALLER', 'THE_BLOCKED_PERSON_READS_THE_BLOCKER', 'THE_PROFILE_OF_SOMEONE_WHO_BLOCKED_THE_CALLER', 'OTHER_WORLD_TARGET', 'OTHER_WORLD_CALLER',
      'CLOSING_TARGET', 'CLOSING_CALLER_THE_FUNCTION_ITSELF', 'DRAFT_FACE', 'UNKNOWN_PROFILE']) assert.equal(after[id], null, id);
    pass('OWN_BLOCKED_BOTH_WAYS_OTHER_WORLD_CLOSING_DRAFT_AND_UNKNOWN_ARE_STILL_NULL');
    const written = await counts();
    for (let index = 0; index < 5; index++) { await readTarget(byId.PERSON_REQUESTER_FACE); await readTarget(byId.BLANK_NAME); }
    assert.deepEqual(await counts(), written);
    assert.deepEqual(await closure(), closureBefore);
    pass('THE_READER_WRITES_NOTHING_AND_THE_CERTIFICATE_IS_UNMOVED');
    await denied(rt.anon.rpc('rpc_read_safety_target', {p_profile_id: F.person.REQUESTER.id}));
    await denied(rt.service.rpc('rpc_read_safety_target', {p_profile_id: F.person.REQUESTER.id}));
    pass('ANONYMOUS_AND_SERVICE_CALLERS_ARE_STILL_REFUSED');
    const codes = lib.errcodes(files.candidate + files.revert + files.plainApply + files.plainRevert);
    assert.ok(codes.length > 20 && codes.every(code => code === '55000'), 'every refusal of the candidate and its revert raises errcode 55000 only');
    assert.ok(![files.candidate, files.revert, devBody, devBody.replace(anchor, replacement)].some(text => /errcode\s*=\s*'40001'/.test(text)), 'a deterministic conflict raises PT409 and nothing here raises a retried serialization failure');
    assert.ok(!(await sql(`select prosrc from pg_proc where oid = ${q(TARGET)}::regprocedure`)).includes('40001'), 'the applied body names no retried serialization failure');
    pass('ERRCODES_ARE_55000_ONLY_AND_NOTHING_RAISES_A_RETRIED_SERIALIZATION_FAILURE');

    // ================================================================ 4 REVERT
    await sql(files.revert);
    assert.equal(await bodyMd5(TARGET), OLD_MD5); assert.equal(md5(await commentOf(TARGET)), OLD_COMMENT_MD5);
    assert.deepEqual(await surface(), surfaceBefore, 'THE_WHOLE_SURFACE_IS_RESTORED_EXACTLY');
    assert.deepEqual(await catalog(), catalogBefore, 'THE_WHOLE_CATALOG_IS_RESTORED_EXACTLY');
    assert.deepEqual(await closure(), closureBefore);
    await refused(files.revert, /EX07S06_REVERT_STATE_NOT_THE_APPLIED_ONE/, 'a second revert');
    pass('REVERT_RESTORES_THE_MD5_PINS_THE_SURFACE_AND_THE_CATALOG_AND_REFUSES_TO_RUN_TWICE');
    const reverted = await readAll();
    for (const scenario of scenarios) assert.deepEqual(lib.answerDiff(before[scenario.id], reverted[scenario.id]), [], 'REVERTED_EQUALS_BEFORE ' + scenario.id);
    assert.equal(await sql(`select (prosrc = ${q(devBody)})::text from pg_proc where oid = ${q(TARGET)}::regprocedure`), 'true', 'RESTORED_BYTE_FOR_BYTE');
    pass('REVERTED_EVERY_ANSWER_EQUALS_THE_BEFORE_ANSWER_AND_THE_BODY_IS_THE_DEV_BODY_BYTE_FOR_BYTE');
    // the guarded forms: ONE Query message (psql -c), the database hashes the statement it received
    await psqlC(files.plainApply);
    assert.equal(await bodyMd5(TARGET), NEW_MD5);
    await psqlC(files.plainRevert);
    assert.equal(await bodyMd5(TARGET), OLD_MD5);
    await psqlC(files.plainApply + '\n-- source: POST /mcp\n-- user: proof\n');
    assert.equal(await bodyMd5(TARGET), NEW_MD5, 'a connector trailer comment is accepted');
    await psqlC(files.plainRevert.replace(/\n$/, ''));
    assert.equal(await bodyMd5(TARGET), OLD_MD5, 'a missing final line feed is accepted');
    await refusedC(files.plainApply.replace('lock_timeout', 'lock_timeoyt'), /EX07S06_APPLY_TEXT_INTEGRITY/, 'one changed byte');
    await refusedC(files.plainApply + 'select 1;', /EX07S06_APPLY_TEXT_INTEGRITY/, 'a statement after the candidate');
    await refusedC(' ' + files.plainApply, /EX07S06_APPLY_TEXT_INTEGRITY/, 'a shifted start');
    assert.equal(await bodyMd5(TARGET), OLD_MD5);
    assert.deepEqual(await surface(), surfaceBefore); assert.deepEqual(await closure(), closureBefore);
    pass('THE_GUARDED_FORMS_APPLY_AND_REVERT_THROUGH_ONE_QUERY_MESSAGE_AND_A_CHANGED_TEXT_IS_REFUSED');

    // ================================================================ 5 REAPPLY
    await sql(files.candidate);
    assert.equal(await bodyMd5(TARGET), NEW_MD5);
    assert.deepEqual(await surface(), surfaceAfter, 'REAPPLY_PRODUCES_THE_SAME_SURFACE');
    assert.deepEqual(await catalog(), catalogAfter, 'REAPPLY_PRODUCES_THE_SAME_CATALOG');
    assert.deepEqual(await closure(), closureBefore);
    const flightAgain = JSON.parse(await sql(files.postflight));
    assert.deepEqual([flightAgain.problems, flightAgain.informational], [[], []]);
    const again = await readAll();
    for (const scenario of scenarios) assert.deepEqual(lib.answerDiff(after[scenario.id], again[scenario.id]), [], 'REAPPLIED_EQUALS_AFTER ' + scenario.id);
    pass('REAPPLY_AGAIN_EQUAL_SURFACE_CATALOG_POSTFLIGHT_AND_EVERY_ANSWER');

    // ================================================================ the documented limitation, observed (not changed)
    assert.equal((await setBlock(viewer, person, true, 0)).blocked, true);
    const list = await ok(viewer.client.rpc('rpc_list_my_account_blocks', {p_after: null}));
    const item = list.items.find(entry => entry.targetAccountId === person.id);
    assert.ok(item, 'the blocked person is listed');
    report.limitation = {blockedListName: item.displayName, requesterFaceTargetName: after.PERSON_REQUESTER_FACE.displayName, workerFaceTargetName: after.PERSON_WORKER_FACE.displayName,
      rule: 'rpc_list_my_account_blocks names a blocked person by the REQUESTER profile first (order by p.kind limit 1), so it can differ from the face the blocker saw; changing it needs a column and so a certificate re-bind: documented, not part of S06',
      differsFromTheWorkerFaceThatWasSeen: item.displayName !== after.PERSON_WORKER_FACE.displayName};
    assert.equal(item.displayName, after.PERSON_REQUESTER_FACE.displayName);
    assert.equal(report.limitation.differsFromTheWorkerFaceThatWasSeen, true);
    assert.equal(await readTarget(byId.PERSON_REQUESTER_FACE), null); assert.equal(await readTarget(byId.PERSON_WORKER_FACE), null);
    assert.deepEqual(await closure(), closureBefore);
    pass('THE_BLOCKED_LIST_KEEPS_ITS_REQUESTER_FIRST_NAME_RULE_A_DOCUMENTED_LIMITATION_AND_A_BLOCKED_PERSON_IS_NO_TARGET');
    report.certificateAfter = await closure();
    report.result = 'PASS'; save();
    say('RESULT PASS | checks ' + report.checks.length + ' | chain ' + report.chainFidelityVerdict);
    return report;
  } catch (error) {
    report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save();
    throw error;
  }
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const rt = await import('../../pre_v3/closure_runtime.mjs');
  rt.assert.equal(rt.env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
  rt.assert.equal(rt.env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  run(rt).catch(error => { console.error(String(error?.stack ?? error).slice(0, 4000)); process.exit(1); });
}
