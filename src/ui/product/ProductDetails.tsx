import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRight, CaretRight } from 'phosphor-react-native';
import { needPriceBasisNote, needPriceText } from '../../data/needDetailPresentation';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { brandAction, sys } from '../system/tokens';
import { ScreenChrome } from '../system/ScreenChrome';
import { T } from '../Text';
import { Press } from '../Press';

/**
 * Visual composition only. All data, permissions and callbacks belong to the caller.
 *
 * `ScreenChrome`'s detail bar, as DetailTopBar is: the arrow, the screen's name when it has one that
 * is not already the content's own title, an optional line under it, one action on the right. A task
 * screen passes no title — the task's name is the title, drawn large by ProductTitle below (owner,
 * 2026-09-23). `titleVisible` lets such a screen bring its name into the bar once the large title
 * has scrolled away (`useChromeTitleOnScroll`).
 */
export function ProductHeader({ title, subtitle, back, backLabel = 'Nazad', disabled = false, right, titleVisible }: {
  title?: string; subtitle?: string; back: () => void; backLabel?: string; disabled?: boolean; right?: ReactNode; titleVisible?: boolean;
}) {
  return <ScreenChrome variant="detail" title={title} subtitle={subtitle} onBack={back} backLabel={backLabel} disabled={disabled}
    right={right} titleVisible={titleVisible} />;
}

export function ProductTitle({ children }: { children: ReactNode }) {
  return <T accessibilityRole="header" style={s.title}>{children}</T>;
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
 * The task detail, recomposed from zero (owner, 2026-09-23: the HTML prototypes are documentation of
 * what a task says, not of how the screen is laid out). A task is read in one pass, top to bottom:
 * its name, then four facts as one list — where, when, how many people, how much — then the words,
 * what it needs, the place on a small map, the questions and the person behind it. Sections are
 * separated by a hairline and air, never by boxes; the one action stays at the foot of the screen.
 */

/**
 * One fact of a task as a row: its art, the value and, when there is one, a quiet line under it.
 * A screen reader hears the whole row as one sentence, "Potrebno: 2 osobe, popunjeno 0 od 2 mesta".
 * Money wears the money colour only when it is an amount; a word about money stays ink.
 */
export function DetailFact({ art, label, value, note, spokenNote, money = false }: {
  art: FactArtKind; label: string; value: string; note?: string | null;
  /** The note as it should be heard; "0 / 2" read aloud is a slash. */ spokenNote?: string; money?: boolean;
}) {
  const heard = spokenNote ?? note;
  return <View accessible accessibilityLabel={`${label}: ${value}${heard ? `, ${heard}` : ''}`} style={s.detailFact}>
    <View style={s.detailArt}><FactArt kind={art} size={28} /></View>
    <View style={s.factCopy}>
      <T style={money ? s.detailMoney : s.detailValue}>{value}</T>
      {note ? <T variant="note" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

/** The facts of a task, one under the other. */
export function DetailFacts({ children }: { children: ReactNode }) {
  return <View style={s.detailFacts}>{children}</View>;
}

/** A part of a detail screen: a hairline and air above it, and a heading when the part needs one. */
export function DetailSection({ title, children }: { title?: string; children: ReactNode }) {
  return <View style={s.section}>
    {title ? <T accessibilityRole="header" variant="heading" style={s.sectionTitle}>{title}</T> : null}
    {children}
  </View>;
}

/** A row that leads somewhere: its art, what it is, a quiet line, and the caret. */
export function DetailLink({ art, label, detail, accessibilityLabel, onPress, disabled = false, trailing }: {
  art: FactArtKind; label: string; detail?: string | null; accessibilityLabel?: string; onPress: () => void; disabled?: boolean;
  /** A count or a mark that belongs beside the caret. */ trailing?: ReactNode;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} haptic="select" scaleTo={0.99} style={[s.link, disabled && s.disabled]}>
    <View style={s.detailArt}><FactArt kind={art} size={28} /></View>
    <View style={s.factCopy}>
      <T variant="bodyStrong" style={s.ink}>{label}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
    {trailing}
    <CaretRight size={20} color={sys.color.muted} />
  </Press>;
}

/**
 * The public stops of a task that moves, as one line: "Kalenić → Užice" under what kind of trip it is.
 * The label of each stop is heard, not shown; a stop that names the same place twice is said once.
 * A task done in one place draws nothing here: its place is already the first fact and the map.
 */
export function DetailRoute({ rows, country }: { rows: { label: string; value: string }[]; country?: string | null }) {
  const [mode, ...stops] = rows;
  const once = (value: string) => [...new Set(value.split(' · ').map(part => part.trim()).filter(Boolean))].join(' · ');
  const named = stops.map(stop => ({ label: stop.label, value: once(stop.value) })).filter(stop => stop.value);
  if (!mode || !named.length) return null;
  return <View accessible accessibilityLabel={`${mode.value}: ${named.map(stop => `${stop.label} ${stop.value}`).join(', ')}${country ? `, ${country}` : ''}`}
    style={s.route}>
    <T variant="meta" tone="muted">{country ? `${mode.value} · ${country}` : mode.value}</T>
    <T variant="bodyStrong" style={s.ink}>{named.map(stop => stop.value).join('  →  ')}</T>
  </View>;
}

/** Whether the stops of a task name anything the area line does not already say. */
export function routeAddsToArea(rows: { label: string; value: string }[], area: string): boolean {
  const [, ...stops] = rows;
  return stops.length > 1 || stops.some(stop => stop.value.split(' · ').map(part => part.trim()).filter(Boolean).some(part => !area.includes(part)));
}

/**
 * A task's words. A long description shows its first lines and one quiet press to read the rest;
 * the whole text is always there for a screen reader and for selection.
 */
export function DetailDescription({ text }: { text: string }) {
  const long = text.length > 360 || text.split(/\r?\n/).length > 8;
  const [open, setOpen] = useState(false);
  return <View style={s.description}>
    <T selectable variant="body" numberOfLines={long && !open ? 8 : undefined} style={s.descriptionText}>{text}</T>
    {long ? <Press accessibilityRole="button" accessibilityLabel={open ? 'Prikaži kraći opis' : 'Prikaži ceo opis'} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(value => !value)} haptic="select" scaleTo={0.99} style={s.more}>
      <T variant="bodyStrong" style={s.moreText}>{open ? 'Prikaži kraći opis' : 'Prikaži ceo opis'}</T>
    </Press> : null}
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

/**
 * The screen's one primary action at the foot of a detail: its words, a count when the words are about
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
    {arrow && !disabled ? <ArrowRight size={20} weight="bold" color={sys.color.onGreen} /> : null}
  </Press>;
}

/** A bulleted list ("• a" lines) as ["a", "b"]; anything that is not a bulleted list stays text (null). */
const BULLET = /^[•\-–]\s*/;
function listItems(value: string): string[] | null {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length || !lines.every(line => BULLET.test(line))) return null;
  return lines.map(line => line.replace(BULLET, '')).filter(Boolean);
}

/**
 * What a task asks of the person who takes it, readable at once: none of it hides behind a disclosure.
 * A list is a row of quiet chips under its label; a sentence stays a sentence. No panel around it —
 * the section's hairline is the only frame.
 */
export function ProductRequirements({ rows, title = 'Važno za ovaj zadatak' }: {
  rows: { label: string; value: string }[]; title?: string;
}) {
  // Nothing to say, nothing drawn: a heading over "Nema dodatih uslova." was a section of noise
  // on the one screen where a person decides whether to apply.
  if (!rows.length) return null;
  return <DetailSection title={title}>
    <View style={s.requirements}>{rows.map((row, index) => {
      const items = listItems(row.value);
      return <View key={`${row.label}:${index}`} style={s.requirement}>
        <T variant="meta" tone="muted">{row.label}</T>
        {items ? <View style={s.chips}>{items.map((item, at) => <View key={`${item}:${at}`} style={s.chip}>
          <T selectable variant="copy" style={s.chipText}>{item}</T></View>)}</View>
          : <T selectable variant="body" style={s.ink}>{row.value}</T>}
      </View>;
    })}
    </View>
  </DetailSection>;
}

/** The caller supplies the photo by verified profile ID; this component never reads an account.
 *  One flat row under a hairline: who they are to this task, their name, their rating. */
export function ProductPerson({ name, caption, overline, photo, initial, onPress, disabled = false, label = 'Pogledaj javni profil' }: {
  name: string; caption?: string; /** What this person is to the task, above the name ("Traži pomoć"). */ overline?: string;
  photo?: ReactNode; initial: string; onPress?: () => void;
  disabled?: boolean; label?: string;
}) {
  const unavailable = disabled || !onPress;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: unavailable }}
    disabled={unavailable} onPress={onPress} haptic="select" scaleTo={0.99} style={s.person}>
    {photo ?? <View style={s.avatar}><T style={s.initial}>{initial}</T></View>}
    <View style={s.personCopy}>
      {overline ? <T variant="meta" tone="muted">{overline}</T> : null}
      <T variant="bodyStrong" style={s.personName}>{name}</T>
      {caption ? <T variant="note" tone="muted">{caption}</T> : null}
    </View>
    {onPress ? <CaretRight size={20} color={sys.color.muted} /> : null}
  </Press>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  title: { ...sys.type.hero, color: sys.color.green, letterSpacing: -0.8 },
  facts: { gap: 4 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  factValue: { ...sys.type.bodyStrong, color: sys.color.ink },
  price: { marginTop: 8, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: sys.color.line },
  priceValue: { ...sys.type.priceLarge, color: sys.color.money },
  priceLabel: { ...sys.type.title, color: sys.color.green },
  detailFacts: { gap: 18 },
  detailFact: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  // The art sits on the first line of the value, whatever size the reader has chosen for text.
  detailArt: { width: 32, alignItems: 'center', paddingTop: 1 },
  detailValue: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: sys.color.ink },
  detailMoney: { ...sys.type.priceSmall, color: sys.color.money },
  section: { gap: 14, paddingTop: 24, borderTopWidth: 1, borderTopColor: sys.color.line },
  sectionTitle: { color: sys.color.ink },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 },
  disabled: { opacity: 0.5 },
  description: { gap: 6 },
  route: { gap: 2 },
  descriptionText: { color: sys.color.ink, lineHeight: 26 },
  more: { alignSelf: 'flex-start', minHeight: sys.touch.min, justifyContent: 'center' },
  moreText: { color: sys.color.green },
  requirements: { gap: 16 },
  requirement: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  chipText: { color: sys.color.ink, fontWeight: '500' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: sys.touch.min, paddingTop: 20,
    borderTopWidth: 1, borderColor: sys.color.line },
  personCopy: { flex: 1, minWidth: 0, gap: 1 },
  personName: { color: sys.color.ink, fontSize: 18, lineHeight: 24 },
  avatar: { width: 48, height: 48, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft,
    alignItems: 'center', justifyContent: 'center' },
  initial: { ...sys.type.title, color: sys.color.green },
  footerAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.sm,
    paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm },
  footerText: { flexShrink: 1, textAlign: 'center', color: sys.color.onGreen, fontVariant: ['tabular-nums'] },
  footerDisabled: { opacity: 0.45 },
});
