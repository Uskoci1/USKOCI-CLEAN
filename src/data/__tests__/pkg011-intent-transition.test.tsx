import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockReduced = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    return key === 'View' ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('phosphor-react-native', () => ({ ArrowsLeftRight: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { IntentTransition } from '../../ui/system/IntentTransition';

let tree: ReactTestRenderer;
const confirm = jest.fn(), cancel = jest.fn();
const press = (label: string) => tree.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === label)!;
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async (request: any, current: 'narucilac' | 'uskocer' = 'uskocer') => act(async () => {
  tree = create(<IntentTransition request={request} current={current} onConfirm={confirm} onCancel={cancel} />);
});
beforeEach(() => { confirm.mockClear(); cancel.mockClear(); mockReduced = false; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('no request renders nothing at all', async () => { await render(null); expect(tree.toJSON()).toBeNull(); });

test('states where the user is, where the action leads and why; confirm and stay are the only two actions', async () => {
  await render({ target: 'narucilac', reason: 'Novi Zadatak praviš kao naručilac.', confirmLabel: 'Pređi i napravi Zadatak' });
  const copy = text();
  expect(copy).toContain('Prelaziš u MENI TREBA'); expect(copy).toContain('Novi Zadatak praviš kao naručilac.'); expect(copy).toContain('Sada ste u JA MOGU');
  expect(tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel)).toEqual(['Pređi i napravi Zadatak', 'Ostani u JA MOGU']);
  await act(async () => press('Pređi i napravi Zadatak').props.onPress()); expect(confirm).toHaveBeenCalledTimes(1); expect(cancel).not.toHaveBeenCalled();
  await act(async () => press('Ostani u JA MOGU').props.onPress()); expect(cancel).toHaveBeenCalledTimes(1);
});

test('hardware back cancels; reduced motion removes the slide', async () => {
  await render({ target: 'uskocer', reason: 'r', confirmLabel: 'Pređi i otvori' }, 'narucilac');
  const modal = tree.root.findByType('Modal' as React.ElementType);
  expect(modal.props.animationType).toBe('slide'); expect(modal.props.transparent).toBe(true);
  await act(async () => modal.props.onRequestClose()); expect(cancel).toHaveBeenCalledTimes(1); expect(confirm).not.toHaveBeenCalled();
  await act(async () => tree.unmount()); mockReduced = true;
  await render({ target: 'uskocer', reason: 'r', confirmLabel: 'Pređi i otvori' }, 'narucilac');
  expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
  expect(text()).toContain('Ostani u MENI TREBA');
});
