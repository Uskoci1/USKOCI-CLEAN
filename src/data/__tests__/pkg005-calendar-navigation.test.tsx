import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return ({ data, ListEmptyComponent, ...props }: any) => React.createElement('List', props, data.length ? null : ListEmptyComponent);
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ CalendarBlank: 'Icon', Check: 'Icon', User: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/AgreementPresentation', () => ({ AgreementHero: 'AgreementHero' }));

import { AgreementCollectionPresentation } from '../../ui/v2/AgreementCollectionPresentation';

let tree: ReactTestRenderer | undefined;
const calendar = jest.fn();
async function render(requester: boolean) {
  await act(async () => { tree = create(<AgreementCollectionPresentation items={[]} loading={false} error={false}
    requester={requester} section="active" confirmationOnly={false} onSection={() => {}} onConfirmationOnly={() => {}}
    onRefresh={() => {}} onOpen={() => {}} onCalendar={calendar} onProfile={() => {}} onTasks={() => {}} />); });
}

afterEach(async () => { if (tree) await act(async () => tree?.unmount()); tree = undefined; calendar.mockClear(); });

describe('PKG-005 Worker-only calendar navigation', () => {
  it('does not present the Worker calendar as a requester Dogovori action', async () => {
    await render(true);
    expect(tree!.root.findAllByProps({ accessibilityLabel: 'Radni raspored (JA MOGU)' })).toHaveLength(0);
  });

  it('offers the Worker calendar from Dogovori only in JA MOGU and uses the existing callback', async () => {
    await render(false);
    const button = tree!.root.findByProps({ accessibilityLabel: 'Radni raspored (JA MOGU)' });
    await act(async () => button.props.onPress());
    expect(calendar).toHaveBeenCalledTimes(1);
  });
});
