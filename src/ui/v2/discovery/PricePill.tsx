import { StyleSheet, View } from 'react-native';
import { Lightning } from 'phosphor-react-native';
import type { PinLabel } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { sys } from '../../system/tokens';

/** What a pill on the map shows: one task's price label, or how many tasks share one point. */
export type PillContent = PinLabel | { text: string; tone: 'count'; spoken: string };

/**
 * A pin that says something (round-1 critique B10, 2026-09-24): a white pill with the hairline, the amount in the money
 * colour at the meta size (13, on a 16 line) semibold. A task that asks for offers says "Ponude" in the quiet grey at a
 * lighter weight, so a word about money never looks like an amount; a task without a price is a small grey dot and
 * nothing else. Several tasks on one point say how many ("3 zadatka"), in ink. HITNO keeps its danger cue, the lightning
 * and a danger edge. The chosen pin is the green pill with white words. Drawn by the map as a picture: nothing here moves.
 */
export function PricePill({ content, urgent = false, selected = false }: { content: PillContent; urgent?: boolean; selected?: boolean }) {
  const words = content.tone === 'none' ? null : content.text;
  return <View collapsable={false} style={s.frame}>
    <View testID="price-pill" style={[s.pill, !words && s.dotOnly, urgent && s.urgent, selected && s.selected]}>
      {urgent ? <Lightning size={12} weight="fill" color={selected ? sys.color.onGreen : sys.color.danger} /> : null}
      {words ? <T variant="meta" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[s.text, TONE[content.tone], selected && s.onGreen]}>{words}</T>
        : <View style={[s.dot, selected && s.dotSelected]} />}
    </View>
  </View>;
}

const s = StyleSheet.create({
  // Room around the pill for its lift: the map draws the annotation as a picture of exactly this frame.
  frame: { padding: sys.space.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 30, paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface,
    shadowColor: sys.color.ink, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  dotOnly: { paddingHorizontal: 9 },
  urgent: { borderColor: sys.color.danger },
  selected: { backgroundColor: sys.color.green, borderColor: sys.color.green },
  // The meta size (13), set a little tighter so the pill stays a small mark on the map.
  text: { lineHeight: 16, letterSpacing: 0, fontVariant: ['tabular-nums'] },
  onGreen: { color: sys.color.onGreen },
  dot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.muted },
  dotSelected: { backgroundColor: sys.color.onGreen },
});
/** Money is the money colour at the money weight; the offer word is grey and lighter; a count is ink. */
const TONE = StyleSheet.create({
  money: { color: sys.color.money, fontWeight: '600' },
  offer: { color: sys.color.muted, fontWeight: '500' },
  count: { color: sys.color.ink, fontWeight: '600' },
  none: { color: sys.color.muted, fontWeight: '500' },
});
