import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { useReducedMotion } from './motion';
import { nested, sys } from './tokens';

export type SegmentedOption<K extends string> = { key: K; label: string; /** Optional count shown beside the label. */ badge?: number | string;
  /** The caller owns what is counted (all records or only those waiting for a choice). */ badgeLabel?: string;
  /** A set that needs the person ("Čeka te") keeps an orange count; every other count is quiet (V41). */ badgeTone?: 'attention' };

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * Segmented control (V4.9 segment): a quiet track, the selected segment is a white
 * pill with heavier type, so shape and weight carry the state, never colour alone.
 * Each segment is a tab for screen readers. One segmented control per screen: it
 * answers which set is shown, never which filter is on.
 *
 * The fixed pill and underline use measured native transforms. Selection semantics change immediately;
 * the indicator follows over the toggle duration, or settles immediately under reduced motion. Until
 * the selected segment is measured it paints its own selection, so the first frame is never empty.
 */
export function Segmented<K extends string>({ options, value, onChange, scroll = false, style, appearance = 'pill' }: {
  options: readonly SegmentedOption<K>[]; value: K; onChange: (key: K) => void; scroll?: boolean; style?: object;
  appearance?: 'pill' | 'underline';
}) {
  const underline = appearance === 'underline';
  const sliding = !scroll || underline;
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<K, { x: number; width: number }>>>({});
  const target = sliding ? layouts[value] : undefined;
  const translateX = useRef(new Animated.Value(0)).current;
  const lineWidth = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!target) return;
    // A one-dp line scales around its centre. Moving that centre keeps both edges aligned to the
    // measured tab, including after a count or larger text changes its width. Both run natively.
    const x = underline ? target.x + (target.width - 1) / 2 : target.x;
    if (!placed.current || reduced) {
      translateX.setValue(x); lineWidth.setValue(target.width); placed.current = true; return;
    }
    const config = { duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true };
    const slide = Animated.parallel([
      Animated.timing(translateX, { ...config, toValue: x }),
      ...(underline ? [Animated.timing(lineWidth, { ...config, toValue: target.width })] : []),
    ]);
    slide.start();
    return () => slide.stop();
  }, [target?.x, target?.width, underline, reduced, translateX, lineWidth]); // eslint-disable-line react-hooks/exhaustive-deps
  const measure = (key: K) => (event: LayoutChangeEvent) => {
    if (!sliding) return;
    const { x, width } = event.nativeEvent.layout;
    if (width <= 0) return;
    setLayouts(current => current[key]?.x === x && current[key]?.width === width ? current : { ...current, [key]: { x, width } });
  };
  const items = options.map(option => {
    const selected = option.key === value;
    return <Press key={option.key} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected }}
      accessibilityValue={option.badge != null && option.badgeLabel ? { text: option.badgeLabel } : undefined}
      haptic="select" scaleTo={0.98} onPress={() => { if (!selected) onChange(option.key); }} onLayout={measure(option.key)}
      style={[s.segment, underline ? s.underlineSegment : selected && !target && s.selected, underline && selected && !target && s.underlineSelected]}>
      <T variant="meta" style={[s.text, selected && s.selectedText]}>{option.label}</T>
      {option.badge !== undefined && option.badge !== null ? <View style={[s.badge, option.badgeTone === 'attention' ? s.badgeAttention : selected ? s.badgeSelected : null]}>
        <T variant="label" style={[s.badgeText, option.badgeTone === 'attention' ? s.badgeTextAttention : selected ? s.badgeTextSelected : null]}>{String(option.badge)}</T></View> : null}
    </Press>;
  });
  const indicator = target ? <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants"
    style={underline ? [s.underlineIndicator, { transform: [{ translateX }, { scaleX: lineWidth }] }]
      : [s.indicator, { width: target.width, transform: [{ translateX }] }]} /> : null;
  // The track is the grey band, and when the segments scroll it has to be the part that stays put.
  // Putting it on the scrolling content made the band end wherever the last visible segment did,
  // mid-word, so a control that scrolls looked like a control that was cut off.
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist"
    style={[s.track, underline && s.underlineTrack, style]} contentContainerStyle={s.scrollRow}>
    {underline ? <View style={s.underlineScrollRow}>{indicator}{items}</View> : items}
  </ScrollView>;
  return <View accessibilityRole="tablist" style={[s.track, underline && s.underlineTrack, style]}>
    {indicator}
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
  underlineScrollRow: { flexDirection: 'row', alignItems: 'stretch', gap: 20 },
  underlineIndicator: { position: 'absolute', left: 0, bottom: 0, width: 1, height: 3, backgroundColor: sys.color.green },
  underlineSegment: { flexGrow: 0, flexBasis: 'auto', minHeight: 48, paddingHorizontal: 4, borderRadius: 0, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  underlineSelected: { borderBottomColor: sys.color.green },
  text: { ...sys.type.tab, color: sys.color.muted, textAlign: 'center' },
  selectedText: { color: sys.color.ink, fontWeight: '700' },
  // V41 counts are quiet: grey beside an unselected set, green on the chosen one; orange only for what needs me.
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: sys.radius.badge, backgroundColor: sys.color.control, alignItems: 'center', justifyContent: 'center' },
  badgeSelected: { backgroundColor: sys.color.greenSoft },
  badgeAttention: { backgroundColor: sys.color.orange },
  badgeText: { color: sys.color.muted, lineHeight: 14, letterSpacing: 0 },
  badgeTextSelected: { color: sys.color.green },
  badgeTextAttention: { color: sys.color.onOrange },
});
