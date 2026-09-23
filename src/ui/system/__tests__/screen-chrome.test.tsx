import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// The bell reads the inbox; the root bar only has to hold it.
jest.mock('../../InboxBell', () => ({ InboxBell: () => require('react').createElement('Bell') }));

import { MagnifyingGlass } from 'phosphor-react-native';
import { chrome, ScreenChrome, useChromeTitleOnScroll } from '../ScreenChrome';
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
    expect(flat(control('Pretraga')).backgroundColor).toBe(sys.color.greenSoft);
    await act(async () => tree.update(<HeaderIconButton label="Pretraga" icon={MagnifyingGlass} onPress={noop} />));
    expect(press('Pretraga').props.accessibilityState).toEqual({ selected: false });
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
