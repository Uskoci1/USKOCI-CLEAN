import React, { useState } from 'react';
import { BackHandler, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import { ConfirmSheet, useConfirmSheet, type ConfirmRequest } from '../ConfirmSheet';
import { ActionSheet, orderActions, type SheetAction } from '../ActionSheet';
import { PeekSheet } from '../PeekSheet';
import { ProductSheet } from '../../product/ProductSheet';
import { sys } from '../tokens';
import { Press } from '../../Press';

let mockReduced = false;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), mockReact = require('react');
  return new Proxy(native, { get(target, key) {
    // The native Modal owns Back; the double keeps its one callback reachable.
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? mockReact.createElement('Modal', props, children) : null;
    return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => mockReduced }));

/**
 * The one sheet engine and the three sheets built on it. Confirmations used to be system alerts: they could not show
 * that a command was running, could not stop a second tap, and looked like another app. These tests pin what replaced
 * them — one confirm that runs once, a busy state with no way out while its command runs, every other ending routed to
 * the cancel path — and the engine rules every sheet shares: pinned actions, a guard for unsaved input, Back, and no
 * motion when the phone asks for none.
 */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const byTestId = (testID: string, root: ReactTestInstance = tree.root) => root.findByProps({ testID });
const texts = (root: ReactTestInstance = tree.root) => root.findAll(node => node.type === ('T' as unknown as React.ElementType))
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const sheet = () => tree.root.findByType(BottomSheet);
const modal = () => tree.root.findByType('Modal' as unknown as React.ElementType);
const press = async (instance: ReactTestInstance) => { await act(async () => { instance.props.onPress(); }); };
const deferred = () => { let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const flat = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean));
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; });

describe('ConfirmSheet', () => {
  const request = (patch: Partial<ConfirmRequest> = {}): ConfirmRequest => ({ title: 'Povući prijavu?',
    message: 'Prijava više neće biti aktivna.', confirmLabel: 'Povuci', ...patch });

  it('asks with a title, one sentence, one confirm and one quiet cancel', async () => {
    await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(texts()).toContain('Povući prijavu?'); expect(texts()).toContain('Prijava više neće biti aktivna.');
    expect(byTestId('confirm-sheet-confirm').props.accessibilityLabel).toBe('Povuci');
    expect(byTestId('confirm-sheet-cancel').props.accessibilityLabel).toBe('Odustani');
    // The only buttons are those two: the title row has no × of its own.
    expect(tree.root.findAllByType(Press).map(node => node.props.accessibilityLabel)).toEqual(['Povuci', 'Odustani']);
    expect(flat(byTestId('confirm-sheet-confirm').props.style).backgroundColor).toBe(sys.color.green);
    expect(flat(byTestId('confirm-sheet-cancel').props.style).backgroundColor).toBeUndefined();
    expect(flat(byTestId('confirm-sheet-cancel').props.style).minHeight).toBeGreaterThanOrEqual(48);
  });

  it('draws a destructive confirm in the danger colour', async () => {
    await render(<ConfirmSheet {...request({ tone: 'danger' })} onClosed={jest.fn()} />);
    expect(flat(byTestId('confirm-sheet-confirm').props.style).backgroundColor).toBe(sys.color.danger);
  });

  it('runs a confirm once, however often it is pressed, then closes without cancelling', async () => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    const confirm = byTestId('confirm-sheet-confirm').props.onPress, cancel = byTestId('confirm-sheet-cancel').props.onPress;
    await act(async () => { confirm(); confirm(); cancel(); });
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('stays busy and cannot be left while the command it started runs, and reports nothing itself', async () => {
    const command = deferred(), onCancel = jest.fn(), onClosed = jest.fn();
    const onConfirm = jest.fn(() => command.promise);
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    const confirm = byTestId('confirm-sheet-confirm');
    expect(confirm.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, busy: true } });
    expect(confirm.findAllByType('ActivityIndicator' as unknown as React.ElementType)).toHaveLength(1);
    expect(byTestId('confirm-sheet-cancel').props.disabled).toBe(true);
    // No way out while it runs: not the confirm again, not cancel, not Back, not a tap outside, not a drag.
    await press(confirm); await press(byTestId('confirm-sheet-cancel')); await act(async () => { modal().props.onRequestClose(); });
    const backdrop = sheet().props.backdropComponent({ animatedIndex: { value: 0 }, animatedPosition: { value: 0 }, style: {} });
    expect(backdrop.props.pressBehavior).toBe(0); expect(sheet().props.enablePanDownToClose).toBe(false);
    expect(onConfirm).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(onClosed).not.toHaveBeenCalled();
    const before = texts();
    await act(async () => { command.resolve(); await command.promise; });
    expect(onClosed).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled(); expect(texts()).toBe(before);
  });

  it('closes after a command that fails, leaving the failure to the screen that owns it', async () => {
    const command = deferred(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm: () => command.promise })} onClosed={onClosed} />);
    await press(byTestId('confirm-sheet-confirm'));
    await act(async () => { command.reject(new Error('server')); await command.promise.catch(() => undefined); });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('cancel runs the cancel path once, and a confirm pressed after it does nothing', async () => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    const confirm = byTestId('confirm-sheet-confirm').props.onPress;
    await press(byTestId('confirm-sheet-cancel')); await act(async () => { confirm(); });
    expect(onCancel).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it.each(['Back', 'a tap outside', 'a drag down'])('%s is a cancel', async route => {
    const onConfirm = jest.fn(), onCancel = jest.fn(), onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ onConfirm, onCancel })} onClosed={onClosed} />);
    await act(async () => {
      if (route === 'Back') modal().props.onRequestClose();
      else if (route === 'a drag down') sheet().props.onClose();
      else {
        const backdrop = sheet().props.backdropComponent({ animatedIndex: { value: 0 }, animatedPosition: { value: 0 }, style: {} });
        expect(backdrop.props.pressBehavior).toBe('close');
        sheet().props.onClose(); // What pressBehavior "close" does once the sheet has gone.
      }
    });
    expect(onCancel).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled(); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('a notice has one button and nothing to cancel', async () => {
    const onClosed = jest.fn();
    await render(<ConfirmSheet {...request({ title: 'Govorni unos i privatnost', confirmLabel: 'U redu', cancelLabel: null })} onClosed={onClosed} />);
    expect(tree.root.findAllByProps({ testID: 'confirm-sheet-cancel' })).toHaveLength(0);
    await press(byTestId('confirm-sheet-confirm')); expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('never moves when the phone asks for less motion', async () => {
    mockReduced = true; await render(<ConfirmSheet {...request()} onClosed={jest.fn()} />);
    expect(sheet().props).toMatchObject({ animateOnMount: false, animationConfigs: { duration: 0 } });
  });
});

describe('useConfirmSheet', () => {
  let api: ReturnType<typeof useConfirmSheet>;
  function Screen() { api = useConfirmSheet(); return <>{api.sheet}</>; }

  it('shows what was asked, retires it silently through the cancel path, and asks again', async () => {
    await render(<Screen />);
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    const first = { onConfirm: jest.fn(), onCancel: jest.fn() };
    await act(async () => { api.ask({ title: 'Prvo?', message: 'Jedna rečenica.', confirmLabel: 'Da', ...first }); });
    expect(tree.root.findByType(ConfirmSheet).props.title).toBe('Prvo?'); expect(api.open).toBe(true);
    await act(async () => { api.close(); });
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0); expect(first.onCancel).toHaveBeenCalledTimes(1);
    expect(first.onConfirm).not.toHaveBeenCalled();
    const second = { onConfirm: jest.fn(), onCancel: jest.fn() };
    await act(async () => { api.ask({ title: 'Drugo?', message: 'Jedna rečenica.', confirmLabel: 'Da', ...second }); });
    await press(byTestId('confirm-sheet-confirm'));
    expect(second.onConfirm).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('a new question replaces an open one, and the old one ends as a cancel', async () => {
    await render(<Screen />);
    const old = { onConfirm: jest.fn(), onCancel: jest.fn() };
    await act(async () => { api.ask({ title: 'Staro?', message: 'x', confirmLabel: 'Da', ...old }); });
    await act(async () => { api.ask({ title: 'Novo?', message: 'y', confirmLabel: 'Da' }); });
    expect(tree.root.findAllByType(ConfirmSheet).map(node => node.props.title)).toEqual(['Novo?']);
    expect(old.onCancel).toHaveBeenCalledTimes(1); expect(old.onConfirm).not.toHaveBeenCalled();
  });
});

describe('ProductSheet', () => {
  it('pins its actions under the content, and the content makes room for them', async () => {
    await render(<ProductSheet title="Filteri" onClose={jest.fn()} footer={() => <Text testID="apply">Primeni</Text>}>
      {() => <Text>Sadržaj</Text>}</ProductSheet>);
    expect(sheet().props.footerComponent).toEqual(expect.any(Function));
    expect(byTestId('product-sheet-footer').findByProps({ testID: 'apply' })).toBeDefined();
    await act(async () => { byTestId('product-sheet-footer').props.onLayout({ nativeEvent: { layout: { height: 96 } } }); });
    const scroll = tree.root.findByType('ScrollView' as unknown as React.ElementType);
    expect(flat(scroll.props.contentContainerStyle).paddingBottom).toBe(104);
  });

  it('names a sheet without a visible title, and draws no heading for it', async () => {
    await render(<ProductSheet label="Radnje" onClose={jest.fn()}>{() => <Text>Sadržaj</Text>}</ProductSheet>);
    expect(sheet().props.accessibilityLabel).toBe('Radnje');
    expect(tree.root.findAll(node => node.props.accessibilityRole === 'header')).toHaveLength(0);
  });

  it('closes on Back and on its ×, each once', async () => {
    const onClose = jest.fn();
    await render(<ProductSheet title="Filteri" onClose={onClose}>{() => <Text>Sadržaj</Text>}</ProductSheet>);
    await act(async () => { modal().props.onRequestClose(); modal().props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before throwing unsaved input away, and the caller\'s own commit never asks', async () => {
    const onClose = jest.fn();
    function Draft() {
      const [dirty, setDirty] = useState(true);
      return <ProductSheet title="Filteri" onClose={onClose} dirty={dirty}
        footer={dismiss => <Text testID="commit" onPress={() => { setDirty(true); dismiss(); }}>Primeni</Text>}>
        {() => <Text testID="clean" onPress={() => setDirty(false)}>Sadržaj</Text>}</ProductSheet>;
    }
    await render(<Draft />);
    // No drag closes it and a tap outside stays where it is and asks instead.
    expect(sheet().props.enablePanDownToClose).toBe(false);
    const backdrop = sheet().props.backdropComponent({ animatedIndex: { value: 0 }, animatedPosition: { value: 0 }, style: {} });
    expect(backdrop.props.pressBehavior).toBe(0);
    await press(tree.root.findByProps({ accessibilityLabel: 'Zatvori' }));
    expect(onClose).not.toHaveBeenCalled(); expect(texts()).toContain('Odbaciti izmene?');
    expect(tree.root.findAllByProps({ testID: 'commit' })).toHaveLength(0);
    // Back while it asks means "keep editing".
    await act(async () => { modal().props.onRequestClose(); });
    expect(texts()).not.toContain('Odbaciti izmene?'); expect(onClose).not.toHaveBeenCalled();
    await act(async () => { modal().props.onRequestClose(); });
    await press(byTestId('product-sheet-keep')); expect(texts()).not.toContain('Odbaciti izmene?');
    await act(async () => { backdrop.props.onPress(); });
    await press(byTestId('product-sheet-discard')); expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('commits without the question', async () => {
    const onClose = jest.fn();
    await render(<ProductSheet title="Filteri" onClose={onClose} dirty
      footer={dismiss => <Text testID="commit" onPress={dismiss}>Primeni</Text>}>{() => <Text>Sadržaj</Text>}</ProductSheet>);
    await press(byTestId('commit'));
    expect(onClose).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Odbaciti izmene?');
  });

  it('cannot be left while it is not dismissible', async () => {
    const onClose = jest.fn();
    await render(<ProductSheet title="Filteri" onClose={onClose} dismissible={false}>{() => <Text>Sadržaj</Text>}</ProductSheet>);
    await act(async () => { modal().props.onRequestClose(); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Zatvori' }).props.disabled).toBe(true);
    expect(sheet().props.enablePanDownToClose).toBe(false); expect(onClose).not.toHaveBeenCalled();
  });

  it('settles on a critically damped spring, and on nothing at all under reduced motion', async () => {
    await render(<ProductSheet title="Filteri" onClose={jest.fn()}>{() => <Text>Sadržaj</Text>}</ProductSheet>);
    expect(sheet().props.animateOnMount).toBe(true);
    expect(sheet().props.animationConfigs).toMatchObject({ overshootClamping: true });
    await act(async () => tree.unmount());
    mockReduced = true;
    await render(<ProductSheet title="Filteri" onClose={jest.fn()}>{() => <Text>Sadržaj</Text>}</ProductSheet>);
    expect(sheet().props).toMatchObject({ animateOnMount: false, animationConfigs: { duration: 0 } });
    // The caller's own reading still wins, as the discovery sheets pass it.
    await act(async () => tree.unmount());
    await render(<ProductSheet title="Filteri" reduced={false} onClose={jest.fn()}>{() => <Text>Sadržaj</Text>}</ProductSheet>);
    expect(sheet().props.animateOnMount).toBe(true);
  });
});

describe('ActionSheet', () => {
  const actions = (log: string[]): SheetAction[] => [
    { key: 'report', label: 'Prijavi ili blokiraj', icon: 'shield', destructive: true, onPress: () => log.push('report') },
    { key: 'profile', label: 'Otvori profil', icon: 'person', onPress: () => log.push('profile') },
    { key: 'photos', label: 'Fotografije', icon: 'photo', disabled: true, onPress: () => log.push('photos') },
  ];

  it('puts a destructive action last and draws it in the danger colour', async () => {
    expect(orderActions(actions([])).map(action => action.key)).toEqual(['profile', 'photos', 'report']);
    await render(<ActionSheet actions={actions([])} onClose={jest.fn()} />);
    const rows = tree.root.findAllByType(Press);
    expect(rows.map(row => row.props.accessibilityLabel)).toEqual(['Otvori profil', 'Fotografije', 'Prijavi ili blokiraj']);
    const label = rows[2].findByType('T' as unknown as React.ElementType);
    expect(flat(label.props.style).color).toBe(sys.color.danger);
    expect(flat(rows[0].props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(sheet().props.accessibilityLabel).toBe('Radnje');
  });

  it('runs the chosen action once, after the sheet has gone', async () => {
    const log: string[] = [], onClose = jest.fn(() => log.push('closed'));
    await render(<ActionSheet actions={actions(log)} onClose={onClose} />);
    const profile = tree.root.findByProps({ accessibilityLabel: 'Otvori profil' }).props.onPress;
    await act(async () => { profile(); profile(); });
    expect(log).toEqual(['closed', 'profile']);
  });

  it('does nothing for an action that is not available', async () => {
    const log: string[] = [], onClose = jest.fn();
    await render(<ActionSheet actions={actions(log)} onClose={onClose} />);
    await press(tree.root.findByProps({ accessibilityLabel: 'Fotografije' }));
    expect(log).toEqual([]); expect(onClose).not.toHaveBeenCalled();
  });
});

describe('PeekSheet', () => {
  it('peeks over the screen without a backdrop, a modal or a focus trap, detached above the tab bar', async () => {
    const onClose = jest.fn();
    await render(<PeekSheet label="Zadatak na mapi" onClose={onClose}>{dismiss => <Text testID="card" onPress={dismiss}>Kartica</Text>}</PeekSheet>);
    expect(tree.root.findAllByType('Modal' as unknown as React.ElementType)).toHaveLength(0);
    expect(sheet().props).toMatchObject({ detached: true, bottomInset: 12, enablePanDownToClose: true, accessibilityLabel: 'Zadatak na mapi' });
    expect(sheet().props.backdropComponent).toBeUndefined();
    await press(byTestId('card')); expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Android Back before the screen under it does, and lets Back go once it is gone', async () => {
    const listeners: (() => boolean)[] = [], remove = jest.fn();
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      listeners.push(handler as () => boolean); return { remove };
    });
    try {
      const onClose = jest.fn();
      await render(<PeekSheet label="Zadatak na mapi" onClose={onClose}>{() => <Text>Kartica</Text>}</PeekSheet>);
      let consumed = false;
      await act(async () => { consumed = listeners[0](); });
      expect(consumed).toBe(true); expect(onClose).toHaveBeenCalledTimes(1);
      await act(async () => tree.unmount()); expect(remove).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });

  it('appears without motion under reduced motion', async () => {
    mockReduced = true;
    await render(<PeekSheet label="Zadatak na mapi" onClose={jest.fn()}>{() => <Text>Kartica</Text>}</PeekSheet>);
    expect(sheet().props).toMatchObject({ animateOnMount: false, animationConfigs: { duration: 0 } });
  });
});
