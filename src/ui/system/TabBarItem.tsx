import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type TextProps, type ViewStyle } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt, type FactArtKind } from './FactArt';
import { useReducedMotion } from './motion';
import { useTextScale } from './textScale';
import { nested, sys } from './tokens';

/**
 * The parts of the bottom tab bar (UI/UX pass, wave 2, item 2.1; audits HP-03, ICO-06, MO-M11). The bar used to be a background
 * colour that swapped on the tapped tab in one frame, an icon that was a pure function of "selected" (the same heavy grey 3D
 * object when inactive, a snap to colour when chosen) and a 12/16 label with its own letter spacing, so the one control that is
 * on screen in every root felt static and did not say clearly where you are. Now:
 *
 * - THE CAPSULE of the chosen tab is a child of the button that is always mounted, and fades in or out over `sys.motion.toggle`
 *   (180 ms, ease-out). A 20 by 3 green pill sits on its top edge, the one brand mark of the bar; the capsule is a neutral well
 *   (about 1.1:1 on white, so the pill and the green label carry the selection).
 * - THE ICON is the flat `mark` cut in the `quiet` tone at rest and the `art` sticker in the brand tone when chosen. Both are
 *   mounted and cross-fade, and the chosen one pops once, 1.0 to 1.08 to 1.
 * - THE LABEL is the existing `tab` type variant (14 on 20, 600), not the 12 on 16 label.
 * - THE HEIGHT follows the icon size and the label height that was measured (`tabBarHeight`), so a large font does not clip a
 *   label and the 48 px control stays whole.
 *
 * MOTION (B22, the flood of dead Reanimated native views; rules R1, R2, R4, R7 of `sys.motion`): React Native Animated on the
 * NATIVE driver, opacity and transform only, never a Reanimated layout or entering or exiting animation and nothing laid out
 * while it moves. Under reduced motion every change is instant. Nothing runs when the bar is first drawn, only when the
 * selection changes. The accessibility state (`selected`) is the button's and never waits for any of it.
 *
 * Not here on purpose: an attention dot (no existing server-owned read feeds one), a second Press scale on top of the capsule
 * (the button is `scaleTo={1}`: one motion, one Reanimated view fewer per tab), and the scene transition between tabs (item 2.2,
 * waiting for the owner's recordings).
 *
 * STATE AND HOW TO CONTINUE (for whoever picks this up with no memory of the session). Proof level: SOURCE and jest only (the unit
 * suite `__tests__/tab-bar-item.test.tsx`, the real navigator in `tab-bar-navigator.test.tsx`, the layout contract in
 * `__tests__/tabLayoutSafeAreaContract.test.ts`); no frame of this has been seen moving on a device. The judge is the owner's HONOR
 * (361 dp, text 1.15; also 1.3): the checklist is `verifyOnPhone` of wave W2 in
 * `docs/implementation/ui-ux-pass-20261002/UIUX_PLAN_20261002.json`, and the same bar can be tapped on `uskociapp://dizajn-tabla`
 * (internal build). Open on purpose: (1) the scene change between tabs is still the navigator's `animation: 'none'` (item 2.2); (2)
 * there is no pressed look before the finger lifts; navigation is silent per owner U10 (any additional feedback must be visual,
 * not a touch-down tick); (3) the icon is 30, off the 16/20/24/32
 * ladder, because `tabBarHeight` is exact for it (change the size and the formula together); (4) `(app)/_layout.tsx` still reads
 * the window width itself for `roomyLabels` (it equals `useLayoutClass().stacked`; its line in `one-token-source.test.ts` goes with it).
 */

/** The picture of a tab. 30 is above the 24 where the flat cut ends, so the sticker is a real sticker and the mark is forced. */
export const TAB_ICON = 30;
/** Between the picture and the label. */
export const TAB_LABEL_GAP = 3;
/** What the tab navigator keeps beside the icon and the label of every tab (its own `padding: 5`): the two sides. */
export const TAB_ITEM_PADDING = 5;
/**
 * Above the icon and under the label. The navigator keeps 5 and 5; the bar keeps 7 and 3, which add up to the same 10, so it is exactly
 * as high. It was looked at on a static mock drawn from the real pictures and Inter at 361 dp and text 1.15 (a layout check, not the
 * phone): with 5 and 5 the green pill (3 high, on the capsule's top edge) stood under 3 dp above the top of the Dogovori bubble, and the
 * picture and the word sat low in the capsule (about 10 dp from the baseline to the capsule's foot against 6 from its top to the picture).
 * Two dp move from under the label to over the icon: the pill has air and the content stands in the middle. The word keeps 3 dp of its
 * own under it (the capsule's rounded foot never sits on a letter) and the whole tab is still the touch.
 */
export const TAB_ITEM_TOP = 7;
export const TAB_ITEM_BOTTOM = 3;
/** The pill on the capsule's top edge. */
export const TAB_INDICATOR = { width: 20, height: 3 } as const;
/** The one pop of a chosen icon. */
export const TAB_POP = 1.08;

/**
 * The selected tab's capsule sits inside the bar, `TAB_BAR_PADDING` in from its edge, so its corner is the bar's corner
 * minus that padding: a nested corner follows the outer line. The same 24 inside a 24 bar did not (round 2c).
 */
export const TAB_BAR_PADDING = 4;
export const TAB_CAPSULE = nested(sys.radius.card, TAB_BAR_PADDING);

/** The look of the bar itself: the floating white surface with its hairline. The layout adds the height and the margins. */
export const tabBarSurface = {
  ...sys.elevation.soft, backgroundColor: sys.color.surface, borderColor: sys.color.line, borderWidth: 1,
  borderRadius: sys.radius.card, padding: TAB_BAR_PADDING,
} satisfies ViewStyle;

/**
 * The bar as high as its content needs: icon, gap, the room above the icon and under the label (`TAB_ITEM_TOP` and `TAB_ITEM_BOTTOM`),
 * the bar's own padding and the label's height (the larger of what the text size predicts and what was measured), in whole dp, and
 * never under the 70 every earlier bar had. Icon 30 + gap 3 + 7 + 3 + 2 x 4 + a 20 px label = 71. (The icon box the navigator draws
 * is 28 high and the bar's hairline takes 2: the two cancel, so 30 is the icon's own size and the sum is exact.)
 */
export function tabBarHeight(labelHeight: number, barPadding: number): number {
  return Math.max(70, Math.ceil(TAB_ICON + TAB_LABEL_GAP + TAB_ITEM_TOP + TAB_ITEM_BOTTOM + barPadding * 2 + labelHeight));
}

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * 1 while `selected` and 0 while not, and the value follows a change over the toggle token on the native driver. Nothing is
 * started when the component first mounts (the value is already right), and under reduced motion a change is set at once.
 */
function useSelection(selected: boolean): Animated.Value {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(selected ? 1 : 0));
  const mounted = useRef(false);
  useEffect(() => {
    const target = selected ? 1 : 0;
    if (reduced) { value.setValue(target); return; }
    if (!mounted.current) { mounted.current = true; return; }
    const run = Animated.timing(value, { toValue: target, duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [selected, reduced, value]);
  return value;
}

/**
 * The chosen tab's capsule: always mounted, an absolute fill of the button that never takes a touch, fading with the selection.
 * `radius` is the capsule corner (`TAB_CAPSULE`), passed in so the bar and its corner agree in one place.
 */
export function TabCapsule({ selected, radius }: { selected: boolean; radius: number }) {
  const shown = useSelection(selected);
  return <Animated.View testID="tab-capsule" pointerEvents="none" style={[s.capsule, { borderRadius: radius, opacity: shown }]}>
    <View testID="tab-indicator" style={s.indicator} />
  </Animated.View>;
}

/**
 * The picture of a tab: the flat mark at rest and the sticker when chosen, both mounted, cross-fading over the toggle token,
 * and one pop (1.0 to 1.08 to 1) when the tab becomes the chosen one: never when it is first drawn and never on the way out.
 */
export function TabGlyph({ kind, selected }: { kind: FactArtKind; selected: boolean }) {
  const reduced = useReducedMotion();
  const sticker = useSelection(selected);
  const mark = useMemo(() => sticker.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), [sticker]);
  const [pop] = useState(() => new Animated.Value(1));
  const was = useRef(selected);
  useEffect(() => {
    const rose = selected && !was.current;
    was.current = selected;
    // Anything that is not a rise puts the scale back at rest (and stops a pop that a quick second tap interrupted).
    if (!rose || reduced) { pop.setValue(1); return; }
    const run = Animated.sequence([
      Animated.timing(pop, { toValue: TAB_POP, duration: sys.motion.press, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [selected, reduced, pop]);
  return <Animated.View testID="tab-glyph" style={[s.glyph, { transform: [{ scale: pop }] }]}>
    <Animated.View testID="tab-glyph-mark" style={[s.layer, { opacity: mark }]}>
      <FactArt kind={kind} size={TAB_ICON} cut="mark" tone="quiet" />
    </Animated.View>
    <Animated.View testID="tab-glyph-art" style={[s.layer, { opacity: sticker }]}>
      <FactArt kind={kind} size={TAB_ICON} cut="art" tone="brand" />
    </Animated.View>
  </Animated.View>;
}

/**
 * The name under the picture: the `tab` variant, green when chosen and muted at rest. Never shrunk and never cut; the person's
 * text size decides, and `onTextLayout` hands the measured lines on so the bar's height can follow.
 */
export function TabLabel({ children, selected, onTextLayout }: { children: ReactNode; selected: boolean; onTextLayout?: TextProps['onTextLayout'] }) {
  return <T variant="tab" tone={selected ? 'green' : 'muted'} onTextLayout={onTextLayout} style={s.label}>{children}</T>;
}

const PREVIEW: readonly { kind: FactArtKind; title: string }[] = [
  { kind: 'home', title: 'Početna' }, { kind: 'map', title: 'Zadaci' }, { kind: 'agreements', title: 'Dogovori' },
];

/**
 * The bar drawn by hand from the same parts, for the design board on the phone (`uskociapp://dizajn-tabla`, internal build): three
 * tabs that can be tapped, so the owner can feel the capsule, the pill, the cross-fade and the pop and compare them with the
 * build already on his phone. It holds no navigation and no data. The real bar's layout is the navigator's; this one mirrors it
 * (the 31 by 28 box the icon stands in, the tab padding and corner), and the height is the same `tabBarHeight`.
 */
export function TabBarPreview() {
  const [chosen, setChosen] = useState(0);
  const labelHeight = sys.type.tab.lineHeight * useTextScale();
  return <View style={[tabBarSurface, s.preview, { height: tabBarHeight(labelHeight, TAB_BAR_PADDING) }]}>
    {PREVIEW.map((tab, index) => <Press key={tab.kind} accessibilityRole="tab" accessibilityLabel={tab.title}
      accessibilityState={{ selected: chosen === index }} onPress={() => setChosen(index)} haptic="none" scaleTo={1}
      hitSlop={0} style={s.previewTab}>
      <TabCapsule selected={chosen === index} radius={TAB_CAPSULE} />
      <View style={s.previewIcon}><TabGlyph kind={tab.kind} selected={chosen === index} /></View>
      <TabLabel selected={chosen === index}>{tab.title}</TabLabel>
    </Press>)}
  </View>;
}

const s = StyleSheet.create({
  capsule: { ...StyleSheet.absoluteFill, backgroundColor: sys.color.greenSoft },
  // On the capsule's top edge, centred; a full pill, so its ends are round.
  indicator: { position: 'absolute', top: 0, alignSelf: 'center', width: TAB_INDICATOR.width, height: TAB_INDICATOR.height,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  glyph: { width: TAB_ICON, height: TAB_ICON },
  layer: { ...StyleSheet.absoluteFill },
  label: { textAlign: 'center', marginTop: TAB_LABEL_GAP },
  preview: { flexDirection: 'row' },
  previewTab: { flex: 1, alignItems: 'center', paddingHorizontal: TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM,
    borderRadius: TAB_CAPSULE, overflow: 'hidden' },
  previewIcon: { width: 31, height: 28, alignItems: 'center', justifyContent: 'center' },
});
