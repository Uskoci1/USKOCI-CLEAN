import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Appear, useAppear } from '../Appear';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));

/**
 * Motion in this app is feedback, never decoration. That is one rule with two halves and both are
 * here: a row that was already on screen when it opened has nothing to announce, and a row that
 * arrives while the person is looking does.
 */
describe('a row arriving in a list', () => {
  let tree: ReactTestRenderer;
  let rows: { key: string; animate: boolean }[] = [];
  afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; rows = []; });

  /** Stands in for a list: it settles what it is about to draw, then asks about each row. */
  function List({ keys }: { keys: string[] }) {
    const appear = useAppear();
    appear.settle(keys);
    rows = keys.map(key => ({ key, animate: appear.isNew(key) }));
    return <>{keys.map((key, index) => <Appear key={key} index={index} animate={rows[index].animate}>
      <mock-row testID={key} />
    </Appear>)}</>;
  }
  const draw = async (keys: string[]) => { await act(async () => { tree = create(<List keys={keys} />); }); };
  const redraw = async (keys: string[]) => { await act(async () => tree.update(<List keys={keys} />)); };
  const animate = () => rows.map(row => row.animate);

  it('is silent for what was already there, and for the same rows read again', async () => {
    await draw(['a', 'b']);
    expect(animate()).toEqual([false, false]);
    await redraw(['a', 'b']);
    expect(animate()).toEqual([false, false]);
  });

  it('animates the row that was not there before, once', async () => {
    await draw(['a', 'b']);
    await redraw(['a', 'b', 'c']);
    expect(animate()).toEqual([false, false, true]);
    // Having arrived, it is part of the list: a later read leaves it alone.
    await redraw(['a', 'b', 'c']);
    expect(animate()).toEqual([false, false, false]);
  });

  it('carries an entrance only for the row the list called new', async () => {
    await draw(['a']);
    await redraw(['a', 'b']);
    const views = tree.root.findAllByType('View' as React.ElementType);
    expect(views[0].props.entering).toBeUndefined();
    expect(views[1].props.entering).toBeDefined();
  });

  it('does nothing at all when the system asks for less motion', async () => {
    mockReduced = true;
    await draw(['a']);
    await redraw(['a', 'b']);
    expect(tree.root.findAllByType('View' as React.ElementType).every(view => view.props.entering === undefined)).toBe(true);
  });
});
