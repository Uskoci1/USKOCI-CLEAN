import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockPublic = jest.fn(), mockNavigate = jest.fn(), mockReplace = jest.fn(), mockSwitch = jest.fn();
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent: 'narucilac' | 'uskocer' = 'uskocer', mockFocused = true;
const mockSource = { otvorenePrilike: (...args: unknown[]) => mockPublic(...args) };
const mockApp = { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args), replace: (...args: unknown[]) => mockReplace(...args) },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); } }); });
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: (...args: unknown[]) => mockSwitch(...args) }));
jest.mock('../../ui/v2/MarketplacePresentation', () => ({ MarketplacePresentation: 'Marketplace' }));
jest.mock('../../ui/system/IntentTransition', () => ({ IntentTransition: 'Transition' }));
import Public from '../../app/(app)/prilike';

let tree: ReactTestRenderer;
const market = () => tree.root.findByType('Marketplace' as React.ElementType).props;
const sheet = () => tree.root.findByType('Transition' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Public />); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); mockIntent = 'uskocer'; mockFocused = true; mockApp.currentState = 'active';
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockPublic.mockReset().mockResolvedValue([{ id: 'public' }]);
  mockNavigate.mockReset(); mockReplace.mockReset(); mockSwitch.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('a worker pressing "+" is asked; only the confirm switches the intent and replaces the route, once', async () => {
  await render(); expect(sheet().request).toBeNull(); expect(sheet().current).toBe('uskocer');
  await act(async () => market().onNew());
  expect(mockSwitch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
  expect(sheet().request).toMatchObject({ target: 'narucilac', confirmLabel: 'Pređi i napravi Zadatak' });
  await act(async () => { sheet().onConfirm(); sheet().onConfirm(); });
  expect(mockSwitch.mock.calls).toEqual([['narucilac']]); expect(mockReplace.mock.calls).toEqual([['/nova']]); expect(sheet().request).toBeNull();
});
test('a worker pressing "Moji" is asked for the owned Tasks; staying changes nothing', async () => {
  await render(); await act(async () => market().onSwitch());
  expect(sheet().request).toMatchObject({ target: 'narucilac', confirmLabel: 'Pređi na moje Zadatke' });
  await act(async () => sheet().onCancel()); expect(sheet().request).toBeNull();
  expect(mockSwitch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled(); expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => market().onSwitch()); await act(async () => sheet().onConfirm());
  expect(mockSwitch.mock.calls).toEqual([['narucilac']]); expect(mockReplace.mock.calls).toEqual([['/potrebe']]);
});
test('a requester never sees the sheet: "+" and "Moji" navigate within MENI TREBA without touching the intent', async () => {
  mockIntent = 'narucilac'; await render(); expect(market().intent).toBe('narucilac');
  await act(async () => market().onNew()); expect(sheet().request).toBeNull(); expect(mockNavigate.mock.calls).toEqual([['/nova']]);
  await act(async () => tree.unmount()); await render();
  await act(async () => market().onSwitch()); expect(mockNavigate).toHaveBeenLastCalledWith('/potrebe'); expect(mockSwitch).not.toHaveBeenCalled();
});
test('a pending sheet cannot switch after the account or focus changed underneath it', async () => {
  await render(); await act(async () => market().onNew()); const old = sheet();
  mockFocused = false; await act(async () => tree.update(<Public />));
  await act(async () => old.onConfirm());
  expect(mockSwitch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
