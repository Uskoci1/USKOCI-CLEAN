import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useBreath } from './Arrive';
import { sys, cardCompact } from './tokens';

/** Placeholder that matches the final geometry; the list breathes as one while it waits (V41), never per block. */
function SkeletonBlock({ width, height, radius = 8 }: { width: DimensionValue; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: sys.color.skeleton }} />;
}

/** Same anatomy as TaskCard / the Agreement card so the list does not jump when rows arrive. */
export function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.card}>
    <SkeletonBlock width="78%" height={22} radius={7} />
    {Array.from({ length: rows }, (_, index) => <SkeletonBlock key={index} width={index ? '44%' : '60%'} height={14} radius={6} />)}
    <View style={s.foot}><SkeletonBlock width={112} height={24} radius={7} /><SkeletonBlock width={58} height={18} radius={6} /></View>
  </View>;
}

export function SkeletonList({ count = 3, rows }: { count?: number; rows?: number }) {
  const opacity = useBreath();
  return <Animated.View style={[s.list, { opacity }]}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={index} rows={rows} />)}</Animated.View>;
}

const s = StyleSheet.create({
  card: { ...cardCompact, gap: 10 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: sys.color.line },
  list: { gap: 12 },
});
