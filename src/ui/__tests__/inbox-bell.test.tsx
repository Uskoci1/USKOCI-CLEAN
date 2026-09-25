import React from 'react';
import { Animated } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The bell on the three root screens (step 11a, 2026-09-24): its count sits in a fixed 20 px capsule, so the digits
// must not grow with the system text size (the spoken label carries the number), and a count above 99 is "99+".
let mockState: { error: string | null; page: { unreadCount: number } | null } = { error: null, page: null };
let mockReduced = true;
jest.mock('../../hooks/useInbox', () => ({ useInbox: () => ({ state: mockState }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../Press', () => ({ Press: 'Press' }));
jest.mock('../Text', () => ({ T: 'T' }));
import { InboxBell } from '../InboxBell';
import { ChromeIconButton } from '../system/ScreenChrome';

let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<InboxBell />); }); };
const badge = () => tree.root.findAllByType('T' as React.ElementType);
const spoken = () => tree.root.findByType('Press' as React.ElementType).props.accessibilityLabel as string;
const rotation = () => tree.root.findByType(ChromeIconButton).props.glyphStyle.transform[0].rotate.__getValue() as string;
const update = async () => { await act(async () => { tree.update(<InboxBell />); }); };

beforeEach(() => { mockReduced = true; });
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });

it('draws the count with digits that keep their size and line up', async () => {
  mockState = { error: null, page: { unreadCount: 7 } }; await render();
  const [text] = badge();
  expect(text.props.children).toBe(7);
  expect(text.props.maxFontSizeMultiplier).toBe(1);
  expect(text.props.style).toMatchObject({ fontVariant: ['tabular-nums'] });
  expect(spoken()).toBe('Obaveštenja, 7 nepročitanih');
});

it('caps the drawn count at "99+" while the label says the real number', async () => {
  mockState = { error: null, page: { unreadCount: 142 } }; await render();
  expect(badge()[0].props.children).toBe('99+');
  expect(spoken()).toBe('Obaveštenja, 142 nepročitana');
});

it.each([
  ['nothing unread', { error: null, page: { unreadCount: 0 } }, 'Obaveštenja, 0 nepročitanih'],
  ['a count that could not be read', { error: 'load', page: { unreadCount: 3 } }, 'Obaveštenja, broj nepročitanih nije dostupan'],
  ['no page yet', { error: null, page: null }, 'Obaveštenja, broj nepročitanih nije dostupan'],
])('draws no badge for %s', async (_case, state, label) => {
  mockState = state; await render();
  expect(badge()).toHaveLength(0);
  expect(spoken()).toBe(label);
});

it.each(['reduced motion', 'a lower count', 'an unavailable count'] as const)(
  'returns the visible bell to neutral when %s interrupts a swing', async interruption => {
    mockReduced = false;
    const stop = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockImplementation(value => ({
      // Hold the native animation at its first visible swing, before completion can restore it.
      start: () => { (value as Animated.Value).setValue(0.22); }, stop, reset: jest.fn(),
    }));
    mockState = { error: null, page: { unreadCount: 1 } }; await render();
    expect(timing).not.toHaveBeenCalled();
    expect(rotation()).toBe('0deg');
    mockState = { error: null, page: { unreadCount: 2 } }; await update();
    expect(rotation()).toBe('-12deg');
    if (interruption === 'reduced motion') mockReduced = true;
    else mockState = interruption === 'a lower count' ? { error: null, page: { unreadCount: 1 } } : { error: 'load', page: null };
    await update();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(rotation()).toBe('0deg');
    expect(timing).toHaveBeenCalledTimes(1);
  },
);
