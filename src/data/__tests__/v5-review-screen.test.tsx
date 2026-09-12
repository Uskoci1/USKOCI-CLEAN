import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from '../aiTaskReviewClientService';

const OWNER = '11111111-1111-4111-8111-111111111111', OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONVERSATION = '22222222-2222-4222-8222-222222222222', REVIEW = '33333333-3333-4333-8333-333333333333';
const NEED = '55555555-5555-4555-8555-555555555555';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockIntent = 'narucilac', mockFocused = true, mockCounter = 0;
let mockParams: { conversationId?: string | string[] } = { conversationId: CONVERSATION };
const mockLatest = jest.fn(), mockRead = jest.fn(), mockPrepare = jest.fn(), mockAccept = jest.fn(), mockResume = jest.fn();
const mockNeed = jest.fn(), mockCorrect = jest.fn(), mockOpenEdit = jest.fn(), mockAlert = jest.fn();
const mockLocationRead = jest.fn(), mockLocationSave = jest.fn(), mockCancelResolver = jest.fn();
const mockRouter = { replace: jest.fn() };
jest.mock('../aiTaskReviewClientService', () => ({ aiTaskReviewClientService: {
  readLatest: (...args: unknown[]) => mockLatest(...args), read: (...args: unknown[]) => mockRead(...args),
  prepare: (...args: unknown[]) => mockPrepare(...args), acceptAndPublish: (...args: unknown[]) => mockAccept(...args),
  resume: (...args: unknown[]) => mockResume(...args),
} }));
jest.mock('../index', () => ({ izvor: { potreba: (...args: unknown[]) => mockNeed(...args) },
  aiNeedV2Izvor: { correctFact: (...args: unknown[]) => mockCorrect(...args), openEditConversation: (...args: unknown[]) => mockOpenEdit(...args) } }));
jest.mock('../locationClientService', () => ({ needLocationClientService: {
  read: (...args: unknown[]) => mockLocationRead(...args), save: (...args: unknown[]) => mockLocationSave(...args),
} }));
jest.mock('../productionLocationResolver', () => ({ createProductionLocationResolver: () => ({ cancel: mockCancelResolver }) }));
jest.mock('../../ui/location/NeedLocationForm', () => ({ NeedLocationForm: 'LocationForm' }));
jest.mock('../../ui/aiFirst/ResponseDeadlineEditor', () => ({ ResponseDeadlineEditor: 'DeadlineEditor' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++mockCounter).padStart(12, '0')}` }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'Alert') return { alert: (...args: unknown[]) => mockAlert(...args) };
  return ['View', 'ScrollView', 'ActivityIndicator', 'KeyboardAvoidingView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import ReviewRoute from '../../app/(app)/pregled-zadatka';

const ok = (podatak: unknown) => ({ ok: true, podatak });
const unknownOutcome = () => ({ ok: false, kod: 'TASK_REVIEW_OUTCOME_UNCONFIRMED', poruka: 'Ishod objave nije potvrđen.' });
function review(): AiTaskReviewEnvelope {
  return { reviewId: REVIEW, accountId: OWNER, conversationId: CONVERSATION, schemaVersion: 'NEED_FACT_V2', draftId: null, draftRevision: 0,
    displayedContentDigest: 'a'.repeat(64), factsRevision: 'b'.repeat(64), sourceTurnRevision: 2, geographyRevision: 'c'.repeat(64),
    expiresAt: '2026-10-01T00:00:00Z', responseDeadline: null, location: null, canAccept: true, safety: 'ALLOW', missingRequired: [],
    publicProjection: [{ id: 'title', key: 'need.title', value: 'Prenos ormara', displayValue: 'Prenos ormara',
      privacyClass: 'PUBLIC', source: 'AI_INFERENCE', status: 'NEEDS_CONFIRMATION' }],
    ownerPrivateProjection: [{ id: 'address', key: 'need.exact_address', value: 'Privatna 42', displayValue: 'Privatna 42',
      privacyClass: 'PRIVATE', source: 'EXPLICIT_USER_ANSWER', status: 'NEEDS_CONFIRMATION' }],
  };
}
function command(state: AiTaskPublicationCommand['state'] = 'ACCEPTED'): AiTaskPublicationCommand {
  return { reviewId: REVIEW, clientRequestId: '44444444-4444-4444-8444-444444444444', needId: NEED, needRevision: 1,
    state, evaluation: null, published: state === 'PUBLISHED' ? { needId: NEED, status: 'PUBLISHED',
      publishedAt: '2026-09-12T12:00:01Z', responseDeadline: null, idempotentReplay: false } : null, authoritative: true };
}
function deferred<T = unknown>() { let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<ReviewRoute />); }); };
const update = async () => { await act(async () => tree.update(<ReviewRoute />)); };
const action = (label: string) => tree.root.findByProps({ label }).props;
const publish = () => tree.root.findByProps({ accessibilityLabel: 'Objavi zadatak' }).props;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const blur = async () => { mockFocused = false; await update(); };
const focus = async () => { mockFocused = true; await update(); };
beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockLatest, mockRead, mockPrepare, mockAccept, mockResume, mockNeed, mockCorrect, mockOpenEdit, mockLocationRead, mockLocationSave]) mock.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockIntent = 'narucilac'; mockFocused = true; mockCounter = 0;
  mockParams = { conversationId: CONVERSATION };
  mockLatest.mockResolvedValue(ok(null)); mockRead.mockResolvedValue(ok({ review: review(), command: null }));
  mockPrepare.mockResolvedValue(ok(review())); mockAccept.mockResolvedValue(unknownOutcome()); mockResume.mockResolvedValue(unknownOutcome());
  mockNeed.mockResolvedValue({ id: NEED, narucilacId: OWNER, revizija: 1, stanje: 'OBJAVLJENA' });
  mockLocationRead.mockResolvedValue(ok({ conversationId: CONVERSATION, revision: 'location-r1', value: null, authoritative: true }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('prepares the displayed public and private review with one publish action and no per-fact confirmation', async () => {
  await render();
  expect(mockLatest).toHaveBeenCalledWith(CONVERSATION);
  expect(mockPrepare).toHaveBeenCalledWith({ conversationId: CONVERSATION, responseDeadline: null });
  expect(text()).toContain('Prenos ormara'); expect(text()).toContain('Privatni podaci'); expect(text()).toContain('Privatna 42');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(1);
  expect(publish().disabled).toBe(false);
  const labels = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel).join(' ');
  expect(labels).not.toMatch(/potvrdi|prihvati podatak/i);
  expect(mockCorrect).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(mockAlert).not.toHaveBeenCalled();
});

it('serializes retained taps to one immutable review command and freezes an unknown result until explicit readback', async () => {
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise); await render(); const retained = publish().onPress;
  await act(async () => { void retained(); void retained(); });
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(mockAccept.mock.calls[0][0]).toEqual({ review: review(), clientRequestId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
  await act(async () => held.resolve(unknownOutcome())); expect(publish().disabled).toBe(true);
  await act(async () => retained()); expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockRead).not.toHaveBeenCalled();
  mockRead.mockResolvedValue(ok({ review: review(), command: command('UNKNOWN_OUTCOME') }));
  await act(async () => action('Učitaj pregled i proveri ishod').onPress());
  expect(mockRead).toHaveBeenCalledWith(REVIEW); expect(mockLatest).toHaveBeenCalledTimes(1);
  expect(mockResume).not.toHaveBeenCalled(); expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Objava još nije potvrđena'); expect(mockAlert).not.toHaveBeenCalled();
});

it.each(['ACCEPTED', 'EVALUATING', 'UNKNOWN_OUTCOME'] as const)('restores %s on a fresh screen by read only without automatically resuming publication', async state => {
  mockLatest.mockResolvedValue(ok({ review: review(), command: command(state) })); await render();
  expect(mockPrepare).not.toHaveBeenCalled(); expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Objavi zadatak' })).toHaveLength(0);
  expect(text()).not.toContain('Zadatak je objavljen.');
  if (state === 'ACCEPTED') {
    await act(async () => action('Nastavi istu objavu').onPress());
    expect(mockResume).toHaveBeenCalledWith(command(state)); expect(mockAccept).not.toHaveBeenCalled();
  }
});

it.each([
  ['different Need', { id: OTHER, revizija: 1, stanje: 'OBJAVLJENA' }],
  ['different revision', { id: NEED, revizija: 2, stanje: 'OBJAVLJENA' }],
  ['private draft', { id: NEED, revizija: 1, stanje: 'NACRT' }],
  ['missing Need', null],
])('does not label a stored receipt published before matching Need readback: %s', async (_case, value) => {
  mockLatest.mockResolvedValue(ok({ review: review(), command: command('PUBLISHED') })); mockNeed.mockResolvedValue(value);
  await render(); expect(mockNeed).toHaveBeenCalledWith(NEED);
  expect(text()).toContain('Objava je zabeležena. Ponovo učitaj zadatak');
  expect(text()).not.toContain('Zadatak je objavljen.'); expect(tree.root.findAllByProps({ label: 'Otvori zadatak' })).toHaveLength(0);
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

it('shows publication only after the current owned Need revision and published state are read, then opens its exact route', async () => {
  const held = deferred(); mockLatest.mockResolvedValue(ok({ review: review(), command: command('PUBLISHED') })); mockNeed.mockReturnValueOnce(held.promise);
  await render(); expect(text()).not.toContain('Zadatak je objavljen.');
  await act(async () => held.resolve({ id: NEED, narucilacId: OWNER, revizija: 1, stanje: 'CEKA_PRIJAVE' }));
  expect(text()).toContain('Zadatak je objavljen.'); const retained = action('Otvori zadatak').onPress;
  await act(async () => { retained(); retained(); });
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: NEED } });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});

it.each(['blur', 'account ABA', 'account switch', 'intent', 'route'] as const)('rejects retained publish and late callbacks after %s', async change => {
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise); await render(); const retained = publish().onPress;
  await act(async () => { void retained(); });
  if (change === 'blur') await blur();
  else {
    if (change === 'account ABA') mockSession = { user: { id: OWNER }, accountRevision: 3 };
    if (change === 'account switch') mockSession = { user: { id: OTHER }, accountRevision: 2 };
    if (change === 'intent') mockIntent = 'uskocer';
    if (change === 'route') mockParams = { conversationId: OTHER };
    await update();
  }
  const reads = mockRead.mock.calls.length;
  await act(async () => { held.resolve(ok(command('PUBLISHED'))); await retained(); });
  expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(reads);
  expect(mockNeed).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(text()).not.toContain('Zadatak je objavljen.');
});

it('refocuses after a lost acceptance using its retained review identity without a second acceptance', async () => {
  const held = deferred(); mockAccept.mockReturnValueOnce(held.promise); await render();
  await act(async () => { void publish().onPress(); }); await blur();
  await act(async () => held.resolve(unknownOutcome()));
  mockRead.mockResolvedValue(ok({ review: review(), command: command('ACCEPTED') })); await focus();
  expect(mockRead).toHaveBeenCalledWith(REVIEW); expect(mockAccept).toHaveBeenCalledTimes(1); expect(mockResume).not.toHaveBeenCalled();
});

it('passes reviewOnly to the location editor and prepares the proposed location without saving canonical facts', async () => {
  await render(); await act(async () => action('Dodaj mesto').onPress());
  const form = tree.root.findByType('LocationForm' as React.ElementType).props;
  expect(form.reviewOnly).toBe(true); expect(form.review.revision).toBe('location-r1'); expect(publish().disabled).toBe(true);
  const value = { taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null, resolvedLocation: null };
  await act(async () => form.onSave(value));
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null,
    location: { expectedRevision: 'location-r1', value } });
  expect(mockLocationSave).not.toHaveBeenCalled(); expect(mockCorrect).not.toHaveBeenCalled();
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('LocationForm' as React.ElementType)).toHaveLength(0);
});

it('prepares a new immutable review for an explicit deadline without publishing while the editor is open', async () => {
  await render(); const retainedPublish = publish().onPress, retainedLocation = action('Dodaj mesto').onPress;
  await act(async () => action('Uredi rok za prijave').onPress());
  expect(publish().disabled).toBe(true);
  await act(async () => { void retainedPublish(); void retainedLocation(); });
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockLocationRead).not.toHaveBeenCalled();
  const deadline = '2026-10-12T10:15:00.000Z';
  mockPrepare.mockResolvedValue(ok({ ...review(), reviewId: OTHER, responseDeadline: deadline }));
  await act(async () => tree.root.findByType('DeadlineEditor' as React.ElementType).props.apply(deadline));
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: deadline });
  expect(tree.root.findAllByType('DeadlineEditor' as React.ElementType)).toHaveLength(0);
  expect(publish().disabled).toBe(false); expect(mockAccept).not.toHaveBeenCalled();
  await act(async () => publish().onPress());
  expect(mockAccept.mock.calls[0][0].review).toMatchObject({ reviewId: OTHER, responseDeadline: deadline });
});

it('restores the server review deadline and allows its explicit removal without inventing a duration', async () => {
  const deadline = '2026-10-12T10:15:00.000Z';
  mockLatest.mockResolvedValue(ok({ review: { ...review(), responseDeadline: deadline }, command: null }));
  mockPrepare.mockResolvedValue(ok({ ...review(), responseDeadline: deadline }));
  await render();
  expect(mockPrepare).toHaveBeenCalledWith({ conversationId: CONVERSATION, responseDeadline: deadline });
  await act(async () => action('Uredi rok za prijave').onPress());
  const form = tree.root.findByType('DeadlineEditor' as React.ElementType).props;
  expect(form.value).toBe(deadline);
  mockPrepare.mockResolvedValue(ok(review()));
  await act(async () => form.apply(null));
  expect(mockPrepare).toHaveBeenLastCalledWith({ conversationId: CONVERSATION, responseDeadline: null });
  expect(text()).toContain('do popune, zaustavljanja potrage ili isteka zadatka');
  expect(mockAccept).not.toHaveBeenCalled();
});

it.each([undefined, 'malformed', [CONVERSATION]])('invalid conversation route performs no review or publication I/O', async value => {
  mockParams = { conversationId: value }; await render();
  expect(mockLatest).not.toHaveBeenCalled(); expect(mockPrepare).not.toHaveBeenCalled();
  expect(mockAccept).not.toHaveBeenCalled(); expect(mockResume).not.toHaveBeenCalled();
});
