import { StyleSheet, View, type DimensionValue } from 'react-native';
import { sys } from './tokens';

/** Static placeholder that matches the final geometry. No shimmer: loading is frequent and motion here would be decoration. */
export function SkeletonBlock({ width, height, radius = 8 }: { width: DimensionValue; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: sys.color.skeleton }} />;
}

/** Same anatomy as TaskCard / the Agreement card so the list does not jump when rows arrive. */
export function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.card}>
    <SkeletonBlock width={96} height={12} />
    <SkeletonBlock width="82%" height={22} />
    {Array.from({ length: rows }, (_, index) => <SkeletonBlock key={index} width={index ? '48%' : '64%'} height={13} />)}
    <View style={s.bottom}><SkeletonBlock width={120} height={26} /><SkeletonBlock width={64} height={30} radius={10} /></View>
  </View>;
}

export function SkeletonList({ count = 3, rows }: { count?: number; rows?: number }) {
  return <View style={s.list}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={index} rows={rows} />)}</View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 18, gap: 10 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  list: { gap: 14 },
});
