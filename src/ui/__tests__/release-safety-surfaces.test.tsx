import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// Two release surfaces of 2026-09-23: the screen shown instead of a white page when a route throws while
// rendering, and the one success mark that confirms a finished thing (a saved rating, a published Zadatak).
const mockReplace = jest.fn();
const mockHaptic = jest.fn(() => Promise.resolve());
jest.mock('expo-router', () => ({ router: { replace: (...args: unknown[]) => mockReplace(...args) } }));
jest.mock('expo-haptics', () => ({ notificationAsync: () => mockHaptic(), NotificationFeedbackType: { Success: 'success' } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ Check: 'Check', Star: 'Star' }));
jest.mock('../entry/BrandAssets', () => ({ BrandMark: 'BrandMark' }));
jest.mock('../Text', () => ({ T: 'T' }));
jest.mock('../v2/V2Action', () => ({ V2Action: 'Action' }));
import { AppErrorBoundary } from '../system/AppErrorBoundary';
import { SuccessMark } from '../system/SuccessMark';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as never).map(node => [node.props.children].flat().join(''));
const action = (label: string) => tree.root.findByProps({ label });
beforeEach(() => { mockReplace.mockReset(); mockHaptic.mockClear(); jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('a screen that throws while rendering says it did not open and offers retry and the start, never the raw error', async () => {
  const retry = jest.fn(() => Promise.resolve());
  await act(async () => { tree = create(<AppErrorBoundary error={new Error('secret stack detail')} retry={retry} />); });
  expect(texts()).toEqual(['Ovaj ekran se nije otvorio', 'Pokušaj ponovo. Ako se ponovi, vrati se na početak aplikacije.']);
  expect(JSON.stringify(tree.toJSON())).not.toContain('secret stack detail');
  await act(async () => action('Pokušaj ponovo').props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
  await act(async () => action('Na početak').props.onPress());
  expect(mockReplace).toHaveBeenCalledWith('/');
  expect(retry).toHaveBeenCalledTimes(2);
});

test('the success mark buzzes once only when the thing has just happened; a reopened receipt is still', async () => {
  await act(async () => { tree = create(<SuccessMark />); });
  expect(mockHaptic).not.toHaveBeenCalled();
  expect(tree.root.findAllByType('Check' as never)).toHaveLength(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<SuccessMark fresh tone="orange">{React.createElement('Star')}</SuccessMark>); });
  expect(mockHaptic).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType('Star' as never)).toHaveLength(1);
  expect(tree.root.findAllByType('Check' as never)).toHaveLength(0);
});
