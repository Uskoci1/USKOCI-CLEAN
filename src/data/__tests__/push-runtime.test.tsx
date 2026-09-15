import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { Notification, NotificationHandler } from 'expo-notifications';
import { PushRuntime } from '../../ui/notifications/PushRuntime';
const mockPush = jest.fn(), mockCold = jest.fn(), mockClear = jest.fn(), mockSession = jest.fn(), mockRotate = jest.fn(), mockRevoke = jest.fn(), mockNative = jest.fn();
const mockSetHandler = jest.fn();
let mockHandler: NotificationHandler | null = null;
let mockActivity: AppStateStatus | null = 'active';
let mockTap: (value: unknown) => void, mockToken: () => void, mockActive: (value: AppStateStatus) => void;
let mockState: { user: { id: string } | null; accountRevision: number; sessionEpoch: number } = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockState, sesijaSada: () => mockState }));
jest.mock('react-native', () => {
 const native = jest.requireActual('react-native');
 const appState = { get currentState() { return mockActivity; }, addEventListener: jest.fn() };
 return new Proxy(native, { get(target, key) { return key === 'AppState' ? appState : Reflect.get(target, key); } });
});
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path) } }));
jest.mock('expo-notifications', () => ({
 setNotificationHandler: (handler: NotificationHandler | null) => { mockHandler = handler; mockSetHandler(handler); },
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
beforeEach(() => { jest.useRealTimers(); jest.resetAllMocks(); mockHandler = null; mockActivity = 'active'; jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, callback) => { mockActive = callback; return { remove: jest.fn() }; }); mockState = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 }; mockCold.mockResolvedValue(null); mockClear.mockResolvedValue(undefined); mockSession.mockResolvedValue({ ok: true, podatak: { kind: 'NONE' } }); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[new]', platform: 'ANDROID' }); mockRotate.mockResolvedValue({ ok: true }); mockRevoke.mockResolvedValue(true); });
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
 expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function)); expect(mockRotate).toHaveBeenCalledWith({ accountId: mockState.user!.id, accountRevision: 1 }, device, 'ExpoPushToken[new]', 'ANDROID');
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
 jest.replaceProperty(Platform, 'OS', 'web'); await mount(); expect(mockCold).not.toHaveBeenCalled(); expect(mockSession).not.toHaveBeenCalled(); expect(mockNative).not.toHaveBeenCalled(); expect(mockSetHandler).not.toHaveBeenCalled();
});

const notification = (content: Record<string, unknown> = {}) => ({ date: 1, request: { identifier: 'foreground', trigger: { type: 'push' },
 content: { title: 'USKOČI', subtitle: null, body: 'Imate novo obaveštenje. Otvorite aplikaciju.', data: { kind: 'INBOX' },
  categoryIdentifier: null, sound: 'default', ...content } } });
const hidden = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
const visible = { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
const present = (value: unknown = notification()) => mockHandler!.handleNotification(value as Notification);

it.each(['android', 'ios'] as const)('foreground public copy is immediate local presentation only on %s; a later tap still opens Inbox once', async platform => {
 jest.replaceProperty(Platform, 'OS', platform); await mount();
 mockSession.mockClear(); mockCold.mockClear();
 expect(await present(platform === 'ios' ? notification({ attachments: [], launchImageName: '', threadIdentifier: '', summaryArgument: '', badge: null, interruptionLevel: 'active' }) : notification())).toEqual(visible);
 expect(mockSession).not.toHaveBeenCalled(); expect(mockNative).not.toHaveBeenCalled(); expect(mockRotate).not.toHaveBeenCalled(); expect(mockRevoke).not.toHaveBeenCalled();
 expect(mockCold).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled(); expect(mockPush).not.toHaveBeenCalled();
 act(() => { mockTap({ notification: notification() }); mockTap({ notification: notification() }); });
 expect(mockPush.mock.calls).toEqual([['/obavestenja']]); expect(mockClear).toHaveBeenCalledTimes(1);
});
it.each([
 { title: 'Private person' }, { body: 'Private address' }, { subtitle: 'Private summary' },
 { data: { kind: 'INBOX', url: '/private' } }, { data: { kind: 'AGREEMENT' } }, { data: [] }, { data: null },
 { attachments: [{ url: 'https://private.example/image' }] }, { attachments: {} }, { summaryArgument: 'Private person' },
 { categoryIdentifier: 'ACCEPT' }, { launchImageName: 'private' }, { targetContentIdentifier: 'private' }, { threadIdentifier: 'private' },
 { sound: 'defaultCritical' }, { interruptionLevel: 'critical' },
])('foreground rejects noncanonical visible content or payload: %j', async content => {
 await mount(); expect(await present(notification(content))).toEqual(hidden); expect(mockPush).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
});
it.each([null, {}, { request: null }, { request: { identifier: '', content: notification().request.content, trigger: { type: 'push' } } },
 { request: { ...notification().request, trigger: { type: 'timeInterval' } } },
 { request: { ...notification().request, trigger: { type: 'push', remoteMessage: { notification: { imageUrl: 'https://private.example/image' } } } } },
])('foreground malformed/local/image notifications fail closed: %j', async value => {
 await mount(); expect(await present(value)).toEqual(hidden);
});
it('foreground does not wait for a hanging device RPC or acquire a token', async () => {
 mockSession.mockReturnValue(new Promise(() => undefined)); await mount();
 expect(await present()).toEqual(visible); expect(mockNative).not.toHaveBeenCalled(); expect(mockSession).toHaveBeenCalledTimes(1);
});
it.each(['background', 'inactive'] as AppStateStatus[])('foreground presentation closes in %s and resumes only on active', async state => {
 await mount(); act(() => mockActive(state)); expect(await present()).toEqual(hidden);
 act(() => mockActive('active')); expect(await present()).toEqual(visible);
});
it('unknown initial native activity state cannot display a notification', async () => {
 mockActivity = null; await mount(); expect(await present()).toEqual(hidden);
});
it.each(['different-account', 'account-ABA', 'session-refresh', 'logout'])('retained foreground callback rejects %s before React cleanup', async change => {
 await mount();
 mockState = { ...mockState, ...(change === 'different-account' ? { user: { id: 'other-account' }, accountRevision: 2 }
  : change === 'account-ABA' ? { accountRevision: 3 } : change === 'session-refresh' ? { sessionEpoch: 2 } : { user: null, accountRevision: 2 }) };
 expect(await present()).toEqual(hidden); expect(mockPush).not.toHaveBeenCalled();
});
it('Auth/recovery readiness removes the handler and a retained callback remains closed after a new owner resumes', async () => {
 await mount(); const previous = mockHandler!;
 act(() => tree.update(<PushRuntime ready={false} />)); expect(mockHandler).toBeNull(); expect(await previous.handleNotification(notification() as Notification)).toEqual(hidden);
 act(() => tree.update(<PushRuntime ready />)); await act(flush);
 expect(await present()).toEqual(visible); expect(await previous.handleNotification(notification() as Notification)).toEqual(hidden);
});
it('unmounted foreground callback cannot show or acknowledge anything', async () => {
 await mount(); const previous = mockHandler!; act(() => tree.unmount());
 expect(mockSetHandler).toHaveBeenLastCalledWith(null); expect(await previous.handleNotification(notification() as Notification)).toEqual(hidden);
 expect(mockPush).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled();
});
it('signed-out runtime never installs a foreground handler', async () => {
 mockState = { ...mockState, user: null }; await mount(); expect(mockSetHandler).not.toHaveBeenCalled();
});
