import { rememberIntakeReviewReturn, readIntakeReviewReturn, retireIntakeReviewReturn } from '../intakeReviewReturn';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CONVERSATION = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
let mockSession = { user: { id: ACCOUNT }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const owner = () => ({ accountId: mockSession.user.id, accountRevision: mockSession.accountRevision });
beforeEach(() => { mockSession = { user: { id: ACCOUNT }, accountRevision: 1 }; });

it.each([{}, { entryKey: OTHER }, { conversationId: CONVERSATION }])('keeps only the exact original route identity: %j', params => {
  const handoff = rememberIntakeReviewReturn(owner(), CONVERSATION, params)!;
  expect(readIntakeReviewReturn(handoff.token, CONVERSATION)?.params).toEqual(params);
  expect(Object.keys(handoff).sort()).toEqual(['accountId', 'accountRevision', 'conversationId', 'params', 'token']);
  expect(readIntakeReviewReturn(handoff.token, OTHER)).toBeNull();
  expect(readIntakeReviewReturn('external-token', CONVERSATION)).toBeNull();
  expect(readIntakeReviewReturn([handoff.token], CONVERSATION)).toBeNull();
});

it.each(['switch', 'ABA'])('rejects a previous account visit after %s', change => {
  const captured = owner();
  const handoff = rememberIntakeReviewReturn(captured, CONVERSATION, {})!;
  mockSession = { user: { id: OTHER }, accountRevision: 2 };
  if (change === 'ABA') mockSession = { user: { id: ACCOUNT }, accountRevision: 3 };
  expect(readIntakeReviewReturn(handoff.token, CONVERSATION)).toBeNull();
  expect(rememberIntakeReviewReturn(captured, CONVERSATION, {})).toBeNull();
});

it('retires an unmounted/returned visit without allowing its cleanup to retire a newer visit', () => {
  const old = rememberIntakeReviewReturn(owner(), CONVERSATION, {})!;
  const next = rememberIntakeReviewReturn(owner(), CONVERSATION, { conversationId: CONVERSATION })!;
  expect(readIntakeReviewReturn(old.token, CONVERSATION)).toBeNull();
  retireIntakeReviewReturn(old);
  expect(readIntakeReviewReturn(next.token, CONVERSATION)).toBe(next);
  retireIntakeReviewReturn(next);
  expect(readIntakeReviewReturn(next.token, CONVERSATION)).toBeNull();
});

it('does not bind another conversation or malformed route identity to the return', () => {
  expect(rememberIntakeReviewReturn(owner(), CONVERSATION, { conversationId: OTHER })).toBeNull();
  expect(rememberIntakeReviewReturn(owner(), CONVERSATION, { entryKey: 'bad' })).toBeNull();
  expect(rememberIntakeReviewReturn(owner(), 'bad', {})).toBeNull();
});
