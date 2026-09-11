jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { requesterProfileClientService as service } from '../requesterProfileClientService';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const P = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', K = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
const identity = () => ({ schema: 'REQUESTER_IDENTITY_V1', accountId: A, profileId: P, displayName: 'Miloš Šljivić', revision: 'a'.repeat(64), writableFields: ['displayName'] });
const command = () => ({ expectedRevision: 'b'.repeat(64), displayName: 'Miloš Šljivić', clientRequestId: K });
const receipt = () => ({ saved: true, idempotentReplay: false, clientRequestId: K, identity: identity() });
beforeEach(() => { mockRpc.mockReset(); mockSession = { user: { id: A }, accountRevision: 1 }; });
it('reads a bounded owner-only schema with no phone, email, rating, verification or extra fields', async () => {
  mockRpc.mockResolvedValue({ data: { ...identity(), email: 'private', phone: 'private', verified: true, rating: 5 }, error: null });
  expect(await service.read()).toEqual({ ok: true, podatak: identity() });
  expect(mockRpc).toHaveBeenCalledWith('rpc_get_requester_profile_for_edit', {});
});
it.each([
  { accountId: B }, { schema: 'PUBLIC' }, { profileId: 'invalid' }, { revision: '1' }, { displayName: 2 },
  { writableFields: ['displayName', 'city'] }, { writableFields: 'displayName' }, { displayName: 'x'.repeat(8001) },
])('rejects malformed or foreign authoritative identity %j', async patch => {
  mockRpc.mockResolvedValue({ data: { ...identity(), ...patch }, error: null });
  expect((await service.read()).ok).toBe(false);
});
it('keeps a blank historical name on read; does not invent a new user identity', async () => {
  mockRpc.mockResolvedValue({ data: { ...identity(), displayName: '' }, error: null });
  expect(await service.read()).toMatchObject({ ok: true, podatak: { displayName: '' } });
});
it('saves only frozen existing field and verifies exact command receipt', async () => {
  mockRpc.mockResolvedValue({ data: receipt(), error: null });
  const input = { ...command(), displayName: '  Miloš Šljivić  ', avatarPath: 'forged', city: 'not supported' };
  const request = service.save(input); input.displayName = 'MUTATED DURING REQUEST';
  expect(await request).toMatchObject({ ok: true, podatak: receipt() });
  expect(mockRpc).toHaveBeenCalledWith('rpc_save_requester_profile', { p_display_name: 'Miloš Šljivić', p_expected_revision: 'b'.repeat(64), p_client_request_id: K });
});
it.each(['', '  ', 'x'.repeat(201), 'A\nB', 'A\u0000B', 'A\u007fB', 123, true, null, [], {}])('rejects invalid new display name before I/O %j', async displayName => {
  expect((await service.save({ ...command(), displayName } as never)).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{ expectedRevision: 'stale' }, { clientRequestId: 'invalid' }])('requires revision and idempotency key', async patch => {
  expect((await service.save({ ...command(), ...patch })).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{ saved: false }, { clientRequestId: B }, { idempotentReplay: 'true' }, { identity: { ...identity(), displayName: 'OTHER' } }, { identity: { ...identity(), accountId: B } }])('does not trust a malformed write receipt %j', async patch => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), ...patch }, error: null });
  expect(await service.save(command())).toMatchObject({ ok: false, kod: 'REQUESTER_PROFILE_INVALID_RECEIPT' });
});
it('preserves immutable server replay without synthesizing the current revision', async () => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), idempotentReplay: true }, error: null });
  expect(await service.save(command())).toMatchObject({ ok: true, podatak: { idempotentReplay: true, identity: { revision: 'a'.repeat(64) } } });
});
it.each(['REQUESTER_PROFILE_STALE', 'REQUEST_ID_REUSED', 'REQUESTER_PROFILE_RESTRICTED'])('maps typed server denial %s', async code => {
  mockRpc.mockResolvedValue({ data: null, error: { message: code, details: 'SECRET' } });
  const result = await service.save(command()); expect(result).toMatchObject({ ok: false, kod: code }); expect(JSON.stringify(result)).not.toContain('SECRET');
});
it('fences transport uncertainty without replay or raw diagnostics', async () => {
  mockRpc.mockRejectedValue(new Error('postgres secret TOKEN'));
  const result = await service.save(command()); expect(result).toMatchObject({ ok: false, kod: 'REQUESTER_PROFILE_OUTCOME_UNKNOWN' });
  expect(JSON.stringify(result)).not.toContain('TOKEN'); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it.each([A, B])('fences a late write receipt after session generation changed to %s', async id => {
  let resolve!: (x: unknown) => void; mockRpc.mockImplementation(() => new Promise(done => { resolve = done; }));
  const request = service.save(command()); mockSession = { user: { id }, accountRevision: 3 };
  resolve({ data: receipt(), error: null }); expect(await request).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('rejects an explicit stale account before any RPC', async () => {
  expect(await service.read({ accountId: A, accountRevision: 0 })).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' }); expect(mockRpc).not.toHaveBeenCalled();
});
