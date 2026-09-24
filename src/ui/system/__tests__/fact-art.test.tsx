import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { FactArt, type FactArtKind } from '../FactArt';

/**
 * The fact drawings a task card's requirement line uses (card review r3 item 5, 2026-09-24). A vehicle and a tool are
 * FactArt kinds like the rest: the same 32-unit drawing on a ground shadow, green-led with no orange in them, decorative
 * (the words beside them carry the meaning), and drawn at the size asked for, the card's 16 px included.
 */
const ORANGE = ['#F78028', '#CF5B12', '#FFBE85', '#FFF0E2'];
const GREEN = ['#079C77', '#077958'];
const colours = (root: ReactTestInstance) => root.findAll(node => typeof node.props?.fill === 'string' || typeof node.props?.stroke === 'string', { deep: true })
  .flatMap(node => [node.props.fill, node.props.stroke]).filter((value): value is string => typeof value === 'string');

describe('the vehicle and the tool', () => {
  let tree: ReactTestRenderer;
  afterEach(async () => { await act(async () => tree?.unmount()); });

  it.each(['vehicle', 'tool'] as FactArtKind[])('%s draws green-led, with no orange, hidden from screen readers, at 16 px', async kind => {
    await act(async () => { tree = create(<FactArt kind={kind} size={16} />); });
    const box = tree.root.findAll(node => node.props?.['aria-hidden'] === true)[0];
    expect(box.props.style).toMatchObject({ width: 16, height: 16 });
    const used = colours(tree.root);
    expect(used.some(colour => GREEN.includes(colour))).toBe(true);
    expect(used.filter(colour => ORANGE.includes(colour))).toEqual([]);
    // The same construction as the other kinds: the 32-unit drawing on its ground shadow.
    expect(tree.root.findAll(node => node.props?.viewBox === '0 0 32 32').length).toBeGreaterThan(0);
    expect(tree.root.findAll(node => node.props?.ry === 1.6 && node.props?.cy === 29.4).length).toBeGreaterThan(0);
  });

  it.each(['vehicle', 'tool'] as FactArtKind[])('%s turns grey when it is not active', async kind => {
    await act(async () => { tree = create(<FactArt kind={kind} size={20} muted />); });
    const used = colours(tree.root);
    expect(used.filter(colour => [...GREEN, ...ORANGE].includes(colour))).toEqual([]);
  });
});
