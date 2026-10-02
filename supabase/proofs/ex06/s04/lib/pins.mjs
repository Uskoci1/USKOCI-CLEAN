// EX-06 S04: the DEV pins of the dispatch lifecycle and the CHAIN-FIDELITY gate that compares the disposable chain with them. Pure module (no database): the proof hands it the rows of s04PinQuery().
//
// What a pin is. md5 over prosrc with carriage returns removed (the S01 convention: md5(replace(prosrc, E'\r', ''))). One pin names ONE function body of canonical DEV. They were read
// by read-only SELECT on canonical DEV at the time DEV_READ says, NOT taken from the S01 baseline (2026-10-01, ledger 219): since then ex06a (ledger 220: two matcher bodies) and D12
// (ledger 221) were applied, so every pin was read again. Eleven of the twelve CORE pins are unchanged since S01; private.match_detail_without_calendar is the ex06a body.
//
// Tiers.
//   CORE           the twelve bodies the S03 corpus proof and the ex06a proof already proved equal to DEV on the chain (the chain carries the ex06a bodies only after the workflow applies
//                  supabase/candidates/ex06a_flexible_window.sql, exactly as DEV did). A difference makes the whole run CHAIN_DIFFERS (exit 1).
//   SUPPORTING     the other bodies a case or a probe of S04 depends on (the lifecycle writers, the safety and closure guards, the inbox and push gates). Expected equal, not yet read from a
//                  run (proven: EXPECTED) except the five availability helpers the ex06a candidate already pinned (proven: CI). A difference is fatal in strict mode (the default) and a
//                  loud warning in report mode (EX06_S04_PINS=report: for an exploratory re-run that must still show every case).
//   INFORMATIONAL  helpers and the production tick: compared and listed, never fatal.
// A difference is explained only when it is NAMED: a B24 part 1 target whose chain body turns into the DEV body when the quoted '40001' becomes 'PT409' (B24 part 1 was applied to DEV on
// 2026-09-30, the chain stops before it). Nothing else is explained; every other difference is reported as unexplained and makes the run fail loudly.
import {bodyQuery} from '../../lib/pins.mjs';

export const DEV_READ = Object.freeze({
  project: 'leqcwgzvjsxugfgzdmth',
  readAtUtc: '2026-10-02 08:55',
  ledger: 221,
  confirmedAtUtc: '2026-10-02 10:00',   // all 60 pins read again, read-only, one SELECT comparing them with this table: 60 equal, 0 differ, 0 ambiguous, ledger still 221
  closureDigest: '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431',
  how: 'read-only SELECT through the Supabase connector (pg_proc.prosrc md5, carriage returns removed); no write, no personal data, no user text',
  convention: "md5(replace(prosrc, E'\\r', ''))",
});

const CI_PROVEN = new Set(['private.match_detail', 'private.match_detail_for_calendar_interval', 'private.match_detail_without_calendar', 'private.worker_dispatch_time_admitted',
  'private.dispatch_next_wave', 'private.dispatch_tick', 'private.dispatch_cheap_candidate_admitted', 'private.candidate_profile_ids', 'private.emit_event', 'private.push_suppression',
  'private.work_kinds_v5', 'private.requeue_open_needs_for_worker_v5', 'private.schedule_fit', 'private.availability_is_future', 'private.availability_timezone_valid',
  'private.worker_available_periods', 'private.worker_calendar_conflict']);

const EQUAL = Object.freeze({expect: 'EQUAL'});
const AFTER_EX06A = Object.freeze({expect: 'AFTER_EX06A'});
const b24 = preImageDev => Object.freeze({expect: 'B24_PART1', preImageDev});
function pin(name, nargs, md5, tier, role, use, chain = EQUAL) {
  return Object.freeze({name, nargs, md5, tier, role, use, chain, proven: CI_PROVEN.has(name) ? 'CI' : 'EXPECTED'});
}

export const S04_PINS = Object.freeze([
  // ---- CORE
  pin('private.match_detail', 2, '38c7894a8cf43a8f32bd5a30bc2cbd09', 'CORE', 'MATCH', 'the matcher the wave calls per candidate'),
  pin('private.match_detail_for_calendar_interval', 4, '781956cab666befab216b3ce2334ca1d', 'CORE', 'MATCH', 'calendar conflict for fixed windows'),
  pin('private.match_detail_without_calendar', 2, 'c8aaf3da761242397243fc56262d1aeb', 'CORE', 'MATCH', 'hard and soft gates, score (the ex06a body)', AFTER_EX06A),
  pin('private.worker_dispatch_time_admitted', 2, '4f0beb65922d2b3d947d69e68a56a956', 'CORE', 'MATCH', 'availability for the task window incl. the ex06a derived window', AFTER_EX06A),
  pin('private.dispatch_next_wave', 1, '1fd8c51ef026ece24471e2f68250ecc5', 'CORE', 'DISPATCH', 'one wave: open check, slots, target, sizes, deliveries, events'),
  pin('private.dispatch_tick', 2, 'e568b033b9457736869fc5829ffc5511', 'CORE', 'DISPATCH', 'claims due schedule rows, runs waves, backoff'),
  pin('private.dispatch_cheap_candidate_admitted', 2, '0132fae38c75947179b4d389edc1e1f0', 'CORE', 'DISPATCH', 'the candidate admission (world, status, own task, skills, resources, no earlier delivery)'),
  pin('private.candidate_profile_ids', 2, 'dca4ddc8080a52c8af83c33689c5568e', 'CORE', 'DISPATCH', 'bounded candidate retrieval'),
  pin('private.emit_event', 12, '67413effbbb3fa227397d355e0d4edfb', 'CORE', 'EVENT', 'durable event, IN_APP and PUSH delivery rows, role inheritance, quiet hours at emit'),
  pin('private.push_suppression', 1, '0e0277608bf40f3cccc3575a77b1c23d', 'CORE', 'PUSH', 'the sender gate at claim time (exact role, quiet hours, closure, block)'),
  pin('private.work_kinds_v5', 1, '2113eb46ab7ea968b873e76d1de12377', 'CORE', 'MATCH', 'hidden work kinds (the service and exclusion gates)'),
  pin('private.requeue_open_needs_for_worker_v5', 1, '371bb38ea1d7180ca6222409f1a9a591', 'CORE', 'DISPATCH', 'requeue of the open tasks after a worker write'),
  // ---- SUPPORTING: the queue and the lifecycle
  pin('private.candidate_budget', 3, '0ba935bd0a253c7653686cb1823ff391', 'SUPPORTING', 'DISPATCH', 'candidate limit of a wave'),
  pin('private.enqueue_dispatch', 2, '470ed6ab6501c69bf9ebbfe057ccd0fb', 'SUPPORTING', 'DISPATCH', 'the schedule insert (keeps the earlier run time)'),
  pin('private.enqueue_on_need_change', 0, 'a0f65116a72c779634d9a85baf4c7a23', 'SUPPORTING', 'DISPATCH', 'trigger: enqueue on publish / revision, dequeue on a closing status'),
  pin('private.after_need_revision', 0, '645eb3b7dbcc4ec37df8e5298a382d5f', 'SUPPORTING', 'LIFECYCLE', 'trigger: a revision bump expires the old deliveries and stops the rounds'),
  pin('private.expire_lifecycle', 1, '2e13f16eb5f760c1a8a3ebbf59fb60a9', 'SUPPORTING', 'LIFECYCLE', 'expiry of tasks, deliveries, rounds and pending notifications'),
  pin('private.guard_closed_remaining_search_delivery', 0, '9eee75a9a0302d125bf2028dae5e3510', 'SUPPORTING', 'LIFECYCLE', 'trigger: no new delivery for a task whose remaining search is closed'),
  pin('private.guard_need_write', 0, '314b93f7f89d3d52dbcf17a2a2552502', 'SUPPORTING', 'LIFECYCLE', 'trigger: which status and revision changes a task accepts'),
  pin('public.rpc_cancel_need', 3, 'b6896803455751f0df87f5e778b1bd15', 'SUPPORTING', 'LIFECYCLE', 'cancellation closes rounds, deliveries, schedule and pending notifications'),
  pin('public.rpc_close_remaining_search', 4, '39fa830132d714a1cc61d3bba73d5cec', 'SUPPORTING', 'LIFECYCLE', 'closes the remaining search of a task with an agreement', b24('1e3e98db30a8260c5896909df94b1506')),
  pin('public.rpc_confirm_need_edit', 4, '450b6f8d932b1c58bcead22b6d29374b', 'SUPPORTING', 'LIFECYCLE', 'a material edit: revision + 1, back to DRAFT', b24('dfa1a8096380772a9ac60283bebfaf3d')),
  pin('public.rpc_submit_response', 9, 'c98e5bee7965b0d6ece9b477f94cede9', 'SUPPORTING', 'LIFECYCLE', 'a manual application (capacity, hard gates, delivery to RESPONDED)'),
  pin('public.rpc_select_response', 6, '7cbb83905c1c983be4a7d92ff505411e', 'SUPPORTING', 'LIFECYCLE', 'selection: agreement, ACTIVE when filled'),
  pin('public.rpc_cancel_agreement', 2, 'f3ca4d5f8bdf324d5773d887d0a2d093', 'SUPPORTING', 'LIFECYCLE', 'an agreement cancellation re-enqueues the task'),
  // ---- SUPPORTING: the worker writers that requeue
  pin('public.rpc_complete_worker_profile', 1, '3c53aa679dfc6811d5281433e5585278', 'SUPPORTING', 'REQUEUE', 'activation requeues the open tasks'),
  pin('public.rpc_save_worker_availability', 2, 'e35340586e6e7ea41f4d8b98a000f36f', 'SUPPORTING', 'REQUEUE', 'availability write requeues', b24('1d558d6a7f486b0c4ebf1484c96bc9e6')),
  pin('public.rpc_save_worker_capacity', 2, '54736d1ab234507e137066e6553ce334', 'SUPPORTING', 'REQUEUE', 'capacity write requeues (an unchanged value does not)', b24('9fd012b74afa2a1abe67e9fdf6873b42')),
  pin('public.rpc_save_worker_location', 3, '12b4505d1f6a5f97053a48ed72128af3', 'SUPPORTING', 'REQUEUE', 'location write requeues', b24('7566cf23f17ed08bbe0e99cbd92f549a')),
  // ---- SUPPORTING: safety, closure, world
  pin('private.safety_guard_delivery', 0, '650c89ef5bc36fe45d802f5dec1c9dbd', 'SUPPORTING', 'SAFETY', 'trigger: a blocked pair gets a SUPPRESSED notification row'),
  pin('private.safety_event_blocked', 1, '4a253bbaf6abd6b3207c7cd73a02ae0e', 'SUPPORTING', 'SAFETY', 'the block decision of an event'),
  pin('private.safety_pair_blocked', 2, '698fb21abb0379743bc7ab09d9f946ad', 'SUPPORTING', 'SAFETY', 'an active block between two accounts'),
  pin('public.rpc_set_account_block', 4, '8700f2abf73d2d9add5e02b32b28c6bc', 'SUPPORTING', 'SAFETY', 'the product writer of a block', b24('43b3b050c3ddc21657790f13c424390e')),
  pin('private.closure_guard_delivery', 0, '33649ad64a682f939bad905cf9ff4734', 'SUPPORTING', 'SAFETY', 'trigger: a closing account gets a SUPPRESSED notification row'),
  pin('private.closure_event_restricted', 1, '9487f617239b01bd5c698e6dc93d055d', 'SUPPORTING', 'SAFETY', 'the closure decision of an event'),
  pin('private.closure_account_restricted', 1, 'f4999250c315e0253374d4611291c7ad', 'SUPPORTING', 'SAFETY', 'a closure request in READY, EXECUTING, FAILED or CLOSED'),
  pin('private.accounts_same_world', 2, '16f541f952d4e1e2dbb4fc87e594d572', 'SUPPORTING', 'WORLD', 'the world gate of the admission'),
  pin('private.account_visibility_world', 1, '876cfc16f0ed1c4d32b128e8e18bdcda', 'SUPPORTING', 'WORLD', 'REAL or TEST of an account'),
  // ---- SUPPORTING: events, preferences, inbox
  pin('private.category_of_event', 1, '85389285506a1f5801ad204f60dfa2a1', 'SUPPORTING', 'EVENT', 'the notification category of an event type'),
  pin('private.in_quiet_hours', 1, '386e00eb4a7645addffac95fde09bea7', 'SUPPORTING', 'EVENT', 'quiet hours at emit time'),
  pin('public.rpc_set_notification_preferences', 4, 'd07d80e3c9f689482fb2edf6b95587b4', 'SUPPORTING', 'EVENT', 'the product writer of the push and quiet-hours choices', b24('34a307e2c38ff341581229f3726af680')),
  pin('public.rpc_claim_push_transport', 1, '8059dcbd47489ffba239c951e233dc02', 'SUPPORTING', 'PUSH', 'the claim: asks push_suppression, suppresses permanently, never sends'),
  pin('public.rpc_list_inbox', 4, 'b7928c5040ff715ea2af15e1f745c285', 'SUPPORTING', 'INBOX', 'what the person sees in the Inbox'),
  pin('public.rpc_resolve_activity_event', 1, 'e5dc05773da08471db572194caf467e2', 'SUPPORTING', 'INBOX', 'the Inbox resolver of an event (SECURITY INVOKER: the task read follows RLS)'),
  pin('public.rpc_read_task', 1, '1e01db5140248f27ab374187f01fded3', 'SUPPORTING', 'INBOX', 'the task read of the opportunity screen (RLS decides)'),
  // ---- SUPPORTING: availability helpers (already pinned by the ex06a candidate)
  pin('private.schedule_fit', 4, 'e29a7bade1437e3f2067924b5179ddfd', 'SUPPORTING', 'MATCH', 'fixed window fit'),
  pin('private.availability_is_future', 4, '3a1aee763e9fe3d0f06d6ba04ef21aac', 'SUPPORTING', 'MATCH', 'future availability test'),
  pin('private.availability_timezone_valid', 1, '013f884ca649cb5246f39eaf9f2e0ec9', 'SUPPORTING', 'MATCH', 'zone check of the derived window'),
  pin('private.worker_available_periods', 4, '5107af3020a3beb7bb45e6e90e7a203b', 'SUPPORTING', 'MATCH', 'real available periods of a worker'),
  pin('private.worker_calendar_conflict', 4, '417c9db16bbe70ed9ad652380790900c', 'SUPPORTING', 'MATCH', 'calendar conflict'),
  // ---- INFORMATIONAL
  pin('private.marketplace_tick', 2, '3858404992f2ceaa30b65af1055e2b9c', 'INFORMATIONAL', 'DISPATCH', 'the production tick: expiry, then dispatch, then maintenance (the proof calls the first two in this order)'),
  pin('private.lower_arr', 1, '07f449cf589196cc8ca349b4f5ca460c', 'INFORMATIONAL', 'MATCH', 'helper'),
  pin('private.haversine_km', 4, '027cf272c3616d952c7f241353ffd5a2', 'INFORMATIONAL', 'MATCH', 'helper'),
  pin('private.effective_radius_km', 1, 'fa9b8c7fcafd65ebb4d98f538fff5223', 'INFORMATIONAL', 'MATCH', 'helper'),
  pin('private.identity_admitted', 1, '9f4684bfd84df734cb8438b14aff0c16', 'INFORMATIONAL', 'MATCH', 'helper (fail-closed placeholder)'),
  pin('private.notification_preferences_settings', 1, '8448ca42aebbc17047aea6e303717194', 'INFORMATIONAL', 'EVENT', 'helper of the preferences writer'),
  pin('private.assert_application_price_v5', 3, 'bd7ef02925c03d99ff7fd549219214cb', 'INFORMATIONAL', 'LIFECYCLE', 'helper of the application writer'),
  pin('private.audit_marketplace', 6, 'ef33e1d34afb1507071c47253a13c9b2', 'INFORMATIONAL', 'LIFECYCLE', 'helper (audit rows)'),
  pin('private.notification_copy_v5', 1, 'e725df74604d4b52c0a3fad90b748c51', 'INFORMATIONAL', 'EVENT', 'helper (stored copy of the texts)'),
  pin('private.account_lineage', 1, 'c08602534ee5e0f0aa826db0913fde81', 'INFORMATIONAL', 'WORLD', 'helper of the world'),
]);

export const CORE_NAMES = Object.freeze(S04_PINS.filter(item => item.tier === 'CORE').map(item => item.name));

/** The DEV body texts kept byte-exact next to the proof (md5 equal to the pin; the offline tests check them). The static claims of the report are tested against these. */
export const DEV_BODY_CAPTURES = Object.freeze({
  'private.dispatch_cheap_candidate_admitted': 'dispatch_cheap_candidate_admitted.txt',
  'private.dispatch_next_wave': 'dispatch_next_wave.txt',
  'private.push_suppression': 'push_suppression.txt',
  'private.marketplace_tick': 'marketplace_tick.txt',
});

/** The SELECT that reads every pinned name (every overload), with the B24 part 1 derivation column. */
export const s04PinQuery = () => bodyQuery(S04_PINS.map(item => item.name), {derived: true});

const FATAL_VERDICTS = ['DIFFERENT', 'MISSING', 'AMBIGUOUS'];

/** Pure: one row per pin from the rows of s04PinQuery. verdict EQUAL | EXPLAINED | DIFFERENT | MISSING | AMBIGUOUS. */
export function evaluateS04Pins(rows) {
  return S04_PINS.map(item => {
    const base = {name: item.name, tier: item.tier, role: item.role, use: item.use, expected: item.md5, proven: item.proven, chain: item.chain.expect};
    const found = (rows ?? []).filter(row => row.name === item.name && Number(row.nargs) === item.nargs);
    if (found.length === 0) return {...base, actual: 'MISSING', verdict: 'MISSING', explanation: 'no such function with ' + item.nargs + ' arguments on the chain'};
    if (found.length > 1) return {...base, actual: 'AMBIGUOUS_OVERLOADS:' + found.length, verdict: 'AMBIGUOUS', explanation: 'more than one overload with ' + item.nargs + ' arguments'};
    const row = found[0];
    if (row.md5 === item.md5) return {...base, actual: row.md5, verdict: 'EQUAL', explanation: ''};
    if (item.chain.expect === 'B24_PART1' && row.derived_b24_part1_pt409 === item.md5) {
      const preImageEqual = row.md5 === item.chain.preImageDev;
      return {...base, actual: row.md5, verdict: 'EXPLAINED', preImageEqual,
        explanation: "B24 part 1 (DEV ledger 213): the chain body with the quoted '40001' turned into 'PT409' equals the DEV body" + (preImageEqual ? '; the chain body is the recorded DEV pre-image ' + item.chain.preImageDev.slice(0, 8) : '; the chain body is NOT the recorded DEV pre-image')};
    }
    return {...base, actual: row.md5, verdict: 'DIFFERENT', explanation: 'unexplained: the chain body is neither the DEV body' + (item.chain.expect === 'B24_PART1' ? " nor its B24 part 1 derivation" : '')};
  });
}

/**
 * Pure: the verdict of a pin evaluation. mode 'strict' (default): a CORE or SUPPORTING difference is fatal. mode 'report': only a CORE difference is fatal; SUPPORTING differences are listed.
 * verdict: 'DIFFERS' (something fatal), 'DIFFERS_SUPPORTING_ONLY' (report mode), 'EXPLAINED' (every difference is a named one), 'EQUAL'.
 */
export function chainVerdict(rows, {mode = 'strict'} = {}) {
  if (!['strict', 'report'].includes(mode)) throw new Error('S04_PIN_MODE_INVALID:' + mode);
  const bad = rows.filter(row => FATAL_VERDICTS.includes(row.verdict));
  const fatal = bad.filter(row => row.tier === 'CORE' || (mode === 'strict' && row.tier === 'SUPPORTING')).map(row => row.name);
  const supportingDifferences = bad.filter(row => row.tier === 'SUPPORTING').map(row => row.name);
  const informational = rows.filter(row => row.tier === 'INFORMATIONAL' && row.verdict !== 'EQUAL').map(row => row.name);
  const explained = rows.filter(row => row.verdict === 'EXPLAINED').map(row => row.name);
  const verdict = fatal.length ? 'DIFFERS' : supportingDifferences.length ? 'DIFFERS_SUPPORTING_ONLY' : explained.length ? 'EXPLAINED' : 'EQUAL';
  return {verdict, mode, rows, fatal, supportingDifferences, informational, explained, counts: {
    total: rows.length, core: rows.filter(row => row.tier === 'CORE').length, supporting: rows.filter(row => row.tier === 'SUPPORTING').length, informational: rows.filter(row => row.tier === 'INFORMATIONAL').length,
    equal: rows.filter(row => row.verdict === 'EQUAL').length, explained: explained.length, different: rows.filter(row => row.verdict === 'DIFFERENT').length,
    missing: rows.filter(row => row.verdict === 'MISSING').length, ambiguous: rows.filter(row => row.verdict === 'AMBIGUOUS').length}};
}

const NOT_PINNED = 'RLS policies, config rows and triggers are not pinned (the dispatch config sha256 is recorded apart); the chain stops before A1, B3, P0, P4, P5, pkg051a, B24, voice B1, EX-04, D12, pkg045b-p0 and the P6 rollout';
/** The chain verdict of a run that stopped BEFORE the pin gate: nothing was compared, so nothing in the report is evidence about DEV. */
export const notReadChain = (mode = 'strict') => ({verdict: 'NOT_READ', mode, rows: [], fatal: [], supportingDifferences: [], informational: [], explained: [], counts: {total: 0, core: 0, supporting: 0,
  informational: 0, equal: 0, explained: 0, different: 0, missing: 0, ambiguous: 0}});

/** Pure: the evidence label a result is quoted with. It says exactly what the pins cover and what they do not. */
export function chainLabel(verdict) {
  if (verdict.verdict === 'NOT_READ') return 'FUNCTION BODIES NOT READ (the run stopped before the pin gate: nothing in this report is evidence about DEV)';
  const c = verdict.counts;
  if (verdict.verdict === 'DIFFERS') {
    return `FUNCTION BODIES != DEV (${verdict.fatal.length} of ${c.total} pins differ or are missing without a named explanation: ${verdict.fatal.join(', ')}; the cases that depend on them are NOT evidence about DEV; ${NOT_PINNED})`;
  }
  if (verdict.verdict === 'DIFFERS_SUPPORTING_ONLY') {
    return `FUNCTION BODIES == DEV for the ${c.core} CORE pins, but ${verdict.supportingDifferences.length} SUPPORTING pin(s) differ (report mode): ${verdict.supportingDifferences.join(', ')}; ${NOT_PINNED}`;
  }
  const explained = verdict.explained.length ? `, ${verdict.explained.length} explained by B24 part 1` : '';
  return `FUNCTION BODIES == DEV (${c.total} pins: ${c.core} core and ${c.supporting} supporting equal${explained}; ${c.informational} informational pins compared, ${verdict.informational.length} differ and are listed; ${NOT_PINNED})`;
}
