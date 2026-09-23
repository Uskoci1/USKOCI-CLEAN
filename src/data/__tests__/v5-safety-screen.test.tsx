import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockFocused = true;
const mockStorage = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
const mockSafety = { readBlock: jest.fn(), setBlock: jest.fn(), report: jest.fn(), readReportCommand: jest.fn() };
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...args: unknown[]) => mockStorage.getItem(...args), setItem: (...args: unknown[]) => mockStorage.setItem(...args), removeItem: (...args: unknown[]) => mockStorage.removeItem(...args),
} }));
jest.mock('../safetyClientService', () => ({ safetyClientService: {
  readBlock: (...args: unknown[]) => mockSafety.readBlock(...args), setBlock: (...args: unknown[]) => mockSafety.setBlock(...args),
  report: (...args: unknown[]) => mockSafety.report(...args), readReportCommand: (...args: unknown[]) => mockSafety.readReportCommand(...args),
}, SAFETY_CATEGORIES: ['HARASSMENT','FRAUD','UNSAFE_WORK','DISCRIMINATION','OTHER'] }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return key === 'View' ? 'View' : key === 'TextInput' ? 'Input' : Reflect.get(target, key);
} }); });
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsText: 'T', SettingsAction: 'Action' }));
import { SafetyScreen } from '../../ui/safety/SafetyScreen';
let tree: ReactTestRenderer;
const page = () => <SafetyScreen targetAccountId={B} needId={null} agreementId={null} />;
const render = async () => { await act(async () => { tree = create(page()); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const receipt = () => ({ reportId: K, received: true, clientRequestId: K, createdAt: '2026-09-13T00:00:00Z', idempotentReplay: true, authoritative: true });
const fill = async () => { await act(async () => {
  tree.root.findByProps({ accessibilityLabel: 'Uznemiravanje' }).props.onPress();
  tree.root.findByProps({ accessibilityLabel: 'Kratak razlog privatne prijave' }).props.onChangeText('Privatan razlog');
  tree.root.findByProps({ accessibilityLabel: 'Dodatni privatni opis' }).props.onChangeText('Privatan opis');
}); };
beforeEach(() => { jest.clearAllMocks(); for (const f of Object.values(mockStorage)) f.mockReset(); for (const f of Object.values(mockSafety)) f.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true;
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockSafety.readBlock.mockResolvedValue({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: false, revision: 0, authoritative: true } });
  mockSafety.report.mockResolvedValue({ ok: false, kod: 'UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: false, receipt: null } });
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('keeps five categories and sends only once on retained double tap, storing no report text', async () => {
  await render(); expect(tree.root.findAllByProps({ accessibilityRole: 'radio' })).toHaveLength(5); await fill();
  const send = action('Pošalji privatnu prijavu').onPress;
  await act(async () => { send(); send(); });
  expect(mockSafety.report).toHaveBeenCalledTimes(1);
  expect(mockStorage.setItem).toHaveBeenCalledWith(expect.stringContaining(`${A}:${B}`), K);
  expect(JSON.stringify(mockStorage.setItem.mock.calls)).not.toContain('Privatan');
  expect(mockSafety.report.mock.calls[0][0]).toMatchObject({ targetAccountId: B, category: 'HARASSMENT', reason: 'Privatan razlog', narrative: 'Privatan opis', clientRequestId: K });
  expect(mockSafety.setBlock).not.toHaveBeenCalled();
});
it('reads unknown receipt without another report and repeats only the frozen same request when asked', async () => {
  await render(); await fill(); await act(async () => action('Pošalji privatnu prijavu').onPress());
  await act(async () => action('Proveri potvrdu prijave').onPress());
  expect(mockSafety.report).toHaveBeenCalledTimes(1);
  await act(async () => action('Ponovi isti zahtev').onPress());
  expect(mockSafety.report.mock.calls[1][0]).toEqual(mockSafety.report.mock.calls[0][0]);
});
it('restores receipt after app recreation from opaque key without auto-submit', async () => {
  mockStorage.getItem.mockResolvedValue(K); mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: true, receipt: receipt() } });
  await render(); expect(mockSafety.readReportCommand).toHaveBeenCalledWith(K); expect(mockSafety.report).not.toHaveBeenCalled();
  expect(action('Nova privatna prijava')).toBeDefined();
});
it('cannot bypass a failed restore with a new command or send after blur', async () => {
  mockStorage.getItem.mockRejectedValue(new Error('LOCAL_READ_FAILED')); await render();
  expect(action('Pošalji privatnu prijavu').disabled).toBe(true); await act(async () => action('Pošalji privatnu prijavu').onPress());
  expect(mockStorage.setItem).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); mockStorage.getItem.mockResolvedValue(null); await render(); await fill();
  const send = action('Pošalji privatnu prijavu').onPress; mockFocused = false; await act(async () => tree.update(page()));
  await act(async () => send()); expect(mockSafety.report).not.toHaveBeenCalled();
});
it('a grey send button carries its reason until a category and a short reason are given', async () => {
  const copy = () => tree.root.findAll(n => n.type === 'T' as React.ElementType).flatMap(n => n.children.filter(c => typeof c === 'string')).join(' ');
  await render(); expect(action('Pošalji privatnu prijavu').disabled).toBe(true);
  expect(copy()).toContain('Izaberi kategoriju i upiši kratak razlog da bi slanje bilo dostupno.');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Uznemiravanje' }).props.onPress());
  expect(copy()).toContain('Upiši kratak razlog da bi slanje bilo dostupno.');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Kratak razlog privatne prijave' }).props.onChangeText('Privatan razlog'));
  expect(action('Pošalji privatnu prijavu').disabled).toBe(false); expect(copy()).not.toContain('da bi slanje bilo dostupno');
  expect(mockSafety.report).not.toHaveBeenCalled();
});
it('checks account again after pending local persistence before network I/O', async () => {
  let resolve!: () => void; mockStorage.setItem.mockImplementation(() => new Promise<void>(r => { resolve = r; }));
  await render(); await fill(); await act(async () => action('Pošalji privatnu prijavu').onPress());
  mockSession = { user: { id: B }, accountRevision: 2 }; await act(async () => resolve()); expect(mockSafety.report).not.toHaveBeenCalled();
});
