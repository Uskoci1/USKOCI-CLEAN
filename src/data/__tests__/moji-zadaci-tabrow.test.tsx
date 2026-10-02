import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type OwnedTaskCounts } from '../marketplaceView';
import { sys } from '../../ui/system/tokens';
import { OWN_TASK_TABS, SCREEN_SIDE, TAB_GAP, TAB_GEOMETRY, TAB_SLACK, ownTaskTabs, tabsRoom, tabsWidth } from '../../ui/v2/ownTaskTabs';
import type { MarketplacePaging } from '../../ui/v2/MarketplacePresentation';

/**
 * UI/UX pass, plan item 8.1 (2026-10-02), from the first look of the wave-1 build on the owner's HONOR (361 dp wide, text scale
 * 1.15): on Moji zadaci the tabs "Aktivni | Nacrti | Istorija" shared ONE line with the two round buttons (search, filters),
 * got about 209 dp of the 321 dp row, scrolled, and the third label was cut to "Istorij". What this file pins:
 *
 *  1. STRUCTURE: the tab row holds the tabs and nothing else, over the whole width; search and filters (the filters now with the
 *     word "Filteri" beside the drawing) stand in a toolbar of their own under it, together with the count line that used to
 *     scroll away as the list's header. The tabs keep the underline indicator, a 48 dp touch height and their 14 px words.
 *  2. THE FIT, by arithmetic from the bundled Inter (`cardHeadFit.textWidth`, whose table `task-card-layout-class` holds to the
 *     font file): at 320, 361 and 411 dp and at text scale 1, 1.15 and 1.3, the tabs as they are drawn (the labels, the count that
 *     waits for the person's choice, and the counts of the other sets where they fit) are never wider than the row, so the row
 *     never scrolls there. Counts are the first to give way: a label is never cut for a count. Beyond that grid the row is a
 *     horizontal scroller that stretches to the row (`flexGrow`), so a huge text size scrolls instead of clipping.
 *  3. THE COUNTS are the ones the screen already has (the server's counts of a paged build, otherwise the list it holds), never
 *     invented: nothing for zero, nothing while they are unknown, and the number on "Aktivni" is still only what waits for the
 *     person's choice, spoken as before.
 *
 * It is arithmetic and structure, not a render: only a phone shows a pixel.
 */
let mockWidth = 361.14, mockScale = 1.15;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // The list stand-in draws its header, its rows (or the empty view) and its foot, and says whether it was given a header.
  const List = React.forwardRef(({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ListFooterComponent, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: () => {} }), []);
    return React.createElement('List', { ...props, hasHeader: ListHeaderComponent != null }, ListHeaderComponent,
      data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent, ListFooterComponent);
  });
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockScale });
    if (key === 'FlatList') return List;
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    if (key === 'Keyboard') return { dismiss: jest.fn() };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

const row = (id: string, patch = {}): MarketplaceItem => ({ id, revizija: 1, naslov: `Pomoć ${id}`, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: ['Alat'], rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, priblizno: null, ...patch } as MarketplaceItem);
/** Two active tasks (one waits for my choice), two drafts, three closed: what the whole-list build counts for itself. */
const wholeList = () => [row('a1', { brojPrijavaZaIzbor: 2 }), row('a2'), row('d1', { stanje: 'NACRT' }), row('d2', { stanje: 'NACRT' }),
  row('h1', { stanje: 'ZATVORENA' }), row('h2', { stanje: 'ZATVORENA' }), row('h3', { stanje: 'ZATVORENA' })];
const SERVER: OwnedTaskCounts = { total: 40, active: 12, waiting: 4, drafts: 3, history: 25 };
let rows: MarketplaceItem[] = wholeList(), paging: MarketplacePaging | undefined, loading = false, error = false, snapshot: MarketplaceView;
const makePaging = (counts: OwnedTaskCounts | null): MarketplacePaging => ({ counts, hasMore: false, loadingMore: false, moreError: false, onLoadMore: jest.fn() });
function Screen({ initial = initialMarketplaceView() }: { initial?: MarketplaceView }) {
  const [view, setView] = useState(initial); snapshot = view;
  return <MarketplacePresentation items={rows} loading={loading} error={error} view={view} onView={setView} onOpen={jest.fn()} onRefresh={jest.fn()}
    onProfile={jest.fn()} paging={paging} />;
}
let tree: ReactTestRenderer;
const render = async (width = 361.14, scale = 1.15, initial?: MarketplaceView) => {
  mockWidth = width; mockScale = scale; await act(async () => { tree = create(<Screen initial={initial} />); });
};
const rerender = async (width: number, scale: number) => { mockWidth = width; mockScale = scale; await act(async () => tree.update(<Screen />)); };
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const byId = (id: string) => tree.root.findByProps({ testID: id });
const PRESS = 'Press' as React.ElementType, T_ = 'T' as React.ElementType, VIEW = 'View' as React.ElementType;
const pressIn = (scope: ReactTestInstance, label: string) => scope.findAll(node => node.type === PRESS && node.props.accessibilityLabel === label);
const tabPresses = () => byId('own-tasks-tabs').findAll(node => node.type === PRESS && node.props.accessibilityRole === 'tab');
const tab = (label: string) => tabPresses().find(node => node.props.accessibilityLabel === label)!;
/** The number drawn in a tab: the badge text is a `T` of the `label` variant inside the pill. */
const badgeOf = (label: string) => tab(label).findAll(node => node.type === T_ && node.props.variant === 'label').map(node => node.props.children);
const textsIn = (scope: ReactTestInstance) => scope.findAll(node => node.type === T_).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ').replace(/\s+/g, ' ');
/** The size a drawn word has: its own style, else the variant's. */
const sizeOf = (node: ReactTestInstance) => (style(node).fontSize ?? (sys.type as Record<string, { fontSize?: number }>)[node.props.variant ?? 'body']?.fontSize) as number;

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  rows = wholeList(); paging = undefined; loading = error = false; mockWidth = 361.14; mockScale = 1.15;
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

/** The window and the text size: what a phone is to this row. The owner's HONOR is 361.14 dp at 1.15. */
const GRID: readonly [width: number, scale: number][] = [320, 361.14, 411].flatMap(width => [1, 1.15, 1.3].map(scale => [width, scale] as [number, number]));

/* ---------------------------------------------------------------------------------------------------------- structure */

describe('the tab row holds the tabs and nothing else', () => {
  /** The defect itself, found without any test id: the first-look build had ONE row holding the tablist and both round buttons. */
  it('no row holds the tabs and a control together (at the owner\'s phone the third tab was cut to "Istorij" by the search button)', async () => {
    await render();
    const ancestorsOf = (node: ReactTestInstance) => { const found: ReactTestInstance[] = []; for (let up = node.parent; up; up = up.parent) found.push(up); return found; };
    const tablist = tree.root.findByProps({ accessibilityRole: 'tablist' });
    for (const control of ['Pretraga', 'Filteri']) {
      const sharedRows = ancestorsOf(tablist).filter(node => style(node).flexDirection === 'row' && pressIn(node, control).length > 0);
      expect([control, sharedRows.length]).toEqual([control, 0]);
    }
  });

  it('draws Aktivni, Nacrti and Istorija as real tabs in a row of their own, with search and filters under it in a toolbar', async () => {
    await render();
    const tabs = byId('own-tasks-tabs'), toolbar = byId('own-tasks-toolbar');
    expect(tabPresses().map(node => node.props.accessibilityLabel)).toEqual(['Aktivni', 'Nacrti', 'Istorija']);
    expect(tabs.findAll(node => node.props.accessibilityRole === 'tablist')).toHaveLength(1);
    for (const control of ['Pretraga', 'Filteri']) {
      expect([control, pressIn(tabs, control).length]).toEqual([control, 0]);
      expect([control, pressIn(toolbar, control).length]).toEqual([control, 1]);
    }
    // The toolbar stands under the tabs, not beside them.
    const order = tree.root.findAll(node => node.props.testID === 'own-tasks-tabs' || node.props.testID === 'own-tasks-toolbar').map(node => node.props.testID);
    expect(order).toEqual(['own-tasks-tabs', 'own-tasks-toolbar']);
  });

  it('gives the tabs the whole row: a horizontal scroller that stretches to it, the tabs spread over it, and the underline is the tab bar\'s own', async () => {
    await render();
    const tabs = byId('own-tasks-tabs'), scroller = tabs.findByType('ScrollView' as React.ElementType);
    // The row pads the screen's 20 dp each side, like the toolbar and the list under it (the room the estimate measures against).
    expect(style(tabs)).toMatchObject({ paddingHorizontal: SCREEN_SIDE }); expect(SCREEN_SIDE).toBe(20);
    expect(style(byId('own-tasks-toolbar'))).toMatchObject({ paddingHorizontal: SCREEN_SIDE });
    expect(StyleSheet.flatten(tree.root.findByType('List' as React.ElementType).props.contentContainerStyle)).toMatchObject({ paddingHorizontal: SCREEN_SIDE });
    // No rubber-band when the tabs fit (a tab bar does not bounce), and a tap on a tab works while the search keyboard is up.
    expect(scroller.props).toMatchObject({ horizontal: true, showsHorizontalScrollIndicator: false, bounces: false, keyboardShouldPersistTaps: 'handled' });
    expect(StyleSheet.flatten(scroller.props.contentContainerStyle)).toMatchObject({ flexGrow: 1 });
    const track = scroller.findByProps({ accessibilityRole: 'tablist' });
    expect(style(track)).toMatchObject({ flexGrow: 1, justifyContent: 'space-between', gap: TAB_GAP, borderBottomWidth: 1 });
    // Underline tabs, not the grey pill: the track is white and each tab marks itself with a 3 dp bottom edge.
    expect(style(track).backgroundColor).toBe(sys.color.surface);
    expect(style(tabPresses()[0])).toMatchObject({ minHeight: 48, borderBottomWidth: 3 });
  });

  it('the count line, which used to be the list\'s scrolling header, stands in the toolbar beside the controls', async () => {
    await render();
    const list = tree.root.findByType('List' as React.ElementType);
    expect(textsIn(byId('own-tasks-toolbar'))).toContain('2 zadatka');
    expect(textsIn(list)).not.toMatch(/\d+ zadat/);
    expect(list.props.hasHeader).toBe(false);
  });

  it('keeps the commands: tapping a tab, search and filters work from where they stand now, with the same spoken names', async () => {
    await render();
    await act(async () => tab('Nacrti').props.onPress()); expect(snapshot.section).toBe('drafts');
    await act(async () => tab('Aktivni').props.onPress()); expect(snapshot.section).toBe('active');
    await act(async () => pressIn(byId('own-tasks-toolbar'), 'Pretraga')[0].props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži zadatke' }).length).toBeGreaterThan(0);
    await act(async () => pressIn(byId('own-tasks-toolbar'), 'Filteri')[0].props.onPress());
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Svi načini' }).length).toBeGreaterThan(0);
  });
});

describe('the toolbar controls are touchable and say what they are', () => {
  it.each(GRID)('at %s dp and text scale %s the controls keep a 44 dp touch target and no word on the two rows is under 12 px', async (width, scale) => {
    await render(width, scale);
    const toolbar = byId('own-tasks-toolbar');
    for (const label of ['Pretraga', 'Filteri']) {
      const control = pressIn(toolbar, label)[0], box = style(control);
      expect([label, (box.height ?? box.minHeight) as number >= 44, (box.width ?? box.minWidth) as number >= 44]).toEqual([label, true, true]);
    }
    for (const scope of [byId('own-tasks-tabs'), toolbar]) {
      for (const word of scope.findAll(node => node.type === T_)) expect([word.props.children, sizeOf(word) >= 12]).toEqual([word.props.children, true]);
    }
    for (const press of tabPresses()) expect(style(press).minHeight as number).toBeGreaterThanOrEqual(44);
  });

  it('the filters carry the word beside the drawing (a bare sliders icon says nothing), the search keeps the universal magnifier; the spoken names are unchanged', async () => {
    await render();
    const toolbar = byId('own-tasks-toolbar');
    expect(toolbar.findAll(node => node.type === T_ && node.props.children === 'Filteri')).toHaveLength(1);
    expect(toolbar.findAll(node => node.type === T_ && node.props.children === 'Pretraga')).toHaveLength(0);
    expect(pressIn(toolbar, 'Filteri')[0].props.accessibilityState).toEqual({ selected: false });
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), price: 'OFFERS' });
    // A filter that is on says so in its name (as before) and in its look (the control is "on").
    expect(pressIn(byId('own-tasks-toolbar'), 'Filteri, aktivni')).toHaveLength(1);
    expect(pressIn(byId('own-tasks-toolbar'), 'Filteri, aktivni')[0].props.accessibilityState).toEqual({ selected: true });
  });
});

/* ------------------------------------------------------------------------------------------------------------- the fit */

describe('the tabs are never wider than their row, so the row does not scroll', () => {
  const SCENARIOS: readonly [name: string, counts: OwnedTaskCounts | null][] = [
    ['counts unknown', null],
    ['one task waits, nothing else', { total: 3, active: 2, waiting: 1, drafts: 0, history: 1 }],
    ['ordinary counts', SERVER],
    ['two-digit counts everywhere', { total: 330, active: 100, waiting: 12, drafts: 12, history: 218 }],
  ];

  it('the geometry the estimate assumes is the one the tab bar draws (4 dp each side of a label, 6 dp to its count, a 22 dp pill with 6 dp inside), and the sizes are the tokens', async () => {
    rows = [row('a', { brojPrijavaZaIzbor: 1 })]; paging = makePaging({ ...SERVER, waiting: 1 });
    await render();
    const segment = tab('Aktivni'), pill = segment.findAll(node => node.type === VIEW && style(node).minWidth === 22)[0];
    // What the estimate uses (`TAB_GEOMETRY`) is what the tab bar draws: the numbers are read back from the render, not typed twice.
    expect([style(segment).paddingHorizontal, style(segment).gap]).toEqual([TAB_GEOMETRY.padding / 2, TAB_GEOMETRY.countGap]);
    expect([style(pill).minWidth, style(pill).paddingHorizontal]).toEqual([TAB_GEOMETRY.countMin, TAB_GEOMETRY.countPadding / 2]);
    expect(style(pill).height).toBe(22);
    const label = segment.findAll(node => node.type === T_ && node.props.children === 'Aktivni')[0], count = segment.findAll(node => node.type === T_ && node.props.variant === 'label')[0];
    expect([sizeOf(label), sizeOf(count)]).toEqual([sys.type.tab.fontSize, sys.type.label.fontSize]);
    expect(OWN_TASK_TABS.map(option => option.label)).toEqual(['Aktivni', 'Nacrti', 'Istorija']);
  });

  it.each(GRID)('at %s dp and text scale %s: every scenario fits, and a count that would not fit is dropped, never a label', (width, scale) => {
    const room = { width, scale };
    for (const [name, counts] of SCENARIOS) {
      const options = ownTaskTabs(counts, room);
      expect([name, options.map(option => option.label)]).toEqual([name, ['Aktivni', 'Nacrti', 'Istorija']]);
      expect([name, tabsWidth(options, scale) <= tabsRoom(room)]).toEqual([name, true]);
      // The count of what waits for the person's choice is never the one that gives way.
      expect([name, options[0].badge]).toEqual([name, counts && counts.waiting > 0 ? counts.waiting : undefined]);
    }
  });

  it('shows the counts of the other sets where there is room, with room to spare, and not where there is none (a count is the first thing to give way)', () => {
    const shown = (width: number, scale: number) => ownTaskTabs(SERVER, { width, scale }).map(option => option.badge);
    expect(shown(411, 1)).toEqual([4, 3, 25]);
    expect(shown(361.14, 1)).toEqual([4, 3, 25]);
    expect(shown(361.14, 1.15)).toEqual([4, 3, 25]); // the owner's phone
    expect(shown(361.14, 1.3)).toEqual([4, undefined, undefined]);
    expect(shown(320, 1.15)).toEqual([4, undefined, undefined]);
    expect(shown(320, 1.3)).toEqual([4, undefined, undefined]);
    // The slack is what the estimate keeps free: what is drawn needs that much less than the row.
    for (const [width, scale] of GRID) {
      const room = { width, scale }, drawn = ownTaskTabs(SERVER, room);
      if (drawn[1].badge !== undefined) expect(tabsWidth(drawn, scale) + TAB_SLACK).toBeLessThanOrEqual(tabsRoom(room));
    }
    // The room accounts for the pill of a two-digit count, and a count costs room.
    const owner = { width: 361.14, scale: 1.15 }, one = ownTaskTabs({ ...SERVER, waiting: 1 }, owner), two = ownTaskTabs({ ...SERVER, waiting: 12 }, owner);
    expect(tabsWidth(two, 1.15)).toBeGreaterThan(tabsWidth(one, 1.15));
    expect(tabsWidth(ownTaskTabs(null, owner), 1.15)).toBeLessThan(tabsWidth(one, 1.15));
  });

  it('the row is the window less the 20 dp the screen pads on each side', () => {
    expect(tabsRoom({ width: 361.14, scale: 1 })).toBeCloseTo(321.14, 2);
    expect(tabsRoom({ width: 320, scale: 1 })).toBe(280);
  });

  it('the original defect, in numbers: beside the two 48 dp buttons the tabs had 209 dp and needed more; now they have 321 dp and need less', () => {
    const owner = { width: 361.14, scale: 1.15 };
    // The first-look build drew the three labels, the count of what waits, and Segmented's own 20 dp between two tabs.
    const firstLook = ownTaskTabs(SERVER, owner).map(option => ({ label: option.label, badge: option.key === 'active' ? option.badge : undefined }));
    const needed = tabsWidth(firstLook, 1.15) + 2 * (20 - TAB_GAP), had = tabsRoom(owner) - 2 * 48 - 2 * 8;
    expect(had).toBeCloseTo(209.14, 2); expect(needed).toBeGreaterThan(had);
    expect(tabsWidth(ownTaskTabs(SERVER, owner), 1.15)).toBeLessThan(tabsRoom(owner));
  });

  it('beyond the grid the row scrolls instead of clipping a label: the scroller is there, and a huge text size needs more than the row', async () => {
    await render(320, 2);
    expect(byId('own-tasks-tabs').findByType('ScrollView' as React.ElementType).props.horizontal).toBe(true);
    expect(tabPresses().map(node => node.props.accessibilityLabel)).toEqual(['Aktivni', 'Nacrti', 'Istorija']);
    expect(tabsWidth(ownTaskTabs(null, { width: 320, scale: 2 }), 2)).toBeGreaterThan(tabsRoom({ width: 320, scale: 2 }));
  });
});

/* ---------------------------------------------------------------------------------------------------------- the counts */

describe('the counts on the tabs are the ones the screen already has', () => {
  it('a whole-list build counts the list it holds: the badge on Aktivni is still what waits for my choice, the other tabs say how many they hold', async () => {
    await render();
    expect(badgeOf('Aktivni')).toEqual(['1']); expect(badgeOf('Nacrti')).toEqual(['2']); expect(badgeOf('Istorija')).toEqual(['3']);
    expect(tab('Aktivni').props.accessibilityValue).toEqual({ text: 'Za tvoj izbor: 1 zadatak' });
    expect(tab('Nacrti').props.accessibilityValue).toEqual({ text: '2 nacrta' });
    expect(tab('Istorija').props.accessibilityValue).toEqual({ text: '3 zadatka' });
  });

  it('a paged build shows the server\'s counts, never the number that happens to be loaded, and nothing while they are unknown', async () => {
    paging = makePaging(SERVER); rows = [row('only')];
    await render();
    expect(badgeOf('Aktivni')).toEqual(['4']); expect(badgeOf('Nacrti')).toEqual(['3']); expect(badgeOf('Istorija')).toEqual(['25']);
    expect(tab('Istorija').props.accessibilityValue).toEqual({ text: '25 zadataka' });
    paging = makePaging(null); await rerender(361.14, 1.15);
    for (const label of ['Aktivni', 'Nacrti', 'Istorija']) expect([label, badgeOf(label), tab(label).props.accessibilityValue]).toEqual([label, [], { text: '' }]);
  });

  it('shows no number for an empty set', async () => {
    rows = [row('a1'), row('h1', { stanje: 'ZATVORENA' })];
    await render();
    expect(badgeOf('Aktivni')).toEqual([]); expect(badgeOf('Nacrti')).toEqual([]); expect(badgeOf('Istorija')).toEqual(['1']);
  });

  it('the count of what waits for me is the orange one, the counts of the sets are quiet', () => {
    expect(ownTaskTabs(SERVER, { width: 411, scale: 1 }).map(option => option.badgeTone)).toEqual(['attention', undefined, undefined]);
  });

  it('says nothing while the list is being read or failed to read', async () => {
    loading = true; await render();
    for (const label of ['Aktivni', 'Nacrti', 'Istorija']) expect([label, badgeOf(label)]).toEqual([label, []]);
    loading = false; error = true; await rerender(361.14, 1.15);
    for (const label of ['Aktivni', 'Nacrti', 'Istorija']) expect([label, badgeOf(label)]).toEqual([label, []]);
  });

  it('the count line says how many the set shows and does not name a set the tab above already names; only the view without a tab does', async () => {
    await render();
    const line = () => textsIn(byId('own-tasks-count'));
    expect(line()).toBe('2 zadatka');
    await act(async () => tab('Nacrti').props.onPress());
    expect(line()).toBe('2 zadatka');
    await act(async () => tab('Istorija').props.onPress());
    expect(line()).toBe('3 zadatka');
    await act(async () => { tree.unmount(); });
    await render(361.14, 1.15, { ...initialMarketplaceView(), section: 'all' });
    expect(tabPresses().every(node => node.props.accessibilityState.selected === false)).toBe(true);
    expect(line()).toBe('7 zadataka · svi zadaci');
  });
});
