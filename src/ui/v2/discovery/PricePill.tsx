import { Image, StyleSheet, View } from 'react-native';
import { Lightning } from 'phosphor-react-native';
import type { PinLabel } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { sys } from '../../system/tokens';

/** What a pill on the map shows: one task's price label, or how many tasks share one point. */
export type PillContent = PinLabel | { text: string; tone: 'count'; spoken: string };

/**
 * A recognisable USKOČI mark and truthful terms, never an invented price. Offers stay quiet words and a missing price
 * leaves the mark on its own. Several tasks at the same public point retain their count. The white logo well keeps
 * the original two brand colours legible on a selected green capsule. MapLibre draws this view as a bitmap; camera
 * and sheet motion happen outside it, not in dozens of independently animated native annotations.
 */
export function PricePill({ content, urgent = false, selected = false, onReady }: {
  content: PillContent; urgent?: boolean; selected?: boolean;
  /** Android annotations are snapshots: refresh only after this bundled logo has actually loaded. */
  onReady?: () => void;
}) {
  const words = content.tone === 'none' ? null : content.text;
  return <View collapsable={false} style={s.frame}>
    <View testID="price-pill" style={[s.pill, !words && s.markOnly, urgent && s.urgent, selected && s.selected]}>
      <View style={s.mark} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Image source={require('../../../../assets/entry-splash-mark.png')} style={s.logo} resizeMode="contain" fadeDuration={0}
          accessible={false} onLoad={onReady} />
      </View>
      {urgent ? <Lightning size={14} weight="fill" color={selected ? sys.color.onGreen : sys.color.danger} /> : null}
      {words ? <T variant="meta" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[s.text, TONE[content.tone], selected && s.onGreen]}>{words}</T> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  // Room around the pill for its lift: the map draws the annotation as a picture of exactly this frame.
  frame: { padding: sys.space.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 40, paddingLeft: 4, paddingRight: sys.space.md, paddingVertical: 3,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface,
    shadowColor: sys.color.ink, shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  markOnly: { paddingRight: 4, minWidth: 40 },
  mark: { width: 34, height: 34, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 30, height: 30 },
  urgent: { borderColor: sys.color.danger },
  selected: { backgroundColor: sys.color.green, borderColor: sys.color.green },
  // The meta size (13), set a little tighter so the pill stays a small mark on the map.
  text: { lineHeight: 16, letterSpacing: 0, fontVariant: ['tabular-nums'] },
  onGreen: { color: sys.color.onGreen },
});
/** Money is the money colour at the money weight; the offer word is grey and lighter; a count is ink. */
const TONE = StyleSheet.create({
  money: { color: sys.color.money, fontWeight: '600' },
  offer: { color: sys.color.muted, fontWeight: '500' },
  count: { color: sys.color.ink, fontWeight: '600' },
  none: { color: sys.color.muted, fontWeight: '500' },
});
