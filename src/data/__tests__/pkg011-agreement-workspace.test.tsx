import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction, sys } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
const mockAccount = '10000000-0000-4000-8000-000000000001', mockOther = '10000000-0000-4000-8000-000000000002', mockAgreementId = '20000000-0000-4000-8000-000000000001';
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
const mockNeedId = '30000000-0000-4000-8000-000000000001', mockApplicationId = '40000000-0000-4000-8000-000000000001';
const mockRead = jest.fn(), mockMessages = jest.fn(), mockMessagesRead = jest.fn();
let mockParams: Record<string, string> = { id: mockAgreementId };
let mockReducedMotion = false;
const mockSource = { dogovor: mockRead, poruke: mockMessages, oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn(), oznaciPorukeProcitanim: mockMessagesRead };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android' };
    if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { submit: jest.fn(), read: jest.fn() } }));
jest.mock('../groupConversationService', () => ({ groupConversationService: { context: jest.fn().mockResolvedValue({ ok: true, podatak: { group: null } }) } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => mockReducedMotion }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: 'AgreementChat' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: 0 }), sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: 0 }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource }));
jest.mock('../../hooks/useAgreementOutbox', () => ({ useAgreementOutbox: () => ({ model: { reconcile: jest.fn().mockResolvedValue(undefined) }, state: { phase: 'ready', entries: [] } }) }));
jest.mock('../../hooks/useAgreementPhotos', () => ({ useAgreementPhotos: () => ({ agreementId: mockAgreementId, loaded: true, busy: false, items: [] }) }));
jest.mock('../agreementPhotoClientService', () => ({ agreementPhotoClientService: { messages: (_id: string, rows: unknown[]) => Promise.resolve(rows) } }));
import Dogovor from '../../app/dogovor/[id]';

const base = (patch: Record<string, unknown> = {}, mine: 'narucilac' | 'uskocer' = 'narucilac') => ({
  id: mockAgreementId, naslov: 'Pomoć pri selidbi', stanje: 'CONFIRMED', verzija: 1, cena: { prikaz: '3.000 RSD' }, pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0 },
  ucesnici: [{ id: mockAccount, ime: 'Ana', inicijali: 'AN', uloga: mine, mesta: mine === 'uskocer' ? 1 : null, viSte: true },
    { id: mockOther, ime: 'Marko', inicijali: 'MA', uloga: mine === 'narucilac' ? 'uskocer' : 'narucilac', mesta: mine === 'narucilac' ? 1 : null, viSte: false }],
  hronologija: [{ vremeTekst: 'juče', tekst: 'Dogovor je potvrđen' }], kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false },
  chatDostupan: true, vremeTekst: 'Fleksibilno', putanjaTekst: 'Beograd', problemOtvoren: false, rokPotvrdeIso: null, rezim: 'FIZICKI',
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null },
  izvor: { zadatakId: mockNeedId, prijavaId: mockApplicationId }, ...patch });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAll(node => String(node.type) === 'Press');
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
const labels = () => presses().map(node => node.props.accessibilityLabel);
async function render(workspace: Record<string, unknown>) {
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue([]);
  await act(async () => { tree = create(<Dogovor />); });
}
beforeEach(() => { jest.clearAllMocks(); mockReducedMotion = false; mockParams = { id: mockAgreementId }; mockMessagesRead.mockResolvedValue(0); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('a confirmed Agreement without server permission leads with the conversation as the one brand action and names the next step', async () => {
  await render(base());
  expect(brand()).toEqual(['Otvori poruke']); expect(labels().filter(label => label === 'Otvori poruke')).toHaveLength(1);
  const copy = texts();
  expect(copy).toContain('Dogovoreno'); expect(copy).toContain('Sledeći korak'); expect(copy).toContain('Potvrdi završetak kada je posao obavljen');
  expect(copy).toContain('Završetak možeš potvrditi kada je posao obavljen, i pre nego što ga druga strana označi.');
  expect(labels()).toEqual(expect.arrayContaining(['Izmene i otkazivanje Dogovora', 'Trenutna lokacija osobe koja dolazi', 'Bezbednost i privatna prijava', 'Kontakt', 'Tok Dogovora', 'Prijavi problem']));
  // The timeline is progressive disclosure: collapsed until the user asks for it.
  expect(copy).not.toContain('Dogovor je potvrđen');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Tok Dogovora' }).props.onPress());
  expect(texts()).toContain('Dogovor je potvrđen');
});
test('when the server allows completion, completion is the brand action and the conversation stays one tap away', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } }));
  expect(brand()).toEqual(['Potvrdi završetak']); expect(labels()).toContain('Otvori poruke');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Potvrdi završetak' }).props.onPress());
  expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Da, potvrdi završetak' }).props.onPress());
  expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledWith(mockAgreementId);
});
test.each([false, true])('completion review uses the accepted facts, sends nothing on Back and respects reduced motion (%s)', async reduced => {
  mockReducedMotion = reduced;
  await render(base({ vremeTekst: '26. septembar, 10:00–12:00', cena: { prikaz: '4.200 RSD' },
    radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } }));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Potvrdi završetak' }).props.onPress());
  const modal = tree.root.findByType('Modal' as any);
  expect(modal.props.animationType).toBe(reduced ? 'none' : 'slide');
  expect(modal.findByProps({ accessibilityLabel: 'Dogovoreni termin: 26. septembar, 10:00–12:00' })).toBeTruthy();
  expect(modal.findByProps({ accessibilityLabel: 'Dogovoreno ukupno: 4.200 RSD' })).toBeTruthy();
  expect(texts()).toContain('Marko');
  const retained = tree.root.findByProps({ accessibilityLabel: 'Da, potvrdi završetak' }).props.onPress;
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad na Dogovor' }).props.onPress());
  await act(async () => retained());
  expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
  expect(mockSource.potvrdiZavrsetak).not.toHaveBeenCalled(); expect(mockSource.oznaciZavrsetak).not.toHaveBeenCalled();
});
test('native Back dismisses a worker completion review without marking the work done', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: true, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false, predlogIzmene: null } }, 'uskocer'));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Završio sam' }).props.onPress());
  expect(texts()).toContain('Druga strana će dobiti zahtev da potvrdi završetak ili prijavi problem.');
  expect(labels()).toContain('Da, završio sam');
  await act(async () => tree.root.findByType('Modal' as any).props.onRequestClose());
  expect(mockSource.oznaciZavrsetak).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Modal' as any)).toHaveLength(0);
});
test('a worker awaiting the requester sees the wait and the deadline; no completion action is offered', async () => {
  await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer'));
  const copy = texts();
  expect(copy).toContain('Čeka se potvrda druge strane'); expect(copy).toContain('Bez odgovora se Dogovor zatvara sam.'); expect(copy).toContain('Čeka se potvrda završetka');
  expect(brand()).toEqual(['Otvori poruke']); expect(labels()).not.toContain('Završio sam');
});
test('after the worker says done the requester confirms or reports a problem; changes and cancelling are not offered (owner decision 2026-09-21)', async () => {
  await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z',
    radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false, predlogIzmene: null } }));
  expect(brand()).toEqual(['Potvrdi završetak']);
  expect(labels()).toContain('Prijavi problem');
  expect(labels()).not.toContain('Izmene i otkazivanje Dogovora');
  // The worker in the same state keeps the row: the owner's rule names the requester only.
  await act(async () => tree.unmount());
  await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer'));
  expect(labels()).toContain('Izmene i otkazivanje Dogovora');
});
test('a completed Agreement leads with the review; a cancelled one offers only the conversation', async () => {
  await render(base({ stanje: 'COMPLETED' }));
  expect(brand()).toEqual(['Oceni saradnju']); expect(texts()).toContain('Dogovor je završen'); expect(labels()).not.toContain('Trenutna lokacija osobe koja dolazi'); expect(labels()).not.toContain('Podeli svoju trenutnu lokaciju');
  // Nothing is left to change or cancel on a finished Dogovor, so no row leads to a screen without an action.
  expect(labels()).not.toContain('Izmene i otkazivanje Dogovora');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Oceni saradnju' }).props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/oceni-dogovor', params: { agreementId: mockAgreementId } });
  await act(async () => tree.unmount());
  await render(base({ stanje: 'CANCELLED' }));
  expect(brand()).toEqual(['Otvori poruke']); expect(texts()).toContain('Dogovor je otkazan.'); expect(labels()).not.toContain('Prijavi problem'); expect(labels()).not.toContain('Izmene i otkazivanje Dogovora');
});
test('unconfirmed permissions keep completion closed and explain how to refresh, inside the next-step card', async () => {
  await render(base({ radnje: null }));
  expect(brand()).toEqual(['Otvori poruke']); expect(texts()).toContain('Dozvole za završetak nisu potvrđene sa servera. Osveži status Dogovora pre završetka.');
  expect(labels()).toContain('Osveži dozvole za završetak');
});

// A pending change blocks both completions. It used to be one grey sentence on this screen with
// nothing to press, and what it proposed lived behind "Izmene i otkazivanje".
const proposal = (patch: Record<string, unknown> = {}) => ({ id: 'p1', moj: false, mozeOdgovoriti: true, mozePovuci: false,
  razlog: 'Ima više stvari nego što je rečeno.', izmene: [{ polje: 'Cena', sada: '3.000 RSD', predlog: '4.500 RSD' }], ...patch });
test('a change proposal waiting for my answer is the next step, says what it changes, and is the one brand action', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true, predlogIzmene: proposal() } }));
  const copy = texts();
  expect(copy).toContain('Predlog izmene čeka tvoj odgovor'); expect(copy).toContain('Cena'); expect(copy).toContain('3.000 RSD');
  expect(copy).toContain('4.500 RSD'); expect(copy).toContain('Ima više stvari nego što je rečeno.');
  expect(copy).toContain('Završetak je moguć tek kada se predlog prihvati, odbije ili povuče.');
  expect(brand()).toEqual(['Odgovori na predlog']); expect(labels()).toContain('Otvori poruke');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Odgovori na predlog' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dogovor/[id]/izmene', params: { id: mockAgreementId } });
});
test('my own pending proposal is shown as mine and does not take the brand action from the conversation', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true,
    predlogIzmene: proposal({ moj: true, mozeOdgovoriti: false, mozePovuci: true }) } }));
  expect(texts()).toContain('Tvoj predlog izmene čeka odgovor'); expect(texts()).toContain('4.500 RSD');
  expect(brand()).toEqual(['Otvori poruke']); expect(labels()).toContain('Pogledaj predlog');
});
test('a pending change whose content cannot be read still says it exists and leads to Izmene, inventing nothing', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: true, predlogIzmene: null } }));
  expect(texts()).toContain('Predlog izmene čeka odgovor'); expect(labels()).toContain('Pogledaj predlog'); expect(brand()).toEqual(['Otvori poruke']);
});

// PKG-048 (F12 / D02): a Dogovor is the end of one lived flow, so it says where it came from. Each side
// opens its own end, and a server that does not carry the ids offers no row at all.
test('the requester reaches the Zadatak this Dogovor grew out of, and is offered no Prijava of their own', async () => {
  await render(base());
  expect(labels()).toContain('Zadatak iz kog je nastao Dogovor');
  expect(labels()).not.toContain('Ponuda koju si poslao');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Zadatak iz kog je nastao Dogovor' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: mockNeedId } });
});
test('the worker reaches the Prilika and the offer they sent', async () => {
  await render(base({}, 'uskocer'));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Zadatak iz kog je nastao Dogovor' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/prilike/[id]', params: { id: mockNeedId } });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Ponuda koju si poslao' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/moje-prijave', params: { prijavaId: mockApplicationId } });
});
test.each([
  ['a reader that does not carry the links', { izvor: { zadatakId: null, prijavaId: null } }],
  ['a projection saved before the links existed', { izvor: undefined }],
])('%s offers no source row instead of one that leads nowhere', async (_label, patch) => {
  await render(base(patch, 'uskocer'));
  expect(labels()).not.toContain('Zadatak iz kog je nastao Dogovor');
  expect(labels()).not.toContain('Ponuda koju si poslao');
  // The rest of the screen is unaffected.
  expect(labels()).toContain('Izmene i otkazivanje Dogovora');
});

// PKG-050: the conversation settles its own "Nova poruka" notifications; the overview does not.
test('showing the Poruke tab with a loaded conversation settles the message notifications about this Dogovor once per list', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  await render(base());
  expect(mockMessagesRead).toHaveBeenCalledTimes(1);
  expect(mockMessagesRead).toHaveBeenCalledWith(mockAgreementId);
});
test('the Pregled tab settles nothing: the person has not read the messages there', async () => {
  await render(base());
  expect(mockMessagesRead).not.toHaveBeenCalled();
});
test('a refused settlement leaves the conversation exactly as it was', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  mockMessagesRead.mockRejectedValue(new Error('MESSAGES_READ_UNCONFIRMED'));
  await render(base());
  expect(mockMessagesRead).toHaveBeenCalledWith(mockAgreementId);
  expect(tree.root.findAll(node => String(node.type) === 'AgreementChat')).toHaveLength(1);
});

// PKG-050: the conversation settles its own "Nova poruka" notifications; the overview does not.
test('showing the Poruke tab with a loaded conversation settles the message notifications about this Dogovor once per list', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  await render(base());
  expect(mockMessagesRead).toHaveBeenCalledTimes(1);
  expect(mockMessagesRead).toHaveBeenCalledWith(mockAgreementId);
});
test('the Pregled tab settles nothing: the person has not read the messages there', async () => {
  await render(base());
  expect(mockMessagesRead).not.toHaveBeenCalled();
});
test('a refused settlement leaves the conversation exactly as it was', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  mockMessagesRead.mockRejectedValue(new Error('MESSAGES_READ_UNCONFIRMED'));
  await render(base());
  expect(mockMessagesRead).toHaveBeenCalledWith(mockAgreementId);
  expect(tree.root.findAll(node => String(node.type) === 'AgreementChat')).toHaveLength(1);
});

// V41 (owner, 2026-09-23): the top bar names the person the Dogovor is with, the same on both tabs, with the state under it.
const headers = () => tree.root.findAll(node => String(node.type) === 'T' && node.props.accessibilityRole === 'header').map(node => node.children.join(''));
test('the top bar names the other person with the state on both tabs, and its arrow still goes back', async () => {
  await render(base());
  expect(headers()).toContain('Marko'); expect(headers()).not.toContain('Dogovor'); expect(texts()).toContain('Dogovoreno');
  // No rating is invented for a person the Dogovor carries none for.
  expect(texts()).not.toContain('Još nema ocena');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Poruke' }).props.onPress());
  expect(headers()).toContain('Marko'); expect(headers()).not.toContain('Poruke');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Nazad' }).props.onPress());
  expect(mockRouter.back).toHaveBeenCalledTimes(1); expect(mockRouter.replace).not.toHaveBeenCalled();
});
test('a Dogovor that does not name the other side keeps the word Dogovor and its state', async () => {
  const lone = base({ stanje: 'AWAITING_REQUESTER' }, 'uskocer') as { ucesnici: { viSte: boolean }[] };
  await render({ ...lone, ucesnici: lone.ucesnici.filter(person => person.viSte) });
  expect(headers()).toContain('Dogovor'); expect(texts()).toContain('Čeka se potvrda završetka');
});

// The adapter can only say "Ja" or "Sagovornik"; the workspace knows who the other person is, and a bubble carries that name.
test('a bubble from the other person carries their name from the workspace, not the adapter label', async () => {
  mockParams = { id: mockAgreementId, tab: 'poruke' };
  mockRead.mockResolvedValue(base());
  mockMessages.mockResolvedValue([
    { id: '50000000-0000-4000-8000-000000000001', posiljalacAccountId: mockOther, posiljalacIme: 'Sagovornik', moja: false, telo: 'Cao', vremeTekst: '07:36', procitano: null },
    { id: '50000000-0000-4000-8000-000000000002', posiljalacAccountId: mockAccount, posiljalacIme: 'Ja', moja: true, telo: 'Ok', vremeTekst: '07:49', procitano: null }]);
  await act(async () => { tree = create(<Dogovor />); });
  const chat = tree.root.findAll(node => String(node.type) === 'AgreementChat')[0];
  expect(chat.props.messages.map((message: { posiljalacIme: string }) => message.posiljalacIme)).toEqual(['Marko', 'Ja']);
});
