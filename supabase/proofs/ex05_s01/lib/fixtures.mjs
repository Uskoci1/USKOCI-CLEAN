// EX05-S01: the shared fixtures of the post-state proofs. The proof runtime `rt` (supabase/proofs/pre_v3/closure_runtime.mjs) is injected, so this module has no import-time effect.
// Everything here is the fixture code of the frozen proofs (voice_b1_feature_proof.mjs, private_history_read_proof.mjs, push_event_transport_proof.mjs), factored once:
// real Auth accounts, a real published need, a real offer and a real selection through the production RPCs. No fixture row is synthesized for an Agreement.
import {randomUUID} from 'node:crypto';
import {SQL} from './sql_snippets.mjs';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A client_message_id the server accepts: an alphanumeric start and 8 to 200 characters of [A-Za-z0-9_.:-]. */
export const commandKey = label => 'ex05-' + String(label).replace(/[^A-Za-z0-9_.:-]/g, '') + '-' + randomUUID().replaceAll('-', '').slice(0, 12);

export function createFixtures(rt) {
  const {assert, sql, rows, q, ok, actor} = rt;

  /** The session id inside an actor's access token (the service protocol binds an operation to it). */
  async function sessionOf(who) {
    const session = (await who.client.auth.getSession()).data.session;
    assert.ok(session, 'SESSION_MISSING');
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString());
    assert.equal(claims.sub, who.id); assert.ok(claims.session_id, 'SESSION_ID_MISSING');
    return claims.session_id;
  }

  /** requester, worker (profile complete), stranger: three real Auth accounts. */
  async function prepareParty(label, {strangers = 1} = {}) {
    const requester = await actor(label + '-requester'), worker = await actor(label + '-worker');
    const outsiders = [];
    for (let index = 0; index < strangers; index++) outsiders.push(await actor(label + '-stranger' + (index === 0 ? '' : index)));
    const requesterProfile = rows(SQL.profileOf(requester.id, 'REQUESTER'))[0].id;
    const workerProfile = rows(SQL.profileOf(worker.id, 'WORKER'))[0].id;
    sql(SQL.prepareWorkerProfile(workerProfile));
    await ok(worker.client.rpc('rpc_complete_worker_profile', {p_profile_id: workerProfile}));
    return {requester, worker, stranger: outsiders[0], strangers: outsiders, requesterProfile, workerProfile};
  }

  /** An extra worker for a multi-slot need: a real account with a completed profile. */
  async function prepareExtraWorker(label) {
    const who = await actor(label);
    const profile = rows(SQL.profileOf(who.id, 'WORKER'))[0].id;
    sql(SQL.prepareWorkerProfile(profile));
    await ok(who.client.rpc('rpc_complete_worker_profile', {p_profile_id: profile}));
    return {...who, profileId: profile};
  }

  /** One published need of the requester (SQL, as every frozen proof does). */
  function publishNeed(party, label, slots = 1) {
    const needId = randomUUID();
    sql(SQL.insertPublishedNeed({needId, requesterId: party.requester.id, requesterProfileId: party.requesterProfile, label, slots}));
    return needId;
  }

  /** A worker's real offer on a need, then the requester's real selection: returns the Agreement id. */
  async function select(party, needId, worker = party.worker, profileId = party.workerProfile, slots = 1) {
    const offer = await ok(worker.client.rpc('rpc_submit_response', {p_need_id: needId, p_need_revision: 1, p_worker_profile_id: profileId, p_covered_slots: slots,
      p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID()}));
    return ok(party.requester.client.rpc('rpc_select_response', {p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId,
      p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID()}));
  }
  async function agreementOf(party, label) { return select(party, publishNeed(party, label, 1)); }

  /** The one MESSAGE_RECEIVED event of a message (asserts exactly one). */
  function eventOf(messageId) {
    const events = rows(SQL.eventOfMessage(messageId));
    assert.equal(events.length, 1, 'EXACTLY_ONE_EVENT_PER_MESSAGE');
    assert.match(events[0].id, UUID_PATTERN);
    return events[0];
  }
  const deliveriesOf = eventId => rows(SQL.deliveriesOfEvent(eventId));
  const deliveryOf = (eventId, channel) => {
    const found = deliveriesOf(eventId).filter(item => item.channel === channel);
    assert.equal(found.length, 1, 'EXACTLY_ONE_' + channel + '_DELIVERY');
    return found[0];
  };

  /** Metadata-only photo fixture (no Storage object): the READY upload row the photo writer attaches, exactly as the frozen B3 proofs insert it. */
  function photoFixtureRow(who, agreementId) {
    const assetId = randomUUID(), uploadId = randomUUID(), inputHash = 'a'.repeat(64), outputHash = 'b'.repeat(64);
    sql(SQL.insertPhotoUploadFixture({assetId, uploadId, accountId: who.id, agreementId, inputHash, outputHash}));
    return assetId;
  }
  const sendText = (who, agreementId, key, body, expected = who.id) => who.client.rpc('rpc_send_agreement_message_v2', {p_expected_user_id: expected, p_agreement_id: agreementId, p_client_message_id: key, p_body: body});
  const sendPhoto = (who, agreementId, assetIds, key = commandKey('photo'), body = '', version = 1) => who.client.rpc('rpc_send_agreement_photo_message_v5',
    {p_expected_user_id: who.id, p_agreement_id: agreementId, p_expected_version: version, p_client_message_id: key, p_body: body, p_asset_ids: assetIds});

  return {sessionOf, prepareParty, prepareExtraWorker, publishNeed, select, agreementOf, eventOf, deliveriesOf, deliveryOf, photoFixtureRow, sendText, sendPhoto};
}
