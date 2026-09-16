import { ScrollView, StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from './tokens';

export type SegmentedOption<K extends string> = { key: K; label: string; /** Optional count shown beside the label; not part of the spoken label. */ badge?: number | string };

/**
 * Segmented control. The selected segment is a raised white pill with heavier
 * type — shape and weight, never color alone. Each segment is a tab for screen
 * readers, so the existing `accessibilityLabel` contract of every screen holds.
 */
export function Segmented<K extends string>({ options, value, onChange, scroll = false, style }: {
  options: readonly SegmentedOption<K>[]; value: K; onChange: (key: K) => void; scroll?: boolean; style?: object;
}) {
  const items = options.map(option => {
    const selected = option.key === value;
    return <Press key={option.key} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected }}
      haptic="select" scaleTo={0.98} onPress={() => { if (!selected) onChange(option.key); }} style={[s.segment, selected && s.selected]}>
      <T variant="action" style={[s.text, selected && s.selectedText]}>{option.label}</T>
      {option.badge !== undefined && option.badge !== null ? <View style={[s.badge, selected && s.badgeSelected]}>
        <T variant="label" style={[s.badgeText, selected && s.badgeTextSelected]}>{String(option.badge)}</T></View> : null}
    </Press>;
  });
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={style}
    contentContainerStyle={s.track}>{items}</ScrollView>;
  return <View accessibilityRole="tablist" style={[s.track, style]}>{items}</View>;
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: sys.radius.control + 2, backgroundColor: sys.color.control },
  segment: { flexGrow: 1, flexBasis: 0, minHeight: 44, minWidth: 64, paddingHorizontal: 12, paddingVertical: 10, borderRadius: sys.radius.control - 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  selected: { backgroundColor: sys.color.surface, ...sys.elevation.card },
  text: { color: sys.color.muted, fontWeight: '600', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  selectedText: { color: sys.color.ink, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  badgeSelected: { backgroundColor: sys.color.greenSoft },
  badgeText: { color: sys.color.muted, lineHeight: 14, letterSpacing: 0 }, badgeTextSelected: { color: sys.color.green },
});
