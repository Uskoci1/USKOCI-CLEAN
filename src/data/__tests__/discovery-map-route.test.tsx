import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockNavigate = jest.fn(), mockSetIntent = jest.fn();
let mockScope = 'account-a:1:narucilac';
let mockFocus: () => (() => void), mockBlur: () => void;
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
  useFocusEffect(callback: () => (() => void)) {
    require('react').useEffect(() => {
      mockFocus = callback; mockBlur = callback();
      return () => mockBlur();
    }, [callback]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../hooks/useDiscoveryBrowse', () => ({ useDiscoveryBrowse: () => ({
  scope: mockScope, items: [], initialized: true, nextCursor: null, refreshing: false, loadingMore: false, error: null,
  refresh: jest.fn(), loadMore: jest.fn(),
}) }));
jest.mock('../../store/uloga', () => ({ useUloga: () => 'narucilac', postaviUlogu: (value: string) => mockSetIntent(value) }));
jest.mock('../../ui/WorkspaceHeader', () => ({ WorkspaceHeader: 'WorkspaceHeader' }));
jest.mock('../../ui/discovery/DiscoveryBody', () => ({ DiscoveryBody: 'DiscoveryBody' }));
import Prilike from '../../app/(app)/prilike';

let tree: ReactTestRenderer;
const body = () => tree.root.findByType('DiscoveryBody' as any).props;
beforeEach(async () => {
  jest.clearAllMocks(); mockScope = 'account-a:1:narucilac';
  await act(async () => { tree = create(<Prilike />); });
});
afterEach(async () => { await act(async () => tree.unmount()); });

it.each(['onOpen', 'onOwn', 'onNew'])('actual route invalidates camera work synchronously before %s dispatch', async action => {
  const scope = body().cameraScope, before = scope.capture();
  expect(scope.owns(before)).toBe(true);
  mockNavigate.mockImplementation(() => {
    expect(scope.capture()).toBeNull();
    expect(scope.owns(before)).toBe(false);
  });
  await act(async () => body()[action]('public-need-id'));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  if (action === 'onOpen') expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/prilike/[id]', params: { id: 'public-need-id' } });
  if (action === 'onOwn') expect(mockNavigate).toHaveBeenCalledWith('/potrebe');
  if (action === 'onNew') {
    expect(mockSetIntent).toHaveBeenCalledWith('narucilac'); expect(mockNavigate).toHaveBeenCalledWith('/nova');
  }
});

it('actual focus cleanup and Back retain the same scope object but never revive the prior epoch', async () => {
  const scope = body().cameraScope, before = scope.capture();
  await act(async () => mockBlur());
  expect(scope.owns(before)).toBe(false);
  await act(async () => { mockBlur = mockFocus(); });
  expect(body().cameraScope).toBe(scope);
  expect(scope.owns(before)).toBe(false);
  expect(scope.owns(scope.capture())).toBe(true);
});

it('account/intent revision replacement disposes the old camera scope, including A to B to A', async () => {
  const first = body().cameraScope, epoch = first.capture();
  mockScope = 'account-b:2:narucilac';
  await act(async () => tree.update(<Prilike />));
  expect(first.owns(epoch)).toBe(false);
  const second = body().cameraScope;
  expect(second).not.toBe(first); expect(second.owns(second.capture())).toBe(true);
  mockScope = 'account-a:3:narucilac';
  await act(async () => tree.update(<Prilike />));
  expect(first.owns(epoch)).toBe(false);
  expect(second.capture()).toBeNull(); expect(body().cameraScope).not.toBe(first);
});
