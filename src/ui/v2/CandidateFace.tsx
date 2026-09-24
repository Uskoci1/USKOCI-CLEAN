import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { KandidatProjekcija, StanjePrijave } from '../../contracts/projections';
import { needScheduleText } from '../../data/needDetailPresentation';
import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { osoba } from '../system/plural';
import { useTextScale } from '../system/textScale';
import { cardCompact, sys } from '../system/tokens';
import { Press } from '../Press';
import { T } from '../Text';
import { CardFact, valueStyles } from './TaskFace';

/**
 * The one face of an application in the requester's list (owner's step 7, 2026-09-24). An offer is chosen as a PERSON
 * first, so the card reads the way the decision is made:
 *
 *   1. what state the offer is in, only when it cannot simply be chosen ("Potrebna nova provera", "Izabrana prijava");
 *   2. the person — the one Avatar (or their photo), the name and the rating with the count it stands on — with the
 *      VALUE SLOT beside it: the total in the money colour and what it covers ("ukupno · 2 osobe");
 *   3. one line of their own message (the whole text is on the offer);
 *   4. the time they proposed, only when they proposed one (without it the offer takes the task's own time, which every
 *      card would repeat).
 *
 * A line either says something or is not drawn. Nothing here invents a rating, a count, a time or a state: a missing
 * rating says it is missing, a count is the server's own words, and an amount without figures is never dressed as money.
 * At the owner's large text, and on a phone under 360 dp, the value moves under the person as a whole line, so a name is
 * never squeezed into a third of the card; a name may take three lines. The card is ONE press that opens the offer and is
 * heard once, as the person and everything the card shows.
 *
 * Pure helpers first (tested on their own), then the parts the list, the comparison and the offer are built from.
 */

/* ------------------------------------------------------------------------------------------------ what it says */

/** What the service writes when the read carried no rating (`candidateClientService`). */
const NO_RATING = '—';

export type CandidateTrust = { text: string; star: boolean; spoken: string };
/**
 * The rating with the count it stands on, as the read gave them. A star only beside a real figure; a missing rating is
 * said to be missing, never left blank and never replaced by a number. The count is the server's own words (reviews, or
 * finished jobs when there are no reviews) and is shown only when the read had it.
 */
export function candidateTrust(k: Pick<KandidatProjekcija, 'ocenaTekst' | 'recenzijeTekst'>): CandidateTrust {
  const rating = (k.ocenaTekst ?? '').trim(), count = (k.recenzijeTekst ?? '').trim();
  const rated = rating !== '' && rating !== NO_RATING && /\d/.test(rating);
  if (rated) return { star: true, text: count ? `${rating} · ${count}` : rating, spoken: count ? `ocena ${rating}, ${count}` : `ocena ${rating}` };
  return { star: false, text: count ? `Ocena nije dostupna · ${count}` : 'Ocena nije dostupna',
    spoken: count ? `ocena nije dostupna, ${count}` : 'ocena nije dostupna' };
}

/** What stands in the value slot: the total and what it covers, or a quiet word. */
export type CandidateValue = { kind: 'amount'; amount: string; basis: string } | { kind: 'unpriced' };
export const UNPRICED = 'Cena nije navedena';
export function candidateValue(k: Pick<KandidatProjekcija, 'cena' | 'pokrivaMesta'>): CandidateValue {
  const shown = (k.cena?.prikaz ?? '').trim();
  if (!shown || !/\d/.test(shown) || !Number.isSafeInteger(k.cena.iznos) || k.cena.iznos <= 0) return { kind: 'unpriced' };
  // An amount never loses its currency: a figure written without one gets the offer's own.
  const amount = /[A-Za-z]/.test(shown) ? shown : `${shown} ${k.cena.valuta || 'RSD'}`;
  return { kind: 'amount', amount, basis: `ukupno · ${osoba(k.pokrivaMesta)}` };
}

/**
 * The exact interval the person proposed, in the task's zone (Serbian time when the task has none: an agreed term reads
 * the same on both phones). The zone is named only on a phone that stands in another one. Null when nothing was proposed.
 */
export function candidateTime(k: Pick<KandidatProjekcija, 'predlozeniPocetak' | 'predlozeniKraj'>, timezone?: string | null): string | null {
  const from = calendarInstant(k.predlozeniPocetak), to = calendarInstant(k.predlozeniKraj);
  if (from === null || to === null || from >= to) return null;
  return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: k.predlozeniPocetak ?? null, endsAt: k.predlozeniKraj ?? null }, timezone || DOGOVORENA_ZONA);
}

/** The server's state of an offer, in words. */
export const CANDIDATE_STATE: Record<StanjePrijave, string> = {
  SELECTABLE: 'Poslata prijava', STALE: 'Potrebna nova provera', OVERFILL: 'Više ljudi nego što je preostalo',
  SELECTED: 'Izabrana prijava', WITHDRAWN: 'Povučena prijava', CLOSED: 'Zadatak je zatvoren', FULL: 'Sva mesta su popunjena',
};
export type CandidateTone = 'green' | 'warn' | 'muted';
export const TONE_INK: Record<CandidateTone, string> = { green: sys.color.green, warn: sys.color.warn, muted: sys.color.muted };
/** The state line, only when it says something: an offer that can simply be chosen is the normal case and says nothing. */
export function candidateStatus(k: Pick<KandidatProjekcija, 'stanje'>): { text: string; tone: CandidateTone } | null {
  if (k.stanje === 'SELECTABLE') return null;
  const tone: CandidateTone = k.stanje === 'SELECTED' ? 'green' : k.stanje === 'STALE' || k.stanje === 'OVERFILL' ? 'warn' : 'muted';
  return { text: CANDIDATE_STATE[k.stanje], tone };
}

/** The message's first 180 characters, for what is heard before the offer is opened. */
export function messagePreview(message: string): { text: string; cut: boolean } {
  const text = Array.from(message).slice(0, 180).join('');
  return { text, cut: text.length < message.length };
}

/**
 * Everything the card shows, as one sentence a screen reader hears after its name: the rating, the total, the people, the
 * time, a bounded preview of the message and, for an offer that cannot be chosen, why.
 */
export function candidateSpoken(k: KandidatProjekcija, time: string | null): string {
  const trust = candidateTrust(k), value = candidateValue(k), status = candidateStatus(k);
  const message = k.napomena?.trim() ?? '';
  const preview = messagePreview(message);
  const offer = value.kind === 'amount' ? `Ukupno ${value.amount}` : UNPRICED;
  return `${trust.spoken.charAt(0).toLocaleUpperCase('sr-Latn-RS')}${trust.spoken.slice(1)}. ${offer}; ${osoba(k.pokrivaMesta)}; ${
    time ? `termin ${time}` : 'termin Zadatka'}.${message ? ` Poruka: „${preview.text}${preview.cut ? '…' : ''}“. Otvori ponudu za celu poruku.` : ''}${
    status ? ` ${status.text}.` : ''}`;
}

/* ------------------------------------------------------------------------------------------------ the parts */

/** The person's picture: the photo the screen hands in, or the one Avatar with their letters (a drawn person without a name). */
export function CandidateAvatar({ candidate, size, photo }: { candidate: Pick<KandidatProjekcija, 'inicijali'>; size: AvatarSize; photo?: ReactNode }) {
  return <View style={{ width: size, height: size }}>{photo ?? <Avatar initials={candidate.inicijali || null} size={size} />}</View>;
}

/**
 * The rating line: a star only beside a figure. When it wraps, it breaks after the dot and keeps the count whole ("Ocena nije
 * dostupna ·" over "3 završena posla"), never inside the count ("· 3" over "završena posla").
 */
export function CandidateTrustLine({ candidate, lines = 2 }: { candidate: Pick<KandidatProjekcija, 'ocenaTekst' | 'recenzijeTekst'>; lines?: number }) {
  const trust = candidateTrust(candidate);
  const [lead, count] = trust.text.split(' · ');
  const shown = count ? `${lead}${NBSP}· ${count.replace(/ /g, NBSP)}` : trust.text;
  return <View style={s.trust}>
    {trust.star ? <FactArt kind="star" size={14} /> : null}
    <T style={s.trustText} numberOfLines={lines}>{shown}</T>
  </View>;
}
const NBSP = ' ';

/** Line 1: a dot and the state, in the state's own ink; never an orange fill. */
export function CandidateStatusLine({ status }: { status: { text: string; tone: CandidateTone } }) {
  const ink = TONE_INK[status.tone];
  return <View style={s.status}>
    <View style={[s.dot, { backgroundColor: ink }]} />
    <T variant="label" numberOfLines={2} style={[s.statusText, { color: ink }]}>{status.text}</T>
  </View>;
}

/**
 * The value slot, in the task card's value type (`valueStyles`). An amount keeps its whole width and the name gives way;
 * a word is quiet and never money-coloured.
 */
export function CandidateValueSlot({ value, large }: { value: CandidateValue; large: boolean }) {
  if (value.kind === 'unpriced') return <View style={large ? s.valueLine : s.valueSide}>
    <T style={[valueStyles.valueWord, large && valueStyles.alignStart]} numberOfLines={2}>{UNPRICED}</T></View>;
  return <View style={large ? s.valueLine : s.valueSide}>
    <T style={[valueStyles.amount, large && valueStyles.alignStart]}>{value.amount}</T>
    <T style={[valueStyles.basis, large && valueStyles.alignStart]} numberOfLines={1}>{value.basis}</T>
  </View>;
}

/**
 * An offer in the list: one press that opens it, heard as the person and everything the card shows. The drawing is the
 * shared hairline card with no shadow; a chosen offer carries the selection's green edge.
 */
export const CandidateCard = memo(function CandidateCard({ candidate: k, timezone, onOpen, photo, large, narrow = false }: {
  candidate: KandidatProjekcija; timezone?: string | null; onOpen: () => void; photo?: ReactNode;
  /** The owner's large text: the value takes its own line and the message two. */ large: boolean;
  /** A phone under 360 dp: the value takes its own line, so a name is not squeezed into a third of the card. */ narrow?: boolean;
}) {
  const status = candidateStatus(k), value = candidateValue(k), time = candidateTime(k, timezone);
  const message = k.napomena?.trim() ?? '';
  const stacked = large || narrow;
  return <Press accessibilityRole="button" accessibilityLabel={`Pogledaj ponudu: ${k.ime}`} accessibilityHint={candidateSpoken(k, time)}
    haptic="select" scaleTo={0.986} onPress={onOpen} style={[s.card, k.stanje === 'SELECTED' && s.chosen]}>
    {status ? <CandidateStatusLine status={status} /> : null}
    <View style={s.head}>
      <CandidateAvatar candidate={k} size={40} photo={photo} />
      <View style={s.identity}>
        <T style={s.name} numberOfLines={3}>{k.ime}</T>
        <CandidateTrustLine candidate={k} />
      </View>
      {stacked ? null : <CandidateValueSlot value={value} large={false} />}
    </View>
    {stacked ? <CandidateValueSlot value={value} large /> : null}
    {message ? <T style={s.message} numberOfLines={large ? 2 : 1} ellipsizeMode="tail">{message}</T> : null}
    {time ? <CardFact art={<FactArt kind="calendar" size={16} />} text={time} lines={2} /> : null}
  </Press>;
});

/**
 * The height of a comparison column's person part at its fullest: the 40 px picture, a three-line name and a two-line
 * rating with the two gaps between them, the text part at the rounded text scale. Two columns side by side hold their
 * person to it, so their cells line up whatever the names (review r4 rk item 6: a fixed 132 was shorter than a three-line
 * name beside the picture, and the columns slipped).
 */
export function compareIdentityHeight(scale: number): number {
  const text = 3 * sys.type.cardTitleCompact.lineHeight! + 2 * TRUST_LINE;
  return Math.ceil(40 + 2 * COMPARE_IDENTITY_GAP + text * scale);
}
const TRUST_LINE = 17, COMPARE_IDENTITY_GAP = 6;

/**
 * An offer as a comparison column: the same person on top, then the same three cells in the same order in every column —
 * the total, the people, the time — so two offers line up cell by cell. `aligned` holds the person's part to one height
 * when two columns stand side by side.
 */
export const CandidateCompareCard = memo(function CandidateCompareCard({ candidate: k, timezone, fallbackTime, onOpen, photo, aligned }: {
  candidate: KandidatProjekcija; timezone?: string | null; fallbackTime: string; onOpen: () => void; photo?: ReactNode; aligned: boolean;
}) {
  const status = candidateStatus(k), value = candidateValue(k), time = candidateTime(k, timezone);
  const scale = useTextScale();
  return <Press accessibilityRole="button" accessibilityLabel={`Otvori prijavu: ${k.ime}`} accessibilityHint={candidateSpoken(k, time)}
    haptic="select" scaleTo={0.986} onPress={onOpen} style={[s.compare, k.stanje === 'SELECTED' && s.chosen]}>
    <View style={[s.compareIdentity, aligned && { minHeight: compareIdentityHeight(scale) }]}>
      <CandidateAvatar candidate={k} size={40} photo={photo} />
      <T style={s.name} numberOfLines={3}>{k.ime}</T>
      <CandidateTrustLine candidate={k} />
    </View>
    <View style={s.cell}><T variant="label" tone="muted">Ukupno</T>
      {/* A column reads from its left edge: the quiet word too (review r4 rk item 7). */}
      {value.kind === 'amount' ? <T style={s.compareAmount}>{value.amount}</T>
        : <T style={[valueStyles.valueWord, valueStyles.alignStart]}>{UNPRICED}</T>}</View>
    <View style={s.cell}><T variant="label" tone="muted">Ljudi</T><T variant="bodyStrong" style={s.ink}>{osoba(k.pokrivaMesta)}</T></View>
    <View style={s.cell}><T variant="label" tone="muted">Termin</T><T variant="meta" style={s.ink}>{time ?? fallbackTime}</T></View>
    {status ? <CandidateStatusLine status={status} /> : null}
  </Press>;
});

/**
 * The person at the head of their offer, under the sheet's title, which is their name (review r4 rk item 3): the 56 px
 * picture and the rating beside it. The name is not drawn again; the row still says it to a screen reader, as the person
 * first, with what a press does as its hint (as the task's poster row is). It opens their public profile.
 */
export function CandidatePerson({ candidate: k, photo, onPress, disabled = false }: {
  candidate: KandidatProjekcija; photo?: ReactNode; onPress: () => void; disabled?: boolean;
}) {
  const trust = candidateTrust(k);
  // No heading role inside the press: a screen reader never reaches a heading that lives in a button (review r4 rk item
  // 3). The sheet's own title is the heading.
  return <Press accessibilityRole="button" accessibilityLabel={`${k.ime}, ${trust.spoken}`} accessibilityHint="Otvara javni profil"
    accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={0.99} onPress={onPress} style={s.person}>
    <CandidateAvatar candidate={k} size={56} photo={photo} />
    <View style={s.identity}>
      <CandidateTrustLine candidate={k} lines={3} />
    </View>
    <CaretRight size={20} color={sys.color.muted} />
  </Press>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  // Type and spacing from the tokens (review r4 rk item 6): the spacing scale's 8, the compact card title, the note.
  card: { ...cardCompact, gap: sys.space.sm },
  // Selection is green (owner, 2026-09-24): the chosen offer keeps the white card and takes the green edge.
  chosen: { borderColor: sys.color.green },
  status: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  statusText: { flexShrink: 1, letterSpacing: 0.3 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...sys.type.cardTitleCompact, color: sys.color.ink },
  trust: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { flexShrink: 1, fontSize: 13, lineHeight: TRUST_LINE, fontWeight: '500', color: sys.color.muted, fontVariant: ['tabular-nums'] },
  // The amount keeps its whole width, whatever the phone and the text size: the name beside it is what gives way.
  valueSide: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '46%' },
  valueLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  message: { ...sys.type.note, color: sys.color.ink },
  compare: { ...cardCompact, flex: 1, minWidth: 0, padding: 14, gap: 8 },
  compareIdentity: { gap: COMPARE_IDENTITY_GAP },
  cell: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderColor: sys.color.line },
  compareAmount: { ...sys.type.priceRow, color: sys.color.money },
  person: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
});
