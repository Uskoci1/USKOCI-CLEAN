import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { PushRuntime } from '../../ui/notifications/PushRuntime';
const mockPush = jest.fn(), mockCold = jest.fn(), mockClear = jest.fn(), mockSession = jest.fn(), mockRotate = jest.fn(), mockRevoke = jest.fn(), mockNative = jest.fn();
let mockTap: (value: unknown) => void, mockToken: () => void, mockActive: (value: AppStateStatus) => void;
let mockState = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockState, sesijaSada: () => mockState }));
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path) } }));
jest.mock('expo-notifications', () => ({
 addNotificationResponseReceivedListener: (callback: (x: unknown) => void) => { mockTap = callback; return { remove: jest.fn() }; },
 addPushTokenListener: (callback: () => void) => { mockToken = callback; return { remove: jest.fn() }; },
 getLastNotificationResponseAsync: () => mockCold(), clearLastNotificationResponseAsync: () => mockClear(),
}));
jest.mock('../nativePushDevice', () => ({ nativePushDevice: (...args: unknown[]) => mockNative(...args) }));
jest.mock('../pushDeviceClientService', () => ({ pushDeviceClientService: { sessionDevice: (...args: unknown[]) => mockSession(...args), rotate: (...args: unknown[]) => mockRotate(...args) }, revokePushBeforeLogout: (...args: unknown[]) => mockRevoke(...args) }));
const device = { kind: 'DEVICE', id: '22222222-2222-4222-8222-222222222222', revision: 3, token: 'ExpoPushToken[old]', platform: 'ANDROID' };
const response = (identifier = 'one', data: unknown = { kind: 'INBOX' }) => ({ notification: { request: { identifier, content: { data } } } });
let tree: Renderer.ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function mount(ready = true) { await act(async () => { tree = Renderer.create(<PushRuntime ready={ready} />); await flush(); }); }
beforeEach(() => { jest.useRealTimers(); jest.resetAllMocks(); jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, callback) => { mockActive = callback; return { remove: jest.fn() }; }); mockState = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 }; mockCold.mockResolvedValue(null); mockClear.mockResolvedValue(undefined); mockSession.mockResolvedValue({ ok: true, podatak: { kind: 'NONE' } }); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[new]', platform: 'ANDROID' }); mockRotate.mockResolvedValue({ ok: true }); mockRevoke.mockResolvedValue(true); });
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
it('no registered session never acquires a token, requests permission, or auto-registers', async () => { await mount(); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled(); });
it('cold response and same live tap navigate once to the fixed owned Inbox', async () => { mockCold.mockResolvedValue(response()); await mount(); act(() => mockTap(response())); expect(mockPush.mock.calls).toEqual([['/obavestenja']]); expect(mockClear).toHaveBeenCalledTimes(1); });
it.each([{ kind: 'INBOX', url: 'https://evil.test' }, { kind: 'AGREEMENT', id: 'private' }, [], null])('untrusted payload cannot select a route', async data => { await mount(); act(() => mockTap(response('one', data))); expect(mockPush).not.toHaveBeenCalled(); });
it('late cold response after account ABA is discarded, without a new-account cold replay', async () => {
 let done!: (value: unknown) => void; mockCold.mockReturnValue(new Promise(r => { done = r; })); await mount();
 mockState = { ...mockState, accountRevision: 3, sessionEpoch: 3 }; act(() => tree.update(<PushRuntime ready />)); await act(flush); done(response()); await act(flush);
 expect(mockPush).not.toHaveBeenCalled(); expect(mockCold).toHaveBeenCalledTimes(1);
});
it('retained listener after unmount cannot navigate', async () => { await mount(); const previous = mockTap; act(() => tree.unmount()); act(() => previous(response())); expect(mockPush).not.toHaveBeenCalled(); });
it('same explicit bound device rotates once and never enables preferences', async () => {
 mockSession.mockResolvedValue({ ok: true, podatak: device }); await mount();
 expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function)); expect(mockRotate).toHaveBeenCalledWith({ accountId: mockState.user.id, accountRevision: 1 }, device, 'ExpoPushToken[new]', 'ANDROID');
});
it('ambiguous registrations are never guessed by order', async () => { mockSession.mockResolvedValue({ ok: true, podatak: { kind: 'AMBIGUOUS' } }); await mount(); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled(); });
it('OS denial revokes the current session and does not attempt rotation', async () => { mockSession.mockResolvedValue({ ok: true, podatak: device }); mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount(); expect(mockRevoke).toHaveBeenCalledTimes(1); expect(mockRotate).not.toHaveBeenCalled(); });
it('unknown rotation only reads back; repeated activation or token event cannot replay it', async () => {
 mockSession.mockResolvedValue({ ok: true, podatak: device }); mockRotate.mockResolvedValue({ ok: false }); await mount(); expect(mockSession).toHaveBeenCalledTimes(2);
 await act(async () => { mockToken(); await flush(); mockActive('active'); await flush(); }); expect(mockRotate).toHaveBeenCalledTimes(1);
});
it('deferred device read across account/session refresh cannot invoke native token or write', async () => {
 let done!: (value: unknown) => void; mockSession.mockReturnValueOnce(new Promise(r => { done = r; })); await mount();
 mockState = { ...mockState, sessionEpoch: 2 }; act(() => tree.update(<PushRuntime ready />)); await act(flush); done({ ok: true, podatak: device }); await act(flush); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled();
});
it('a stuck native read times out and its late result cannot rotate', async () => {
 jest.useFakeTimers(); mockSession.mockResolvedValue({ ok: true, podatak: device }); let done!: (value: unknown) => void; mockNative.mockReturnValue(new Promise(r => { done = r; })); await mount();
 await act(async () => { await jest.advanceTimersByTimeAsync(20000); }); done({ kind: 'READY', token: 'ExpoPushToken[new]', platform: 'ANDROID' }); await act(flush); expect(mockRotate).not.toHaveBeenCalled();
});
it('waits for router/auth readiness, then picks up cold tap once without remount', async () => {
 mockCold.mockResolvedValue(response()); await mount(false); expect(mockCold).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled();
 act(() => tree.update(<PushRuntime ready />)); await act(flush); expect(mockPush).toHaveBeenCalledTimes(1);
 act(() => tree.update(<PushRuntime ready={false} />)); act(() => tree.update(<PushRuntime ready />)); await act(flush); expect(mockCold).toHaveBeenCalledTimes(1);
});
it('web never invokes unsupported notification listener or native APIs', async () => {
 jest.replaceProperty(Platform, 'OS', 'web'); await mount(); expect(mockCold).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled(); expect(mockNative).not.toHaveBeenCalled();
});
