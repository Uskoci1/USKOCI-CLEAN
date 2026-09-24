import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The internal step-11a board (2026-09-24) is how these screens are checked on the emulator. Every scene has to open
// from its visible name and come back with "Nazad", and none may read or write anything.
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
const mockData = jest.fn();
const mockCall = (...args: unknown[]) => mockData(...args);
jest.mock('expo-router', () => ({ get router() { return mockRouter; } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../notificationPreferencesClientService', () => ({ notificationPreferencesClientService: { read: (...a: unknown[]) => mockCall(...a), save: (...a: unknown[]) => mockCall(...a) } }));
jest.mock('../nativePushDevice', () => ({ nativePushDevice: (...a: unknown[]) => mockCall(...a) }));
jest.mock('../pushDeviceClientService', () => ({ pushDeviceClientService: { read: (...a: unknown[]) => mockCall(...a), set: (...a: unknown[]) => mockCall(...a) } }));
jest.mock('../pushReadinessClientService', () => ({ pushReadinessClientService: { read: (...a: unknown[]) => mockCall(...a) } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import Gallery from '../../app/dizajn-obavestenja';

let tree: ReactTestRenderer;
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const press = (label: string) => presses().find(node => node.props.accessibilityLabel === label);
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { await act(async () => tree?.unmount()); });

it('opens every scene from its visible name, draws it, and comes back with "Nazad" without touching data', async () => {
  await act(async () => { tree = create(<Gallery />); });
  const labels = presses().map(node => node.props.accessibilityLabel as string).filter(label => label.includes(' · '));
  expect(labels.length).toBeGreaterThanOrEqual(25);
  for (const label of labels) {
    await act(async () => press(label)!.props.onPress());
    expect(press(label)).toBeUndefined();
    expect(text()).toContain(label);
    await act(async () => press('Nazad na scene')!.props.onPress());
    expect(press(label)).toBeDefined();
  }
  expect(mockData).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
});
