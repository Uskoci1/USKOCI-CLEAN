import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { useReducedMotion } from './motion';
import { sys } from './tokens';
import { motion, nested } from '../../theme/tokens';

export type SegmentedOption<K extends string> = { key: K; label: string; /** Optional count shown beside the label; not part of the spoken label. */ badge?: number | string };

const EASE_OUT = Easing.bezier(...motion.easeOut);

/**
 * Segmented control (V4.9 segment): a quiet track, the selected segment is a white
 * pill with heavier type, so shape and weight carry the state, never colour alone.
 * Each segment is a tab for screen readers. One segmented control per screen: it
 * answers which set is shown, never which filter is on.
 *
 * In the fixed pill track the white pill slides to the chosen segment (2026-09-23): the switch is a
 * movement from one set to the other rather than a blink. It runs on the native driver, takes the
 * toggle duration, and jumps instead of sliding under reduced motion. Until the segments have been
 * measured, the chosen one paints its own pill, so the first frame is never empty.
 */
export function Segmented<K extends string>({ options, value, onChange, scroll = false, style, appearance = 'pill' }: {
  options: readonly SegmentedOption<K>[]; value: K; onChange: (key: K) => void; scroll?: boolean; style?: object;
  appearance?: 'pill' | 'underline';
}) {
  const underline = appearance === 'underline';
  const sliding = !scroll && !underline;
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<K, { x: number; width: number }>>>({});
  const target = sliding ? layouts[value] : undefined;
  const translateX = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!target) return;
    // The first placement is where the pill already is; only a change of segment moves.
    if (!placed.current || reduced) { translateX.setValue(target.x); placed.current = true; return; }
    const slide = Animated.timing(translateX, { toValue: target.x, duration: motion.toggle, easing: EASE_OUT, useNativeDriver: true });
    slide.start();
    return () => slide.stop();
  }, [target?.x, reduced, translateX]); // eslint-disable-line react-hooks/exhaustive-deps
  const measure = (key: K) => (event: LayoutChangeEvent) => {
    if (!sliding) return;
    const { x, width } = event.nativeEvent.layout;
    setLayouts(current => current[key]?.x === x && current[key]?.width === width ? current : { ...current, [key]: { x, width } });
  };
  const items = options.map(option => {
    const selected = option.key === value;
    return <Press key={option.key} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected }}
      haptic="select" scaleTo={0.98} onPress={() => { if (!selected) onChange(option.key); }} onLayout={measure(option.key)}
      style={[s.segment, underline ? s.underlineSegment : selected && !target && s.selected, underline && selected && s.underlineSelected]}>
      <T variant="meta" style={[s.text, selected && s.selectedText]}>{option.label}</T>
      {option.badge !== undefined && option.badge !== null ? <View style={s.badge}>
        <T variant="label" style={s.badgeText}>{String(option.badge)}</T></View> : null}
    </Press>;
  });
  // The track is the grey band, and when the segments scroll it has to be the part that stays put.
  // Putting it on the scrolling content made the band end wherever the last visible segment did,
  // mid-word, so a control that scrolls looked like a control that was cut off.
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist"
    style={[s.track, underline && s.underlineTrack, style]} contentContainerStyle={s.scrollRow}>{items}</ScrollView>;
  return <View accessibilityRole="tablist" style={[s.track, underline && s.underlineTrack, style]}>
    {target ? <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants"
      style={[s.indicator, { width: target.width, transform: [{ translateX }] }]} /> : null}
    {items}
  </View>;
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', gap: 3, padding: 4, borderRadius: sys.radius.control, backgroundColor: sys.color.control },
  scrollRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  segment: { flexGrow: 1, flexBasis: 0, minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: nested(sys.radius.control, 4),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  selected: { backgroundColor: sys.color.surface, shadowColor: sys.color.ink, shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  // Measured x is inside the track's padding box, so the pill starts at the track's left edge. No elevation: on
  // Android an elevated view is drawn above its non-elevated siblings, so the pill would cover the chosen label.
  // A hairline gives it the edge the shadow gives it on iOS.
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: nested(sys.radius.control, 4),
    backgroundColor: sys.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: sys.color.line,
    shadowColor: sys.color.ink, shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  underlineTrack: { padding: 0, gap: 20, borderRadius: 0, backgroundColor: sys.color.surface, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  underlineSegment: { flexGrow: 0, flexBasis: 'auto', minHeight: 48, paddingHorizontal: 4, borderRadius: 0, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  underlineSelected: { borderBottomColor: sys.color.green },
  text: { ...sys.type.tab, color: sys.color.muted, textAlign: 'center' },
  selectedText: { color: sys.color.ink, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: sys.color.onOrange, lineHeight: 14, letterSpacing: 0 },
});
