import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Icon } from 'phosphor-react-native';
import { T } from '../Text';
import { card, sys } from './tokens';
import { Disclosure } from './Disclosure';
import { FactArt, type FactArtKind } from './FactArt';

/**
 * Detail-screen primitives shared by Task, Opportunity and Dogovor screens (V5
 * "Jedna objava" composition): a quiet top bar, a "what happens next" strip, a
 * two-column fact grid with hairlines, section titles and disclosure rows.
 * Presentation only; every callback belongs to the route.
 */

/** Back well + the screen name. The real title is the hero below, so this one stays small. */
// The detail screens had their own copy of the top bar. It is the one chrome's detail bar now; it is
// re-exported here so these screens' imports stay one line.
export { DetailTopBar } from './DetailTopBar';

/** One line that says what happens next, with a quiet sentence under it. */
export function NextStrip({ icon: IconComponent, art, title, detail, tone = 'green' }: {
  icon?: Icon; /** The coloured illustration the rest of the screen uses; wins over `icon`. */ art?: FactArtKind;
  title: string; detail?: string; tone?: 'green' | 'warn' | 'muted';
}) {
  const color = tone === 'warn' ? sys.color.warn : tone === 'muted' ? sys.color.muted : sys.color.green;
  return <View style={s.strip}>
    {art ? <FactArt kind={art} size={28} /> : IconComponent ? <IconComponent size={20} color={color} /> : null}
    <View style={s.grow}><T variant="meta" style={[s.stripTitle, { color }]}>{title}</T>{detail ? <T variant="note" tone="muted">{detail}</T> : null}</View>
  </View>;
}

/** Two columns of facts separated by hairlines. Put `wide` facts on their own row. */
export function FactGrid({ children }: { children: ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

export function Fact({ icon: IconComponent, label, value, note, wide = false, money = false }: {
  icon?: Icon; label: string; value: string; note?: string; wide?: boolean; money?: boolean;
}) {
  return <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} style={[s.fact, wide && s.factWide]}>
    <View style={s.factLabel}>{IconComponent ? <IconComponent size={16} color={sys.color.muted} /> : null}<T variant="meta" tone="muted">{label}</T></View>
    <T style={[s.factValue, money && s.factMoney]}>{value}</T>
    {note ? <T variant="note" tone="muted">{note}</T> : null}
  </View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <T accessibilityRole="header" variant="heading" style={s.section}>{children}</T>;
}

/** Rows that open more detail in place, inside one card; each row is the one `Disclosure`, and `expanded` is spoken. */
export function DisclosureGroup({ children }: { children: ReactNode }) {
  return <View style={s.group}>{children}</View>;
}

export function DisclosureRow({ label, detail, expanded, onPress, first = false, children }: {
  label: string; detail?: string; expanded: boolean; onPress: () => void; first?: boolean; children?: ReactNode;
}) {
  return <Disclosure label={label} hint={detail} expanded={expanded} onToggle={onPress} divider={!first} inset>{children}</Disclosure>;
}

/** Label / value pairs inside an expanded row. */
export function DetailPairs({ rows }: { rows: { label: string; value: string }[] }) {
  return <View style={s.pairs}>{rows.map((row, index) => <View key={`${index}:${row.label}`} style={s.pair}>
    <T variant="meta" tone="muted">{row.label}</T><T variant="body" style={s.ink}>{row.value}</T>
  </View>)}</View>;
}

/** A quiet note on a wash surface, for privacy and other boundaries. */
export function QuietNote({ children }: { children: ReactNode }) {
  return <View style={s.note}><T variant="note" tone="muted">{children}</T></View>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 }, ink: { color: sys.color.ink },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 13, borderRadius: sys.radius.control, backgroundColor: sys.color.wash, borderWidth: 1, borderColor: '#E1EBE3' },
  stripTitle: { fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: sys.color.line },
  fact: { width: '50%', paddingVertical: 14, paddingRight: 12, gap: 6, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  factWide: { width: '100%' },
  factLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factValue: { ...sys.type.bodyStrong, color: sys.color.ink },
  factMoney: { ...sys.type.priceLarge, color: sys.color.money },
  section: { color: sys.color.ink, marginTop: 6 },
  group: { ...card, padding: 0, overflow: 'hidden' },
  pairs: { gap: 10 }, pair: { gap: 2 },
  note: { borderRadius: sys.radius.control, backgroundColor: sys.color.wash, paddingVertical: 12, paddingHorizontal: 14 },
});
