import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useBreath } from './Arrive';
import { sys, cardCompact } from './tokens';

/** Placeholder that matches the final geometry; the list breathes as one while it waits (V41), never per block. */
function SkeletonBlock({ width, height, radius = 8 }: { width: DimensionValue; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: sys.color.skeleton }} />;
}
/**
 * One line of text as a block, centred in the line's own height so rows keep their measure. A share of the width
 * ("60%") takes the rest of its row first, so the share has a width to be measured against.
 */
function SkeletonLine({ width, line, height }: { width: DimensionValue; line: number; height: number }) {
  return <View style={[s.line, { minHeight: line }, typeof width === 'string' && s.grow]}><SkeletonBlock width={width} height={height} radius={6} /></View>;
}

/**
 * Which card is coming. `task` is the task card of the Zadaci and Moji zadaci lists (card review r3 item 11, after its
 * foot gained a 32 px avatar and two lines): the title with its value beside it, the fact lines with their 16 px
 * drawings, and the foot with the count on the left and the person on the right, at TaskCard's own padding, gaps and line
 * heights, so the list does not jump when its rows arrive. `plain` is every other card (a Prijava, a Dogovor, a task's
 * detail, legal documents, the export): a title and its lines over a quiet foot, with no person drawn, because what
 * arrives there has none in that place (verifier r3b vc, nit 4).
 */
export type SkeletonVariant = 'plain' | 'task';

export function SkeletonCard({ rows = 2, variant = 'plain' }: { rows?: number; variant?: SkeletonVariant }) {
  if (variant === 'plain') return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.plain}>
    <SkeletonBlock width="78%" height={22} radius={7} />
    {Array.from({ length: rows }, (_, index) => <SkeletonBlock key={index} width={index ? '44%' : '60%'} height={14} radius={6} />)}
    <View style={s.plainFoot}><SkeletonBlock width={112} height={24} radius={7} /><SkeletonBlock width={58} height={18} radius={6} /></View>
  </View>;
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.card}>
    <View style={s.head}>
      <SkeletonLine width="78%" line={22} height={18} />
      <SkeletonLine width={72} line={22} height={18} />
    </View>
    <View style={s.facts}>
      {Array.from({ length: rows }, (_, index) => <View key={index} style={s.fact}>
        <SkeletonBlock width={16} height={16} radius={sys.radius.pill} />
        <SkeletonLine width={index ? '44%' : '60%'} line={19} height={13} />
      </View>)}
    </View>
    <View style={s.foot}>
      <View style={s.fact}><SkeletonBlock width={16} height={16} radius={sys.radius.pill} /><SkeletonLine width={96} line={19} height={13} /></View>
      <View style={s.person}>
        <SkeletonBlock width={32} height={32} radius={sys.radius.pill} />
        <View><SkeletonLine width={84} line={17} height={12} /><SkeletonLine width={48} line={17} height={12} /></View>
      </View>
    </View>
  </View>;
}

export function SkeletonList({ count = 3, rows, variant }: { count?: number; rows?: number; variant?: SkeletonVariant }) {
  const opacity = useBreath();
  return <Animated.View style={[s.list, { opacity }]}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={index} rows={rows} variant={variant} />)}</Animated.View>;
}

const s = StyleSheet.create({
  // The plain card: the card frame, its lines 10 apart, and a quiet foot under a hairline.
  plain: { ...cardCompact, gap: 10 },
  plainFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: sys.color.line },
  // TaskCard's frame and body: the card corner and hairline, 16 across, 15 over and 14 under, 8 between the lines.
  card: { ...cardCompact, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14, gap: 8 },
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  line: { justifyContent: 'center' },
  facts: { gap: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { gap: 12 },
});
