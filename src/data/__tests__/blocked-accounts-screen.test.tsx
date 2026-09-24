import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The blocked list's good case — nobody blocked — used to be a bare sentence with nothing to do
// (owner rule, 2026-09-23: an empty state has a sentence and one action). It now says how a block
// happens, since this screen cannot start one, and offers the one thing it can: a re-check.
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002', C = '10000000-0000-4000-8000-000000000003';
const mockSession = { user: { id: A }, accountRevision: 1 };
const mockList = jest.fn(), mockSetBlock = jest.fn(), mockRouter = { back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../safetyClientService', () => ({ safetyClientService: {
  listMyBlocks: (...args: unknown[]) => mockList(...args), setBlock: (...args: unknown[]) => mockSetBlock(...args) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsGroup: 'Group', SettingsRow: 'Row',
  SettingsAction: 'Action', SettingsPersonRow: 'PersonRow' }));
// The empty, loading and error states are the shared StateView, whose words are the same `T` host here.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Route from '../../app/(app)/profil/blokirani';

const ok = (items: { targetAccountId: string; displayName: string | null; revision?: number }[], nextCursor: string | null = null) =>
  ({ ok: true, podatak: { accountId: A, authoritative: true, items: items.map(item => ({ revision: 1, ...item, accountId: A, blocked: true })), nextCursor } });
const receipt = (target: string, revision: number) => ({ ok: true, podatak: { accountId: A, targetAccountId: target, blocked: false, revision, authoritative: true, clientRequestId: 'x', idempotentReplay: false } });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const action = (label: string) => tree.root.findByProps({ label }).props;
const actions = (label: string) => tree.root.findAllByProps({ label });
const people = () => tree.root.findAllByType('PersonRow' as React.ElementType);
const person = (name: string) => people().find(node => node.props.name === name)!;
const confirmButton = () => tree.root.findAll(node => node.props.testID === 'confirm-sheet-confirm')[0];
const askUnblock = async (name: string) => act(async () => person(name).props.action.onPress());
beforeEach(() => { jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true); mockList.mockResolvedValue(ok([])); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('with nobody blocked, says how a block happens and offers a re-check instead of a bare "no data"', async () => {
  await render();
  expect(text()).toContain('Još nema blokiranih korisnika.');
  expect(text()).toContain('sa javnog profila osobe');
  expect(mockList).toHaveBeenCalledTimes(1);
  await act(async () => action('Proveri ponovo').onPress());
  expect(mockList).toHaveBeenCalledTimes(2);
  expect(actions('Sledeći korisnici')).toHaveLength(0); expect(actions('Početak liste')).toHaveLength(0);
  // No sentence explaining the screen: the bar says where you are.
  expect(text()).not.toContain('Korisnici koje trenutno blokiraš');
});

it('names each blocked person or says honestly that the name is unknown, and opens them in safety', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko' }, { targetAccountId: C, displayName: null }]));
  await render();
  expect(text()).not.toContain('Još nema blokiranih');
  expect(actions('Proveri ponovo')).toHaveLength(0);
  expect(people().map(node => node.props.name)).toEqual(['Marko', 'USKOČI korisnik']);
  // The letters come from the real name only; an unknown person is drawn, never given letters.
  expect(people().map(node => node.props.initials)).toEqual(['M', null]);
  expect(people().map(node => node.props.action.accessibilityLabel)).toEqual(['Odblokiraj, Marko', 'Odblokiraj, USKOČI korisnik']);
  await act(async () => person('Marko').props.onOpen());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/bezbednost', params: { targetAccountId: B } });
});

it('an empty later page offers the way back to the start, and Back with no history goes to the hub', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko' }], C)).mockResolvedValue(ok([]));
  await render();
  await act(async () => action('Sledeći korisnici').onPress());
  expect(mockList).toHaveBeenLastCalledWith(C);
  expect(text()).toContain('Na ovoj stranici nema više korisnika.');
  expect(actions('Početak liste')).toHaveLength(1);
  mockRouter.canGoBack.mockReturnValue(false);
  await act(async () => tree.root.findByType('Screen' as React.ElementType).props.onBack());
  expect(mockRouter.replace).toHaveBeenCalledWith('/profil');
});

// Step 11a (2026-09-24): unblocking happens on the list, asked once, through the same revisioned, idempotent command.
it('"Odblokiraj" asks first; only the confirm sends one unblock of the shown revision, then the same page is read again', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }], null)).mockResolvedValue(ok([]));
  mockSetBlock.mockResolvedValue(receipt(B, 5));
  await render();
  await askUnblock('Marko');
  expect(mockSetBlock).not.toHaveBeenCalled();
  expect(text()).toContain('Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije.');
  const confirm = confirmButton();
  await act(async () => { confirm.props.onPress(); confirm.props.onPress(); });
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
  expect(mockSetBlock.mock.calls[0][0]).toMatchObject({ targetAccountId: B, blocked: false, expectedRevision: 4 });
  expect(typeof mockSetBlock.mock.calls[0][0].clientRequestId).toBe('string');
  expect(mockList).toHaveBeenLastCalledWith(null);
  expect(text()).toContain('Blokiranje je uklonjeno: Marko.');
  expect(people()).toHaveLength(0);
});

it('a refused or unknown unblock locks every "Odblokiraj" until the list is read again, and a retry reuses the request id', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko', revision: 4 }, { targetAccountId: C, displayName: 'Ana', revision: 2 }]));
  mockSetBlock.mockResolvedValueOnce({ ok: false, kod: 'BLOCK_OUTCOME_UNKNOWN', poruka: 'Ishod nije potvrđen. Proveri listu.' });
  await render();
  await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Ishod nije potvrđen. Proveri listu.');
  expect(people().every(node => node.props.action.disabled === true)).toBe(true);
  expect(text()).not.toContain('Blokiranje je uklonjeno');
  await act(async () => action('Proveri listu').onPress());
  expect(people().every(node => node.props.action.disabled === false)).toBe(true);
  mockSetBlock.mockResolvedValueOnce(receipt(B, 5));
  await askUnblock('Marko'); await act(async () => confirmButton().props.onPress());
  expect(mockSetBlock).toHaveBeenCalledTimes(2);
  expect(mockSetBlock.mock.calls[1][0].clientRequestId).toBe(mockSetBlock.mock.calls[0][0].clientRequestId);
});

it('while one unblock runs, its own action spins and the others wait', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko' }, { targetAccountId: C, displayName: 'Ana' }]));
  let answer!: (value: unknown) => void; mockSetBlock.mockReturnValueOnce(new Promise(resolve => { answer = resolve; }));
  await render();
  await askUnblock('Marko'); await act(async () => { confirmButton().props.onPress(); });
  expect(person('Marko').props.action.loading).toBe(true);
  expect(person('Ana').props.action.loading).toBe(false); expect(person('Ana').props.action.disabled).toBe(true);
  await act(async () => { answer(receipt(B, 2)); });
  expect(mockSetBlock).toHaveBeenCalledTimes(1);
});

it('a question left open is retired when the list is read again, so a late confirm sends nothing', async () => {
  mockList.mockResolvedValueOnce(ok([{ targetAccountId: B, displayName: 'Marko' }], C)).mockResolvedValue(ok([{ targetAccountId: C, displayName: 'Ana' }]));
  await render();
  await askUnblock('Marko');
  const late = confirmButton().props.onPress;
  await act(async () => action('Sledeći korisnici').onPress());
  expect(confirmButton()).toBeUndefined();
  await act(async () => { late(); });
  expect(mockSetBlock).not.toHaveBeenCalled();
});
