import { aiTaskReviewClientService as service, decodeAiTaskReview, type AiTaskReviewEnvelope, type AiTaskPublicationCommand } from '../aiTaskReviewClientService';

const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION = '22222222-2222-4222-8222-222222222222', REVIEW = '33333333-3333-4333-8333-333333333333';
const KEY = '44444444-4444-4444-8444-444444444444', NEED = '55555555-5555-4555-8555-555555555555';
let mockSession = { user: { id: OWNER }, accountRevision: 1 };
const mockRpc = jest.fn(), mockInvoke = jest.fn(), mockGetSession = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, functions: { invoke: mockInvoke }, auth: { getSession: mockGetSession } }) }));
const answer = (data: unknown) => ({ data, error: null });
const review = (): AiTaskReviewEnvelope => ({
  reviewId: REVIEW, accountId: OWNER, conversationId: CONVERSATION, schemaVersion: 'NEED_FACT_V2', draftId: null, draftRevision: 0,
  displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64), sourceTurnRevision: 2, geographyRevision: 'c'.repeat(64),
  expiresAt: '2026-10-01T00:00:00Z', responseDeadline: null, publicProjection: [], ownerPrivateProjection: [],
  location: { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null },
  missingRequired: [], canAccept: true, safety: 'ALLOW',
});
const accepted = (): AiTaskPublicationCommand => ({ reviewId: REVIEW, clientRequestId: KEY, needId: NEED, needRevision: 1, state: 'ACCEPTED', evaluation: null, published: null, authoritative: true });
const evaluated = (outcome: 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK' = 'ALLOW'): AiTaskPublicationCommand => ({ ...accepted(), state: 'EVALUATED', evaluation: { kind: 'DECISION', decision: {
  decisionId: '66666666-6666-4666-8666-666666666666', decisionSequence: 1, needId: NEED, needRevision: 1,
  canonicalFingerprint: 'd'.repeat(64), policyBundleId: '77777777-7777-4777-8777-777777777777', policyVersion: 1, jurisdiction: 'RS',
  outcome, decisionAt: '2026-09-12T12:00:00Z', ruleIds: ['SYNTHETIC_RULE'], safeReasonCodes: [], publishable: outcome === 'ALLOW', authoritative: true,
} } });
const published = (): AiTaskPublicationCommand => ({ ...evaluated(), state: 'PUBLISHED', published: { needId: NEED, status: 'PUBLISHED', publishedAt: '2026-09-12T12:00:01Z', responseDeadline: null, idempotentReplay: false } });
let stored: AiTaskPublicationCommand | null;
beforeEach(() => {
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; stored = null;
  mockRpc.mockReset(); mockInvoke.mockReset(); mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: OWNER }, access_token: 'SYNTHETIC_TOKEN' } }, error: null });
  mockRpc.mockImplementation(async (name: string) => {
    if (name === 'rpc_prepare_ai_task_review') return answer(review());
    if (name === 'rpc_read_ai_task_review' || name === 'rpc_read_latest_ai_task_review') return answer({ review: review(), command: stored });
    if (name === 'rpc_accept_ai_task_review') { stored ??= accepted(); return answer(stored); }
    if (name === 'rpc_publish_accepted_ai_task_review') { stored = published(); return answer(stored); }
    throw new Error('UNEXPECTED_RPC');
  });
  mockInvoke.mockImplementation(async () => { stored = evaluated(); return answer(stored.evaluation); });
});

it('opening review does not accept facts, save a draft, evaluate or publish', async () => {
  await expect(service.prepare({ conversationId: CONVERSATION, responseDeadline: null })).resolves.toEqual({ ok: true, podatak: review() });
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(mockRpc).toHaveBeenCalledWith('rpc_prepare_ai_task_review', { p_conversation_id: CONVERSATION, p_response_deadline: null, p_location: null });
  expect(stored).toBeNull(); expect(mockInvoke).not.toHaveBeenCalled();
});

it('one explicit click accepts exact server digest then publishes only after durable ALLOW readback', async () => {
  await expect(service.acceptAndPublish({ review: review(), clientRequestId: KEY })).resolves.toEqual({ ok: true, podatak: published() });
  expect(mockRpc.mock.calls.map(x => x[0])).toEqual(['rpc_accept_ai_task_review', 'rpc_read_ai_task_review', 'rpc_read_ai_task_review', 'rpc_publish_accepted_ai_task_review']);
  expect(mockRpc.mock.calls[0][1]).toEqual({ p_review_id: REVIEW, p_displayed_content_digest: 'a'.repeat(64), p_client_request_id: KEY });
  expect(mockInvoke).toHaveBeenCalledTimes(1); expect(mockInvoke.mock.calls[0][1].body).toEqual({ needId: NEED, expectedRevision: 1, acceptedReviewId: REVIEW });
});

it.each(['CLARIFY', 'REVIEW', 'BLOCK'] as const)('%s remains a typed stored evaluation without a second confirmation or automatic publish', async outcome => {
  mockInvoke.mockImplementation(async () => { stored = evaluated(outcome); return answer(stored.evaluation); });
  const result = await service.acceptAndPublish({ review: review(), clientRequestId: KEY });
  expect(result).toEqual({ ok: true, podatak: evaluated(outcome) });
  expect(mockRpc.mock.calls.some(x => x[0] === 'rpc_publish_accepted_ai_task_review')).toBe(false);
});

it('lost acceptance response is recovered from durable latest review after app restart without accepting again', async () => {
  const implementation = mockRpc.getMockImplementation()!;
  mockRpc.mockImplementation(async (name: string, ...args: unknown[]) => {
    if (name === 'rpc_accept_ai_task_review') { stored = accepted(); throw new Error('LOST_ACK'); }
    return implementation(name, ...args);
  });
  const unknown = await service.acceptAndPublish({ review: review(), clientRequestId: KEY });
  expect(unknown).toMatchObject({ ok: false, kod: 'TASK_REVIEW_OUTCOME_UNCONFIRMED' }); expect(mockInvoke).not.toHaveBeenCalled();
  const recovered = await service.readLatest(CONVERSATION); expect(recovered).toEqual({ ok: true, podatak: { review: review(), command: accepted() } });
  await expect(service.resume(accepted())).resolves.toEqual({ ok: true, podatak: published() });
  expect(mockRpc.mock.calls.filter(x => x[0] === 'rpc_accept_ai_task_review')).toHaveLength(1);
});

it.each(['EVALUATING', 'UNKNOWN_OUTCOME', 'PUBLISHED'] as const)('durable %s recovery never invokes another provider', async state => {
  stored = state === 'PUBLISHED' ? published() : { ...accepted(), state };
  await expect(service.resume(stored)).resolves.toEqual({ ok: true, podatak: stored });
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('stored ALLOW survives app kill and resumes canonical publish without another evaluator', async () => {
  stored = evaluated(); await expect(service.resume(stored)).resolves.toEqual({ ok: true, podatak: published() });
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('late acceptance after an account round trip cannot invoke the evaluator in the new incarnation', async () => {
  mockRpc.mockImplementation(async () => { mockSession = { user: { id: OWNER }, accountRevision: 3 }; return answer(accepted()); });
  await expect(service.acceptAndPublish({ review: review(), clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('out-of-scope review and private fact smuggled into public projection are rejected before any write', async () => {
  const foreign = { ...review(), accountId: OTHER };
  expect(decodeAiTaskReview(foreign, OWNER)).toBeNull();
  const leaked = { ...review(), publicProjection: [{ id: null, key: 'need.exact_address', value: 'PRIVATE_ADDRESS', displayValue: 'PRIVATE_ADDRESS', source: 'EXPLICIT_USER_ANSWER', status: 'NEEDS_CONFIRMATION', privacyClass: 'PUBLIC' }] };
  expect(decodeAiTaskReview(leaked, OWNER)).toBeNull();
  await expect(service.acceptAndPublish({ review: foreign, clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INPUT_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled(); expect(mockInvoke).not.toHaveBeenCalled();
});

it('server stale review stays typed and cannot start later stages', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'TASK_REVIEW_STALE', details: 'PRIVATE_SQL_SENTINEL' } });
  const result = await service.acceptAndPublish({ review: review(), clientRequestId: KEY });
  expect(result).toMatchObject({ ok: false, kod: 'TASK_REVIEW_STALE' }); expect(JSON.stringify(result)).not.toContain('PRIVATE_SQL_SENTINEL');
  expect(mockInvoke).not.toHaveBeenCalled();
});

it('late Edge response after account switch causes no read or publish for the new user', async () => {
  mockInvoke.mockImplementation(async () => { stored = evaluated(); mockSession = { user: { id: OTHER }, accountRevision: 2 }; return answer(stored.evaluation); });
  await expect(service.acceptAndPublish({ review: review(), clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockRpc.mock.calls.map(x => x[0])).toEqual(['rpc_accept_ai_task_review', 'rpc_read_ai_task_review']);
});

it('no previous review is a nullable read success', async () => {
  mockRpc.mockResolvedValue(answer(null)); await expect(service.readLatest(CONVERSATION)).resolves.toEqual({ ok: true, podatak: null });
});

it('bound review admits inherited system facts without relabeling them as defaults', () => {
  const bound = { ...review(), draftId: NEED, draftRevision: 7, publicProjection: [{ id: KEY, key: 'need.title', value: 'Sačuvan naslov', displayValue: 'Sačuvan naslov',
    privacyClass: 'PUBLIC', source: 'SYSTEM_DERIVED', status: 'CONFIRMED' }] };
  expect(decodeAiTaskReview(bound, OWNER)?.publicProjection[0].source).toBe('SYSTEM_DERIVED');
});

it('bound acceptance response cannot change the reviewed Need identity or revision', async () => {
  const bound = { ...review(), draftId: NEED, draftRevision: 7 };
  mockRpc.mockResolvedValue(answer({ ...accepted(), needId: OTHER, needRevision: 8 }));
  await expect(service.acceptAndPublish({ review: bound, clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INVALID_RESPONSE' });
  mockRpc.mockResolvedValue(answer({ ...accepted(), needRevision: 9 }));
  await expect(service.acceptAndPublish({ review: bound, clientRequestId: KEY })).resolves.toMatchObject({ ok: false, kod: 'TASK_REVIEW_INVALID_RESPONSE' });
  expect(mockInvoke).not.toHaveBeenCalled();
});
