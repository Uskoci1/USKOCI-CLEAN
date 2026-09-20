import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Linking } from 'react-native';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? key : Reflect.get(target, key); } });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { PermissionRecovery } from '../../ui/system/PermissionRecovery';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('a denied permission states what still works and offers the phone settings plus the named alternative; it never re-requests on its own', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  const alternative = jest.fn();
  await act(async () => { tree = create(<PermissionRecovery message="Dozvoli pristup kameri u podešavanjima ili izaberi fotografiju iz galerije." alternative="Izaberi iz galerije" onAlternative={alternative} />); });
  expect(texts()).toContain('Dozvoli pristup kameri u podešavanjima ili izaberi fotografiju iz galerije.');
  expect(presses().map(node => node.props.accessibilityLabel)).toEqual(['Podešavanja telefona', 'Izaberi iz galerije']);
  await act(async () => byLabel('Podešavanja telefona').props.onPress()); expect(openSettings).toHaveBeenCalledTimes(1);
  await act(async () => byLabel('Izaberi iz galerije').props.onPress()); expect(alternative).toHaveBeenCalledTimes(1);
});
test('a settings failure is swallowed and the alternative is optional', async () => {
  jest.spyOn(Linking, 'openSettings').mockRejectedValue(new Error('no settings'));
  await act(async () => { tree = create(<PermissionRecovery message="Mikrofon nije dozvoljen." compact />); });
  expect(presses().map(node => node.props.accessibilityLabel)).toEqual(['Podešavanja telefona']);
  await act(async () => byLabel('Podešavanja telefona').props.onPress());
  expect(texts()).toContain('Mikrofon nije dozvoljen.');
});
