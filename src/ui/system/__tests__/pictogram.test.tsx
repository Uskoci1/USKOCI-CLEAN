import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pictogram, pictogramCatalog } from '../Pictogram';
import { PickerTile } from '../PickerTile';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: {} }));

/**
 * The picker level of the icon language (owner's master directive, step E, 2026-09-23): every pictogram draws, a
 * disabled one turns grey, and a picker tile tells a screen reader what it is, whether it is chosen and why it cannot be.
 */
describe('pictograms', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); });

  it('draws every kind in the catalog, each with its own gradient', async () => {
    await act(async () => { tree = create(<>{pictogramCatalog.map(p => <Pictogram key={p.kind} kind={p.kind} size={48} />)}</>); });
    expect(pictogramCatalog).toHaveLength(46);
    const gradients = tree.root.findAll(node => node.props?.x2 === '0' && node.props?.y2 === '1' && typeof node.props?.id === 'string', { deep: false });
    expect(new Set(gradients.map(node => node.props.id)).size).toBe(gradients.length);
  });

  it('covers the four groups the directive names, with a label for each', () => {
    const groups = new Set(pictogramCatalog.map(p => p.group));
    expect([...groups].sort()).toEqual(['alat', 'ljudi', 'usluge', 'vozila']);
    expect(pictogramCatalog.every(p => p.label.trim().length > 1)).toBe(true);
    for (const kind of ['bicikl', 'ebike', 'skuter', 'motor', 'automobil', 'karavan', 'pickup', 'kombi', 'prikolica', 'kamion']) {
      expect(pictogramCatalog.some(p => p.kind === kind && p.group === 'vozila')).toBe(true);
    }
  });

  it('a disabled pictogram is drawn in the muted tone only', async () => {
    await act(async () => { tree = create(<Pictogram kind="kombi" disabled />); });
    const fills = tree.root.findAll(node => typeof node.props?.stopColor === 'string').map(node => node.props.stopColor);
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every(color => ['#A7AFAA', '#8A938E'].includes(color))).toBe(true);
  });
});

describe('a picker tile', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); });
  const press = () => tree.root.findAll(node => node.props?.accessibilityRole === 'checkbox' || node.props?.accessibilityRole === 'radio')[0];

  it('says its label and whether it is chosen, and chooses on press', async () => {
    const onPress = jest.fn();
    await act(async () => { tree = create(<PickerTile kind="kombi" label="Kombi" selected onPress={onPress} />); });
    expect(press().props.accessibilityRole).toBe('checkbox');
    expect(press().props.accessibilityLabel).toBe('Kombi');
    expect(press().props.accessibilityState).toEqual({ checked: true, disabled: false });
    await act(async () => { press().props.onPress(); });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a single-answer tile is a radio', async () => {
    await act(async () => { tree = create(<PickerTile kind="selidba" label="Selidba" selected={false} mode="single" onPress={() => {}} />); });
    expect(press().props.accessibilityRole).toBe('radio');
    expect(press().props.accessibilityState).toEqual({ checked: false, disabled: false });
  });

  it('a disabled tile says why and cannot be chosen', async () => {
    const onPress = jest.fn();
    await act(async () => { tree = create(<PickerTile kind="kamion" label="Kamion" selected={false} disabled reason="Treba vozačka C" onPress={onPress} />); });
    expect(press().props.accessibilityLabel).toBe('Kamion. Treba vozačka C');
    expect(press().props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(press().props.disabled).toBe(true);
  });
});
