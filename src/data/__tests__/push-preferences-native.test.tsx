import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { PushPreferences } from '../../ui/notifications/PushPreferences';
const mockRead = jest.fn(), mockSave = jest.fn(), mockNative = jest.fn(), mockGet = jest.fn(), mockSet = jest.fn(), mockReadiness = jest.fn();
let mockAccount = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1 };
let mockBlur: (() => void) | undefined;
jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => void | (() => void)) => { const React = require('react'); React.useEffect(() => { const cleanup = callback(); mockBlur = typeof cleanup === 'function' ? cleanup : undefined; return cleanup; }, [callback]); } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockAccount, sesijaSada: () => mockAccount }));
jest.mock('../notificationPreferencesClientService', () => ({ notificationPreferencesClientService: { read: (...args: unknown[]) => mockRead(...args), save: (...args: unknown[]) => mockSave(...args) } }));
jest.mock('../nativePushDevice', () => ({ nativePushDevice: (...args: unknown[]) => mockNative(...args) }));
jest.mock('../pushDeviceClientService', () => ({ pushDeviceClientService: { read: (...args: unknown[]) => mockGet(...args), set: (...args: unknown[]) => mockSet(...args) } }));
jest.mock('../pushReadinessClientService', () => ({ pushReadinessClientService: { read: () => mockReadiness() } }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: (props: unknown) => require('react').createElement('Button', props) }));
jest.mock('../../ui/Text', () => ({ T: (props: unknown) => require('react').createElement('Text', props) }));
const settings = {
 in_app_enabled: true, push_enabled: false, opportunities_enabled: true, responses_enabled: true, dogovor_enabled: true,
 execution_enabled: true, recovery_enabled: true, account_enabled: true, quiet_hours_enabled: true,
 quiet_start: '22:00:00', quiet_end: '07:00:00', quiet_timezone: 'Europe/Belgrade', urgent_overrides_quiet_hours: false,
};
const preferences = { userId: '11111111-1111-4111-8111-111111111111', roleContext: 'REQUESTER', exists: true, revision: 2, updatedAt: '2026-09-10T20:00:00Z', settings };
let tree: Renderer.ReactTestRenderer;
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const button = (label: string) => tree.root.findAllByType('Button' as never).find(x => x.props.label === label)!;
const control = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
async function mount() { await act(async () => { tree = Renderer.create(<PushPreferences role="REQUESTER" />); await flush(); }); }
beforeEach(() => {
 jest.useRealTimers(); jest.resetAllMocks(); mockAccount = { user: { id: preferences.userId }, accountRevision: 1 };
 mockRead.mockResolvedValue(preferences); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
 mockGet.mockResolvedValue({ ok: true, podatak: { exists: false, revision: 0, active: false, sessionBound: false } });
 mockReadiness.mockResolvedValue({ ok: false });
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
const screenText = () => tree.root.findAllByType('Text' as never).map(x => x.props.children).flat().join(' ');
it('reads actual transport evidence independently and never turns a healthy tick into device delivery', async () => {
 mockReadiness.mockResolvedValue({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } });
 await mount(); expect(mockReadiness).toHaveBeenCalledTimes(1); expect(screenText()).toContain('Server je pri proveri uspešno');
 expect(screenText()).toContain('a ne potvrda da je obaveštenje stiglo'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});
it('transport failure preserves available device controls with honest missing evidence', async () => {
 mockReadiness.mockRejectedValue(Error('offline')); await mount(); expect(screenText()).toContain('Nema sveže potvrde');
 expect(button('Uključi push za ovu ulogu')).toBeDefined(); expect(mockSet).not.toHaveBeenCalled();
});
it('late transport result cannot replace a new account snapshot', async () => {
 let done!: (value: unknown) => void; mockReadiness.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 await mount(); mockAccount = { user: { id: preferences.userId }, accountRevision: 3 };
 await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 await act(async () => { done({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } }); await flush(); });
 expect(screenText()).not.toContain('Server je pri proveri uspešno'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});

it('exposes category controls and saves an explicit opt-out without silently enabling push', async () => {
 await mount();
 act(() => control('Nove prilike').props.onValueChange(false));
 expect(button('Uključi push za ovu ulogu').props.disabled).toBe(true);
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).toHaveBeenCalledTimes(1);
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...settings, opportunities_enabled: false }, 2);
 expect(mockNative).not.toHaveBeenCalledWith(true, expect.any(Function));
 expect(mockSet).not.toHaveBeenCalled();
});
it('saves overnight quiet hours, timezone and explicit HITNO override through the same revisioned settings writer', async () => {
 await mount();
 act(() => control('Početak tihih sati').props.onChangeText('23:15'));
 act(() => control('Kraj tihih sati').props.onChangeText('06:45'));
 act(() => control('Vremenska zona tihih sati').props.onChangeText('Europe/Belgrade'));
 act(() => control('HITNO može preko tihih sati').props.onValueChange(true));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', {
  ...settings, quiet_start: '23:15', quiet_end: '06:45', urgent_overrides_quiet_hours: true,
 }, 2);
 expect(mockSet).not.toHaveBeenCalled();
});
it('enabled quiet hours refuse incomplete or malformed local times before any write', async () => {
 await mount();
 act(() => control('Početak tihih sati').props.onChangeText('25:99'));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).not.toHaveBeenCalled(); expect(screenText()).toContain('Vreme unesite kao HH:MM');
});
it('a preference write with unknown outcome requires authoritative readback instead of a blind second write', async () => {
 await mount(); let done!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 act(() => control('Dogovor i poruke').props.onValueChange(false)); const save = button('Sačuvaj podešavanja').props.onPress;
 await act(async () => { save(); await flush(); });
 expect(mockSave).toHaveBeenCalledTimes(1);
 mockAccount = { user: { id: preferences.userId }, accountRevision: 3 };
 await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 done({ ...preferences, revision: 3 }); await act(flush);
 expect(mockSave).toHaveBeenCalledTimes(1);
});
