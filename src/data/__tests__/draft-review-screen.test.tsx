import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';

let mockConversationId = 'conversation-a';
let mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
let mockIntent = 'narucilac';
let mockFocused = true;
const mockLoad = jest.fn(), mockNeed = jest.fn(), mockConfirm = jest.fn(), mockCorrect = jest.fn(), mockSave = jest.fn(), mockConfirmEdit = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('../../data', () => ({
  aiNeedV2Izvor: { loadConversation: (...args: unknown[]) => mockLoad(...args), confirmFact: (...args: unknown[]) => mockConfirm(...args),
    correctFact: (...args: unknown[]) => mockCorrect(...args), saveDraft: (...args: unknown[]) => mockSave(...args), confirmEdit: (...args: unknown[]) => mockConfirmEdit(...args) },
  izvor: { potreba: (...args: unknown[]) => mockNeed(...args) },
}));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ conversationId: mockConversationId }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]),
}));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', Check: 'Icon', CheckCircle: 'Icon', LockKey: 'Icon', PencilSimple: 'Icon', ShieldCheck: 'Icon', Warning: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button', Card: 'Card' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import Review from '../../app/(app)/pregled-nacrta';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function conversation(display = 'Pregled naloga A', boundNeedId: string | null = null, status: AiNeedV2Fact['status'] = 'CONFIRMED'): AiNeedV2Conversation {
  const fact: AiNeedV2Fact = { id: 'fact-a', key: 'need.title', displayValue: display, value: display, valueType: 'TEXT',
    privacyClass: 'PUBLIC', requiredForDraft: true, source: 'EXPLICIT_USER_ANSWER', evidence: null, status };
  return { conversationId: mockConversationId, schemaVersion: 'NEED_FACT_V2', status: 'OPEN', messages: [], facts: [fact], safety: 'ALLOW',
    review: { conversationId: mockConversationId, schemaVersion: 'NEED_FACT_V2', boundNeedId, canSaveDraft: status === 'CONFIRMED',
      missingRequired: status === 'CONFIRMED' ? [] : ['need.title'], facts: [fact] } };
}
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Review />); }); };
const update = async () => { await act(async () => tree.update(<Review />)); };
const button = (label: string) => tree.root.findByProps({ label });
const reveal = async (label = 'Naslov') => { await act(async () => tree.root.findByProps({ accessibilityLabel: `Pregledajte: ${label}` }).props.onPress()); };
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockLoad, mockNeed, mockConfirm, mockCorrect, mockSave, mockConfirmEdit]) mock.mockReset();
  mockConversationId = 'conversation-a'; mockSession = { user: { id: 'account-a' }, accountRevision: 1, sessionEpoch: 1 };
  mockIntent = 'narucilac'; mockFocused = true;
  mockLoad.mockImplementation(async () => conversation());
  mockConfirm.mockResolvedValue({ ok: true, podatak: null });
  mockCorrect.mockResolvedValue({ ok: true, podatak: { newFactId: 'fact-b' } });
  mockSave.mockResolvedValue({ ok: true, podatak: { needId: 'need-a' } });
  mockConfirmEdit.mockResolvedValue({ ok: true, podatak: { needId: 'need-a' } });
});
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('owned parent draft review screen', () => {
  it.each([null, 'need-a'])('requires human confirmation of optional proposals before saving a %s review', async bound => {
    const data = conversation('Confirmed title', bound);
    const optional: AiNeedV2Fact = { id: 'optional-a', key: 'need.required_tools', value: ['kolica'], displayValue: 'kolica',
      valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, source: 'AI_INFERENCE', evidence: 'fixture', status: 'NEEDS_CONFIRMATION' };
    data.facts.push(optional); data.review.facts = data.facts;
    mockLoad.mockResolvedValue(data); if (bound) mockNeed.mockResolvedValue({ id: bound, stanje: 'NACRT', revizija: 4 });
    await render(); const save = button(bound ? 'Sačuvajte izmene' : 'Sačuvajte nacrt');
    expect(save.props.disabled).toBe(true); await act(async () => save.props.onPress());
    expect(mockSave).not.toHaveBeenCalled(); expect(mockConfirmEdit).not.toHaveBeenCalled();
    expect(text()).toContain('Pregledajte i preostale predloge');
  });
  it.each(['ABANDONED', 'COMPLETED'] as const)('keeps an unbound %s conversation read-only even with a stale ready flag', async status => {
    mockLoad.mockResolvedValue({ ...conversation(), status }); await render();
    expect(tree.root.findAllByProps({ label: 'Sačuvajte nacrt' })).toHaveLength(0);
    expect(text()).toContain('Ovaj razgovor je zatvoren'); expect(mockSave).not.toHaveBeenCalled();
  });
  it('edits an actual OPEN conversation bound to a saved DRAFT through the existing confirmEdit owner', async () => {
    mockLoad.mockResolvedValue(conversation('Ispravka nacrta', 'need-a'));
    mockNeed.mockResolvedValue({ id: 'need-a', stanje: 'NACRT', revizija: 4 });
    await render();
    expect(text()).not.toContain('Zadatak je već sačuvan');
    await act(async () => { await button('Sačuvajte izmene').props.onPress(); });
    expect(mockConfirmEdit).toHaveBeenCalledWith('need-a', 4, 'conversation-a', expect.any(String));
    expect(mockSave).not.toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'ABANDONED', undefined, 'UNKNOWN'])('does not infer an edit from boundNeedId when status is %s', async status => {
    mockLoad.mockResolvedValue({ ...conversation('Sačuvani nacrt', 'need-a'), status });
    mockNeed.mockResolvedValue({ id: 'need-a', stanje: 'NACRT', revizija: 4 });
    await render();
    expect(text()).toContain('Zadatak je već sačuvan');
    expect(tree.root.findAllByProps({ label: 'Sačuvajte izmene' })).toHaveLength(0);
    expect(mockConfirmEdit).not.toHaveBeenCalled();
  });
  it('refreshes on return from the real location editor and rejects a stale review action', async () => {
    mockLoad.mockResolvedValueOnce(conversation('Prvo mesto')).mockResolvedValueOnce(conversation('Sačuvano novo mesto'));
    await render();
    const oldSave = button('Sačuvajte nacrt').props.onPress;
    const openLocation = button('Mesto Zadatka').props.onPress;
    await act(async () => { openLocation(); openLocation(); });
    expect(mockRouter.push.mock.calls).toEqual([[{ pathname: '/mesto-zadatka', params: { conversationId: 'conversation-a' } }]]);
    await act(async () => { await oldSave(); });
    expect(mockSave).not.toHaveBeenCalled();
    mockFocused = false; await update(); mockFocused = true; await update();
    expect(text()).toContain('Sačuvano novo mesto'); expect(text()).not.toContain('Prvo mesto');
    await act(async () => { await oldSave(); });
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it.each(['success', 'failure'] as const)('does not reveal late read %s from an old account', async result => {
    const old = deferred<AiNeedV2Conversation>();
    mockLoad.mockReturnValueOnce(old.promise).mockResolvedValueOnce(conversation('Pregled naloga B'));
    await render();
    mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    await update();
    await act(async () => { if (result === 'success') old.resolve(conversation('Privatni stari pregled')); else old.reject(new Error('private database failure')); });
    expect(text()).toContain('Pregled naloga B');
    expect(text()).not.toContain('Privatni'); expect(text()).not.toContain('private database');
  });

  it('serializes draft double taps and navigates once using the accepted receipt', async () => {
    const pending = deferred<unknown>(); mockSave.mockReturnValueOnce(pending.promise);
    await render();
    const save = button('Sačuvajte nacrt').props.onPress;
    await act(async () => { void save(); void save(); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ok: true, podatak: { needId: 'saved-need' } }));
    expect(mockRouter.replace.mock.calls).toEqual([[{ pathname: '/potrebe/[id]/pregled', params: { id: 'saved-need' } }]]);
  });

  it.each(['account', 'blur'] as const)('cannot navigate after a pending save loses ownership by %s', async change => {
    const pending = deferred<unknown>(); mockSave.mockReturnValueOnce(pending.promise);
    await render();
    await act(async () => { void button('Sačuvajte nacrt').props.onPress(); });
    if (change === 'account') mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    else mockFocused = false;
    await update();
    await act(async () => pending.resolve({ ok: true, podatak: { needId: 'old-private-need' } }));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('makes an unknown write outcome readable and requires readback before another send', async () => {
    mockSave.mockRejectedValueOnce(new Error('secret PostgreSQL internals'));
    await render(); const retained = button('Sačuvajte nacrt').props.onPress;
    await act(async () => { await retained(); });
    expect(text()).toContain('Čuvanje nije potvrđeno'); expect(text()).not.toContain('PostgreSQL');
    expect(button('Sačuvajte nacrt').props.disabled).toBe(true);
    await act(async () => { await retained(); }); expect(mockSave).toHaveBeenCalledTimes(1);
    await act(async () => { await button('Učitajte pregled ponovo').props.onPress(); });
    await act(async () => { await button('Sačuvajte nacrt').props.onPress(); });
    expect(mockSave).toHaveBeenCalledTimes(2);
  });

  it('confirms the exact visible Need revision and never silently adopts the latest server revision', async () => {
    mockLoad.mockResolvedValue(conversation('Izmena Zadatka', 'need-a'));
    mockNeed.mockResolvedValueOnce({ id: 'need-a', stanje: 'AKTIVAN', revizija: 3 }).mockResolvedValue({ id: 'need-a', stanje: 'AKTIVAN', revizija: 7 });
    mockConfirmEdit.mockResolvedValueOnce({ ok: false, kod: 'NEED_VERSION_CONFLICT', poruka: 'Zadatak je promenjen. Učitajte pregled ponovo.' });
    await render();
    await act(async () => { await button('Sačuvajte izmene').props.onPress(); });
    expect(mockNeed).toHaveBeenCalledTimes(1);
    expect(mockConfirmEdit).toHaveBeenCalledWith('need-a', 3, 'conversation-a', expect.any(String));
    expect(mockSave).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(button('Sačuvajte izmene').props.disabled).toBe(true);
  });

  it('does not present an already-saved draft while a bound public Need read is still pending', async () => {
    const pending = deferred<unknown>();
    mockLoad.mockResolvedValue(conversation('Izmena Zadatka', 'need-a')); mockNeed.mockReturnValueOnce(pending.promise);
    await render();
    expect(text()).not.toContain('Zadatak je već sačuvan');
    expect(tree.root.findAllByProps({ label: 'Sačuvajte nacrt' })).toHaveLength(0);
    await act(async () => pending.resolve({ id: 'need-a', stanje: 'AKTIVAN', revizija: 3 }));
    expect(button('Sačuvajte izmene')).toBeDefined();
  });

  it('serializes fact confirmations and only displays their fresh authoritative review', async () => {
    const pending = deferred<unknown>();
    mockLoad.mockResolvedValueOnce(conversation('Predloženi naslov', null, 'NEEDS_CONFIRMATION')).mockResolvedValueOnce(conversation('Potvrđeni naslov'));
    mockConfirm.mockReturnValueOnce(pending.promise);
    await render(); await reveal(); const confirm = button('Potvrdite').props.onPress;
    await act(async () => { confirm(); confirm(); });
    expect(mockConfirm.mock.calls).toEqual([['fact-a']]);
    await act(async () => pending.resolve({ ok: true, podatak: null }));
    expect(text()).toContain('Potvrđeni naslov'); expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  it('blocks retained local edit/navigation actions after account changes before rerender', async () => {
    await render(); await reveal(); const open = button('Mesto Zadatka').props.onPress, edit = button('Izmenite').props.onPress;
    mockSession = { user: { id: 'account-b' }, accountRevision: 2, sessionEpoch: 2 };
    await act(async () => { open(); edit(); });
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ label: 'Sačuvaj ispravku' })).toHaveLength(0);
  });

  it('offers a readable retry when initial load throws and never renders raw transport errors', async () => {
    mockLoad.mockRejectedValueOnce(new Error('private token / SQL')).mockResolvedValueOnce(conversation());
    await render();
    expect(text()).toContain('Pregled trenutno nije moguće učitati'); expect(text()).not.toContain('private token');
    await act(async () => { await button('Učitajte pregled ponovo').props.onPress(); });
    expect(text()).toContain('Pregled naloga A');
  });

  it('does not start the second bound-Need request after the conversation read loses focus', async () => {
    const old = deferred<AiNeedV2Conversation>();
    mockLoad.mockReturnValueOnce(old.promise);
    await render();
    mockFocused = false; await update();
    await act(async () => old.resolve(conversation('Stari pregled', 'private-old-need')));
    expect(mockNeed).not.toHaveBeenCalled();
  });

  it('serializes corrections and does not reload their late result after leaving the screen', async () => {
    const pending = deferred<unknown>(); mockCorrect.mockReturnValueOnce(pending.promise);
    await render();
    await reveal();
    await act(async () => button('Izmenite').props.onPress());
    await act(async () => tree.root.findByType('TextInput' as React.ElementType).props.onChangeText('Ispravljen naslov'));
    const save = button('Sačuvaj ispravku').props.onPress;
    await act(async () => { void save(); void save(); });
    expect(mockCorrect).toHaveBeenCalledTimes(1);
    expect(mockCorrect).toHaveBeenCalledWith('fact-a', 'Ispravljen naslov', 'Ispravljen naslov');
    mockFocused = false; await update();
    await act(async () => pending.resolve({ ok: true, podatak: { newFactId: 'new-fact' } }));
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('shows one focused fact editor and keeps private evidence behind its row', async () => {
    const data = conversation('Javni naslov');
    const privateFact: AiNeedV2Fact = { ...data.facts[0], id: 'private-a', key: 'need.access_notes',
      displayValue: 'Privatni ulaz 4', value: 'Privatni ulaz 4', evidence: 'Privatni razgovor', privacyClass: 'PRIVATE' };
    data.facts.push(privateFact); data.review.facts = data.facts; mockLoad.mockResolvedValue(data);
    await render(); expect(text()).not.toContain('Privatni ulaz 4'); expect(text()).not.toContain('Privatni razgovor');
    await reveal(); expect(button('Izmenite')).toBeDefined();
    await reveal('Pristup'); expect(tree.root.findAllByProps({ label: 'Izmenite' })).toHaveLength(0);
    expect(text()).toContain('Privatni ulaz 4'); expect(text()).toContain('Privatni razgovor');
  });

  it('does not save the old value while a focused correction is unfinished', async () => {
    await render(); await reveal(); await act(async () => button('Izmenite').props.onPress());
    expect(button('Sačuvajte nacrt').props.disabled).toBe(true);
    await act(async () => button('Sačuvajte nacrt').props.onPress()); expect(mockSave).not.toHaveBeenCalled();
  });

  it('reviews and seeds correction from the complete typed value rather than the proposed summary', async () => {
    const data = conversation('Model summary', null, 'NEEDS_CONFIRMATION');
    data.facts[0].value = 'Stvarni kompletan naslov';
    mockLoad.mockResolvedValue(data); await render(); await reveal();
    expect(text()).toContain('Stvarni kompletan naslov'); expect(text()).not.toContain('Model summary');
    await act(async () => button('Izmenite').props.onPress());
    expect(tree.root.findByType('TextInput' as React.ElementType).props.value).toBe('Stvarni kompletan naslov');
    await act(async () => button('Sačuvaj ispravku').props.onPress());
    expect(mockCorrect).toHaveBeenCalledWith('fact-a', 'Stvarni kompletan naslov', 'Stvarni kompletan naslov');
  });

  it('retains an unfinished correction when another row or a retained mutation is pressed', async () => {
    const data = conversation('Naslov', null, 'NEEDS_CONFIRMATION');
    data.facts.push({ ...data.facts[0], id: 'description-a', key: 'need.description', value: 'Opis', displayValue: 'Opis' });
    data.review.facts = data.facts; mockLoad.mockResolvedValue(data); await render(); await reveal();
    const oldConfirm = button('Potvrdite').props.onPress, oldLocation = button('Mesto Zadatka').props.onPress;
    const oldSave = button('Sačuvajte nacrt').props.onPress;
    const otherRow = tree.root.findByProps({ accessibilityLabel: 'Pregledajte: Opis' }).props.onPress;
    await act(async () => button('Izmenite').props.onPress());
    await act(async () => tree.root.findByType('TextInput' as React.ElementType).props.onChangeText('Moja nezavršena ispravka'));
    await act(async () => { otherRow(); oldConfirm(); oldLocation(); oldSave(); });
    expect(tree.root.findByType('TextInput' as React.ElementType).props.value).toBe('Moja nezavršena ispravka');
    expect(mockConfirm).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => button('Odustani').props.onPress());
    await reveal('Opis'); expect(tree.root.findByProps({ accessibilityLabel: 'Pregledajte: Opis' }).props.accessibilityState.expanded).toBe(true);
  });

  it('does not label an already published bound task as a private draft', async () => {
    mockLoad.mockResolvedValue({ ...conversation('Objavljen zadatak', 'need-a'), status: 'COMPLETED' });
    mockNeed.mockResolvedValue({ id: 'need-a', stanje: 'AKTIVAN', revizija: 4 }); await render();
    expect(text()).toContain('Zadatak je već sačuvan'); expect(text()).not.toContain('Privatan nacrt');
    expect(text()).not.toContain('Sačuvani nacrt');
  });
});
