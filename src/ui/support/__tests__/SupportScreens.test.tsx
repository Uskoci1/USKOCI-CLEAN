import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SupportDetail, SupportIntent, SupportKind, SupportReference } from '../../../data/supportCaseTypes';
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const C = '20000000-0000-4000-8000-000000000001', K = '30000000-0000-4000-8000-000000000001', E = '40000000-0000-4000-8000-000000000001';
const D = '50000000-0000-4000-8000-000000000001', AP = '60000000-0000-4000-8000-000000000001';
const time = '2026-09-13T05:00:00Z';
let mockSession = { user: { id: A }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true, mockAppState = 'active';
const mockListeners = new Set<(value: string) => void>();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };
const mockService = { capabilities: jest.fn(), inbox: jest.fn(), detail: jest.fn(), loadPending: jest.fn(), prepare: jest.fn(),
  submit: jest.fn(), recover: jest.fn(), cancel: jest.fn(), markRead: jest.fn() }, mockAgreements = jest.fn();
jest.mock('../../../data/supportCaseClientService', () => ({ get supportCaseClientService() { return mockService; } }));
jest.mock('../../../data/agreementClientService', () => ({ agreementClientService: { mojiDogovori: (...args: unknown[]) => mockAgreements(...args) } }));
jest.mock('../../../data/supabaseClient', () => ({ supabaseKlijent: () => ({}) }));
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (fn: () => void) => require('react').useEffect(() => mockFocused ? fn() : undefined, [fn, mockFocused]) }));
jest.mock('react-native', () => { const rn = jest.requireActual('react-native'); return new Proxy(rn, { get(target, key) {
  if (key === 'AppState') return { get currentState() { return mockAppState; }, addEventListener: (_: string, fn: (value: string) => void) => {
    mockListeners.add(fn); return { remove: () => mockListeners.delete(fn) }; } };
  return ['View', 'TextInput', 'ActivityIndicator', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('phosphor-react-native', () => ({ ChatCircleText: 'Icon', ShieldCheck: 'Icon' }));
jest.mock('../../settings/SettingsPresentation', () => ({ SettingsAction: 'Action', SettingsGroup: 'Group', SettingsIntro: 'Intro',
  SettingsPanel: 'Panel', SettingsRow: 'Row', SettingsScreen: 'Screen', SettingsText: 'T' }));
jest.mock('../../media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
import { SupportNewScreen, supportRouteReference } from '../SupportNewScreen';
import { SupportDetailScreen } from '../SupportDetailScreen';
import { SupportInboxScreen } from '../SupportInboxScreen';
import { SupportReferenceView } from '../SupportReferenceView';
const ok = (podatak: unknown) => ({ ok: true, podatak }), unknown = { ok: false, kod: 'UNKNOWN', poruka: 'Sačekaj proveru.' };
const journal = (kind: SupportKind = 'CREATE'): SupportIntent => ({ version: 1, accountId: A, clientRequestId: K, kind, caseId: kind === 'CREATE' ? null : C,
  expectedRevision: kind === 'CREATE' ? null : 2, inputSha256: 'a'.repeat(64) });
const absent = () => ok({ accountId: A, clientRequestId: K, state: 'ABSENT', kind: null, caseId: null, expectedRevision: null, inputSha256: null, receipt: null, authoritative: true });
function detail(): SupportDetail { return { accountId: A, case: { id: C, caseNumber: '71', authorAccountId: A, title: 'Problem sa prikazom',
  desiredOutcome: 'Da razjasnimo', channel: 'SERVICE', topic: 'TECHNICAL', status: 'IN_REVIEW', revision: 2, lastSequence: '9', createdAt: time, updatedAt: time, context: {} },
  viewerRole: 'AUTHOR', operatorAvailable: false, allowedActions: ['AUTHOR_REPLY', 'APPEAL'],
  events: [{ id: E, caseId: C, sequence: '2', kind: 'AUTHOR_REPLY', authorRole: 'AUTHOR', body: 'Privatna dopuna', createdAt: time, decisionId: null, appealId: null }],
  decisions: [{ id: D, caseId: C, caseRevision: 2, outcome: 'REJECTED', reasonCode: 'REVIEWED', explanation: 'Pregledana odluka', effect: 'NONE', evidenceIds: [], priorDecisionId: null, createdAt: time, reviewType: 'INITIAL' }],
  appeals: [], evidence: [], nextAfterSequence: '2', authoritative: true }; }
let tree: ReactTestRenderer, screen: 'NEW' | 'DETAIL' | 'INBOX' = 'NEW', reference: SupportReference | null | 'INVALID' = null, routeKey = true;
const element = () => <React.Fragment key={routeKey ? `${mockSession.user.id}:${mockSession.accountRevision}:${mockIntent}` : 'MOUNTED'}>
  {screen === 'NEW' ? <SupportNewScreen reference={reference} /> : screen === 'DETAIL' ? <SupportDetailScreen caseId={C} /> : <SupportInboxScreen />}
</React.Fragment>;
const render = async () => { await act(async () => { tree = create(element()); }); };
const update = async () => { await act(async () => tree.update(element())); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const actions = (label: string) => tree.root.findAllByProps({ label });
const field = (label: string) => tree.root.findByProps({ accessibilityLabel: label }).props;
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(n => n.children.filter(x => typeof x === 'string')).join(' ');
async function type(label: string, value: string) { await act(async () => field(label).onChangeText(value)); }
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
beforeEach(() => {
  jest.clearAllMocks(); Object.values(mockService).forEach(fn => fn.mockReset()); mockAgreements.mockReset();
  screen = 'NEW'; reference = null; routeKey = true; mockSession = { user: { id: A }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockAppState = 'active';
  mockService.capabilities.mockResolvedValue(ok({ accountId: A, operatorAvailable: false, canCreate: true, authoritative: true }));
  mockService.loadPending.mockResolvedValue(null); mockService.recover.mockResolvedValue(absent()); mockService.submit.mockResolvedValue(unknown); mockService.cancel.mockResolvedValue(unknown);
  mockService.detail.mockResolvedValue(ok(detail())); mockService.markRead.mockResolvedValue(ok({ sequence: '9' }));
  mockService.inbox.mockResolvedValue(ok({ accountId: A, mode: 'OWN', operatorAvailable: false, cases: [], nextBeforeCaseNumber: null, authoritative: true }));
  mockService.prepare.mockImplementation((kind: SupportKind, caseId: string | null, revision: number | null, payload: object) => ({
    intent: { ...journal(kind), caseId, expectedRevision: revision }, payloadText: JSON.stringify(payload) }));
  mockAgreements.mockResolvedValue([{ id: C, verzija: 4, naslov: 'Stvarni sopstveni Dogovor' }]);
});
afterEach(async () => { await act(async () => tree?.unmount()); expect(mockListeners.size).toBe(0); });

it('uses a private create form with optional outcome, scalar limits and no safety category replacement', async () => {
  await render(); expect(text()).toContain('Zahtev vide podnosilac'); expect(actions('Pošalji privatni zahtev')[0].props.disabled).toBe(true);
  await type('Kratak naslov', 'Pomoć'); await type('Opis zahteva', '🙂'.repeat(4000));
  expect(action('Pošalji privatni zahtev').disabled).toBe(false); await type('Opis zahteva', '🙂'.repeat(4001));
  expect(action('Pošalji privatni zahtev').disabled).toBe(true); expect(text()).toContain('Skrati tekst');
  expect(mockService.prepare).not.toHaveBeenCalled(); expect(actions('Bezbednost')).toHaveLength(0);
});
it('does not submit a retained button after the visible draft changes', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Prva verzija');
  const retained = action('Pošalji privatni zahtev').onPress; await type('Opis zahteva', 'Prikazana nova verzija');
  await act(async () => retained()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => action('Pošalji privatni zahtev').onPress()); expect(mockService.prepare.mock.calls[0][3].body).toBe('Prikazana nova verzija');
});
it('selects a current owned Agreement and serializes only its id and revision on an explicit send', async () => {
  await render(); await act(async () => action('Prijava nedolaska').onPress());
  await type('Kratak naslov', 'Nedolazak'); await type('Opis zahteva', 'Nisam našao saradnika.');
  expect(action('Pošalji privatni zahtev').disabled).toBe(true); expect(mockAgreements).not.toHaveBeenCalled();
  await act(async () => action('Izaberi Dogovor').onPress()); await act(async () => action('Stvarni sopstveni Dogovor').onPress());
  await act(async () => action('Pošalji privatni zahtev').onPress());
  expect(mockService.prepare).toHaveBeenCalledWith('CREATE', null, null, { channel: 'TASK', topic: 'NO_SHOW', title: 'Nedolazak',
    body: 'Nisam našao saradnika.', desiredOutcome: null, context: { kind: 'AGREEMENT', id: C, revision: 4 }, evidence: [] }, expect.objectContaining({ accountId: A, accountRevision: 1 }));
  expect(mockService.submit).toHaveBeenCalledTimes(1);
});
it('preserves only the selected message as evidence when its request is attached to a current Agreement', async () => {
  reference = { kind: 'AGREEMENT_MESSAGE', id: E, revision: 2 }; await render();
  await act(async () => action('Prijava nedolaska').onPress()); await act(async () => action('Izaberi Dogovor').onPress());
  await act(async () => action('Stvarni sopstveni Dogovor').onPress());
  await type('Kratak naslov', 'Nedolazak'); await type('Opis zahteva', 'Pogledajte izabranu poruku.');
  await act(async () => action('Pošalji privatni zahtev').onPress());
  expect(mockService.prepare.mock.calls[0][3]).toMatchObject({ context: { kind: 'AGREEMENT', id: C, revision: 4 }, evidence: [reference] });
});
it('explicitly removing selected evidence also removes its standalone message context and fences an old send', async () => {
  reference = { kind: 'GROUP_MESSAGE', id: E, revision: null }; await render();
  await type('Kratak naslov', 'Pomoć'); await type('Opis zahteva', 'Samo moj opis.'); const old = action('Pošalji privatni zahtev').onPress;
  await act(async () => action('Ukloni izabranu poruku iz zahteva').onPress()); await act(async () => old()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => action('Pošalji privatni zahtev').onPress()); expect(mockService.prepare.mock.calls[0][3]).toMatchObject({ context: null, evidence: [] });
});
it('keeps in-memory text disabled during unknown readback, then permits only explicit same-command replay', async () => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Sačuvaj ovaj RAM tekst');
  const lateChange = field('Opis zahteva').onChangeText;
  await act(async () => action('Pošalji privatni zahtev').onPress()); expect(field('Opis zahteva').editable).toBe(false);
  await act(async () => { lateChange('Late native change'); field('Opis zahteva').onChangeText('Disabled native change'); });
  expect(field('Opis zahteva').value).toBe('Sačuvaj ovaj RAM tekst');
  await act(async () => action('Proveri ishod').onPress());
  expect(field('Opis zahteva').value).toBe('Sačuvaj ovaj RAM tekst'); expect(mockService.submit).toHaveBeenCalledTimes(1);
  const replay = tree.root.findAllByType('Action' as React.ElementType).find(n => /Ponovi|Ponovo pošalji/.test(n.props.label));
  expect(replay).toBeDefined();
});
it('restores only opaque unknown state after remount and does not replay the previous narrative', async () => {
  mockService.loadPending.mockResolvedValue(journal()); await render();
  expect(field('Opis zahteva').value).toBe(''); expect(field('Opis zahteva').editable).toBe(false);
  expect(text()).toContain('Potvrda još nije pronađena'); expect(mockService.submit).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Action' as React.ElementType).some(n => /Ponovi|Ponovo pošalji/.test(n.props.label))).toBe(false);
});
it.each(['blur', 'background', 'account ABA', 'intent'] as const)('clears private form and fences retained submit on %s', async change => {
  await render(); await type('Kratak naslov', 'Naslov'); await type('Opis zahteva', 'Privatni RAM tekst'); const retained = action('Pošalji privatni zahtev').onPress;
  if (change === 'blur') { mockFocused = false; await update(); }
  else if (change === 'background') await act(async () => { mockAppState = 'background'; mockListeners.forEach(fn => fn('background')); });
  else { if (change === 'account ABA') mockSession = { user: { id: A }, accountRevision: 3 }; else mockIntent = 'uskocer'; await update(); }
  await act(async () => retained()); expect(mockService.submit).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Opis zahteva' }).every(n => n.props.value === '')).toBe(true);
});
it.each(['account', 'account ABA', 'blur/focus', 'context'] as const)('a reused mounted screen resets every local draft on %s without relying on its route key', async change => {
  routeKey = false; reference = { kind: 'AGREEMENT', id: C, revision: 2 }; await render();
  await type('Kratak naslov', 'Stari naslov'); await type('Opis zahteva', 'Privatni tekst prethodne inkarnacije'); await type('Željeni ishod', 'Stari ishod');
  await act(async () => action('Izaberi Dogovor').onPress());
  expect(action('Pošalji privatni zahtev').disabled).toBe(false);
  const retained = action('Pošalji privatni zahtev').onPress;
  if (change === 'blur/focus') { mockFocused = false; await update(); mockFocused = true; }
  else if (change === 'account') mockSession = { user: { id: B }, accountRevision: 2 };
  else if (change === 'account ABA') mockSession = { user: { id: A }, accountRevision: 3 };
  else reference = { kind: 'TASK_REVIEW', id: D, revision: null };
  await update(); await act(async () => retained()); expect(mockService.prepare).not.toHaveBeenCalled();
  for (const label of ['Kratak naslov', 'Opis zahteva', 'Željeni ishod']) expect(field(label).value).toBe('');
  expect(actions('Stvarni sopstveni Dogovor')).toHaveLength(0);
  expect(action('Pošalji privatni zahtev').disabled).toBe(true);
  if (change === 'context') expect(actions('Izabrano: Pregled odluke o objavi')).toHaveLength(1);
});
it('does not expose a previous account case from a late detail read', async () => {
  screen = 'DETAIL'; const held = deferred(); mockService.detail.mockReturnValueOnce(held.promise); await render();
  mockSession = { user: { id: B }, accountRevision: 2 }; mockService.detail.mockResolvedValue({ ok: false, poruka: 'Nije dostupno.' }); await update();
  await act(async () => held.resolve(ok(detail()))); expect(text()).not.toContain('Privatna dopuna'); expect(actions('Dopuni zahtev')).toHaveLength(0);
});
it('author role never renders operator controls despite a contradictory allowedActions list', async () => {
  screen = 'DETAIL'; mockService.detail.mockResolvedValue(ok({ ...detail(), operatorAvailable: true,
    allowedActions: ['CLAIM', 'DECIDE', 'CLOSE', 'OPERATOR_REPLY', 'AUTHOR_REPLY'] })); await render();
  expect(actions('Dopuni zahtev')).toHaveLength(1); for (const label of ['Preuzmi predmet', 'Donesi odluku', 'Zatvori obrađeni predmet', 'Odgovori podnosiocu']) expect(actions(label)).toHaveLength(0);
  expect(mockService.submit).not.toHaveBeenCalled();
});
it('opens a real decision appeal and submits its exact id only after the author writes a reason', async () => {
  screen = 'DETAIL'; await render(); const row = tree.root.findAllByType('Row' as React.ElementType).find(n => n.props.label.startsWith('Zatraži ponovni pregled'))!;
  await act(async () => row.props.onPress()); expect(text()).toContain('ne predstavlja nezavisan žalbeni organ');
  await type('Razlog i nove činjenice', 'Nova činjenica'); await act(async () => action('Pošalji zahtev za ponovni pregled').onPress());
  expect(mockService.prepare).toHaveBeenCalledWith('APPEAL', C, 2, { decisionId: D, body: 'Nova činjenica' }, expect.objectContaining({ accountId: A }));
});
it('does not submit a retained reply after its draft has been closed', async () => {
  screen = 'DETAIL'; await render(); await act(async () => action('Dopuni zahtev').onPress()); await type('Tekst poruke', 'Uneta dopuna');
  const retained = action('Pošalji poruku').onPress; await act(async () => action('Zatvori unos').onPress());
  await act(async () => retained()); expect(mockService.prepare).not.toHaveBeenCalled();
});
it('operator reconsideration uses only the actual server appeal and does not infer independent review', async () => {
  screen = 'DETAIL'; mockService.detail.mockResolvedValue(ok({ ...detail(), viewerRole: 'OPERATOR', operatorAvailable: true, allowedActions: ['DECIDE_APPEAL'],
    appeals: [{ id: AP, caseId: C, decisionId: D, status: 'IN_REVIEW', decisionResultId: null, createdAt: time }] })); await render();
  await act(async () => action('Odluči o ponovnom pregledu').onPress()); await type('Oznaka razloga', 'RECHECKED'); await type('Obrazloženje', 'Pregledan poslati dokaz');
  await act(async () => action('Sačuvaj odluku').onPress()); expect(mockService.prepare).toHaveBeenCalledWith('DECIDE_APPEAL', C, 2,
    { outcome: 'ACCEPTED', reasonCode: 'RECHECKED', body: 'Pregledan poslati dokaz', evidenceIds: [], appealId: AP }, expect.any(Object));
});
it('a decision can cite only a selected evidence id from this visible case page', async () => {
  screen = 'DETAIL'; const evidence = { id: B, eventId: E, createdAt: time, reference: { kind: 'AGREEMENT_MESSAGE', id: K, revision: 2,
    content: { agreementId: C, body: 'Samo namerno izabrana poruka', createdAt: time, mine: true } } };
  mockService.detail.mockResolvedValue(ok({ ...detail(), viewerRole: 'OPERATOR', operatorAvailable: true,
    allowedActions: ['DECIDE'], evidence: [evidence] })); await render(); await act(async () => action('Donesi odluku').onPress());
  await type('Oznaka razloga', 'REVIEWED'); await type('Obrazloženje', 'Pogledan označen dokaz');
  const stale = action('Sačuvaj odluku').onPress; await act(async () => action('Izabrana poruka iz Dogovora').onPress());
  await act(async () => stale()); expect(mockService.prepare).not.toHaveBeenCalled();
  await act(async () => action('Sačuvaj odluku').onPress()); expect(mockService.prepare.mock.calls[0][3].evidenceIds).toEqual([B]);
});
it('marks only the displayed page explicitly and never uses the unseen case lastSequence', async () => {
  screen = 'DETAIL'; await render(); expect(mockService.markRead).not.toHaveBeenCalled();
  await act(async () => action('Označi prikazane događaje kao pročitane').onPress());
  expect(mockService.markRead).toHaveBeenCalledWith(C, '2', expect.any(Object)); expect(text()).toContain('Prikazani događaji');
});
it('shows the operator inbox entry only when the server grants it to this account', async () => {
  screen = 'INBOX'; await render(); expect(actions('Otvori operaterski inbox')).toHaveLength(0);
  mockService.capabilities.mockResolvedValue(ok({ accountId: A, operatorAvailable: true, canCreate: true, authoritative: true }));
  await act(async () => action('Osveži zahteve').onPress()); expect(actions('Otvori operaterski inbox')).toHaveLength(1);
  expect(mockService.submit).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});
it.each([{ contextKind: 'TASK', contextId: C }, { contextKind: 'TASK_REVIEW', contextId: C, contextRevision: '1' },
  { contextKind: ['TASK'], contextId: C, contextRevision: '1' }, { contextKind: 'AGREEMENT', contextId: C, contextRevision: '01' },
  { contextKind: 'TASK', contextId: 'https://private.example', contextRevision: '1' }])('rejects malformed route references %#', params => {
  expect(supportRouteReference(params)).toBe('INVALID'); expect(mockService.submit).not.toHaveBeenCalled();
});
it('renders only strictly decoded selected media with case scope, never a raw object or URL', async () => {
  const value = { kind: 'TASK' as const, id: D, revision: 2, content: { title: 'Izabrani Zadatak', description: 'Opis dokaza', status: 'PUBLISHED', createdAt: time,
    executionMode: 'STATIONARY', countryCode: 'RS', submitterRole: 'REQUESTER', media: [{ assetId: E, sha256: 'a'.repeat(64), width: 1200, height: 900 }] } };
  await act(async () => { tree = create(<SupportReferenceView value={value} caseId={C} />); });
  expect(tree.root.findByType('AuthorizedPhoto' as React.ElementType).props).toMatchObject({ assetId: E, caseId: C });
  expect(text()).toContain('Opis dokaza');
  await act(async () => tree.update(<SupportReferenceView value={{ ...value, content: { ...value.content, privateAddress: 'DO NOT RENDER' } }} caseId={C} />));
  expect(tree.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0); expect(text()).not.toContain('DO NOT RENDER');
  expect(text()).toContain('nije potvrđen');
});
