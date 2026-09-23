import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft, CaretRight } from 'phosphor-react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { iconButton, sys } from '../system/tokens';
import { innerBar } from '../system/DetailTopBar';
import { T } from '../Text';
import { Press } from '../Press';

/**
 * Visual composition only. All data, permissions and callbacks belong to the caller.
 *
 * Same anatomy as DetailTopBar: the arrow, the screen's name when it has one that is not already
 * the content's own title, an optional line under it, one action on the right. A task screen passes
 * no title — the task's name is the title, drawn large by ProductTitle below (owner, 2026-09-23).
 */
export function ProductHeader({ title, subtitle, back, backLabel = 'Nazad', disabled = false, right }: {
  title?: string; subtitle?: string; back: () => void; backLabel?: string; disabled?: boolean; right?: ReactNode;
}) {
  return <View style={s.header}>
    <Press accessibilityRole="button" accessibilityLabel={backLabel} accessibilityState={{ disabled }}
      disabled={disabled} onPress={back} haptic="select" style={iconButton}>
      <ArrowLeft size={22} color={sys.color.ink} />
    </Press>
    <View style={s.factCopy}>
      {title ? <T accessibilityRole="header" variant="title" style={s.headerTitle}>{title}</T> : null}
      {subtitle ? <T variant="meta" tone="muted">{subtitle}</T> : null}
    </View>
    {right}
  </View>;
}

export function ProductTitle({ children }: { children: ReactNode }) {
  return <T accessibilityRole="header" style={s.title}>{children}</T>;
}

export function ProductSection({ title, children }: { title: string; children: ReactNode }) {
  return <View style={s.section}><T accessibilityRole="header" variant="heading" style={s.sectionTitle}>{title}</T>{children}</View>;
}

/** Full-width reading rows keep long locations, translated dates and enlarged text readable. */
export function ProductFact({ art, label, value, note, prominent = false, prominentAs = 'amount' }: {
  art: FactArtKind; label: string; value: string; note?: string; prominent?: boolean;
  /** A prominent fact is either money or a word about money ("Tražim ponude"); the word never wears the amount's dress. */
  prominentAs?: 'amount' | 'label';
}) {
  return <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} style={[s.fact, prominent && s.price]}>
    <FactArt kind={art} size={prominent ? 36 : 32} />
    <View style={s.factCopy}>
      {prominent ? <T variant="meta" tone="muted">{label}</T> : null}
      <T style={prominent ? (prominentAs === 'label' ? s.priceLabel : s.priceValue) : s.factValue}>{value}</T>
      {note ? <T variant="meta" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

export function ProductFacts({ children }: { children: ReactNode }) {
  return <View style={s.facts}>{children}</View>;
}

/** An explicit list: none of the requirements needed for deciding is hidden behind a disclosure. */
export function ProductRequirements({ rows, title = 'Važno za ovaj zadatak' }: {
  rows: { label: string; value: string }[]; title?: string;
}) {
  return <ProductSection title={title}>
    {rows.length ? <View style={s.requirements}>{rows.map((row, index) =>
      <View key={`${row.label}:${index}`} style={s.requirement}>
        <View style={s.requirementDot} />
        <View style={s.factCopy}><T variant="meta" tone="muted">{row.label}</T>
          <T selectable variant="body" style={s.ink}>{row.value}</T></View>
      </View>)}
    </View> : <T variant="body" tone="muted">Nema dodatih uslova.</T>}
  </ProductSection>;
}

/** The caller supplies the photo by verified profile ID; this component never reads an account. */
export function ProductPerson({ name, caption, photo, initial, onPress, disabled = false, label = 'Pogledaj javni profil' }: {
  name: string; caption?: string; photo?: ReactNode; initial: string; onPress?: () => void;
  disabled?: boolean; label?: string;
}) {
  const unavailable = disabled || !onPress;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: unavailable }}
    disabled={unavailable} onPress={onPress} haptic="select" scaleTo={0.99} style={s.person}>
    {photo ?? <View style={s.avatar}><T style={s.initial}>{initial}</T></View>}
    <View style={s.factCopy}><T variant="bodyStrong" style={s.personName}>{name}</T>
      {caption ? <T variant="meta" tone="muted">{caption}</T> : null}</View>
    {onPress ? <CaretRight size={22} color={sys.color.green} /> : null}
  </Press>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  header: innerBar,
  headerTitle: { minWidth: 0, color: sys.color.ink },
  title: { ...sys.type.hero, color: sys.color.green, letterSpacing: -0.8 },
  section: { gap: 12, paddingTop: 8 },
  sectionTitle: { color: sys.color.ink },
  facts: { gap: 4 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  factCopy: { flex: 1, minWidth: 0, gap: 4 },
  factValue: { ...sys.type.bodyStrong, color: sys.color.ink },
  price: { marginTop: 8, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: sys.color.line },
  priceValue: { ...sys.type.priceLarge, color: sys.color.money },
  priceLabel: { ...sys.type.title, color: sys.color.green },
  requirements: { gap: 16, padding: 16, borderRadius: sys.radius.card, backgroundColor: sys.color.greenSoft },
  requirement: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  requirementDot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.green, marginTop: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: sys.color.cardLine, borderRadius: sys.radius.card, backgroundColor: sys.color.surface },
  personName: { color: sys.color.ink, fontSize: 18, lineHeight: 24 },
  avatar: { width: 72, height: 72, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft,
    alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: sys.color.green },
});
