import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft, ArrowRight, CaretRight } from 'phosphor-react-native';
import { needPriceBasisNote, needPriceText } from '../../data/needDetailPresentation';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { brandAction, iconButton, sys } from '../system/tokens';
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

/*
 * The task detail as the owner's V41 reference sets it (2026-09-23): the place on its own line with a
 * small label over a bold value, then Termin and Potrebno side by side, then the price large with one
 * quiet line saying what it covers. The pieces below only arrange what the caller already read.
 */

/** A fact with its label visible: the art beside a small muted label over the bold value. */
export function ProductLabeledFact({ art, label, value }: { art: FactArtKind; label: string; value: string }) {
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={s.labeled}>
    <FactArt kind={art} size={30} />
    <View style={s.factCopy}>
      <T variant="meta" tone="muted">{label}</T>
      <T style={s.factValue}>{value}</T>
    </View>
  </View>;
}

/** Two facts in one row. When the second no longer fits beside the first (a narrow phone, large text) it moves under it. */
export function ProductFactPair({ children }: { children: ReactNode }) {
  return <View style={s.pair}>{children}</View>;
}

/**
 * The saved schedule sentence as a day and its hours, only where the sentence is exactly that pair:
 * "20. sep 2026 · 18:00 – 19:00 (po vremenu u Srbiji)". A flexible range, a window across two days or a
 * sentence about the schedule stays whole beside the calendar, so nothing is reworded and no hour is guessed.
 */
export function productWhenParts(text: string, exactWindow: boolean): { date: string; time: string | null } {
  const parts = text.split(' · ');
  return exactWindow && parts.length === 2 && parts[0].trim() && parts[1].trim()
    ? { date: parts[0].trim(), time: parts[1].trim() } : { date: text, time: null };
}

/** Termin: its label, then the day beside a calendar and the hours beside a clock. */
export function ProductWhenFact({ text, exactWindow, label = 'Termin' }: { text: string; exactWindow: boolean; label?: string }) {
  const { date, time } = productWhenParts(text, exactWindow);
  return <View accessible accessibilityLabel={`${label}: ${text}`} style={s.pairLead}>
    <T variant="meta" tone="muted">{label}</T>
    <View style={s.when}>
      <View style={s.whenPart}><FactArt kind="calendar" size={24} /><T style={s.whenText}>{date}</T></View>
      {time ? <View style={s.whenPart}><FactArt kind="clock" size={24} /><T style={s.whenText}>{time}</T></View> : null}
    </View>
  </View>;
}

/** Potrebno: the people art beside the label, the count and, when there is one, how many places are taken. */
export function ProductPeopleFact({ value, note, spokenNote, label = 'Potrebno' }: {
  value: string; note?: string; /** The note as it should be heard; "0 / 2" read aloud is a slash. */ spokenNote?: string; label?: string;
}) {
  const heard = spokenNote ?? note;
  return <View accessible accessibilityLabel={`${label}: ${value}${heard ? `, ${heard}` : ''}`} style={s.pairTrail}>
    <FactArt kind="users" size={30} />
    <View style={s.pairTrailCopy}>
      <T variant="meta" tone="muted">{label}</T>
      <T style={s.factValue}>{value}</T>
      {note ? <T variant="meta" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

/**
 * The two parts of a task's price, from the same helpers every other price in the app uses: the figure,
 * and what it covers in the words `needPriceBasisNote` already says. "Tražim ponude" and "Cena nije
 * navedena" are words about a price; they are never marked as an amount.
 */
export function productPriceParts(input: Parameters<typeof needPriceText>[0] & Parameters<typeof needPriceBasisNote>[0], offersNote: string): {
  value: string; note: string | null; isAmount: boolean;
} {
  if (input.rezimCene === 'OFFERS' || !input.ponudjenaCena) {
    return { value: needPriceText(input), note: input.rezimCene === 'OFFERS' ? offersNote : null, isAmount: false };
  }
  const basis = needPriceBasisNote(input);
  return { value: input.ponudjenaCena.prikaz, isAmount: /\d/.test(input.ponudjenaCena.prikaz),
    note: basis ? basis.charAt(0).toLocaleUpperCase('sr-Latn-RS') + basis.slice(1) : null };
}

/** The price large, with one quiet line beside or under it. A word about money never wears the amount's dress. */
export function ProductPrice({ value, note, isAmount, label = 'Budžet' }: { value: string; note?: string | null; isAmount: boolean; label?: string }) {
  return <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} style={s.priceBlock}>
    <T style={isAmount ? s.priceValue : s.priceLabel}>{value}</T>
    {note ? <T variant="note" tone="muted" style={s.priceNote}>{note}</T> : null}
  </View>;
}

/** A hairline between the facts and the reading below them. */
export function ProductDivider() {
  return <View style={s.divider} />;
}

/**
 * The screen's one orange action at the foot of a detail: its words, a count when the words are about
 * something counted ("Pregledaj prijave · 3"), and an arrow when it leads somewhere. What the count
 * means is said to a screen reader through `accessibilityLabel`.
 */
export function ProductFooterAction({ label, count, accessibilityLabel, onPress, disabled = false, arrow = true }: {
  label: string; count?: number | null; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; arrow?: boolean;
}) {
  const text = typeof count === 'number' ? `${label} · ${count}` : label;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? text} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} haptic={disabled ? 'none' : 'select'} style={[s.footerAction, brandAction, disabled && s.footerDisabled]}>
    <T variant="action" style={s.footerText}>{text}</T>
    {arrow && !disabled ? <ArrowRight size={20} weight="bold" color={sys.color.ink} /> : null}
  </Press>;
}

/** A bulleted list ("• a" lines) as ["a", "b"]; anything that is not a bulleted list stays text (null). */
const BULLET = /^[•\-–]\s*/;
function listItems(value: string): string[] | null {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length || !lines.every(line => BULLET.test(line))) return null;
  return lines.map(line => line.replace(BULLET, '')).filter(Boolean);
}

/** An explicit list: none of the requirements needed for deciding is hidden behind a disclosure. */
export function ProductRequirements({ rows, title = 'Važno za ovaj zadatak' }: {
  rows: { label: string; value: string }[]; title?: string;
}) {
  // Nothing to say, nothing drawn: a heading over "Nema dodatih uslova." was a section of noise
  // on the one screen where a person decides whether to apply.
  if (!rows.length) return null;
  return <ProductSection title={title}>
    {rows.length ? <View style={s.requirements}>{rows.map((row, index) => {
      // A list arrives as bulleted lines. Drawn under a dot of its own it read as a bullet inside a bullet on the
      // phone (2026-09-23); a list is a row of chips under its label, a sentence stays a sentence.
      const items = listItems(row.value);
      return <View key={`${row.label}:${index}`} style={s.requirement}>
        <T variant="meta" tone="muted">{row.label}</T>
        {items ? <View style={s.chips}>{items.map((item, at) => <View key={`${item}:${at}`} style={s.chip}>
          <T selectable variant="bodyStrong" style={s.ink}>{item}</T></View>)}</View>
          : <T selectable variant="body" style={s.ink}>{row.value}</T>}
      </View>;
    })}
    </View> : <T variant="body" tone="muted">Nema dodatih uslova.</T>}
  </ProductSection>;
}

/** The caller supplies the photo by verified profile ID; this component never reads an account.
 *  One flat row under a hairline, as V41 closes a task with the person who posted it. */
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
  requirement: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: sys.touch.min, paddingVertical: 16,
    borderTopWidth: 1, borderColor: sys.color.line },
  personName: { color: sys.color.ink, fontSize: 18, lineHeight: 24 },
  avatar: { width: 48, height: 48, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft,
    alignItems: 'center', justifyContent: 'center' },
  initial: { ...sys.type.title, color: sys.color.green },
  labeled: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Termin takes what Potrebno leaves. Its basis is small enough that the two share a row on a 360dp
  // phone (320 of content); with large text Potrebno no longer fits beside it and moves under it.
  pair: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 16, rowGap: 16 },
  pairLead: { flexGrow: 1, flexShrink: 1, flexBasis: 148, minWidth: 0, gap: 6 },
  pairTrail: { flexShrink: 1, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pairTrailCopy: { flexShrink: 1, gap: 2 },
  when: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 6 },
  whenPart: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  whenText: { ...sys.type.body, color: sys.color.ink, flexShrink: 1 },
  priceBlock: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 4, paddingTop: 4 },
  priceNote: { flexShrink: 1 },
  divider: { height: 1, backgroundColor: sys.color.line },
  footerAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.sm,
    paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm },
  footerText: { flexShrink: 1, textAlign: 'center', color: sys.color.ink, fontVariant: ['tabular-nums'] },
  footerDisabled: { opacity: 0.45 },
});
