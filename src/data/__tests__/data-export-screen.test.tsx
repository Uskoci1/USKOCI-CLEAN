import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const ID = '11111111-1111-4111-8111-111111111111', GENERATION = '22222222-2222-4222-8222-222222222222';
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true;
const mockStatus = jest.fn(), mockRequest = jest.fn(), mockPrepare = jest.fn(), mockCancel = jest.fn(), mockRevoke = jest.fn(), mockDownload = jest.fn(), mockSaveFile = jest.fn();
const mockAlert = jest.fn(), mockRouter = { back: jest.fn() };
jest.mock('../dataExportClientService', () => ({ dataExportClientService: { readStatus: (...a: unknown[]) => mockStatus(...a),
  requestExport: (...a: unknown[]) => mockRequest(...a), prepareExport: (...a: unknown[]) => mockPrepare(...a),
  cancelExport: (...a: unknown[]) => mockCancel(...a), revokeExport: (...a: unknown[]) => mockRevoke(...a), downloadExport: (...a: unknown[]) => mockDownload(...a) } }));
jest.mock('../../lib/dataExportFile', () => ({ saveDataExportFile: (...a: unknown[]) => mockSaveFile(...a) }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('unexpected transport'); } }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'Alert') return { alert: mockAlert }; return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', ArrowsLeftRight: 'Icon', User: 'Icon', CaretRight: 'Icon', SignOut: 'Icon', MapPin: 'Icon', CalendarBlank: 'Icon', Bell: 'Icon', DownloadSimple: 'Icon', ShieldCheck: 'Icon', Clock: 'Icon', Eye: 'Icon', CaretDown: 'Icon', CaretUp: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' })); jest.mock('../../ui/Press', () => ({ Press: 'Press' })); jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));
import ExportScreen from '../../app/(app)/profil/izvoz';
const ok = (podatak: unknown) => ({ ok: true, podatak });
const descriptor = () => ({ artifactAvailable: true, artifactGeneration: GENERATION, artifactExpiresAt: '2099-01-01T00:00:00Z', byteLength: 3, sha256: 'a'.repeat(64), md5: 'b'.repeat(32) });
const status = (state: string | null = null, fulfillment: unknown = null, key = 'existing-export-key') => ({ hasRequest: state !== null,
  request: state ? { receiptId: ID, clientRequestId: key, status: state, requestedAt: '2026-09-10T10:00:00Z', updatedAt: '2026-09-10T10:00:00Z',
    cancelledAt: state === 'CANCELLED' ? '2026-09-10T10:01:00Z' : null, completedAt: null, failureCode: null } : null,
  downloadAvailable: fulfillment !== null, fulfillment, serverFulfillmentRequired: true, externalDsrChannelReady: false });
const file = () => ({ receiptId: ID, artifactGeneration: GENERATION, bytes: new Uint8Array([1, 2, 3]), byteLength: 3, sha256: 'a'.repeat(64), md5: 'b'.repeat(32) });
function deferred<T = unknown>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<ExportScreen />); }); };
const update = async () => { await act(async () => tree.update(<ExportScreen />)); };
const button = (label: string) => tree.root.findByProps({ label });
const tap = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
const texts = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const confirm = () => mockAlert.mock.calls.at(-1)[2][1].onPress;
beforeEach(() => {
  jest.clearAllMocks(); for (const mock of [mockStatus, mockRequest, mockPrepare, mockCancel, mockRevoke, mockDownload, mockSaveFile]) mock.mockReset();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true;
  mockStatus.mockResolvedValue(ok(status())); mockRequest.mockImplementation(async key => ok({ receiptId: ID, clientRequestId: key, status: 'REQUESTED', requestedAt: '2026-09-10T10:00:00Z', idempotentReplay: false }));
  mockPrepare.mockResolvedValue(ok({ receiptId: ID, kind: 'NOT_READY', code: 'POLICY_NOT_READY' }));
  mockCancel.mockResolvedValue(ok({ receiptId: ID, status: 'CANCELLED' })); mockRevoke.mockResolvedValue(ok({ receiptId: ID, revoked: true }));
  mockDownload.mockImplementation(async () => ok(file())); mockSaveFile.mockResolvedValue({ status: 'SAVED', fileName: 'safe.json' });
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });
it.each(['narucilac', 'uskocer'])('reads actual account status for %s without requesting or preparing on mount', async intent => {
  mockIntent = intent; await render(); expect(mockStatus).toHaveBeenCalledTimes(1); expect(button('Zatražite izvoz')).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled(); expect(mockPrepare).not.toHaveBeenCalled(); expect(mockDownload).not.toHaveBeenCalled();
});
it('keeps one actual primary action outside scrolling content and cancellation secondary', async () => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render();
  const footer = tree.root.findByProps({ testID: 'settings-primary-footer' });
  expect(footer.findAll(node => node.type === 'Press' as React.ElementType).map(node => node.props.accessibilityLabel))
    .toEqual(['Pripremite kopiju']);
  expect(footer.findAllByProps({ label: 'Otkažite zahtev' })).toHaveLength(0);
  const scroll = tree.root.findByType('ScrollView' as React.ElementType);
  expect(scroll.findAllByProps({ label: 'Otkažite zahtev' }).length).toBeGreaterThan(0);
  expect(mockPrepare).not.toHaveBeenCalled(); expect(mockCancel).not.toHaveBeenCalled();
});
it('keeps the primary footer absent while the account export state is unresolved', async () => {
  const pending = deferred(); mockStatus.mockReturnValueOnce(pending.promise); await render();
  expect(tree.root.findAllByProps({ testID: 'settings-primary-footer' })).toHaveLength(0);
  expect(tree.root.findByProps({ accessibilityLabel: 'Učitavanje stanja izvoza' })).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled(); expect(mockPrepare).not.toHaveBeenCalled();
});
it('serializes request double taps and reads back the accepted request', async () => {
  const pending = deferred(); mockRequest.mockReturnValueOnce(pending.promise); await render(); const action = button('Zatražite izvoz').props.onPress;
  await act(async () => { void action(); void action(); }); expect(mockRequest).toHaveBeenCalledTimes(1);
  const key = mockRequest.mock.calls[0][0]; mockStatus.mockResolvedValue(ok(status('REQUESTED', null, key)));
  await act(async () => pending.resolve(ok({ receiptId: ID, clientRequestId: key, status: 'REQUESTED' })));
  expect(texts()).toContain('Zahtev za izvoz je zabeležen'); expect(button('Pripremite kopiju')).toBeTruthy(); expect(mockPrepare).not.toHaveBeenCalled();
});
it('retains the same request key after unknown outcome and requires readback', async () => {
  mockRequest.mockRejectedValueOnce(new Error('private SQL detail')); await render(); await tap('Zatražite izvoz'); const key = mockRequest.mock.calls[0][0];
  expect(texts()).not.toContain('private SQL'); expect(tree.root.findAllByProps({ label: 'Ponovite isti zahtev' })).toHaveLength(0);
  await tap('Učitajte stanje ponovo'); await tap('Ponovite isti zahtev'); expect(mockRequest).toHaveBeenLastCalledWith(key);
});
it('presents POLICY_NOT_READY without a fabricated READY or download', async () => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render(); await tap('Pripremite kopiju');
  expect(mockPrepare).toHaveBeenCalledWith(ID); expect(texts()).toContain('Priprema kopije trenutno nije dostupna');
  expect(tree.root.findAllByProps({ label: 'Preuzmite i sačuvajte' })).toHaveLength(0); expect(mockDownload).not.toHaveBeenCalled();
});
it('reads actual availability after a READY preparation receipt rather than manufacturing it', async () => {
  mockStatus.mockResolvedValueOnce(ok(status('REQUESTED'))).mockResolvedValue(ok(status('READY')));
  mockPrepare.mockResolvedValue(ok({ receiptId: ID, kind: 'READY' })); await render(); await tap('Pripremite kopiju');
  expect(tree.root.findAllByProps({ label: 'Preuzmite i sačuvajte' })).toHaveLength(0); expect(button('Zatražite novu kopiju')).toBeTruthy();
});
it.each(['account', 'incarnation', 'blur'])('rejects a retained cancellation after %s changes', async change => {
  mockStatus.mockResolvedValue(ok(status('REQUESTED'))); await render(); await tap('Otkažite zahtev'); const old = confirm();
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else { mockFocused = false; await update(); mockFocused = true; await update(); }
  await act(async () => old()); expect(mockCancel).not.toHaveBeenCalled();
});
it('cancels only after explicit confirmation and refetches the real cancelled state', async () => {
  mockStatus.mockResolvedValueOnce(ok(status('REQUESTED'))).mockResolvedValue(ok(status('CANCELLED')));
  await render(); await tap('Otkažite zahtev'); expect(mockCancel).not.toHaveBeenCalled(); const action = confirm();
  await act(async () => { action(); action(); }); expect(mockCancel).toHaveBeenCalledTimes(1); expect(texts()).toContain('Zahtev je otkazan');
});
it('does not report saved or open a picker until explicit download completes and actual local save succeeds', async () => {
  const downloaded = deferred(), saved = deferred(); mockDownload.mockReturnValueOnce(downloaded.promise); mockSaveFile.mockReturnValueOnce(saved.promise);
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); await render(); expect(mockDownload).not.toHaveBeenCalled();
  const action = button('Preuzmite i sačuvajte').props.onPress; await act(async () => { void action(); void action(); });
  expect(mockDownload).toHaveBeenCalledTimes(1); expect(mockSaveFile).not.toHaveBeenCalled(); expect(texts()).not.toContain('Kopija je sačuvana');
  await act(async () => downloaded.resolve(ok(file()))); expect(mockSaveFile).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Kopija je sačuvana');
  await act(async () => saved.resolve({ status: 'SAVED', fileName: 'safe.json' })); expect(texts()).toContain('Kopija je sačuvana u izabranoj fascikli');
});
it.each(['account', 'blur'])('retires pending picker ownership after %s changes', async change => {
  const saved = deferred(); mockSaveFile.mockReturnValueOnce(saved.promise); mockStatus.mockResolvedValue(ok(status('READY', descriptor())));
  await render(); await act(async () => { void button('Preuzmite i sačuvajte').props.onPress(); });
  const options = mockSaveFile.mock.calls[0][0]; expect(options.isCurrent()).toBe(true);
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 }; else mockFocused = false;
  await update(); expect(options.isCurrent()).toBe(false); expect(options.signal.aborted).toBe(true);
  await act(async () => saved.resolve({ status: 'SAVED' })); expect(texts()).not.toContain('Kopija je sačuvana');
});
it.each(['account', 'incarnation', 'blur'])('discards and zeroes a late successful download after %s changes without opening a picker', async change => {
  const downloaded = deferred(), bytes = file(); mockDownload.mockReturnValueOnce(downloaded.promise);
  mockStatus.mockResolvedValue(ok(status('READY', descriptor())));
  await render(); await act(async () => { void button('Preuzmite i sačuvajte').props.onPress(); });
  if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  else if (change === 'incarnation') mockSession = { user: { id: 'account-a' }, accountRevision: 3 };
  else { mockFocused = false; await update(); }
  await act(async () => downloaded.resolve(ok(bytes)));
  expect(bytes.bytes).toEqual(new Uint8Array(3)); expect(mockSaveFile).not.toHaveBeenCalled();
  expect(texts()).not.toContain('Kopija je sačuvana');
});
it.each([{ artifactGeneration: ID }, { sha256: 'c'.repeat(64) }, { byteLength: 2 }])('does not open the picker for a mismatched artifact %s', async change => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); mockDownload.mockResolvedValue(ok({ ...file(), ...change }));
  await render(); await tap('Preuzmite i sačuvajte'); expect(mockSaveFile).not.toHaveBeenCalled(); expect(texts()).toContain('Preuzeta kopija nije potvrđena');
});
it.each(['CANCELLED', 'FAILED', 'DOWNLOAD_STARTED'])('does not claim a saved file after %s', async result => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); mockSaveFile.mockResolvedValue({ status: result });
  await render(); await tap('Preuzmite i sačuvajte'); expect(texts()).not.toContain('Kopija je sačuvana');
});
it('requires an owned readback after an unknown download response before any second download', async () => {
  mockStatus.mockResolvedValue(ok(status('READY', descriptor()))); mockDownload.mockRejectedValueOnce(new Error('private storage error'));
  await render(); const old = button('Preuzmite i sačuvajte').props.onPress; await act(async () => old());
  expect(texts()).not.toContain('private storage'); await act(async () => old()); expect(mockDownload).toHaveBeenCalledTimes(1);
  await tap('Učitajte stanje ponovo'); await tap('Preuzmite i sačuvajte'); expect(mockDownload).toHaveBeenCalledTimes(2);
});
it('never downloads an expired descriptor, even from a retained enabled callback', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-10T10:00:00Z'));
  mockStatus.mockResolvedValue(ok(status('READY', { ...descriptor(), artifactExpiresAt: '2026-09-10T10:00:01Z' })));
  await render(); const old = button('Preuzmite i sačuvajte').props.onPress;
  await act(async () => jest.advanceTimersByTime(1001)); await act(async () => old()); expect(mockDownload).not.toHaveBeenCalled();
});
it('revokes the server copy only after confirmation and explains that existing local files remain', async () => {
  mockStatus.mockResolvedValueOnce(ok(status('READY', descriptor()))).mockResolvedValue(ok(status('EXPIRED')));
  await render(); await tap('Opozovite kopiju'); expect(mockAlert.mock.calls[0][1]).toContain('Već sačuvani fajlovi');
  await act(async () => confirm()()); expect(mockRevoke).toHaveBeenCalledWith(ID); expect(mockSaveFile).not.toHaveBeenCalled();
  expect(texts()).toContain('Preuzimanje kopije je opozvano');
});
