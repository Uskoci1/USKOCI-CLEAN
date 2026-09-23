import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The blocked list's good case — nobody blocked — used to be a bare sentence with nothing to do
// (owner rule, 2026-09-23: an empty state has a sentence and one action). It now says how a block
// happens, since this screen cannot start one, and offers the one thing it can: a re-check.
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002', C = '10000000-0000-4000-8000-000000000003';
const mockSession = { user: { id: A }, accountRevision: 1 };
const mockList = jest.fn(), mockRouter = { back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../safetyClientService', () => ({ safetyClientService: { listMyBlocks: (...args: unknown[]) => mockList(...args) } }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]) }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsGroup: 'Group', SettingsRow: 'Row', SettingsAction: 'Action' }));
import Route from '../../app/(app)/profil/blokirani';

const ok = (items: { targetAccountId: string; displayName: string | null }[], nextCursor: string | null = null) =>
  ({ ok: true, podatak: { accountId: A, authoritative: true, items: items.map(item => ({ ...item, accountId: A, blocked: true, revision: 1 })), nextCursor } });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const action = (label: string) => tree.root.findByProps({ label }).props;
const actions = (label: string) => tree.root.findAllByProps({ label });
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
});

it('names each blocked person or says honestly that the name is unknown, and opens them in safety', async () => {
  mockList.mockResolvedValue(ok([{ targetAccountId: B, displayName: 'Marko' }, { targetAccountId: C, displayName: null }]));
  await render();
  expect(text()).not.toContain('Još nema blokiranih');
  expect(actions('Proveri ponovo')).toHaveLength(0);
  const rows = tree.root.findAllByType('Row' as React.ElementType).map(node => node.props.label);
  expect(rows).toEqual(['Marko', 'USKOČI korisnik']);
  await act(async () => tree.root.findByProps({ label: 'Marko' }).props.onPress());
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
