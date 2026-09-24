import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, StyleSheet } from 'react-native';
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
// The settings rows are pressable now; Press reaches the native gesture and haptics layers.
jest.mock('../../ui/Press', () => ({ Press: (props: unknown) => require('react').createElement('Press', props) }));
// Quiet hours are picked, no longer typed: the native picker is a host here, driven the way the calendar suites drive it.
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
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
async function mount(role: 'REQUESTER' | 'WORKER' = 'REQUESTER', onDirtyChange?: (dirty: boolean) => void) {
 await act(async () => { tree = Renderer.create(<PushPreferences role={role} onDirtyChange={onDirtyChange} />); await flush(); });
}
/** Picks a clock time in a quiet-hours field the way a person does: open the picker, choose, accept (iOS asks to accept). */
async function pickTime(label: string, hours: number, minutes: number) {
 await act(async () => { control(label).props.onPress(); });
 // The runner is in UTC, so the picker's local clock is the UTC clock of this instant.
 const chosen = new Date(Date.UTC(2026, 8, 24, hours, minutes));
 await act(async () => { tree.root.findByType('DateTimePicker' as never).props.onValueChange({}, chosen); });
 const accept = tree.root.findAllByType('Button' as never).find(x => x.props.label === 'Izaberi');
 if (accept) await act(async () => { accept.props.onPress(); });
}
beforeEach(() => {
 jest.useRealTimers(); jest.resetAllMocks(); mockAccount = { user: { id: preferences.userId }, accountRevision: 1 };
 mockRead.mockResolvedValue(preferences); mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
 mockGet.mockResolvedValue({ ok: true, podatak: { exists: false, revision: 0, active: false, sessionBound: false } });
 mockReadiness.mockResolvedValue({ ok: false });
 mockSet.mockResolvedValue({ ok: true, podatak: { exists: true, revision: 1, active: true, sessionBound: true } }); mockSave.mockResolvedValue({ ...preferences, revision: 3 });
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
it('focus reads state without prompting, registering or changing consent', async () => { await mount(); expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function)); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); });
it('a failed initial read can be retried without prompting or writing preferences', async () => {
 mockRead.mockRejectedValueOnce(Error('offline')); await mount();
 expect(button('Proveri stanje').props.disabled).toBe(false);
 await act(async () => { button('Proveri stanje').props.onPress(); await flush(); });
 expect(mockRead).toHaveBeenCalledTimes(2);
 expect(button('Proveri stanje')).toBeUndefined();
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(false);
 expect(mockNative).toHaveBeenCalledWith(false, expect.any(Function));
 expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});
it('after an uncertain save only readback is available, and repeated retry taps start one read', async () => {
 await mount(); act(() => control('Dogovor i poruke').props.onPress());
 mockSave.mockRejectedValueOnce(Error('lost acknowledgement'));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
 expect(control('Početak tihih sati').props.accessibilityState.disabled).toBe(true);
 expect(button('Proveri stanje').props.disabled).toBe(false);
 let done!: (value: unknown) => void;
 mockRead.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 const retry = button('Proveri stanje').props.onPress;
 await act(async () => { retry(); retry(); await flush(); });
 expect(mockRead).toHaveBeenCalledTimes(2);
 expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
 await act(async () => { done({ ...preferences, revision: 3, settings: { ...settings, dogovor_enabled: false } }); await flush(); });
 expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(false);
 expect(button('Sačuvaj podešavanja').props.disabled).toBe(true);
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(false);
 expect(mockSave).toHaveBeenCalledTimes(1); expect(mockSet).not.toHaveBeenCalled();
});
it('explicit enable preserves category/quiet fields, registers once and writes role-scoped consent', async () => {
 await mount(); const onPress = button('Uključi obaveštenja na telefonu').props.onPress;
 await act(async () => { onPress(); onPress(); await flush(); });
 expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).toHaveBeenCalledTimes(1);
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...preferences.settings, push_enabled: true }, 2);
 expect(mockNative).toHaveBeenCalledWith(true, expect.any(Function));
});
it('OS denial never registers or opts in', async () => { await mount(); mockNative.mockResolvedValue({ kind: 'DENIED' }); await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); }); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); });
it('unknown registration clears action and requires readback; retained callback cannot resend', async () => {
 await mount(); const old = button('Uključi obaveštenja na telefonu').props.onPress; mockSet.mockResolvedValue({ ok: false });
 // The settings are no longer wiped off the screen by an unconfirmed outcome, so the control is
 // still there — locked until the state is read back, which is what it was protecting.
 await act(async () => { old(); await flush(); }); expect(button('Proveri stanje')).toBeDefined();
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
 await act(async () => { old(); await flush(); }); expect(mockSet).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled();
});
it('blur during permission/registration prevents later preference opt-in', async () => {
 await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
 await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
 act(() => mockBlur?.()); done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
});
it('account ABA while registration is pending cannot write preferences or expose old device state', async () => {
 await mount(); let done!: (value: unknown) => void; mockSet.mockReturnValue(new Promise(r => { done = r; }));
 await act(async () => { button('Uključi obaveštenja na telefonu').props.onPress(); await flush(); });
 mockAccount = { user: { id: preferences.userId }, accountRevision: 3 }; await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 done({ ok: true, podatak: {} }); await act(flush); expect(mockSave).not.toHaveBeenCalled();
});
it('role switch makes retained old action inert', async () => {
 await mount(); const old = button('Uključi obaveštenja na telefonu').props.onPress;
 act(() => { tree.update(<PushPreferences role="WORKER" />); }); await act(flush);
 await act(async () => { old(); await flush(); }); expect(mockSet).not.toHaveBeenCalled();
});
it('disable uses displayed revision and preserves all other settings', async () => {
 mockRead.mockResolvedValue({ ...preferences, settings: { ...preferences.settings, push_enabled: true } }); await mount();
 await act(async () => { button('Isključi obaveštenja na telefonu').props.onPress(); await flush(); }); expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...preferences.settings, push_enabled: false }, 2); expect(mockSet).not.toHaveBeenCalled();
});
const screenText = () => tree.root.findAllByType('Text' as never).map(x => x.props.children).flat().join(' ');
it('reads actual transport evidence independently and never turns a healthy tick into device delivery', async () => {
 mockReadiness.mockResolvedValue({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } });
 await mount(); expect(mockReadiness).toHaveBeenCalledTimes(1); expect(screenText()).toContain('Pri poslednjoj proveri slanje obaveštenja je radilo');
 expect(screenText()).toContain('a ne potvrda da je obaveštenje stiglo'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});
it('transport failure preserves available device controls with honest missing evidence', async () => {
 mockReadiness.mockRejectedValue(Error('offline')); await mount(); expect(screenText()).toContain('Još ne možemo da potvrdimo da slanje obaveštenja radi');
 expect(button('Uključi obaveštenja na telefonu')).toBeDefined(); expect(mockSet).not.toHaveBeenCalled();
});
it('late transport result cannot replace a new account snapshot', async () => {
 let done!: (value: unknown) => void; mockReadiness.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 await mount(); mockAccount = { user: { id: preferences.userId }, accountRevision: 3 };
 await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 await act(async () => { done({ ok: true, podatak: { state: 'OPERATIONAL', checkedAt: '2026-09-13T00:00:00Z' } }); await flush(); });
 expect(screenText()).not.toContain('Pri poslednjoj proveri slanje obaveštenja je radilo'); expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
});

it('exposes category controls and saves an explicit opt-out without silently enabling push', async () => {
 await mount();
 act(() => control('Prijave i odgovori').props.onPress());
 expect(button('Uključi obaveštenja na telefonu').props.disabled).toBe(true);
 // The phone waits for the change to be saved first, and says so.
 expect(button('Uključi obaveštenja na telefonu').props.reason).toBe('Prvo sačuvaj izmene kategorija i tihih sati.');
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).toHaveBeenCalledTimes(1);
 // The REQUESTER set has no "Novi zadaci" switch, and the value it would hold is written back unchanged.
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', { ...settings, responses_enabled: false }, 2);
 expect(mockNative).not.toHaveBeenCalledWith(true, expect.any(Function));
 expect(mockSet).not.toHaveBeenCalled();
});
it('saves overnight quiet hours, timezone and explicit HITNO override through the same revisioned settings writer', async () => {
 await mount();
 await pickTime('Početak tihih sati', 23, 15);
 await pickTime('Kraj tihih sati', 6, 45);
 // The zone is no longer typed by hand; the saved value is the one that was read back, and the
 // only way to change it is the explicit "use the phone's zone" action.
 act(() => control('Hitno može i tokom tihih sati').props.onPress());
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).toHaveBeenCalledWith(preferences.userId, 'REQUESTER', {
  ...settings, quiet_start: '23:15', quiet_end: '06:45', urgent_overrides_quiet_hours: true,
 }, 2);
 expect(mockSet).not.toHaveBeenCalled();
});
it('enabled quiet hours refuse incomplete or malformed local times before any write', async () => {
 // A time can no longer be typed; a malformed one can still come back from the server, and it is never written on.
 mockRead.mockResolvedValue({ ...preferences, settings: { ...settings, quiet_start: '25:99' } }); await mount();
 act(() => control('Dogovor i poruke').props.onPress());
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).not.toHaveBeenCalled(); expect(screenText()).toContain('Vreme tihih sati nije ispravno');
});
it('enabled quiet hours without an end are refused with a sentence that says what to pick', async () => {
 mockRead.mockResolvedValue({ ...preferences, settings: { ...settings, quiet_end: null } }); await mount();
 act(() => control('Dogovor i poruke').props.onPress());
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(mockSave).not.toHaveBeenCalled(); expect(screenText()).toContain('Za tihe sate izaberi početak i kraj.');
});
it('a preference write with unknown outcome requires authoritative readback instead of a blind second write', async () => {
 await mount(); let done!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { done = resolve; }));
 act(() => control('Dogovor i poruke').props.onPress()); const save = button('Sačuvaj podešavanja').props.onPress;
 await act(async () => { save(); await flush(); });
 expect(mockSave).toHaveBeenCalledTimes(1);
 mockAccount = { user: { id: preferences.userId }, accountRevision: 3 };
 await act(async () => { tree.update(<PushPreferences role="REQUESTER" />); await flush(); });
 done({ ...preferences, revision: 3 }); await act(flush);
 expect(mockSave).toHaveBeenCalledTimes(1);
});

// Step 11a (2026-09-24): the look of the screen, over the same commands.
it('shows the "Novi zadaci" switch only in the set that receives new tasks', async () => {
 await mount('WORKER');
 expect(control('Novi zadaci')).toBeDefined();
 act(() => tree.unmount());
 await mount('REQUESTER');
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Novi zadaci' })).toHaveLength(0);
 expect(screenText()).not.toContain('Nove prilike');
});
it('a switch row is one focus stop, spoken as a switch, drawn green on white instead of the platform teal', async () => {
 await mount();
 const row = control('Dogovor i poruke');
 expect(row.props.accessibilityRole).toBe('switch');
 expect(row.props.accessibilityState).toEqual({ checked: true, disabled: false });
 const drawn = row.findByProps({ importantForAccessibility: 'no-hide-descendants' });
 const toggle = drawn.findByProps({ value: true });
 expect(toggle.props.accessibilityLabel).toBeUndefined();
 expect(toggle.props.trackColor).toEqual({ false: '#C9D6CF', true: '#076E4E' });
 expect(toggle.props.thumbColor).toBe('#FFFFFF');
});
it('the one green action is Save, in the footer, grey with its reason until something changes', async () => {
 await mount();
 const save = button('Sačuvaj podešavanja');
 expect(StyleSheet.flatten(save.props.style).backgroundColor).toBe('#076E4E');
 expect(save.props.disabled).toBe(true);
 expect(save.props.reason).toBe('Dugme se uključuje kad promeniš neko podešavanje.');
 expect(tree.root.findByProps({ testID: 'settings-primary-footer' }).findAllByType('Button' as never).map(x => x.props.label)).toEqual(['Sačuvaj podešavanja']);
 const greens = tree.root.findAllByType('Button' as never).filter(x => StyleSheet.flatten(x.props.style)?.backgroundColor === '#076E4E');
 expect(greens).toHaveLength(1);
});
it('reports unsaved changes to the route, and shows the check only once the saved values are read back', async () => {
 const dirty = jest.fn(); await mount('REQUESTER', dirty);
 expect(dirty).toHaveBeenLastCalledWith(false);
 act(() => control('Dogovor i poruke').props.onPress());
 expect(dirty).toHaveBeenLastCalledWith(true);
 let answer!: (value: unknown) => void; mockSave.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
 await act(async () => { button('Sačuvaj podešavanja').props.onPress(); await flush(); });
 expect(button('Sačuvaj podešavanja').props.loading).toBe(true); expect(button('Sačuvaj podešavanja').props.success).toBe(false);
 mockRead.mockResolvedValueOnce({ ...preferences, revision: 3, settings: { ...settings, dogovor_enabled: false } });
 await act(async () => { answer({ ...preferences, revision: 3 }); await flush(); });
 expect(button('Sačuvaj podešavanja').props.success).toBe(true);
 expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(false);
 expect(dirty).toHaveBeenLastCalledWith(false);
 act(() => control('Izvršenje i završetak').props.onPress());
 expect(button('Sačuvaj podešavanja').props.success).toBe(false);
});
it('an emulator is told honestly that it cannot receive notifications, with nothing to press', async () => {
 mockNative.mockResolvedValue({ kind: 'UNSUPPORTED' }); await mount();
 expect(screenText()).toContain('Nije dostupno na ovom uređaju');
 for (const label of ['Uključi obaveštenja na telefonu', 'Isključi obaveštenja na telefonu', 'Podešavanja telefona', 'Osveži stanje']) expect(button(label)).toBeUndefined();
});
it('a phone that refuses notifications says so first and reads again when the person comes back from its settings', async () => {
 const listeners: ((state: string) => void)[] = [];
 const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: string) => void) => {
  listeners.push(handler); return { remove: jest.fn() }; }) as never);
 try {
  mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
  expect(screenText()).toContain('Telefon ne dozvoljava obaveštenja');
  expect(button('Podešavanja telefona')).toBeDefined(); expect(button('Uključi obaveštenja na telefonu')).toBeUndefined();
  expect(mockRead).toHaveBeenCalledTimes(1);
  mockNative.mockResolvedValue({ kind: 'READY', token: 'ExpoPushToken[synthetic]', platform: 'ANDROID' });
  await act(async () => { listeners.forEach(listener => listener('active')); await flush(); });
  expect(mockRead).toHaveBeenCalledTimes(2); expect(mockNative).toHaveBeenLastCalledWith(false, expect.any(Function));
  expect(button('Uključi obaveštenja na telefonu')).toBeDefined();
  expect(mockSet).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled();
 } finally { spy.mockRestore(); }
});
it('coming back to the app never reads over unsaved changes', async () => {
 const listeners: ((state: string) => void)[] = [];
 const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, handler: (state: string) => void) => {
  listeners.push(handler); return { remove: jest.fn() }; }) as never);
 try {
  mockNative.mockResolvedValue({ kind: 'DENIED' }); await mount();
  act(() => control('Dogovor i poruke').props.onPress());
  await act(async () => { listeners.forEach(listener => listener('active')); await flush(); });
  expect(mockRead).toHaveBeenCalledTimes(1);
  expect(control('Dogovor i poruke').props.accessibilityState.checked).toBe(false);
 } finally { spy.mockRestore(); }
});
