import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'android' };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));
import { CivilField } from '../CalendarControls';

/**
 * Round 6 on the emulator (b4531ef4, "Tačan termin" and Izmene step 1): all four fields wore the calendar, so a 2×2 grid
 * of two dates and two times read as four date pickers. Each fact its own picture: the time field wears the clock.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
/** FactArt is memoised, so its drawing is found by what it was asked to draw. */
const art = () => tree.root.findAll(node => typeof node.type !== 'string' && typeof node.props.kind === 'string' && node.props.size === 22);

it.each([['time', 'clock'], ['date', 'calendar']] as const)('a %s field wears the %s', async (mode, kind) => {
  await act(async () => { tree = create(<CivilField label="Polje" mode={mode} value="" onChange={jest.fn()} />); });
  expect(art().map(node => node.props.kind)).toEqual([kind]);
});
