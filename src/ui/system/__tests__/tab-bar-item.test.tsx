import React from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
// The pictures are tested on their own (`fact-art.test.tsx`); here the tab only has to ask for the right cut and tone.
jest.mock('../FactArt', () => ({ FactArt: 'FactArt' }));

import { Press } from '../../Press';
import { TAB_BAR_PADDING, TAB_CAPSULE, TAB_ICON, TAB_INDICATOR, TAB_ITEM_BOTTOM, TAB_ITEM_PADDING, TAB_ITEM_TOP, TAB_LABEL_GAP, TAB_POP, TabBarPreview, TabCapsule, TabGlyph, TabLabel, tabBarHeight, tabBarSurface } from '../TabBarItem';
import { sys } from '../tokens';

/** Existing selection, motion and accessibility coverage, reconciled to the quiet four-tab chrome.
 * Both tones retain the same mark silhouette. Native-driver and reduced-motion behavior are unchanged. */
let tree: ReactTestRenderer;
beforeEach(() => { mockReduced = false; });
afterEach(async () => { await act(async () => tree?.unmount()); jest.restoreAllMocks(); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const byId = (testID: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === testID)[0];
const pictures = () => tree.root.findAll(node => node.type === ('FactArt' as unknown));
const layer = (cut: 'mark' | 'art') => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === `tab-glyph-${cut}`)[0];
const easeOut = Easing.bezier(...sys.motion.easeOut);

describe('the numbers the bar is built from', () => {
  it('uses compact drawings and spacing while retaining a visible selection marker', () => {
    expect([TAB_ICON, TAB_LABEL_GAP, TAB_ITEM_PADDING]).toEqual([24, 3, 3]);
    expect(TAB_INDICATOR).toEqual({ width: 18, height: 2 });
    expect(TAB_POP).toBe(1.04);
  });

  it('leaves room above the drawing for the marker and below the scalable label', () => {
    expect([TAB_ITEM_TOP, TAB_ITEM_BOTTOM]).toEqual([7, 5]);
    expect(TAB_ITEM_TOP - TAB_INDICATOR.height).toBeGreaterThanOrEqual(3);
    expect(TAB_ITEM_BOTTOM).toBeGreaterThanOrEqual(3);
  });

  it('makes the bar as high as the icon, the gap, the tab padding, the bar padding and the label actually need', () => {
    // Actual 28dp icon host + 3gap + 7top + 5bottom + 1hairline + scalable label.
    expect(tabBarHeight(sys.type.tab.lineHeight, TAB_BAR_PADDING)).toBe(64);
    expect(tabBarHeight(sys.type.tab.lineHeight * 1.15, TAB_BAR_PADDING)).toBe(67);
    expect(tabBarHeight(sys.type.tab.lineHeight * 1.3, TAB_BAR_PADDING)).toBe(70);
    // A two-line label at a large text size makes the bar grow with it; nothing is clipped.
    expect(tabBarHeight(64, TAB_BAR_PADDING)).toBe(108);
    // Minimum target stays whole, and every height rounds up to a whole dp.
    expect(tabBarHeight(0, TAB_BAR_PADDING)).toBe(56);
    expect(Number.isInteger(tabBarHeight(23.4, TAB_BAR_PADDING))).toBe(true);
    // The 48 px control stays whole inside it.
    expect(tabBarHeight(sys.type.tab.lineHeight, TAB_BAR_PADDING) - 2 * TAB_BAR_PADDING).toBeGreaterThanOrEqual(48);
  });
});

describe('the capsule of the chosen tab', () => {
  it('is always mounted, over the whole tab without a filled selection well, and never takes a touch', async () => {
    await render(<TabCapsule selected={false} radius={20} />);
    const capsule = byId('tab-capsule');
    expect(capsule).toBeDefined();
    expect(flat(capsule)).toMatchObject({ borderRadius: 20, position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 });
    expect(flat(capsule).backgroundColor).toBeUndefined();
    expect(capsule.props.pointerEvents).toBe('none');
    // Not selected: still there, fully transparent.
    expect(flat(capsule).opacity).toBe(0);
    // Chosen: the same element, and it is drawn fully opaque when the bar is first drawn with this tab chosen.
    await act(async () => tree.update(<TabCapsule selected radius={20} />));
    expect(byId('tab-capsule')).toBe(capsule);
    await act(async () => tree.unmount());
    await render(<TabCapsule selected radius={20} />);
    expect(flat(byId('tab-capsule')).opacity).toBe(1);
  });

  it('carries a compact green marker on its top edge, which fades with it', async () => {
    await render(<TabCapsule selected radius={20} />);
    const pill = flat(byId('tab-indicator'));
    expect(pill).toMatchObject({ width: TAB_INDICATOR.width, height: TAB_INDICATOR.height, backgroundColor: sys.color.green, position: 'absolute', top: 0, alignSelf: 'center' });
    expect(pill.borderRadius).toBeGreaterThanOrEqual(TAB_INDICATOR.height / 2);
    // It lives inside the capsule, so its opacity is the capsule's.
    expect(byId('tab-capsule').findAll(node => node.props.testID === 'tab-indicator').length).toBeGreaterThan(0);
  });

  it('fades over the toggle token on the native driver with an ease-out, only when the selection changes', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<TabCapsule selected={false} radius={20} />);
    expect(timing).not.toHaveBeenCalled(); // nothing moves when the bar is first drawn
    await act(async () => tree.update(<TabCapsule selected radius={20} />));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: sys.motion.toggle, useNativeDriver: true }));
    const easing = (timing.mock.calls[0][1] as { easing: (t: number) => number }).easing;
    expect(easing(0.5)).toBeCloseTo(easeOut(0.5), 6);
    await act(async () => tree.update(<TabCapsule selected radius={20} />)); // the same state again: nothing runs
    expect(timing).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<TabCapsule selected={false} radius={20} />));
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: sys.motion.toggle, useNativeDriver: true }));
  });

  it('under reduced motion is instant: no animation is started and the value is set at once', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    await render(<TabCapsule selected={false} radius={20} />);
    await act(async () => tree.update(<TabCapsule selected radius={20} />));
    expect(timing).not.toHaveBeenCalled();
    expect(flat(byId('tab-capsule')).opacity).toBe(1);
    await act(async () => tree.update(<TabCapsule selected={false} radius={20} />));
    expect(flat(byId('tab-capsule')).opacity).toBe(0);
  });
});

describe('the icon of a tab', () => {
  it('draws the same 24dp mark silhouette in quiet and brand tones', async () => {
    await render(<TabGlyph kind="home" selected={false} />);
    expect(pictures().map(node => node.props)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'home', size: TAB_ICON, cut: 'mark', tone: 'quiet' }),
      expect.objectContaining({ kind: 'home', size: TAB_ICON, cut: 'mark', tone: 'brand' }),
    ]));
    expect(pictures()).toHaveLength(2);
    expect(TAB_ICON).toBe(24);
  });

  it('shows the quiet mark at rest and brand mark when chosen, and keeps both mounted', async () => {
    await render(<TabGlyph kind="map" selected={false} />);
    expect([flat(layer('mark')).opacity, flat(layer('art')).opacity]).toEqual([1, 0]);
    // The same two layers stay mounted when the tab is chosen (that is what lets them cross-fade).
    const [mark, art] = [layer('mark'), layer('art')];
    await act(async () => tree.update(<TabGlyph kind="map" selected />));
    expect([layer('mark'), layer('art')]).toEqual([mark, art]);
    expect(pictures()).toHaveLength(2);
    // Drawn chosen from the start: the brand layer only (legacy art testID retained).
    await act(async () => tree.unmount());
    await render(<TabGlyph kind="map" selected />);
    expect([flat(layer('mark')).opacity, flat(layer('art')).opacity]).toEqual([0, 1]);
  });

  it('cross-fades over the toggle token on the native driver and pops once, 1.0 to 1.04 to 1, only on a selection', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const sequence = jest.spyOn(Animated, 'sequence');
    await render(<TabGlyph kind="agreements" selected={false} />);
    expect(timing).not.toHaveBeenCalled();
    expect(sequence).not.toHaveBeenCalled();
    await act(async () => tree.update(<TabGlyph kind="agreements" selected />));
    const calls = timing.mock.calls.map(([, config]) => config as { toValue: number; duration: number; useNativeDriver: boolean; easing: unknown });
    // The cross-fade over the toggle token, then the two legs of the pop: up to 1.04 over the press token, back to 1 over the toggle.
    expect(calls.map(call => [call.toValue, call.duration])).toEqual([[1, sys.motion.toggle], [TAB_POP, sys.motion.press], [1, sys.motion.toggle]]);
    expect(sequence).toHaveBeenCalledTimes(1);
    expect(calls.every(call => call.useNativeDriver === true && typeof call.easing === 'function')).toBe(true);
    // The pop never goes under 1 and never overshoots the 4 %.
    expect(Math.max(...calls.map(call => call.toValue))).toBe(TAB_POP);
    expect(Math.min(...calls.map(call => call.toValue))).toBeGreaterThanOrEqual(1);
  });

  it('does not pop when it is deselected, nor when it is drawn already selected', async () => {
    const sequence = jest.spyOn(Animated, 'sequence');
    const timing = jest.spyOn(Animated, 'timing');
    await render(<TabGlyph kind="home" selected />);
    expect(sequence).not.toHaveBeenCalled();
    expect(timing).not.toHaveBeenCalled();
    await act(async () => tree.update(<TabGlyph kind="home" selected={false} />));
    expect(sequence).not.toHaveBeenCalled();
    expect(timing.mock.calls.some(([, config]) => (config as { toValue: number }).toValue === TAB_POP)).toBe(false);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 0, duration: sys.motion.toggle }));
  });

  it('under reduced motion swaps at once: nothing is animated', async () => {
    mockReduced = true;
    const timing = jest.spyOn(Animated, 'timing');
    const sequence = jest.spyOn(Animated, 'sequence');
    await render(<TabGlyph kind="home" selected={false} />);
    await act(async () => tree.update(<TabGlyph kind="home" selected />));
    expect(timing).not.toHaveBeenCalled();
    expect(sequence).not.toHaveBeenCalled();
    expect([flat(layer('mark')).opacity, flat(layer('art')).opacity]).toEqual([0, 1]);
    expect(StyleSheet.flatten(byId('tab-glyph').props.style).transform).toEqual([{ scale: 1 }]);
  });
});

describe('the label of a tab', () => {
  it('is the tab type variant (14 on 20, 600), never the 12 on 16 label, in muted at rest and in ink when chosen', async () => {
    await render(<TabLabel selected={false}>Zadaci</TabLabel>);
    const text = () => tree.root.findAllByType(Text)[0];
    expect(flat(text())).toMatchObject({ fontSize: sys.type.tab.fontSize, lineHeight: sys.type.tab.lineHeight, color: sys.color.muted, textAlign: 'center', marginTop: TAB_LABEL_GAP });
    expect([sys.type.tab.fontSize, sys.type.tab.lineHeight, sys.type.tab.fontWeight]).toEqual([14, 20, '600']);
    // The weight is chosen by the font file: 600 is Inter SemiBold (the old label was 700 Bold).
    expect(flat(text()).fontFamily).toBe('Inter-SemiBold');
    expect(flat(text()).letterSpacing).toBeUndefined(); // the 0.6 of the old label variant is gone with the variant
    await act(async () => tree.update(<TabLabel selected>Zadaci</TabLabel>));
    expect(flat(text()).color).toBe(sys.color.ink);
    // It is never shrunk or cut: the person's text size decides.
    expect(text().props.numberOfLines).toBeUndefined();
    expect(text().props.adjustsFontSizeToFit).toBeUndefined();
  });

  it('hands its measured lines on, so the bar can follow them', async () => {
    const seen = jest.fn();
    await render(<TabLabel selected={false} onTextLayout={seen}>Dogovori</TabLabel>);
    const text = tree.root.findAllByType(Text)[0];
    const event = { nativeEvent: { lines: [{ y: 0, height: 20 }] } };
    text.props.onTextLayout(event);
    expect(seen).toHaveBeenCalledWith(event);
  });
});

describe('the preview the design board draws', () => {
  const tabs = () => tree.root.findAll(node => node.type === (Press as unknown));
  const chosen = () => tabs().filter(tab => tab.props.accessibilityState.selected).map(tab => tab.props.accessibilityLabel);

  it('is the real parts in a bar surface: the four tabs, the first chosen, with the padding, corner and capsule corner of the bar itself', async () => {
    await render(<TabBarPreview />);
    expect(tabs().map(tab => tab.props.accessibilityLabel)).toEqual(['Početna', 'Zadaci', 'Dogovori', 'Poruke']);
    expect(chosen()).toEqual(['Početna']);
    for (const tab of tabs()) {
      expect(tab.props).toMatchObject({ accessibilityRole: 'tab', haptic: 'none', scaleTo: 1, hitSlop: 0 });
      expect(tab.props.hapticOn).toBeUndefined();
      // The same room round the picture and the word as the real button (`TAB_ITEM_*`), so the pill has the air it has there.
      expect(flat(tab)).toMatchObject({ paddingHorizontal: TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM, borderRadius: TAB_CAPSULE });
    }
    expect(tabBarSurface).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.line, borderWidth: 0, borderTopWidth: 1, borderRadius: 0, padding: TAB_BAR_PADDING });
    expect(TAB_CAPSULE).toBe(0);
    expect(tree.root.findAll(node => node.type === (TabCapsule as unknown)).map(node => node.props.radius)).toEqual([TAB_CAPSULE, TAB_CAPSULE, TAB_CAPSULE, TAB_CAPSULE]);
  });

  it('moves the choice, the capsule and the icon together when a tab is tapped, and says so at once to a screen reader', async () => {
    await render(<TabBarPreview />);
    await act(async () => tabs()[1].props.onPress());
    expect(chosen()).toEqual(['Zadaci']);
    expect(tree.root.findAll(node => node.type === (TabCapsule as unknown)).map(node => node.props.selected)).toEqual([false, true, false, false]);
    expect(tree.root.findAll(node => node.type === (TabGlyph as unknown)).map(node => node.props.selected)).toEqual([false, true, false, false]);
    expect(tree.root.findAll(node => node.type === (TabLabel as unknown)).map(node => node.props.selected)).toEqual([false, true, false, false]);
    await act(async () => tabs()[2].props.onPress());
    expect(chosen()).toEqual(['Dogovori']);
  });
});

// B22 (a flood of dead Reanimated native views) and the one reduced-motion source: the source is the witness.
describe('how it is built', () => {
  const source = readFileSync(join(__dirname, '../TabBarItem.tsx'), 'utf8');
  const code = source.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('uses React Native Animated on the native driver, and no Reanimated, layout, entering or exiting animation', () => {
    expect(code).not.toMatch(/react-native-reanimated/);
    expect(code).not.toMatch(/\b(?:entering|exiting|layout)\s*=\s*\{/);
    expect(code).not.toMatch(/useNativeDriver:\s*false/);
    expect(code).toMatch(/useNativeDriver:\s*true/);
    expect(code).toMatch(/from 'react-native'/);
    expect(code).toMatch(/Animated\.timing/);
  });

  it('moves only opacity and transform, from tokens, and reads reduced motion from the one store', () => {
    expect(code).not.toMatch(/\b(?:width|height|top|left|right|bottom|margin\w*|padding\w*):\s*(?:\w+\.)?(?:shown|pop|fade)\b/);
    expect(code).toMatch(/sys\.motion\.toggle/);
    expect(code).toMatch(/sys\.motion\.easeOut/);
    expect(code).toMatch(/from '\.\/motion'/);
    expect(code).not.toMatch(/useSystemReducedMotion/);
  });

  it('spells no colour, duration or spring of its own', () => {
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(/\bduration:\s*[1-9]/);
    expect(code).not.toMatch(/\b(?:damping|dampingRatio|stiffness):\s*\d/);
    expect(code).not.toMatch(/Animated\.spring/);
  });
});
