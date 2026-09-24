import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { NeedUrgencyProjection, Pokrivenost, PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import type { NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { inicijali } from '../../lib/inicijali';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { Pictogram, pictogramCatalog, type PictogramGroup, type PictogramKind } from '../system/Pictogram';
import { osobuAkuz, plural } from '../system/plural';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * The one face of a task in a list (owner's step 5a, 2026-09-24; emulator critique A8, A9, A10, B13, B14). A list is
 * scanned, so every card is the same fixed lines in the same order, and a line either says something or is not drawn:
 *
 *   1. status, only when it says something (HITNO, "Prijava poslata", "Tvoj zadatak", the state of my own task);
 *   2. the title with the VALUE SLOT beside it, which is never empty: the amount, or a quiet word;
 *   3. where (one line); 4. when (one line);
 *   5. at most one requirement a worker decides on (a condition, a vehicle, a tool; never a skill, which reads as a
 *      category);
 *   6. the foot: how many people, and who posted it.
 *
 * No line wraps into the next one (no flex-wrap in the facts): the card of the phone screenshots put the poster on a
 * line of its own at one text size and beside a chip at another. At the owner's large text the value moves under the
 * title and the person under the places, as whole lines. Nothing here invents a rating, a count or a state, and a word
 * about money never wears the money colour or weight.
 *
 * Pure helpers first (tested on their own), then the parts `TaskCard` is built from.
 */

/* ------------------------------------------------------------------------------------------------ what it says */

/** What stands in the value slot. It is always one of the three: a card never leaves the corner empty (A8). */
export type TaskValue =
  | { kind: 'amount'; amount: string; basis: 'ukupno' | 'po osobi' | null }
  | { kind: 'offers' }
  | { kind: 'unpriced' };

export function taskValue(item: Pick<MarketplaceItem, 'rezimCene' | 'ponudjenaCena' | 'osnovaCene'>): TaskValue {
  if (item.rezimCene === 'OFFERS') return { kind: 'offers' };
  const amount = item.ponudjenaCena?.prikaz;
  if (!amount) return { kind: 'unpriced' };
  // The card says what the number buys in one or two words (A10, B14); the full sentence stays on the detail.
  return { kind: 'amount', amount, basis: item.osnovaCene === 'TOTAL' ? 'ukupno' : item.osnovaCene === 'PER_PERSON' ? 'po osobi' : null };
}

/** The words of a value slot without an amount. They are labels, never drawn as money. */
export const VALUE_WORDS = { offers: 'Tražim ponude', unpriced: 'Cena nije navedena' } as const;

/** Where the task happens, from public data only: a route reads "start → end" from area or city, never the private label. */
export function taskPlace(item: Pick<MarketplaceItem, 'detalji' | 'podrucjeTekst'>): { remote: boolean; text: string } {
  if (item.detalji?.rezimLokacije === 'REMOTE') return { remote: true, text: 'Na daljinu' };
  const geography = item.detalji?.geografija;
  if (geography?.mode === 'POINT_TO_POINT') {
    const from = publicName(geography.start), to = publicName(geography.end);
    if (from && to && from !== to) return { remote: false, text: `${from} → ${to}` };
  }
  return { remote: false, text: item.podrucjeTekst };
}
const publicName = (point: NeedTaskGeographyPoint | undefined) => point?.area?.trim() || point?.city?.trim() || null;

/**
 * The one requirement a worker decides on, from the task's own conditions, then its vehicles, then its tools. Skills
 * are never read and neither is `uslovi` (skills + tools + vehicles in one list): "Krečenje" under "Krečenje stana" read
 * as a category, which the owner forbids. The skills stay on the detail's requirement list.
 */
export type TaskRequirement = { kind: 'condition' | 'vehicle' | 'tool'; text: string; spoken: string; art?: PictogramKind };
export function taskRequirement(item: Pick<MarketplaceItem, 'detalji'>): TaskRequirement | null {
  const needs = item.detalji?.zahtevi;
  if (!needs) return null;
  const clean = (values: readonly string[] | null | undefined) => (values ?? []).map(value => value.trim()).filter(Boolean);
  const conditions = clean(needs.bitniUslovi), vehicles = clean(needs.vozila), tools = clean(needs.alati);
  if (conditions.length) return { kind: 'condition', text: conditions.join(' · '), spoken: `Bitni uslovi: ${conditions.join(', ')}` };
  if (vehicles.length) return { kind: 'vehicle', text: vehicles.join(' · '), spoken: `Potrebno vozilo: ${vehicles.join(', ')}`,
    art: matchingArt('vozila', vehicles[0], 'kombi') };
  if (tools.length) return { kind: 'tool', text: tools.join(' · '), spoken: `Potreban alat: ${tools.join(', ')}`,
    art: matchingArt('alat', tools[0], 'rucni-alat') };
  return null;
}
/** The drawing of the thing named, when the picker has one by that name; otherwise the group's general drawing. */
function matchingArt(group: PictogramGroup, name: string, fallback: PictogramKind): PictogramKind {
  const wanted = name.toLocaleLowerCase('sr-Latn-RS');
  return pictogramCatalog.find(entry => entry.group === group && entry.label.toLocaleLowerCase('sr-Latn-RS') === wanted)?.kind ?? fallback;
}

/**
 * How many people, said to the one reading it. A worker asks how many places are left ("Traži 2 osobe", "Još 1 od 2
 * mesta"); the owner follows the progress of their own task ("0/2 popunjeno").
 */
export function placesText(places: Pokrivenost, audience: 'worker' | 'owner'): { text: string; spoken: string } {
  if (audience === 'owner') return { text: `${places.popunjeno}/${places.ukupno} popunjeno`, spoken: `${places.popunjeno} od ${places.ukupno} mesta popunjeno` };
  if (places.preostalo <= 0) return { text: 'Sva mesta su popunjena', spoken: 'Sva mesta su popunjena' };
  if (places.popunjeno <= 0) return { text: `Traži ${osobuAkuz(places.ukupno)}`, spoken: `Traži ${osobuAkuz(places.ukupno)}` };
  return { text: `Još ${places.preostalo} od ${places.ukupno} mesta`, spoken: `Još ${places.preostalo} od ${places.ukupno} mesta` };
}

/**
 * A rating is shown with how many reviews it stands on, so a 5,0 from one review never looks like one from fifty.
 * Zero reviews says so; an unknown count (the profile read did not say) shows the rating alone; no rating shows nothing.
 * The same honesty rule as the public profile sheet.
 */
export function ratingWords(rating: string | null | undefined, count: number | null | undefined): { text: string; star: boolean; spoken: string } | null {
  if (count === 0) return { text: 'Još nema ocena', star: false, spoken: 'još nema ocena' };
  if (!rating) return null;
  if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) {
    return { text: `${rating} (${count})`, star: true, spoken: `ocena ${rating}, ${plural(count, 'ocena', 'ocene', 'ocena')}` };
  }
  return { text: rating, star: true, spoken: `ocena ${rating}` };
}

const OWN_STATUS: Partial<Record<StanjePotrebe, string>> = { NACRT: 'Nacrt', DELIMICNO_POPUNJENA: 'Delimično popunjen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' };
/** The status line, only when it says something: every card in a list of open tasks is open, so that is never said. */
export function taskStatus(item: MarketplaceItem, relation?: 'OWNED' | 'APPLIED'): { text: string; quiet: boolean } | null {
  if ('stanje' in item) {
    const text = OWN_STATUS[item.stanje];
    return text ? { text, quiet: item.stanje === 'NACRT' || item.stanje === 'ZATVORENA' } : null;
  }
  // A sent application is a paper plane in words, never the tick of something finished.
  return relation === 'OWNED' ? { text: 'Tvoj zadatak', quiet: false } : relation === 'APPLIED' ? { text: 'Prijava poslata', quiet: false } : null;
}

/**
 * What my own task asks of me next, from the server's count of applications I can choose among. Unknown (null) draws
 * nothing, never zero; a draft continues its editing; a closed or full task asks nothing.
 */
export type OwnerNext = { kind: 'waiting'; count: number; text: string } | { kind: 'none' } | { kind: 'draft' } | null;
export function ownerNext(item: PotrebaProjekcija): OwnerNext {
  if (item.stanje === 'NACRT') return { kind: 'draft' };
  if (item.stanje === 'ZATVORENA' || item.pokrivenost.preostalo <= 0) return null;
  const count = item.brojPrijavaZaIzbor;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
  return count > 0 ? { kind: 'waiting', count, text: plural(count, 'prijava čeka izbor', 'prijave čekaju izbor', 'prijava čeka izbor') } : { kind: 'none' };
}

/* ------------------------------------------------------------------------------------------------ the parts */

/** Line 1. The HITNO badge reads the card's one clock. */
export function CardStatus({ status, urgency, now }: { status: { text: string; quiet: boolean } | null; urgency?: NeedUrgencyProjection; now: number }) {
  const tone = status?.quiet ? sys.color.muted : sys.color.green;
  return <View style={s.statusRow}>
    {status ? <View style={s.status}><View style={[s.dot, { backgroundColor: tone }]} />
      <T variant="label" numberOfLines={1} style={[s.statusText, { color: tone }]}>{status.text}</T></View> : <View style={s.grow} />}
    <NeedUrgencyBadge urgency={urgency} now={now} />
  </View>;
}

/** Line 2: the title, and the value slot beside it (under it at large text, so the title keeps its width). */
export function CardHead({ title, value, large }: { title: string; value: TaskValue; large: boolean }) {
  return <View style={large ? s.headStacked : s.head}>
    <T style={[s.title, !large && s.titleSide]} numberOfLines={large ? 3 : 2}>{title}</T>
    <CardValue value={value} large={large} />
  </View>;
}

/** The value slot. An amount is money (colour, weight, tabular figures); a word is a quiet label and nothing else. */
export function CardValue({ value, large }: { value: TaskValue; large: boolean }) {
  if (value.kind === 'amount') {
    return <View accessible accessibilityLabel={value.basis ? `${value.amount} ${value.basis}` : value.amount} style={large ? s.valueRow : s.valueSide}>
      <T style={[s.amount, large && s.alignStart]} numberOfLines={1}>{value.amount}</T>
      {value.basis ? <T style={[s.basis, large && s.alignStart]} numberOfLines={1}>{value.basis}</T> : null}
    </View>;
  }
  return <View style={large ? s.valueRow : s.valueSide}>
    <T style={[s.valueWord, large && s.alignStart]} numberOfLines={2}>{VALUE_WORDS[value.kind]}</T>
  </View>;
}

/** One fact on its own line: a 16 px drawing and the words, never wrapping into the next fact. */
export function CardFact({ art, text, lines = 1, spoken }: { art: ReactNode; text: string; lines?: number; spoken?: string }) {
  return <View style={s.fact} accessible={!!spoken} accessibilityLabel={spoken}>
    <View style={s.art}>{art}</View>
    <T style={s.factText} numberOfLines={lines}>{text}</T>
  </View>;
}

/**
 * Line 5. A condition draws the "info" fact; a vehicle or a tool draws the picker's own drawing of it, at fact size, so
 * the line shows what is needed rather than a generic mark.
 */
export function CardRequirement({ requirement }: { requirement: TaskRequirement }) {
  const art = requirement.art ? <Pictogram kind={requirement.art} size={16} /> : <FactArt kind="info" size={16} />;
  return <CardFact art={art} text={requirement.text} lines={2} spoken={requirement.spoken} />;
}

/** Who posted the task: the one avatar and the one initials rule of the app, the name, and the honest rating. */
export const CardPerson = memo(function CardPerson({ name, rating, count }: { name: string; rating: string | null | undefined; count: number | null | undefined }) {
  const trust = ratingWords(rating, count);
  return <View accessible accessibilityLabel={trust ? `${name}, ${trust.spoken}` : name} style={s.person}>
    <Avatar initials={inicijali(name)} size={32} />
    <View style={s.personText}>
      <T style={s.personName} numberOfLines={1}>{name}</T>
      {trust ? <View style={s.rating}>
        {trust.star ? <FactArt kind="star" size={14} /> : null}
        <T style={s.ratingText} numberOfLines={1}>{trust.text}</T>
      </View> : null}
    </View>
  </View>;
});

/** Line 6: places on the left, the person anchored bottom right; at large text they are two whole lines. */
export function CardFoot({ places, person, large }: { places: ReactNode; person: ReactNode; large: boolean }) {
  return <View style={large ? s.footStacked : s.foot}>
    {places}
    {person ? <View style={large ? s.personStacked : s.personSide}>{person}</View> : null}
  </View>;
}

export function CardPlaces({ places, audience }: { places: Pokrivenost; audience: 'worker' | 'owner' }) {
  const words = placesText(places, audience);
  return <View accessible accessibilityLabel={words.spoken} style={s.places}>
    <FactArt kind="users" size={16} />
    <T style={s.placesText} numberOfLines={1}>{words.text}</T>
  </View>;
}

/** A line inside the card's own target: "Nastavi uređivanje" continues the draft the card opens. */
export function CardNext({ label }: { label: string }) {
  return <View style={s.next}><T style={s.nextText} numberOfLines={1}>{label}</T><CaretRight size={16} weight="bold" color={sys.color.green} /></View>;
}

/** A quiet sentence of fact inside the card, never a target of its own. */
export function CardNote({ text }: { text: string }) {
  return <T style={s.note} numberOfLines={2}>{text}</T>;
}

/** The warm words of what waits for me, for a card that has nowhere to send them (no route handed over). */
export function CardWaitingLine({ text }: { text: string }) {
  return <T style={s.waitingLine} numberOfLines={1}>{text}</T>;
}

export const faceStyles = StyleSheet.create({
  /** The own-task foot: a flat warm tint at control radius inside the card, never a card in a card and no hairline over it. */
  ownerFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: sys.radius.control, backgroundColor: sys.color.orangeSoft },
  ownerFootText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.waitingInk },
});

const s = StyleSheet.create({
  grow: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  statusText: { flexShrink: 1, letterSpacing: 0.3 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headStacked: { gap: 4 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3, color: sys.color.ink },
  titleSide: { flex: 1, minWidth: 0 },
  // The amount keeps its width; a word may take two short lines rather than squeeze the title.
  valueSide: { alignItems: 'flex-end', maxWidth: '42%', flexShrink: 0 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  alignStart: { textAlign: 'left' },
  amount: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2, color: sys.color.money, fontVariant: ['tabular-nums'], textAlign: 'right' },
  basis: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: sys.color.muted, textAlign: 'right' },
  valueWord: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: sys.color.muted, textAlign: 'right' },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  art: { width: 16, height: 19, alignItems: 'center', justifyContent: 'center' },
  factText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19, fontWeight: '500', color: sys.color.fact },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  footStacked: { gap: 8, marginTop: 2 },
  places: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  placesText: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '500', color: sys.color.fact, fontVariant: ['tabular-nums'] },
  personSide: { flexShrink: 1, maxWidth: '62%' },
  personStacked: { alignSelf: 'flex-end', maxWidth: '100%' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personText: { flexShrink: 1, minWidth: 0 },
  personName: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: sys.color.ink },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { flexShrink: 1, fontSize: 13, lineHeight: 17, fontWeight: '500', color: sys.color.muted, fontVariant: ['tabular-nums'] },
  next: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  nextText: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: sys.color.green },
  note: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: sys.color.muted },
  waitingLine: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.attentionInk },
});
