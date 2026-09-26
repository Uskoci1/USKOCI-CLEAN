import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockFocused = true;
let mockContext: { targetAccountId: string; needId: string | null; agreementId: string | null } = { targetAccountId: B, needId: null, agreementId: null };
const mockRequestId = jest.fn(() => K);
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
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => mockRequestId() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return key === 'View' ? 'View' : key === 'TextInput' ? 'Input' : Reflect.get(target, key);
} }); });
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsText: 'T', SettingsAction: 'Action' }));
import { SafetyScreen } from '../../ui/safety/SafetyScreen';
let tree: ReactTestRenderer;
const page = () => <SafetyScreen {...mockContext} />;
const render = async () => { await act(async () => { tree = create(page()); }); };
const update = async () => { await act(async () => tree.update(page())); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const confirmButton = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-confirm')[0];
const confirmBlock = async () => { const confirm = confirmButton(); expect(confirm).toBeDefined(); await act(async () => confirm.props.onPress()); };
const copy = () => tree.root.findAll(n => String(n.type) === 'T').flatMap(n => n.children.filter(c => typeof c === 'string')).join(' ');
const receipt = () => ({ reportId: K, received: true, clientRequestId: K, createdAt: '2026-09-13T00:00:00Z', idempotentReplay: true, authoritative: true });
const fill = async () => { await act(async () => {
  tree.root.findByProps({ accessibilityLabel: 'Uznemiravanje' }).props.onPress();
  tree.root.findByProps({ accessibilityLabel: 'Kratak razlog privatne prijave' }).props.onChangeText('Privatan razlog');
  tree.root.findByProps({ accessibilityLabel: 'Dodatni privatni opis' }).props.onChangeText('Privatan opis');
}); };
beforeEach(() => { jest.clearAllMocks(); for (const f of Object.values(mockStorage)) f.mockReset(); for (const f of Object.values(mockSafety)) f.mockReset();
  mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true;
  mockContext = { targetAccountId: B, needId: null, agreementId: null };
  mockStorage.getItem.mockResolvedValue(null); mockStorage.setItem.mockResolvedValue(undefined); mockStorage.removeItem.mockResolvedValue(undefined);
  mockSafety.readBlock.mockImplementation(async (targetAccountId: string) => ({ ok: true,
    podatak: { accountId: mockSession.user.id, targetAccountId, blocked: false, revision: 0, authoritative: true } }));
  mockSafety.setBlock.mockImplementation(async (command: { targetAccountId: string; blocked: boolean; expectedRevision: number; clientRequestId: string }) => ({ ok: true,
    podatak: { accountId: mockSession.user.id, targetAccountId: command.targetAccountId, blocked: command.blocked,
      revision: command.expectedRevision + 1, clientRequestId: command.clientRequestId, authoritative: true, idempotentReplay: false } }));
  mockSafety.report.mockResolvedValue({ ok: false, kod: 'UNKNOWN', poruka: 'Ishod nije potvrđen.' });
  mockSafety.readReportCommand.mockResolvedValue({ ok: true, podatak: { found: false, receipt: null } });
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('asks the existing block consequence first; cancel sends nothing and a fresh confirmation sends the exact choice once', async () => {
  await render(); await act(async () => action('Blokiraj korisnika').onPress());
  expect(copy()).toContain('Blokirati korisnika?');
  expect(copy()).toContain('Blokiranje zaustavlja običan kontakt i nova povezivanja. Završetak, otkazivanje i prijava problema u postojećem Dogovoru ostaju dostupni.');
  expect(mockSafety.setBlock).not.toHaveBeenCalled(); expect(mockRequestId).not.toHaveBeenCalled();
  const canceled = confirmButton().props.onPress;
  await act(async () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'confirm-sheet-cancel')[0].props.onPress());
  await act(async () => canceled());
  expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).not.toHaveBeenCalled(); expect(mockRequestId).not.toHaveBeenCalled();
  await act(async () => action('Blokiraj korisnika').onPress());
  const confirm = confirmButton().props.onPress; await act(async () => { confirm(); confirm(); });
  expect(mockSafety.setBlock.mock.calls).toEqual([[{ targetAccountId: B, blocked: true, expectedRevision: 0, clientRequestId: K }]]);
  expect(mockRequestId).toHaveBeenCalledTimes(1); expect(copy()).toContain('Korisnik je blokiran.'); expect(mockSafety.report).not.toHaveBeenCalled();
});
it.each(['blur', 'account', 'incarnation', 'target', 'need', 'agreement'] as const)('retires a block question after %s changes and rejects its retained confirmation and opener', async change => {
  await render(); const open = action('Blokiraj korisnika').onPress; await act(async () => open());
  const late = confirmButton().props.onPress;
  if (change === 'blur') mockFocused = false;
  else if (change === 'account') mockSession = { user: { id: K }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: A }, accountRevision: 3 };
  else if (change === 'target') mockContext = { ...mockContext, targetAccountId: K };
  else if (change === 'need') mockContext = { ...mockContext, needId: K };
  else mockContext = { ...mockContext, agreementId: K };
  await update(); expect(confirmButton()).toBeUndefined();
  await act(async () => { late(); open(); });
  expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).not.toHaveBeenCalled(); expect(mockRequestId).not.toHaveBeenCalled();
  if (change === 'blur') { mockFocused = true; await update(); }
  await act(async () => action('Blokiraj korisnika').onPress()); await confirmBlock();
  expect(mockSafety.setBlock).toHaveBeenCalledTimes(1); expect(mockSafety.setBlock.mock.calls[0][0].targetAccountId).toBe(mockContext.targetAccountId);
});
it('retires a question before a new read generation, including a retained refresh of the same revision', async () => {
  mockSafety.readBlock.mockRejectedValueOnce(new Error('offline'));
  await render(); const refresh = action('Proveri blokiranje').onPress; await act(async () => refresh());
  const open = action('Blokiraj korisnika').onPress; await act(async () => open()); const late = confirmButton().props.onPress;
  await act(async () => { refresh(); late(); }); expect(confirmButton()).toBeUndefined();
  await act(async () => open()); expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).not.toHaveBeenCalled();
  await act(async () => action('Blokiraj korisnika').onPress()); await confirmBlock(); expect(mockSafety.setBlock).toHaveBeenCalledTimes(1);
});
it('keeps an unknown block fenced until readback and then replays only the exact confirmed command', async () => {
  mockSafety.setBlock.mockResolvedValueOnce({ ok: false, kod: 'BLOCK_OUTCOME_UNKNOWN', poruka: 'Ishod blokiranja nije potvrđen.' });
  await render(); await act(async () => action('Blokiraj korisnika').onPress()); await confirmBlock();
  expect(action('Blokiraj korisnika').disabled).toBe(true); expect(copy()).toContain('Ishod blokiranja nije potvrđen.');
  await act(async () => action('Blokiraj korisnika').onPress()); expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).toHaveBeenCalledTimes(1);
  await act(async () => action('Proveri blokiranje').onPress());
  await act(async () => action('Blokiraj korisnika').onPress());
  expect(confirmButton()).toBeUndefined(); expect(mockSafety.setBlock).toHaveBeenCalledTimes(2);
  expect(mockSafety.setBlock.mock.calls[1][0]).toEqual(mockSafety.setBlock.mock.calls[0][0]); expect(mockRequestId).toHaveBeenCalledTimes(1);
});
it('preserves the existing explicit unblock action and revision without a new block question', async () => {
  mockSafety.readBlock.mockResolvedValueOnce({ ok: true, podatak: { accountId: A, targetAccountId: B, blocked: true, revision: 4, authoritative: true } });
  await render(); await act(async () => action('Odblokiraj korisnika').onPress());
  expect(confirmButton()).toBeUndefined();
  expect(mockSafety.setBlock.mock.calls).toEqual([[{ targetAccountId: B, blocked: false, expectedRevision: 4, clientRequestId: K }]]);
});
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
