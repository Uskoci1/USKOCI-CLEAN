import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The bell reads the inbox; the root bar only has to hold it. The bell's own drawing is checked below on the real one.
jest.mock('../../InboxBell', () => ({ InboxBell: () => require('react').createElement('Bell') }));
let mockUnread: number | undefined;
jest.mock('../../../hooks/useInbox', () => ({ useInbox: () => ({ state: { error: null, page: mockUnread === undefined ? null : { unreadCount: mockUnread } } }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { ArrowLeft, Bell, CalendarBlank, MagnifyingGlass, User } from 'phosphor-react-native';
import { chrome, ChromeIconButton, ScreenChrome, useChromeTitleOnScroll } from '../ScreenChrome';
import { HeaderIconButton, ScreenHeader } from '../ScreenHeader';
import { DetailTopBar } from '../DetailTopBar';
import { ProductHeader } from '../../product/ProductDetails';
import { SettingsScreen } from '../../settings/SettingsPresentation';
import { sys } from '../tokens';

/**
 * One chrome for every screen (master design plan, 2026-09-24). Six ways of drawing a top bar gave six heights, two
 * arrow sizes and three title styles; these checks hold the one bar that replaced them, through the wrappers every
 * screen already uses.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); mockReduced = false; jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const hosts = (match: (node: ReactTestInstance) => boolean) => tree.root.findAll(node => typeof node.type === 'string' && match(node));
const control = (label: string) => hosts(node => node.props.accessibilityLabel === label)[0];
/** The Press itself, whose props are what the screen asked for (the native host adds every state key). */
const press = (label: string) => tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityLabel === label)[0];
const bar = () => hosts(node => flat(node).minHeight === chrome.minHeight)[0];
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).flat().filter(child => typeof child === 'string');
const header = () => hosts(node => node.props.accessibilityRole === 'header')[0];
/** The drawn circle inside a control's 48 px touch area, and the glyph inside it. */
const circle = (label: string) => control(label).findAll(node => typeof node.type === 'string' && node.props.testID === 'chrome-circle')[0];
// The repository's phosphor mock draws each icon as a host element named after it.
const glyph = (label: string) => press(label).findAll(node => node.props.size === chrome.icon && node.props.weight !== undefined)[0];
const noop = () => {};

describe('one bar for every kind of screen', () => {
  it('gives the root, detail and flow bars one height, one side padding and 48 px controls', async () => {
    for (const [element, lead] of [
      [<ScreenHeader title="Dogovori" onProfile={noop} />, 'Moj profil'],
      [<DetailTopBar title="Kalendar obaveza" onBack={noop} />, 'Nazad'],
      [<ScreenChrome variant="flow" title="Novi zadatak" onClose={noop} />, 'Zatvori'],
    ] as const) {
      await render(element);
      expect(flat(bar())).toMatchObject({ minHeight: 64, paddingHorizontal: 20, paddingVertical: 8 });
      // The same values, named on the one spacing scale.
      expect(flat(bar())).toMatchObject({ paddingHorizontal: sys.space.lg, paddingVertical: sys.space.sm, gap: sys.space.md });
      expect(flat(control(lead))).toMatchObject({ width: 48, height: 48 });
      await act(async () => tree.unmount());
    }
  });

  it('draws DetailTopBar, ProductHeader and the Settings screens with the same bar and the same title', async () => {
    const measured: unknown[] = [];
    for (const element of [<DetailTopBar title="Profil" onBack={noop} />, <ProductHeader title="Profil" back={noop} />,
      <SettingsScreen title="Profil" onBack={noop}>{null}</SettingsScreen>]) {
      await render(element);
      measured.push({ bar: flat(bar()), title: flat(header()), arrow: flat(control('Nazad')) });
      await act(async () => tree.unmount());
    }
    expect(measured[1]).toEqual(measured[0]);
    expect(measured[2]).toEqual(measured[0]);
    const { fontSize, lineHeight, letterSpacing } = sys.type.title;
    expect((measured[0] as { title: object }).title).toMatchObject({ fontSize, lineHeight, letterSpacing, color: sys.color.ink });
  });
});

describe('root', () => {
  it('has the profile, the centred mark and the bell; the section is spoken with the mark and never drawn', async () => {
    await render(<ScreenHeader title="Dogovori" onProfile={noop} right={<HeaderIconButton label="Kalendar obaveza" icon={MagnifyingGlass} onPress={noop} />} />);
    expect(control('Moj profil')).toBeDefined();
    expect(header().props.accessibilityLabel).toBe('USKOČI, Dogovori');
    expect(tree.root.findAllByType('Bell' as React.ElementType)).toHaveLength(1);
    expect(texts()).not.toContain('Dogovori');
    expect(control('Kalendar obaveza')).toBeDefined();
  });

  it('speaks a header toggle as selected or not, and shows it by weight and colour together', async () => {
    await render(<HeaderIconButton label="Pretraga" icon={MagnifyingGlass} active onPress={noop} />);
    expect(press('Pretraga').props.accessibilityState).toEqual({ selected: true });
    // Updated 2026-09-24 (critique B2): the fill is on the drawn 44 px circle, no longer on the 48 px touch area.
    expect(flat(circle('Pretraga')).backgroundColor).toBe(sys.color.greenSoft);
    expect(glyph('Pretraga').props).toMatchObject({ weight: 'fill', color: sys.color.green });
    await act(async () => tree.update(<HeaderIconButton label="Pretraga" icon={MagnifyingGlass} onPress={noop} />));
    expect(press('Pretraga').props.accessibilityState).toEqual({ selected: false });
    expect(flat(circle('Pretraga')).backgroundColor).toBe(sys.color.surface);
    expect(glyph('Pretraga').props).toMatchObject({ weight: 'regular', color: sys.color.ink });
  });

  it('draws the profile as the same circle with a green glyph, and nothing else between it, the mark and the bell', async () => {
    await render(<ScreenHeader title="Dogovori" onProfile={noop} />);
    expect(flat(circle('Moj profil'))).toMatchObject({ width: chrome.circle, height: chrome.circle, backgroundColor: sys.color.surface });
    expect(glyph('Moj profil').type).toBe(User);
    expect(glyph('Moj profil').props).toMatchObject({ weight: 'regular', color: sys.color.green });
    const buttons = hosts(node => node.props.accessibilityRole === 'button');
    expect([...new Set(buttons.map(node => node.props.accessibilityLabel))]).toEqual(['Moj profil']);
    expect(tree.root.findAllByType('Bell' as React.ElementType)).toHaveLength(1);
  });
});

// Round-1 critique B2: five icon-button shapes (a square well, a round well, a green avatar, a round bell, the week's
// bordered arrows) became one. B1: the bell's glyph is green; only its unread count keeps the orange.
describe('the one chrome icon button', () => {
  it('is a 44 px white circle with the hairline inside an exact 48 px touch area, with a 22 px regular glyph in ink', async () => {
    const back = jest.fn();
    await render(<DetailTopBar title="Kalendar obaveza" onBack={back} />);
    expect(flat(control('Nazad'))).toMatchObject({ width: 48, height: 48 });
    expect(press('Nazad').props.hitSlop).toBe(0);
    expect(flat(circle('Nazad'))).toMatchObject({ width: 44, height: 44, borderRadius: sys.radius.pill,
      backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line });
    expect(glyph('Nazad').type).toBe(ArrowLeft);
    expect(glyph('Nazad').props).toMatchObject({ size: 22, weight: 'regular', color: sys.color.ink });
    await act(async () => press('Nazad').props.onPress());
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('draws a disabled control with a muted glyph and never fades it', async () => {
    await render(<DetailTopBar title="Profil" disabled onBack={noop} />);
    expect(press('Nazad').props.disabled).toBe(true);
    expect(glyph('Nazad').props.color).toBe(sys.color.muted);
    expect(flat(control('Nazad')).opacity).toBeUndefined();
    expect(flat(circle('Nazad')).opacity).toBeUndefined();
    expect(flat(circle('Nazad')).backgroundColor).toBe(sys.color.surface);
  });

  it('has a quiet form without the circle, for a control that ends a row of its own content', async () => {
    await render(<ChromeIconButton quiet label="Kalendar obaveza" icon={CalendarBlank} onPress={noop} />);
    expect(flat(control('Kalendar obaveza'))).toMatchObject({ width: 48, height: 48 });
    expect(flat(circle('Kalendar obaveza'))).toMatchObject({ backgroundColor: 'transparent', borderColor: 'transparent' });
    expect(glyph('Kalendar obaveza').props).toMatchObject({ size: 22, weight: 'regular', color: sys.color.ink });
    expect(press('Kalendar obaveza').props.accessibilityState).toEqual({ disabled: false });
  });

  it('draws the bell green in the same circle; an unread count keeps the orange badge', async () => {
    const { InboxBell } = jest.requireActual('../../InboxBell') as typeof import('../../InboxBell');
    const bellLabel = (count: number) => hosts(node => typeof node.props.accessibilityLabel === 'string'
      && node.props.accessibilityLabel.startsWith(`Obaveštenja, ${count} `))[0].props.accessibilityLabel as string;
    mockUnread = 0;
    await render(<InboxBell />);
    const label = bellLabel(0);
    expect(flat(circle(label))).toMatchObject({ width: 44, height: 44, backgroundColor: sys.color.surface, borderColor: sys.color.line });
    expect(glyph(label).type).toBe(Bell);
    expect(glyph(label).props).toMatchObject({ weight: 'regular', color: sys.color.green });
    expect(hosts(node => flat(node).backgroundColor === sys.color.orange)).toHaveLength(0);
    await act(async () => tree.unmount());
    mockUnread = 3;
    await render(<InboxBell />);
    const spoken = bellLabel(3);
    // Still green with something unread: the orange is the badge alone.
    expect(glyph(spoken).props.color).toBe(sys.color.green);
    expect(hosts(node => flat(node).backgroundColor === sys.color.orange)).toHaveLength(1);
    expect(tree.root.findAllByType(Text).map(node => node.props.children)).toContain(3);
    mockUnread = undefined;
  });
});

describe('detail', () => {
  it('keeps the back label and the disabled state, draws the title as a header and holds one right control', async () => {
    const back = jest.fn();
    await render(<DetailTopBar title="Veštine, alat i tim" backLabel="Nazad na profil" disabled onBack={back}
      right={<HeaderIconButton label="Više radnji" icon={MagnifyingGlass} onPress={noop} />} />);
    expect(press('Nazad na profil').props.accessibilityState).toEqual({ disabled: true });
    expect(header().props.children).toBe('Veštine, alat i tim');
    expect(control('Više radnji')).toBeDefined();
    // The owner's rule: the bar names the content and nothing says where you are.
    expect(texts()).toEqual(['Veštine, alat i tim']);
  });

  it('lets a task screen leave the title to its content and still say its state under the arrow', async () => {
    await render(<ProductHeader back={noop} subtitle="Učitavamo" />);
    expect(hosts(node => node.props.accessibilityRole === 'header')).toHaveLength(0);
    expect(texts()).toEqual(['Učitavamo']);
    expect(press('Nazad').props.accessibilityState).toEqual({ disabled: false });
  });

  it('puts a face before the name when the bar is about a person', async () => {
    await render(<ScreenChrome variant="detail" title="Mila" subtitle="Dogovoreno" onBack={noop} lead={<Text>MI</Text>} />);
    expect(texts()).toEqual(['MI', 'Mila', 'Dogovoreno']);
    expect(header().props.children).toBe('Mila');
  });
});

describe('the title that appears on scroll', () => {
  const title = () => hosts(node => node.props.testID === 'chrome-title')[0];

  it('is hidden from the eye and from a screen reader until the content title has scrolled away, then fades in over 180 ms', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<ProductHeader title="Selidba stana" back={noop} titleVisible={false} />);
    expect(title().props.accessibilityElementsHidden).toBe(true);
    expect(title().props.importantForAccessibility).toBe('no-hide-descendants');
    expect(flat(title()).opacity).toBe(0);
    timing.mockClear();
    await act(async () => tree.update(<ProductHeader title="Selidba stana" back={noop} titleVisible />));
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: 180, useNativeDriver: true }));
    expect(title().props.accessibilityElementsHidden).toBe(false);
    expect(title().props.importantForAccessibility).toBe('auto');
  });

  // Review of step 5b (2026-09-24): the faded name stood in the bar at opacity 0, two lines of it, and held the bar at
  // 68 px at normal text and about 84 px at the owner's large font, with an empty band above the large title before any
  // scroll. It now lies over the copy area, one line, capped at 1.3, so the bar is its controls' height at every size.
  it('takes no height, hidden or shown, so the bar keeps one height at every text size', async () => {
    const long = 'Selidba trosobnog stana sa trećeg sprata bez lifta, uz pakovanje i odnošenje starog nameštaja';
    for (const visible of [false, true]) {
      await render(<ProductHeader title={long} back={noop} titleVisible={visible}
        right={<HeaderIconButton label="Više radnji" icon={MagnifyingGlass} onPress={noop} />} />);
      expect(flat(title())).toMatchObject({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center' });
      expect(header().props).toMatchObject({ numberOfLines: 1, maxFontSizeMultiplier: 1.3 });
      expect(header().props.children).toBe(long);
      // The copy area spans the controls' height and holds nothing in the flow: its first element is the laid-over title.
      const copy = hosts(node => flat(node).flex === 1 && flat(node).alignSelf === 'stretch')[0];
      expect(copy.findAll(node => typeof node.type === 'string' && node !== copy)[0].props.testID).toBe('chrome-title');
      // What does stand in the row is two fixed 48 px controls, inside the one 64 px bar.
      expect(flat(control('Nazad'))).toMatchObject({ width: 48, height: 48 });
      expect(flat(control('Više radnji'))).toMatchObject({ width: 48, height: 48 });
      expect(flat(bar())).toMatchObject({ minHeight: 64, paddingVertical: 8 });
      expect(flat(bar()).height).toBeUndefined();
      await act(async () => tree.unmount());
    }
    // A title that is always there is the only name on the screen, so it keeps its two lines and the chosen text size.
    await render(<DetailTopBar title={long} onBack={noop} />);
    expect(header().props.numberOfLines).toBe(2);
    expect(header().props.maxFontSizeMultiplier).toBeUndefined();
    expect(hosts(node => node.props.testID === 'chrome-title')).toHaveLength(0);
  });

  it('is simply there under reduced motion', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render(<ProductHeader title="Selidba stana" back={noop} titleVisible={false} />);
    await act(async () => tree.update(<ProductHeader title="Selidba stana" back={noop} titleVisible />));
    expect(timing).not.toHaveBeenCalled();
    expect(flat(title()).opacity).toBe(1);
  });

  it('turns on and off only when the content title crosses the line', async () => {
    let state: ReturnType<typeof useChromeTitleOnScroll> | undefined; let renders = 0;
    function Probe() { state = useChromeTitleOnScroll(72); renders++; return null; }
    await render(<Probe />);
    const scroll = (y: number) => act(async () => state!.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } } as never));
    expect(state!.titleVisible).toBe(false);
    await scroll(40); const before = renders; await scroll(60);
    expect(renders).toBe(before);
    await scroll(80); expect(state!.titleVisible).toBe(true);
    await scroll(10); expect(state!.titleVisible).toBe(false);
  });
});

describe('flow', () => {
  it('has the close X and says where you are in the flow', async () => {
    const close = jest.fn();
    await render(<ScreenChrome variant="flow" title="Novi zadatak" step="Korak 2 od 4" onClose={close} />);
    expect(control('Zatvori').props.accessibilityRole).toBe('button');
    expect(texts()).toEqual(['Novi zadatak', 'Korak 2 od 4']);
    await act(async () => press('Zatvori').props.onPress());
    expect(close).toHaveBeenCalledTimes(1);
  });
});
