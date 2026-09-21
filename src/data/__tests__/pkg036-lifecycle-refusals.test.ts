import { agreementChangeService, agreementClientService, agreementProblemService, type AgreementChangeSnapshot } from '../agreementClientService';
import { needLifecycleClientService } from '../needLifecycleClientService';
import { createNeedLifecycleController } from '../needLifecycleController';
import { ru4Production } from '../ru4Production';
import { AgreementActionsController } from '../../ui/agreements/AgreementActionsController';

const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const ID = '20000000-0000-4000-8000-000000000001';
const account = { accountId: A, accountRevision: 1 };
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: { id: '10000000-0000-4000-8000-000000000001' }, accountRevision: 1 }) }));

const snapshot: AgreementChangeSnapshot = {
  agreementId: ID, agreementVersion: 1, agreementStatus: 'CONFIRMED', requesterAccountId: A, workerAccountId: B,
  terms: { priceRsd: 5000, currency: 'RSD', scopeNote: null, startsAt: null, endsAt: null }, proposals: [],
  actions: { agreementId: ID, agreementVersion: 1, accountId: A, authoritative: true, canProposeChange: true,
    canRespondChange: false, canWithdrawChange: false, canMarkWorkDone: false, canConfirmCompletion: true, canCancel: true },
};
const cancel = { kind: 'CANCEL' as const, agreementId: ID, version: 1, reason: 'Razlog' };
const proposal = { dogovorId: ID, ocekivanaVerzija: 1, clientRequestId: 'same-command-key', izmena: { cenaIznos: 6000 } };
function controller() {
  const storage = { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn().mockResolvedValue(undefined) };
  const service = { ...agreementChangeService, read: jest.fn().mockResolvedValue({ ok: true, podatak: snapshot }),
    readCommand: jest.fn().mockResolvedValue({ ok: true, podatak: { found: false } }) };
  const value = new AgreementActionsController({ agreementId: ID, account, current: () => true, storage, service });
  return { value, service, storage };
}
const refuse = (message: string) => mockRpc.mockResolvedValue({ data: null,
  error: { message, code: 'P0001', details: 'PRIVATE_SQL', hint: 'PRIVATE_HINT' } });
beforeEach(() => mockRpc.mockReset());

// Codes are from the complete live bodies read at ledger191, not the client maps.
it.each(['ALREADY_COMPLETED', 'NEED_NOT_FOUND', 'AGREEMENT_NEED_MISMATCH', 'REASON_REQUIRED',
  'AUTH_REQUIRED', 'AGREEMENT_NOT_FOUND', 'ACCOUNT_CLOSING', 'INTERACTION_BLOCKED'])
('keeps an answered cancellation refusal through the real adapter and controller: %s', async code => {
  refuse(code); const h = controller(); await h.value.load(); await h.value.submit(cancel);
  expect(h.value.snapshot()).toMatchObject({ phase: 'REJECTED', canRetry: false, journal: { kind: 'CANCEL' } });
  expect(h.value.snapshot().error).not.toMatch(/Ishod|PRIVATE|P0001/);
  expect(h.service.read).toHaveBeenCalledTimes(1);
  await h.value.retry(); expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(h.storage.removeItem).not.toHaveBeenCalled();
});

it.each(['AUTH_REQUIRED', 'AGREEMENT_VERSION_NOT_FOUND', 'CHANGE_CURRENCY_INVALID',
  'ACCOUNT_CLOSING', 'INTERACTION_BLOCKED'])
('does not discard a definite proposal refusal in a second controller allowlist: %s', async code => {
  refuse(code); const h = controller(); await h.value.load(); await h.value.submit({ kind: 'PROPOSE', value: proposal });
  expect(h.value.snapshot()).toMatchObject({ phase: 'REJECTED', canRetry: false });
  expect(h.service.readCommand).not.toHaveBeenCalled();
});

it('a malformed cancellation ACK stays unknown and is confirmed only by the saved Agreement', async () => {
  mockRpc.mockResolvedValue({ data: { cancelled: true }, error: null });
  const h = controller(); await h.value.load(); await h.value.submit(cancel);
  expect(h.value.snapshot()).toMatchObject({ phase: 'UNKNOWN', journal: { kind: 'CANCEL' } });
  expect(h.storage.removeItem).not.toHaveBeenCalled();
  h.service.read.mockResolvedValue({ ok: true, podatak: { ...snapshot, agreementStatus: 'CANCELLED' } });
  await h.value.refresh(); expect(h.value.snapshot().phase).toBe('CONFIRMED');
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

it('a malformed proposal ACK still permits recovery of its original persisted key', async () => {
  mockRpc.mockResolvedValue({ data: 'not-a-proposal-id', error: null });
  const h = controller(); await h.value.load(); await h.value.submit({ kind: 'PROPOSE', value: proposal });
  expect(h.value.snapshot().phase).toBe('UNKNOWN');
  expect(h.service.readCommand).toHaveBeenCalledWith(ID, { clientRequestId: 'same-command-key' }, account);
  expect(h.storage.removeItem).not.toHaveBeenCalled();
});

it.each(['PRIVATE_SQL', 'UNRECOGNIZED_CODE', 'toString', 'ALREADY_COMPLETED extra'])
('unknown cancellation failure stays recoverable without displaying raw text: %s', async code => {
  refuse(code); const h = controller(); await h.value.load(); await h.value.submit(cancel);
  expect(h.value.snapshot().phase).toBe('UNKNOWN');
  expect(JSON.stringify(h.value.snapshot())).not.toContain(code);
  expect(h.storage.removeItem).not.toHaveBeenCalled();
});

it.each(['CANCEL', 'DELETE_DRAFT'] as const)('a closing-account refusal reaches the %s lifecycle controller', async action => {
  refuse('ACCOUNT_CLOSING');
  const h = createNeedLifecycleController({ account, command: { action, needId: ID, expectedRevision: 1, reason: '' },
    currentAccount: () => account, refreshOwnedNeeds: jest.fn() });
  await h.submit(); expect(h.snapshot()).toMatchObject({ phase: 'REJECTED', error: { kod: 'ACCOUNT_CLOSING' } });
  expect(h.canRetrySame()).toBe(false); await h.retrySame(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each(['NEED_ID_REVISION_REQUIRED', 'CLIENT_REQUEST_ID_INVALID', 'NEED_NOT_OWNED',
  'REMAINING_SEARCH_CLOSE_REQUIRES_DOGOVOR', 'NEED_REMAINING_SEARCH_NOT_OPEN',
  'REMAINING_SEARCH_CLOSE_REQUIRES_SELECTED_CAPACITY', 'NO_REMAINING_SEARCH', 'ACCOUNT_CLOSING'])
('closing remaining search explains the server refusal: %s', async code => {
  refuse(code); const result = await ru4Production.closeRemainingSearch(ID, 1, 'same-command-key');
  expect(result).toMatchObject({ ok: false, kod: code }); expect(JSON.stringify(result)).not.toMatch(/PRIVATE|P0001/);
});

it.each(['NEED_NOT_FOUND', 'ACCOUNT_CLOSING'])('problem report keeps the answered refusal: %s', async code => {
  refuse(code); expect(await agreementProblemService.submit(ID, 'Problem', account)).toMatchObject({ ok: false, kod: code });
});

it.each(['ACCOUNT_CLOSING', 'INTERACTION_BLOCKED'])('completion keeps the answered guard refusal: %s', async code => {
  refuse(code); expect(await agreementClientService.potvrdiZavrsetak(ID)).toMatchObject({ ok: false, kod: code });
  expect(await agreementClientService.oznaciZavrsetak(ID)).toMatchObject({ ok: false, kod: code });
});

it('the receipt reader maps its own invalid-input refusal', async () => {
  refuse('NEED_COMMAND_INVALID_INPUT');
  expect(await needLifecycleClientService.readCommandReceipt({ action: 'CANCEL', needId: ID, expectedRevision: 1, reason: '' }))
    .toMatchObject({ ok: false, kod: 'NEED_COMMAND_INVALID_INPUT' });
});
