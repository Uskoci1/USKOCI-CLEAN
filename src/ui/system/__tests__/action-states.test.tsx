import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { ACTION_MIN_HEIGHT, ACTION_SUCCESS_MS, V2Action } from '../../v2/V2Action';
import { brandAction, sys } from '../tokens';

/**
 * The one action (master design plan, 2026-09-24): a person always sees whether a button can be pressed, is working,
 * went through or did not — and a disabled button still says what it would do.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.useRealTimers(); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const update = async (element: React.ReactElement) => { await act(async () => tree.update(element)); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
/** The Press as the action asked for it, and the native view it draws. */
const press = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityRole === 'button')[0];
const surface = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'button')[0];
const label = (text: string) => tree.root.findAllByType(Text).find(node => node.props.children === text)!;
const checks = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'action-confirmed');
const noop = () => {};

it('is never under 48 px, and the primary is 54 as the brand action', async () => {
  for (const kind of ['secondary', 'quiet', 'destructive'] as const) {
    await render(<V2Action label="Sačuvaj" kind={kind} onPress={noop} />);
    expect(flat(surface()).minHeight).toBe(ACTION_MIN_HEIGHT);
    expect(ACTION_MIN_HEIGHT).toBeGreaterThanOrEqual(48);
  }
  await render(<V2Action label="Sačuvaj" kind="primary" onPress={noop} />);
  expect(flat(surface()).minHeight).toBe(54);
  await render(<V2Action label="Sačuvaj" style={brandAction} onPress={noop} />);
  expect(flat(surface()).minHeight).toBe(54);
});

it('keeps a readable label when disabled: muted ink on the quiet wash, never a faded ghost', async () => {
  await render(<V2Action label="Sačuvaj područje rada" style={brandAction} disabled onPress={noop} />);
  expect(press().props.accessibilityState).toEqual({ disabled: true });
  expect(press().props.disabled).toBe(true);
  expect(flat(surface())).toMatchObject({ backgroundColor: sys.color.wash });
  expect(flat(surface()).opacity ?? 1).toBe(1);
  expect(flat(label('Sačuvaj područje rada')).color).toBe(sys.color.muted);
  // A quiet action stays text; only its ink changes.
  await render(<V2Action label="Otkaži" kind="quiet" disabled onPress={noop} />);
  expect(flat(surface()).backgroundColor).toBe('transparent');
  expect(flat(label('Otkaži')).color).toBe(sys.color.muted);
});

it('keeps its colour and its words while loading, shows a spinner, cannot be pressed twice and is spoken as busy', async () => {
  await render(<V2Action label="Sačuvaj područje rada" style={brandAction} loading onPress={noop} />);
  expect(press().props.accessibilityState).toEqual({ disabled: true, busy: true });
  expect(press().props.disabled).toBe(true);
  expect(flat(surface()).backgroundColor).toBe(sys.color.green);
  expect(flat(label('Sačuvaj područje rada')).color).toBe(sys.color.onGreen);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
  await update(<V2Action label="Sačuvaj područje rada" style={brandAction} onPress={noop} />);
  expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(press().props.accessibilityState).toEqual({ disabled: false });
});

it('shows the check for 1.2 s only when the caller says the write is confirmed', async () => {
  jest.useFakeTimers();
  await render(<V2Action label="Sačuvaj" style={brandAction} onPress={noop} />);
  expect(checks()).toHaveLength(0);
  await update(<V2Action label="Sačuvaj" style={brandAction} success onPress={noop} />);
  expect(checks()).toHaveLength(1);
  expect(label('Sačuvaj')).toBeDefined();
  await act(async () => { jest.advanceTimersByTime(ACTION_SUCCESS_MS - 1); });
  expect(checks()).toHaveLength(1);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(checks()).toHaveLength(0);
  // A caller that keeps saying "saved" does not keep the check: it was news once.
  await update(<V2Action label="Sačuvaj" style={brandAction} success onPress={noop} />);
  expect(checks()).toHaveLength(0);
  expect(ACTION_SUCCESS_MS).toBe(1200);
});

it('settles the check in with a short scale, and simply shows it under reduced motion', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  await render(<V2Action label="Sačuvaj" success onPress={noop} />);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 180, useNativeDriver: true }));
  await act(async () => tree.unmount());
  timing.mockClear(); mockReduced = true;
  await render(<V2Action label="Sačuvaj" success onPress={noop} />);
  expect(checks()).toHaveLength(1);
  expect(timing).not.toHaveBeenCalled();
});

it('draws a danger outline and the caller\'s message right under the button, announced as an alert', async () => {
  await render(<V2Action label="Podeli lokaciju" onPress={noop} />);
  expect(tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert')).toHaveLength(0);
  await update(<V2Action label="Podeli lokaciju" error="Lokacija nije podeljena. Pokušaj ponovo." onPress={noop} />);
  expect(flat(surface())).toMatchObject({ borderWidth: 2, borderColor: sys.color.danger });
  const alert = tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === 'alert')[0];
  expect(alert.props.children).toBe('Lokacija nije podeljena. Pokušaj ponovo.');
  expect(flat(alert).color).toBe(sys.color.danger);
  // The button itself stays usable: an error is a reason to try again, not a lock.
  expect(press().props.accessibilityState).toEqual({ disabled: false });
});

it('writes the label white on the brand surface and green on every other action', async () => {
  await render(<V2Action label="Objavi" style={brandAction} onPress={noop} />);
  expect(flat(label('Objavi')).color).toBe(sys.color.onGreen);
  await render(<V2Action label="Pogledaj" onPress={noop} />);
  expect(flat(label('Pogledaj')).color).toBe(sys.color.green);
  await render(<V2Action label="Otkaži Dogovor" kind="destructive" onPress={noop} />);
  expect(flat(label('Otkaži Dogovor')).color).toBe(sys.color.danger);
});
