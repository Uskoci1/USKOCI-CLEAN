import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { PushPreferences } from '../../ui/notifications/PushPreferences';
const mockRead = jest.fn(), mockSave = jest.fn(), mockNative = jest.fn(), mockGet = jest.fn(), mockSet = jest.fn();
let mockAccount = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
let mockBlur: (() => void) | undefined;
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => { const React = require('react'); React.useEffect(() => { const cleanup = callback(); mockBlur = typeof cleanup === 'function' ? cleanup : undefined; return cleanup; }, [callback]); } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../notificationPreferencesClientService', () => ({ notificationPreferencesClientService: { read: (...args: unknown[]) => mockRead(...args), save: (...args: unknown[]) => mockSave(...args) } }));
jest.mock('../nativePushDevice', () => ({ nativePushDevice: (...args: unknown[]) => mockNative(...args) }));
jest.mock('../pushDeviceClientService', () => ({ pushDeviceClientService: { read: (...args: unknown[]) => mockGet(...args), set: (...args: unknown[]) => mockSet(...args) } }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: (props: unknown) => require('react').createElement('Button', props) }));
jest.mock('../../ui/Text', () => ({ T: (props: unknown) => require('react').createElement('Text', props) }));
const preferences = { userId: '11111111-1111-4111-8111-111111111111', roleContext: 'REQUESTER', exists: true, revision: 2, updatedAt: '2026-09-10T20:00:00Z', settings: { push_enabled: false, opportunities_enabled: false, quiet_hours_enabled: true, urgent_overrides_quiet_hours: false } };
let tree: Renderer.ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const button = (label: string) => tree.root.findAllByType('Button' as never).find(x => x.props.label === label)!;
async function mount() { await act(async () => { tree = Renderer.create(<PushPreferences role="REQUESTER" />); await flush(); }); }
beforeEach(() => {
 jest.useRealTimers(); jest.resetAllMocks(); mockAccount = { user: { id: preferences.userId }, accountRevision: 1 };
 mockRead.mockResolvedValue(preferences); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
 mockGet.mockResolvedValue({ ok: true, podatak: { exists: false, revision: 0, active: false, sessionBound: false } });
 mockSet.mockResolvedValue({ ok: true, podatak: { exists: true, revision: 1, active: true, sessionBound: true } }); mockSave.mockResolvedValue({ ...preferences, revision: 3 });
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
it('focus reads state without prompting, registering or changing consent', async () => { await mount(); expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function)); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); });
it('explicit enable preserves category/quiet fields, registers once and writes role-scoped consent', async () => {
 await mount(); const onPress = button('Uključi push za ovu ulogu').props.onPress;
 await act(async () => { onPress(); onPress(); await flush(); });
 expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).toHaveBeenCalledTimes(1);
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...preferences.settings, push_enabled: true }, 2);
 expect(mockNative).toHaveBeenCalledWith(true, expect.any(Function));
});
it('OS denial never registers or opts in', async () => { await mount(); mockNative.mockResolvedValue({ kind: 'DENIED' }); await act(async () => { button('Uključi push za ovu ulogu').props.onPress(); await flush(); }); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); });
it('unknown registration clears action and requires readback; retained callback cannot resend', async () => {
 await mount(); const old = button('Uključi push za ovu ulogu').props.onPress; mockSet.mockResolvedValue({ ok: false });
 await act(async () => { old(); await flush(); }); expect(button('Proverite stanje')).toBeDefined(); expect(button('Uključi push za ovu ulogu')).toBeUndefined();
 await act(async () => { old(); await flush(); }); expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
});
it('blur during permission/registration prevents later preference opt-in', async () => {
 await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
 await act(async () => { button('Uključi push za ovu ulogu').props.onPress(); await flush(); });
 act(() => mockBlur?.()); done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
});
it('account ABA while registration is pending cannot write preferences or expose old device state', async () => {
 await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
 await act(async () => { button('Uključi push za ovu ulogu').props.onPress(); await flush(); });
 mockAccount = { user: { id: preferences.userId }, accountRevision: 3 }; await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
});
it('role switch makes retained old action inert', async () => {
 await mount(); const old = button('Uključi push za ovu ulogu').props.onPress;
 act(() => { tree.update(<PushPreferences role="WORKER" />); }); await act(flush);
 await act(async () => { old(); await flush(); }); expect(mockSet).not.toHaveBeenCalled();
});
it('disable uses displayed revision and preserves all other settings', async () => {
 mockRead.mockResolvedValue({ ...preferences, settings: { ...preferences.settings, push_enabled: true } }); await mount();
 await act(async () => { button('Isključi push za ovu ulogu').props.onPress(); await flush(); }); expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...preferences.settings, push_enabled: false }, 2); expect(mockSet).not.toHaveBeenCalled();
});
