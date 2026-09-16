import { ScrollView, StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from './tokens';

export type SegmentedOption<K extends string> = { key: K; label: string; /** Optional count shown beside the label; not part of the spoken label. */ badge?: number | string };

/**
 * Segmented control (V4.9 segment): a quiet track, the selected segment is a white
 * pill with heavier type, so shape and weight carry the state, never colour alone.
 * Each segment is a tab for screen readers. One segmented control per screen: it
 * answers which set is shown, never which filter is on.
 */
export function Segmented<K extends string>({ options, value, onChange, scroll = false, style }: {
  options: readonly SegmentedOption<K>[]; value: K; onChange: (key: K) => void; scroll?: boolean; style?: object;
}) {
  const items = options.map(option => {
    const selected = option.key === value;
    return <Press key={option.key} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected }}
      haptic="select" scaleTo={0.98} onPress={() => { if (!selected) onChange(option.key); }} style={[s.segment, selected && s.selected]}>
      <T variant="meta" style={[s.text, selected && s.selectedText]}>{option.label}</T>
      {option.badge !== undefined && option.badge !== null ? <View style={s.badge}>
        <T variant="label" style={s.badgeText}>{String(option.badge)}</T></View> : null}
    </Press>;
  });
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={style}
    contentContainerStyle={s.track}>{items}</ScrollView>;
  return <View accessibilityRole="tablist" style={[s.track, style]}>{items}</View>;
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', gap: 3, padding: 4, borderRadius: 14, backgroundColor: sys.color.control },
  segment: { flexGrow: 1, flexBasis: 0, minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  selected: { backgroundColor: sys.color.surface, shadowColor: '#183F35', shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  text: { color: sys.color.muted, fontWeight: '600', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  selectedText: { color: sys.color.ink, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: sys.color.orange, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: sys.color.onOrange, lineHeight: 14, letterSpacing: 0 },
});
