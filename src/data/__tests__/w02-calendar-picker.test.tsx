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
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', CalendarBlank: 'Icon' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button' }));
import { CivilField } from '../../ui/calendar/CalendarControls';

let tree: ReactTestRenderer;
const picker = () => tree.root.findByType('DateTimePicker' as React.ElementType);
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('SDK57 native civil-field adapter', () => {
  it('preserves the Android Material UTC civil date even west of UTC', async () => {
    const onChange = jest.fn();
    await act(async () => { tree = create(<CivilField label="Datum" mode="date" value="2026-09-11" onChange={onChange} />); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datum' }).props.onPress());
    expect(picker().props.value.toISOString()).toBe('2026-09-11T12:00:00.000Z');
    const selected = new Date('2026-09-12T00:00:00Z');
    // Material returns UTC midnight; in a western device zone getDate is the prior day.
    selected.getDate = () => 11;
    await act(async () => picker().props.onValueChange({}, selected));
    expect(onChange).toHaveBeenCalledWith('2026-09-12');
    expect(tree.root.findAllByType('DateTimePicker' as React.ElementType)).toHaveLength(0);
  });
  it('cancel does not silently accept the picker seed', async () => {
    const onChange = jest.fn();
    await act(async () => { tree = create(<CivilField label="Vreme" mode="time" value="" onChange={onChange} />); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Vreme' }).props.onPress());
    await act(async () => picker().props.onDismiss());
    expect(onChange).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('DateTimePicker' as React.ElementType)).toHaveLength(0);
  });
  it('reads native time picker local hours independently of its instant date', async () => {
    const onChange = jest.fn();
    await act(async () => { tree = create(<CivilField label="Vreme" mode="time" value="09:00" onChange={onChange} />); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Vreme' }).props.onPress());
    const selected = new Date('2026-09-12T00:00:00Z'); selected.getHours = () => 17; selected.getMinutes = () => 45;
    await act(async () => picker().props.onValueChange({}, selected));
    expect(onChange).toHaveBeenCalledWith('17:45');
  });
});
