import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockAccount = '10000000-0000-4000-8000-000000000001', mockOther = '10000000-0000-4000-8000-000000000002', mockAgreementId = '20000000-0000-4000-8000-000000000001';
const mockRouter = { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn() };
const mockRead = jest.fn(), mockMessages = jest.fn();
const mockSource = { dogovor: mockRead, poruke: mockMessages, oznaciZavrsetak: jest.fn(), potvrdiZavrsetak: jest.fn(), podeliTelefon: jest.fn(), opoziviTelefon: jest.fn() };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android' };
    if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
    return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ id: mockAgreementId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('../agreementClientService', () => ({ agreementProblemService: { submit: jest.fn(), read: jest.fn() } }));
jest.mock('../groupConversationService', () => ({ groupConversationService: { context: jest.fn().mockResolvedValue({ ok: true, podatak: { group: null } }) } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/AgreementChat', () => ({ AgreementChat: 'AgreementChat' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PrivateMap' }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: 0 }), sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: 0 }) }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => 'narucilac', ulogaSada: () => 'narucilac' }));
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
  radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: false, izmenaNaCekanju: false }, ...patch });
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAll(node => String(node.type) === 'Press');
const brand = () => presses().filter(node => JSON.stringify(node.props.style).includes('#FF850F')).map(node => node.props.accessibilityLabel);
const labels = () => presses().map(node => node.props.accessibilityLabel);
async function render(workspace: Record<string, unknown>) {
  mockRead.mockResolvedValue(workspace); mockMessages.mockResolvedValue([]);
  await act(async () => { tree = create(<Dogovor />); });
}
beforeEach(() => { jest.clearAllMocks(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('a confirmed Agreement without server permission leads with the conversation as the one brand action and names the next step', async () => {
  await render(base());
  expect(brand()).toEqual(['Otvori poruke']); expect(labels().filter(label => label === 'Otvori poruke')).toHaveLength(1);
  const copy = texts();
  expect(copy).toContain('Dogovoreno'); expect(copy).toContain('Sledeći korak'); expect(copy).toContain('Potvrdi završetak kada je posao obavljen');
  expect(copy).toContain('Završetak možeš potvrditi kada je posao obavljen, i pre nego što ga Uskočer označi.');
  expect(labels()).toEqual(expect.arrayContaining(['Izmene i otkazivanje Dogovora', 'Dobrovoljna lokacija Uskočera', 'Bezbednost i privatna prijava', 'Kontakt', 'Tok Dogovora', 'Prijavi problem']));
  // The timeline is progressive disclosure: collapsed until the user asks for it.
  expect(copy).not.toContain('Dogovor je potvrđen');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Tok Dogovora' }).props.onPress());
  expect(texts()).toContain('Dogovor je potvrđen');
});
test('when the server allows completion, completion is the brand action and the conversation stays one tap away', async () => {
  await render(base({ radnje: { mozeOznacitiZavrsetak: false, mozePotvrditiZavrsetak: true, izmenaNaCekanju: false } }));
  expect(brand()).toEqual(['Potvrdi završetak']); expect(labels()).toContain('Otvori poruke');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Potvrdi završetak' }).props.onPress());
  expect(mockSource.potvrdiZavrsetak).toHaveBeenCalledWith(mockAgreementId);
});
test('a worker awaiting the requester sees the wait and the deadline; no completion action is offered', async () => {
  await render(base({ stanje: 'AWAITING_REQUESTER', rokPotvrdeIso: '2026-09-18T10:00:00Z' }, 'uskocer'));
  const copy = texts();
  expect(copy).toContain('Čeka se Naručilac'); expect(copy).toContain('Bez odgovora se Dogovor zatvara sam.'); expect(copy).toContain('Čeka se potvrda završetka');
  expect(brand()).toEqual(['Otvori poruke']); expect(labels()).not.toContain('Završio sam');
});
test('a completed Agreement leads with the review; a cancelled one offers only the conversation', async () => {
  await render(base({ stanje: 'COMPLETED' }));
  expect(brand()).toEqual(['Oceni saradnju']); expect(texts()).toContain('Dogovor je završen'); expect(labels()).not.toContain('Dobrovoljna lokacija Uskočera');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Oceni saradnju' }).props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/oceni-dogovor', params: { agreementId: mockAgreementId } });
  await act(async () => tree.unmount());
  await render(base({ stanje: 'CANCELLED' }));
  expect(brand()).toEqual(['Otvori poruke']); expect(texts()).toContain('Dogovor je otkazan.'); expect(labels()).not.toContain('Prijavi problem');
});
test('unconfirmed permissions keep completion closed and explain how to refresh, inside the next-step card', async () => {
  await render(base({ radnje: null }));
  expect(brand()).toEqual(['Otvori poruke']); expect(texts()).toContain('Dozvole za završetak nisu potvrđene sa servera. Osveži status Dogovora pre završetka.');
  expect(labels()).toContain('Osveži dozvole za završetak');
});
