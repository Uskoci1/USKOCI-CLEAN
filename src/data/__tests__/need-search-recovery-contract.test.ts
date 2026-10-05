import { decodeNeedSearchState as decode, decodeReopenSearchReceipt as receipt, decodeReopenSearchReadback as readback,
  reopenSearchArgs, validReopenSearchCommand } from '../needSearchRecoveryContract';

const NEED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLOSED_AT = '2026-10-05T08:00:00.123456+00:00';
const command = { needId: NEED, revision: 3, closedAt: CLOSED_AT, clientRequestId: 'reopen-test-1234', reason: '' };
const state = () => ({
  schemaVersion: 1, authoritative: true, serverAsOf: '2026-10-05T09:00:00Z', needId: NEED, revision: 3, status: 'SELECTION',
  requiredSlots: 2, coveredSlots: 1, missingSlots: 1, searchAuthority: 'CLOSED', closedAt: CLOSED_AT,
  searchTimeAdmitted: true, canReopen: true, reason: 'CAN_REOPEN', nextAction: 'REOPEN_SEARCH',
  agreementCount: 1, activeAgreementCount: 1, awaitingConfirmationCount: 0, openProblemCount: 0,
});
const result = () => ({
  command: 'REOPEN_REMAINING_SEARCH_V1', authoritative: true, needId: NEED, revision: 3, observedClosedAt: CLOSED_AT,
  remainingSearchClosed: false, reopenedAt: '2026-10-05T09:00:00Z', requiredSlots: 2, selectedSlots: 1,
  reopenedRemainingSlots: 1, idempotentReplay: false,
});

it('retains the exact microsecond closure text through the command', () => {
  expect(decode(state(), NEED)?.closedAt).toBe(CLOSED_AT);
  expect(validReopenSearchCommand(command)).toBe(true);
  expect(reopenSearchArgs(command).p_expected_closed_at).toBe(CLOSED_AT);
});

it.each([
  ['foreign task', { needId: OTHER }],
  ['unknown schema', { schemaVersion: 2 }],
  ['missing authority', { authoritative: false }],
  ['wrong missing count', { missingSlots: 2 }],
  ['overcoverage', { coveredSlots: 3 }],
  ['negative', { missingSlots: -1 }],
  ['string count', { coveredSlots: '1' }],
  ['open with closure', { searchAuthority: 'OPEN' }],
  ['closed without instant', { closedAt: null }],
  ['invented permission', { searchTimeAdmitted: false }],
  ['permission vs reason', { reason: 'SEARCH_WINDOW_CLOSED' }],
  ['reopen after completion', { status: 'COMPLETED' }],
  ['unknown next action', { nextAction: 'AUTO_REPLACE' }],
  ['unknown reason', { reason: 'SOMETHING' }],
  ['awaiting exceeds active', { awaitingConfirmationCount: 2 }],
  ['more active than history', { agreementCount: 0 }],
])('rejects inconsistent state: %s', (_name, patch) => {
  expect(decode({ ...state(), ...patch }, NEED)).toBeNull();
});

it('accepts Agreement priority even when reopening would otherwise be allowed', () => {
  expect(decode({ ...state(), nextAction: 'OPEN_AGREEMENTS', awaitingConfirmationCount: 1 }, NEED)).not.toBeNull();
});

it('treats a reopen receipt as an exact command witness, not generic HTTP success', () => {
  expect(receipt(result(), command)).not.toBeNull();
  for (const patch of [
    { command: 'CLOSE_REMAINING_SEARCH' },
    { needId: OTHER },
    { observedClosedAt: '2026-10-05T08:00:00.123457Z' },
    { revision: 4 },
    { remainingSearchClosed: true },
    { selectedSlots: 2 },
    { authoritative: false },
  ]) expect(receipt({ ...result(), ...patch }, command)).toBeNull();
});

it('accepts an equivalent timezone spelling without rounding the closure witness', () => {
  expect(receipt({ ...result(), observedClosedAt: '2026-10-05T10:00:00.123456+02:00' }, command)).not.toBeNull();
});

it('accepts NOT_CONFIRMED only as an explicit authorized receipt read', () => {
  const base = { command: 'REOPEN_REMAINING_SEARCH_V1', authoritative: true, needId: NEED, state: 'NOT_CONFIRMED', receipt: null };
  expect(readback(base, command)).toEqual({ state: 'NOT_CONFIRMED' });
  expect(readback({ ...base, receipt: result() }, command)).toBeNull();
  expect(readback({ ...base, needId: OTHER }, command)).toBeNull();
});

it('confirmed history requires the validated replay receipt', () => {
  const base = { command: 'REOPEN_REMAINING_SEARCH_V1', authoritative: true, needId: NEED, state: 'CONFIRMED' };
  expect(readback({ ...base, receipt: result() }, command)).toBeNull();
  expect(readback({ ...base, receipt: { ...result(), idempotentReplay: true } }, command)?.state).toBe('CONFIRMED');
});

it('rejects malformed stored commands instead of manufacturing an intent', () => {
  for (const patch of [
    { closedAt: null },
    { needId: OTHER },
    { clientRequestId: 'x' },
    { clientRequestId: 'a'.repeat(194) },
    { reason: ' hidden ' },
    { unknown: true },
  ]) expect(validReopenSearchCommand({ ...command, ...patch }, NEED)).toBe(false);
});
