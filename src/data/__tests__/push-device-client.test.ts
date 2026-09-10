import { pushDeviceClientService, revokePushBeforeLogout } from '../pushDeviceClientService';
const mockRpc = jest.fn();
const id = '11111111-1111-4111-8111-111111111111', deviceId = '22222222-2222-4222-8222-222222222222';
let mockScope = { user: { id }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockScope }));
const scope = { accountId: id, accountRevision: 1 }, token = 'ExpoPushToken[synthetic]';
const receipt = { id: deviceId, active: true, platform: 'ANDROID', revision: 1, lastSeenAt: '2026-09-10T20:00:00Z', sessionBound: true };
beforeEach(() => { jest.useRealTimers(); mockRpc.mockReset(); mockScope = { user: { id }, accountRevision: 1 }; });
it('binds registration to account and exact device revision, without any preference write', async () => {
 mockRpc.mockResolvedValue({ data: receipt, error: null });
 expect((await pushDeviceClientService.set(scope, token, 'ANDROID', true, 0)).ok).toBe(true);
 expect(mockRpc.mock.calls).toEqual([['rpc_set_push_device_owned', { p_expected_user_id: id, p_expo_push_token: token, p_platform: 'ANDROID', p_active: true, p_expected_revision: 0 }]]);
});
it('absent registration is an explicit owned projection', async () => {
 mockRpc.mockResolvedValue({ data: { exists: false, active: false, revision: 0, sessionBound: false }, error: null });
 expect(await pushDeviceClientService.read(scope, token)).toMatchObject({ ok: true, podatak: { exists: false, id: null, revision: 0, active: false, sessionBound: false } });
 expect(mockRpc).toHaveBeenCalledWith('rpc_get_push_device_owned', { p_expected_user_id: id, p_expo_push_token: token });
});
it.each([{ ...receipt, revision: 2 }, { ...receipt, sessionBound: false }, { ...receipt, active: false }, { ...receipt, privateToken: token }, { ...receipt, revision: 9007199254740992 }, { ...receipt, id: 'bad' }])('rejects corrupt or mismatched registration receipt', async raw => {
 mockRpc.mockResolvedValue({ data: raw, error: null }); expect(await pushDeviceClientService.set(scope, token, 'ANDROID', true, 0)).toMatchObject({ ok: false, kod: 'PUSH_INVALID_RESPONSE' });
});
it('stale account and late ABA cannot begin or accept a registration', async () => {
 mockScope.accountRevision = 3; await pushDeviceClientService.set(scope, token, 'ANDROID', true, 0); expect(mockRpc).not.toHaveBeenCalled();
 mockScope.accountRevision = 1; let done!: (value: unknown) => void; mockRpc.mockReturnValue(new Promise(r => { done = r; }));
 const result = pushDeviceClientService.set(scope, token, 'ANDROID', true, 0); mockScope.accountRevision = 3; done({ data: receipt, error: null });
 expect(await result).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('unknown registration deadline is bounded and has no automatic replay', async () => {
 jest.useFakeTimers(); let done!: (value: unknown) => void; mockRpc.mockReturnValue(new Promise(r => { done = r; }));
 const pending = pushDeviceClientService.set(scope, token, 'ANDROID', true, 0); await jest.advanceTimersByTimeAsync(15000);
 expect(await pending).toMatchObject({ ok: false, kod: 'PUSH_UNCONFIRMED' }); done({ data: receipt, error: null }); await Promise.resolve(); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('logout push revocation is bounded at4s and cannot hold the Auth flow indefinitely', async () => {
 jest.useFakeTimers(); mockRpc.mockReturnValue(new Promise(() => undefined)); const pending = revokePushBeforeLogout(scope);
 await jest.advanceTimersByTimeAsync(4000); expect(await pending).toBe(false); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('logout accepts only exact owned revoke receipt and sanitizes provider errors', async () => {
 mockRpc.mockResolvedValue({ data: { userId: id, revoked: true }, error: null }); expect(await revokePushBeforeLogout(scope)).toBe(true);
 mockRpc.mockResolvedValue({ data: { userId: deviceId, revoked: true }, error: null }); expect(await revokePushBeforeLogout(scope)).toBe(false);
 mockRpc.mockRejectedValue(Error('PRIVATE SECRET')); expect(await revokePushBeforeLogout(scope)).toBe(false);
});
it.each(['NONE', 'AMBIGUOUS'])('current session %s never chooses a device implicitly', async kind => {
 mockRpc.mockResolvedValue({ data: { kind }, error: null }); expect(await pushDeviceClientService.sessionDevice(scope)).toMatchObject({ ok: true, podatak: { kind } });
 expect(mockRpc).toHaveBeenCalledWith('rpc_get_push_session_device', { p_expected_user_id: id });
});
it('validates current session device token without exposing arbitrary metadata', async () => {
 const data = { kind: 'DEVICE', id: deviceId, revision: 3, expoPushToken: token, platform: 'ANDROID' };
 mockRpc.mockResolvedValue({ data, error: null }); expect(await pushDeviceClientService.sessionDevice(scope)).toMatchObject({ ok: true, podatak: { id: deviceId, token } });
 mockRpc.mockResolvedValue({ data: { ...data, secret: 'never' }, error: null }); expect(await pushDeviceClientService.sessionDevice(scope)).toMatchObject({ ok: false });
});
it('atomic rotation sends exact old revision and accepts only linked retirement receipt', async () => {
 const old = { kind: 'DEVICE' as const, id: deviceId, revision: 3, token, platform: 'ANDROID' as const };
 const nextId = '33333333-3333-4333-8333-333333333333';
 mockRpc.mockResolvedValue({ data: { ...receipt, id: nextId, previousDeviceId: deviceId, previousRevision: 4 }, error: null });
 expect(await pushDeviceClientService.rotate(scope, old, 'ExpoPushToken[new]', 'ANDROID')).toMatchObject({ ok: true, podatak: { id: nextId } });
 expect(mockRpc).toHaveBeenCalledWith('rpc_rotate_push_device_owned', { p_expected_user_id: id, p_previous_device_id: deviceId, p_previous_revision: 3, p_expo_push_token: 'ExpoPushToken[new]', p_platform: 'ANDROID' });
 mockRpc.mockResolvedValue({ data: { ...receipt, id: nextId, previousDeviceId: nextId, previousRevision: 4 }, error: null });
 expect(await pushDeviceClientService.rotate(scope, old, 'ExpoPushToken[new]', 'ANDROID')).toMatchObject({ ok: false, kod: 'PUSH_INVALID_RESPONSE' });
});
