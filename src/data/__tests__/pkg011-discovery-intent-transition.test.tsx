import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const mockPublic = jest.fn(), mockNavigate = jest.fn(), mockReplace = jest.fn(), mockSwitch = jest.fn();
let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockIntent: 'narucilac' | 'uskocer' = 'uskocer', mockFocused = true;
const mockSource = { otvorenePrilike: (...args: unknown[]) => mockPublic(...args), mojePotrebe: async () => [], mojePrijave: async () => [] };
const mockApp = { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
jest.mock('expo-router', () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args), replace: (...args: unknown[]) => mockReplace(...args) },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return key === 'AppState' ? mockApp : Reflect.get(target, key); } }); });
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent, postaviUlogu: (...args: unknown[]) => mockSwitch(...args) }));
jest.mock('../../ui/v2/MarketplacePresentation', () => ({ MarketplacePresentation: 'Marketplace' }));
import Public from '../../app/(app)/zadaci';

let tree: ReactTestRenderer;
const market = () => tree.root.findByType('Marketplace' as React.ElementType).props;
const render = async () => act(async () => { tree = create(<Public />); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); mockIntent = 'uskocer'; mockFocused = true; mockApp.currentState = 'active';
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockPublic.mockReset().mockResolvedValue([{ id: 'public' }]);
  mockNavigate.mockReset(); mockReplace.mockReset(); mockSwitch.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

// Owner decision 1 (2026-09-19) supersedes the sheet that asked a worker before "+" or "Moji" could
// switch the app into the requester mode. One account does all three things from here, directly.
test.each(['narucilac', 'uskocer'] as const)('"+" opens a new task directly and touches no mode, whatever the app last was (%s)', async last => {
  mockIntent = last; await render(); await act(async () => market().onNew());
  expect(mockNavigate).toHaveBeenCalledWith('/nova'); expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled(); expect(mockSwitch).not.toHaveBeenCalled();
});
test.each(['narucilac', 'uskocer'] as const)('"Moji" opens my own tasks directly and touches no mode (%s)', async last => {
  mockIntent = last; await render(); await act(async () => market().onSwitch());
  expect(mockNavigate).toHaveBeenCalledWith('/potrebe'); expect(mockReplace).not.toHaveBeenCalled(); expect(mockSwitch).not.toHaveBeenCalled();
});
test('no sheet is ever mounted, so there is nothing to confirm after the account or the focus changes', async () => {
  await render(); expect(tree.root.findAllByType('Transition' as React.ElementType)).toHaveLength(0);
  const retained = market().onNew; mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  await act(async () => tree.update(<Public />)); await act(async () => retained());
  expect(mockNavigate).not.toHaveBeenCalled(); expect(mockSwitch).not.toHaveBeenCalled();
});
