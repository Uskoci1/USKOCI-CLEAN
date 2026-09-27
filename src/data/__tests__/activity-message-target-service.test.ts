const ACCOUNT = 'abcdefab-0000-4000-8000-000000000001';
const OTHER = 'abcdefab-0000-4000-8000-000000000002';
const EVENT = 'abcdefab-1000-4000-8000-000000000001';
const AGREEMENT = 'abcdefab-2000-4000-8000-000000000001';
const MESSAGE = 'abcdefab-3000-4000-8000-000000000001';
let mockAccount: string | null = ACCOUNT, mockRevision = 3;
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
import { activityMessageTargetService, createActivityMessageTargetService, decodeActivityMessageTarget } from '../activityMessageTargetService';
import { supabaseKlijent } from '../supabaseClient';

const target = (patch: Record<string, unknown> = {}) => ({ schema: 'ACTIVITY_MESSAGE_TARGET_V1', accountId: ACCOUNT,
  kind: 'AGREEMENT_MESSAGE', eventId: EVENT, agreementId: AGREEMENT, messageId: MESSAGE, role: 'REQUESTER', authoritative: true, ...patch });
const unavailable = (patch: Record<string, unknown> = {}) => ({ schema: 'ACTIVITY_MESSAGE_TARGET_V1', accountId: ACCOUNT,
  kind: 'UNAVAILABLE', authoritative: true, ...patch });
const receipt = (data: unknown) => ({ data, error: null });
const rpc = jest.fn(), service = createActivityMessageTargetService(rpc);
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { jest.clearAllMocks(); rpc.mockReset(); mockAccount = ACCOUNT; mockRevision = 3; });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it.each(['REQUESTER', 'WORKER'])('resolves one exact event for %s with only canonical IDs', async role => {
  rpc.mockResolvedValue(receipt(target({ role })));
  expect(await service.resolve(EVENT.toUpperCase())).toEqual({ ok: true, podatak: target({ role }) });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith('rpc_resolve_activity_message_v1', { p_expected_user_id: ACCOUNT, p_event_id: EVENT }, expect.any(AbortSignal));
});
it('text and photo events have the same ID-only envelope and require no media request', async () => {
  const photoMessage = 'abcdefab-3000-4000-8000-000000000002';
  rpc.mockResolvedValueOnce(receipt(target())).mockResolvedValueOnce(receipt(target({ messageId: photoMessage })));
  const text = await service.resolve(EVENT), photo = await service.resolve(EVENT);
  expect(text).toEqual({ ok: true, podatak: target() });
  expect(photo).toEqual({ ok: true, podatak: target({ messageId: photoMessage }) });
  expect(text.ok && photo.ok && Object.keys(text.podatak)).toEqual(photo.ok && Object.keys(photo.podatak));
  expect(rpc).toHaveBeenCalledTimes(2); expect(supabaseKlijent).not.toHaveBeenCalled();
});
it('distinguishes an authoritative unavailable event from a transport or malformed-response failure', async () => {
  rpc.mockResolvedValueOnce(receipt(unavailable())).mockResolvedValueOnce({ data: unavailable(), error: { message: 'private transport text' } })
    .mockResolvedValueOnce(receipt(null));
  expect(await service.resolve(EVENT)).toEqual({ ok: true, podatak: unavailable() });
  expect(await service.resolve(EVENT)).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_UNCONFIRMED' });
  expect(await service.resolve(EVENT)).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_INVALID_RESPONSE' });
});
it.each([
  { schema: 'LEGACY' }, { accountId: OTHER }, { eventId: OTHER }, { kind: 'AGREEMENT' },
  { role: 'OWNER' }, { role: 'requester' }, { role: null }, { authoritative: false }, { authoritative: 'true' }, { authoritative: undefined },
  { body: 'private text' }, { photos: [] }, { media: {} }, { path: 'private/path' }, { payload: { message_id: MESSAGE } },
  { agreementId: null }, { messageId: 1 },
])('rejects foreign, malformed or expanded target fields %#', patch => {
  expect(decodeActivityMessageTarget(target(patch), ACCOUNT, EVENT)).toBeNull();
});
it.each(['accountId', 'eventId', 'agreementId', 'messageId'])('requires an exact 36-character UUID in %s', key => {
  for (const value of [`${MESSAGE}\n`, ` ${MESSAGE}`, MESSAGE.replaceAll('-', ''), 'not-an-id', '', null])
    expect(decodeActivityMessageTarget(target({ [key]: value }), ACCOUNT, EVENT)).toBeNull();
});
it('rejects every omitted target field and inherited fields, and copies only the exact envelope', () => {
  for (const key of Object.keys(target())) {
    const value: Record<string, unknown> = target(); delete value[key];
    expect(decodeActivityMessageTarget(value, ACCOUNT, EVENT)).toBeNull();
  }
  expect(decodeActivityMessageTarget(Object.create(target()), ACCOUNT, EVENT)).toBeNull();
  expect(decodeActivityMessageTarget([target()], ACCOUNT, EVENT)).toBeNull();
  expect(decodeActivityMessageTarget(target({ eventId: EVENT.toUpperCase(), agreementId: AGREEMENT.toUpperCase(), messageId: MESSAGE.toUpperCase() }), ACCOUNT, EVENT)).toEqual(target());
});
it('unavailable admits no target IDs, role, payload, media or error detail', () => {
  for (const key of ['eventId', 'agreementId', 'messageId', 'role', 'body', 'photos', 'path', 'error'])
    expect(decodeActivityMessageTarget(unavailable({ [key]: null }), ACCOUNT, EVENT)).toBeNull();
  for (const key of Object.keys(unavailable())) {
    const value: Record<string, unknown> = unavailable(); delete value[key];
    expect(decodeActivityMessageTarget(value, ACCOUNT, EVENT)).toBeNull();
  }
  expect(decodeActivityMessageTarget(unavailable({ accountId: OTHER }), ACCOUNT, EVENT)).toBeNull();
  expect(decodeActivityMessageTarget(unavailable(), ACCOUNT, `${EVENT}\n`)).toBeNull();
});
it('rejects invalid input, missing auth and invalid account revisions before transport', async () => {
  for (const event of ['bad', `${EVENT}\n`, '', ` ${EVENT}`])
    expect(await service.resolve(event)).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_INPUT_INVALID' });
  for (const accountRevision of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])
    expect(await service.resolve(EVENT, {}, { accountId: ACCOUNT, accountRevision })).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  mockAccount = null;
  expect(await service.resolve(EVENT)).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects a stale explicit account or revision without issuing the request', async () => {
  for (const scope of [{ accountId: OTHER, accountRevision: 3 }, { accountId: ACCOUNT, accountRevision: 2 }])
    expect(await service.resolve(EVENT, {}, scope)).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(rpc).not.toHaveBeenCalled();
});
it.each(['other-account', 'signed-out', 'same-account-revision', 'A-B-A'])('retires a completion after %s', async change => {
  const request = deferred(); rpc.mockReturnValue(request.promise);
  const pending = service.resolve(EVENT);
  if (change === 'other-account') { mockAccount = OTHER; mockRevision++; }
  if (change === 'signed-out') { mockAccount = null; mockRevision++; }
  if (change === 'same-account-revision') mockRevision++;
  if (change === 'A-B-A') { mockAccount = OTHER; mockRevision++; mockAccount = ACCOUNT; mockRevision++; }
  request.resolve(receipt(target()));
  expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('captures an explicit account scope before asynchronous work', async () => {
  const request = deferred(), scope = { accountId: ACCOUNT, accountRevision: 3 }; rpc.mockReturnValue(request.promise);
  const pending = service.resolve(EVENT, {}, scope);
  scope.accountId = OTHER; scope.accountRevision = 99;
  request.resolve(receipt(target()));
  expect(await pending).toEqual({ ok: true, podatak: target() });
});
it('does not start an already-aborted read', async () => {
  const abort = new AbortController(); abort.abort();
  expect(await service.resolve(EVENT, { signal: abort.signal })).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_CANCELLED' });
  expect(rpc).not.toHaveBeenCalled();
});
it.each(['resolve', 'reject'] as const)('abort immediately settles a hung transport, removes its listener, and ignores late %s', async complete => {
  jest.useFakeTimers();
  const request = deferred(), abort = new AbortController(); rpc.mockReturnValue(request.promise);
  const remove = jest.spyOn(abort.signal, 'removeEventListener');
  const pending = service.resolve(EVENT, { signal: abort.signal }), published = jest.fn(); void pending.then(published);
  const transportSignal = rpc.mock.calls[0][2] as AbortSignal;
  abort.abort();
  expect(await pending).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_CANCELLED' });
  expect(transportSignal.aborted).toBe(true); expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
  if (complete === 'resolve') request.resolve(receipt(target())); else request.reject(new Error('private late failure'));
  await Promise.resolve(); await Promise.resolve();
  expect(published).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledTimes(1);
});
it('refuses a result when abort races the transport completion', async () => {
  const abort = new AbortController();
  rpc.mockImplementation(async () => { abort.abort(); return receipt(target()); });
  expect(await service.resolve(EVENT, { signal: abort.signal })).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_CANCELLED' });
});
it('uses the shared 15-second bound, aborts transport and never retries or accepts a late answer', async () => {
  jest.useFakeTimers(); const request = deferred(); rpc.mockReturnValue(request.promise);
  const pending = service.resolve(EVENT), published = jest.fn(); void pending.then(published);
  await jest.advanceTimersByTimeAsync(14_999); expect(published).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expect(await pending).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_UNCONFIRMED' });
  expect((rpc.mock.calls[0][2] as AbortSignal).aborted).toBe(true); expect(jest.getTimerCount()).toBe(0);
  request.resolve(receipt(target())); await Promise.resolve(); await Promise.resolve();
  expect(published).toHaveBeenCalledTimes(1); expect(rpc).toHaveBeenCalledTimes(1);
});
it('returns only allowlisted error text and never treats missing transport markers as unavailable', async () => {
  for (const response of [null, { data: unavailable() }, { data: null, error: { message: 'private raw error' } }]) {
    rpc.mockResolvedValueOnce(response);
    const result = await service.resolve(EVENT);
    expect(result).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_UNCONFIRMED' });
    expect(JSON.stringify(result)).not.toContain('private');
  }
  rpc.mockImplementationOnce(() => { throw new Error('private sync error'); });
  expect(await service.resolve(EVENT)).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_UNCONFIRMED' });
  rpc.mockRejectedValueOnce(new Error('private async error'));
  expect(await service.resolve(EVENT)).toMatchObject({ ok: false, kod: 'ACTIVITY_MESSAGE_TARGET_UNCONFIRMED' });
  rpc.mockResolvedValueOnce({ data: null, error: { message: 'AUTH_CONTEXT_CHANGED', details: 'private details' } });
  expect(await service.resolve(EVENT)).toEqual({ ok: false, kod: 'AUTH_CONTEXT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' });
});
it('the unused production singleton calls only the resolver RPC with its cancellation signal', async () => {
  const abortSignal = jest.fn().mockResolvedValue(receipt(target())), productionRpc = jest.fn(() => ({ abortSignal }));
  (supabaseKlijent as jest.Mock).mockReturnValue({ rpc: productionRpc });
  expect(await activityMessageTargetService.resolve(EVENT)).toEqual({ ok: true, podatak: target() });
  expect(productionRpc).toHaveBeenCalledTimes(1);
  expect(productionRpc).toHaveBeenCalledWith('rpc_resolve_activity_message_v1', { p_expected_user_id: ACCOUNT, p_event_id: EVENT });
  expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
});
