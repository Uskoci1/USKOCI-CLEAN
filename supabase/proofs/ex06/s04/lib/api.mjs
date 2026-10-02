// EX-06 S04: the PostgREST seam of the proof: the product RPCs the scenarios call as a person (a worker, the requester) or as the service. Every call carries an abort signal (30 s): PostgREST 14
// re-executes a function that raises SQLSTATE 40001 without end, and the disposable chain stops before B24 part 1, so a deterministic conflict would otherwise hang the run. The scenarios use
// this object only; the offline tests give them a simulated one (world_sim.mjs).
export const ABORT_MS = 30000;

export function createApi(rt, {abortMs = ABORT_MS} = {}) {
  const {ok, randomUUID, service} = rt;
  const withSignal = builder => (typeof builder?.abortSignal === 'function' ? builder.abortSignal(AbortSignal.timeout(abortMs)) : builder);
  /** A call whose error becomes an exception. */
  const call = (client, name, args = {}) => ok(withSignal(client.rpc(name, args)));
  /** A call whose error is data: {ok: true, data} | {ok: false, error: {code, message}}. */
  const attempt = async (client, name, args = {}) => {
    const result = await withSignal(client.rpc(name, args));
    return result.error ? {ok: false, error: {code: result.error.code ?? null, message: String(result.error.message ?? '').slice(0, 300)}} : {ok: true, data: result.data};
  };
  return {
    /** The blocker blocks the target (rpc_set_account_block; the revision of a first block is 0). */
    block: (blocker, target) => call(blocker.client, 'rpc_set_account_block', {p_target_account_id: target.id, p_blocked: true, p_expected_revision: 0, p_client_request_id: randomUUID()}),
    /** The notification preferences of a worker in the WORKER role (settings: opportunities_enabled, push_enabled, quiet hours ...). */
    workerPreferences: worker => call(worker.client, 'rpc_get_notification_preferences', {p_role: 'WORKER', p_expected_user_id: worker.id}),
    /** What the person sees in the Inbox (the first hundred rows). */
    listInbox: worker => attempt(worker.client, 'rpc_list_inbox', {p_role: 'WORKER', p_limit: 100, p_before_at: null, p_before_id: null}),
    /** The Inbox resolver of an event (rpc_resolve_activity_event). */
    resolveEvent: (worker, eventId) => attempt(worker.client, 'rpc_resolve_activity_event', {p_event_id: eventId}),
    /** The task read of the opportunity screen (rpc_read_task: RLS decides what the person may read). */
    readTask: (worker, needId) => attempt(worker.client, 'rpc_read_task', {p_need_id: needId}),
    /** A confirmed material edit of a published task (rpc_confirm_need_edit): the task becomes a DRAFT of the next revision. material = the 22-key snapshot. */
    confirmNeedEdit: (requester, {needId, revision, material}) => call(requester.client, 'rpc_confirm_need_edit',
      {p_need_id: needId, p_expected_revision: revision, p_client_request_id: 's04-edit-' + randomUUID(), p_material: material}),
    /** The requester closes the remaining search of a task that has an agreement (rpc_close_remaining_search). */
    closeRemainingSearch: (requester, {needId, revision, reason = 'EX-06 S04'}) => call(requester.client, 'rpc_close_remaining_search',
      {p_need_id: needId, p_expected_revision: revision, p_client_request_id: 's04-close-' + randomUUID(), p_reason: reason}),
    /** A party cancels an agreement (rpc_cancel_agreement; the reason is required). */
    cancelAgreement: (person, agreementId, reason = 'EX-06 S04') => call(person.client, 'rpc_cancel_agreement', {p_agreement_id: agreementId, p_reason: reason}),
    /** The push sender's claim as the service (rpc_claim_push_transport SEND): it suppresses or leases PUSH rows in the database; it never contacts a provider and nothing is sent. */
    claimPush: () => call(service, 'rpc_claim_push_transport', {p_kind: 'SEND'}),
    /**
     * The owner UPDATE of a worker's own profile row (what the profile editor does: skills, tools, vehicles, licenses). The abort signal goes on BEFORE single(): in postgrest-js only the
     * filter and transform builders have abortSignal, the builder single() returns does not.
     */
    updateProfile: (worker, patch) => ok(worker.client.from('app_profiles').update(patch).eq('id', worker.profileId).eq('account_id', worker.id).eq('kind', 'WORKER').select('id')
      .abortSignal(AbortSignal.timeout(abortMs)).single()),
  };
}
