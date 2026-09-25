import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => mockWindow;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { DiscoverySearchBar } from '../../ui/v2/discovery/DiscoverySearchBar';
import { sys } from '../../ui/system/tokens';

const search = jest.fn(), conditions = jest.fn(), add = jest.fn(), clear = jest.fn(), chip = jest.fn(), nearby = jest.fn();
const layout = jest.fn(), chipsHeight = jest.fn();
const props = () => ({ where: 'Petrovaradin, Novi Sad', conditions: 'Sutra · Tražim ponude · Slobodna mesta', conditionCount: 3,
  chips: [{ key: 'offers', label: 'Tražim ponude', selected: true, onPress: chip }], chipsShown: true,
  nearby: { onPress: nearby, busy: false }, onSearch: search, onConditions: conditions, onNew: add, onClearWhere: clear,
  onLayout: layout, onChipsHeight: chipsHeight });
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<DiscoverySearchBar {...props()} />); });
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
beforeEach(() => {
  mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };
  jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test.each([{ width: 320, fontScale: 1 }, { width: 320, fontScale: 2 }, { width: 390, fontScale: 1.2999999523 }])(
  'the search owns the full row at %o, with complete spoken values and independent persistent tools', async size => {
    mockWindow = { ...mockWindow, ...size }; await render();
    const row = tree.root.findByProps({ testID: 'discovery-search-row' });
    const tools = tree.root.findByProps({ testID: 'discovery-search-tools' });
    const summary = button('Pretraži zadatke');
    expect(row.findByProps({ accessibilityLabel: 'Pretraži zadatke' })).toBe(summary);
    expect(row.findAllByProps({ accessibilityLabel: 'Dodaj zadatak' })).toHaveLength(0);
    expect(tools.findByProps({ accessibilityLabel: 'Dodaj zadatak' })).toBeTruthy();
    expect(summary.props.accessibilityValue.text).toBe(`${props().where}, ${props().conditions}`);
    expect(summary.findAllByType('T' as React.ElementType).map(text => text.props.numberOfLines)).toEqual([1, 1]);
    expect(summary.findAllByType('T' as React.ElementType).every(text => text.props.allowFontScaling !== false && !text.props.adjustsFontSizeToFit)).toBe(true);
    for (const label of ['Dodaj zadatak', 'Uslovi pretrage, 3 aktivna']) {
      expect(StyleSheet.flatten(button(label).props.style)).toMatchObject({ width: 48, height: 48 });
    }
    await act(async () => tree.update(<DiscoverySearchBar {...props()} chipsShown={false} />));
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Brzi filteri' })).toHaveLength(0);
    expect(button('Dodaj zadatak')).toBeTruthy(); expect(button('Uslovi pretrage, 3 aktivna')).toBeTruthy();
  });

test('normal width retains the existing single row and changing geometry performs no action', async () => {
  await render();
  expect(tree.root.findAllByProps({ testID: 'discovery-search-tools' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'discovery-search-row' }).findByProps({ accessibilityLabel: 'Dodaj zadatak' })).toBeTruthy();
  mockWindow = { ...mockWindow, fontScale: 2 };
  await act(async () => tree.update(<DiscoverySearchBar {...props()} />));
  for (const callback of [search, conditions, add, clear, chip, nearby]) expect(callback).not.toHaveBeenCalled();
});

test('every search, filter, clear and Nearby action retains its own callback and truthful selected/busy state', async () => {
  mockWindow = { ...mockWindow, width: 320, fontScale: 2 }; await render();
  for (const [label, callback] of [['Pretraži zadatke', search], ['Uslovi pretrage, 3 aktivna', conditions],
    ['Dodaj zadatak', add], ['Prikaži sve zadatke', clear], ['Tražim ponude', chip], ['U blizini', nearby]] as const) {
    await act(async () => button(label).props.onPress()); expect(callback).toHaveBeenCalledTimes(1);
  }
  expect(button('Tražim ponude').props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(button('Tražim ponude').props.style).minHeight).toBeGreaterThanOrEqual(48);
  expect(StyleSheet.flatten(button('Prikaži sve zadatke').props.style)).toMatchObject({ width: 48, minHeight: 48 });
  await act(async () => tree.update(<DiscoverySearchBar {...props()} nearby={{ onPress: nearby, busy: true }} />));
  expect(button('U blizini').props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, busy: true } });
  expect(tree.root.findByProps({ testID: 'conditions-badge' }).findByType('T' as React.ElementType).props.children).toBe(3);
});

test('fold measurement reclaims only the rail height above the persistent tools at large text', async () => {
  mockWindow = { ...mockWindow, width: 320, fontScale: 2 }; await render();
  await act(async () => button('Brzi filteri').props.onLayout({ nativeEvent: { layout: { height: 64 } } }));
  expect(chipsHeight).toHaveBeenLastCalledWith(16);
  const bar = tree.root.findByProps({ testID: 'discovery-search-row' }).parent!;
  await act(async () => bar.props.onLayout({ nativeEvent: { layout: { y: 12, height: 150 } } }));
  expect(layout).toHaveBeenLastCalledWith(162);
  mockWindow = { ...mockWindow, width: 390, fontScale: 1 };
  await act(async () => tree.update(<DiscoverySearchBar {...props()} />));
  await act(async () => button('Brzi filteri').props.onLayout({ nativeEvent: { layout: { height: 64 } } }));
  expect(chipsHeight).toHaveBeenLastCalledWith(64 + sys.space.sm);
});
