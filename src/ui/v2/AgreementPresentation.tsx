import type { ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Avatar } from '../system/Avatar';
import { ScreenChrome } from '../system/ScreenChrome';
import { Disclosure } from '../system/Disclosure';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Segmented } from '../system/Segmented';
import { sys } from '../system/tokens';
import { useTextScale } from '../system/textScale';
import { osoba } from '../system/plural';
import { BEZ_IZNOSA } from '../../lib/novac';
import { T } from '../Text';
import { WaitingDot } from './TaskFace';

export type AgreementTab = 'pregled' | 'poruke';
const TABS = [{ key: 'pregled', label: 'Pregled' }, { key: 'poruke', label: 'Poruke' }] as const;
/** Pregled | Poruke are the two main sections of a Dogovor (V5 CODEX §16); actions live in rows and sheets. */
export function AgreementTabs({ tab, onChange }: { tab: AgreementTab; onChange: (tab: AgreementTab) => void }) {
  return <Segmented options={TABS} value={tab} onChange={onChange} appearance="underline" />;
}

const states: Record<DogovorProjekcija['stanje'], string> = {
  CONFIRMED: 'Dogovoreno', AWAITING_REQUESTER: 'Čeka se potvrda završetka', COMPLETED: 'Završeno', CANCELLED: 'Otkazano',
};
export const agreementStateText = (state: DogovorProjekcija['stanje']) => states[state];

/**
 * What the OTHER person is to me, in the third person, from the Dogovor's own participants (owner, 2026-09-19): their
 * name stands first, so a sentence about me beside it ("Uskočio si") read as if it were about them. The card, the
 * Dogovor's bar and its people rows say it with these words. Empty when the Dogovor does not say.
 */
export function agreementRole(person: Pick<UcesnikProjekcija, 'uloga'> | null | undefined): string {
  return person?.uloga === 'narucilac' ? 'Traži pomoć' : person?.uloga === 'uskocer' ? 'Uskače na tvoj zadatak' : '';
}

/** The adapter's sentence for an accepted term with neither end (agreementClientService.acceptedSchedule). */
const NO_TERM = 'Termin nije potvrđen';
/** A Dogovor that is over never had an exact time, and is no longer waiting for one (round-1 critique A3). */
export const NO_EXACT_TERM = 'Bez tačnog termina';
const SERBIAN_TIME = /\s*\(po vremenu u Srbiji\)/;

/**
 * The accepted term as a list and the overview draw it (round-1 critique A3, B15): the date as one line, and the zone
 * note, which a phone set outside Serbia carries, on a quiet line of its own instead of breaking the date over three.
 * The words are the adapter's, in Serbian time; only where they stand changes. A finished or cancelled Dogovor whose term
 * never had an end or a start says "Bez tačnog termina": "Termin nije potvrđen" read as a step still to come.
 */
export function agreementTerm({ vremeTekst, stanje }: Pick<DogovorProjekcija, 'vremeTekst' | 'stanje'>): { line: string; zone: string | null } {
  const text = vremeTekst.trim();
  if (text === NO_TERM && (stanje === 'COMPLETED' || stanje === 'CANCELLED')) return { line: NO_EXACT_TERM, zone: null };
  const zone = SERBIAN_TIME.exec(text);
  if (!zone) return { line: text, zone: null };
  return { line: `${text.slice(0, zone.index)}${text.slice(zone.index + zone[0].length)}`.trim(), zone: 'Po vremenu u Srbiji' };
}

/**
 * A Dogovor on a task for more than one person. Only there does the list of both sides say something the bar does not;
 * on a 1:1 Dogovor the bar already names the one other person (round-1 critique A13).
 */
export const isGroupAgreement = (agreement: Pick<DogovorProjekcija, 'pokrivenost' | 'ucesnici'>) =>
  agreement.pokrivenost.ukupno > 1 || agreement.ucesnici.length > 2;

/** How many people this Dogovor covers, said only when it is not the one person the bar already shows (A13). */
export const agreementPeople = (agreement: Pick<DogovorProjekcija, 'pokrivenost'>): string | null =>
  agreement.pokrivenost.popunjeno === 1 ? null : osoba(agreement.pokrivenost.popunjeno);

/**
 * The top bar of a Dogovor: the arrow back, then the person on the other side, their face or initials and their name,
 * with what they are to me under it. It is the same on Pregled and Poruke, so a tab never changes whom the screen is
 * about. The Dogovor's state is said once, in the step under the terms, not here as well (round-1 critique A13). It is
 * the one chrome's detail bar with the face as its lead. No rating is drawn: the Dogovor does not carry one, and
 * "Još nema ocena" would be a claim about someone who may have many.
 */
export function AgreementPersonBar({ person, back }: { person: UcesnikProjekcija; back: () => void }) {
  // The one Avatar: a missing name draws the person, never an empty disc.
  const initials = <Avatar initials={person.inicijali} size={40} />;
  return <ScreenChrome variant="detail" onBack={back} title={person.ime} subtitle={agreementRole(person) || undefined}
    lead={person.profilId ? <ProfilePhoto profileId={person.profilId} size={40} fallback={initials} /> : initials} />;
}

/**
 * One accepted fact as a row (round-1 critique B17): its 24 px drawing, the value at 17/22 and, under it, a quiet line
 * when the value has one (the zone of a term). A row is at least 36 high, so four facts take the height one used to.
 * It is heard as one sentence, "Termin: 24. sep · 17:00–19:00, Po vremenu u Srbiji". An amount wears the money colour
 * with its basis beside it; a word about money ("Iznos nije sačuvan") stays ink and has no basis.
 */
export function AgreementFact({ art, label, value, note, basis, money = false }: {
  art: FactArtKind; label: string; value: string; note?: string | null; basis?: string | null; money?: boolean;
}) {
  return <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} style={s.fact}>
    <View style={s.factArt}><FactArt kind={art} size={24} /></View>
    <View style={s.factCopy}>
      <T style={money ? s.factMoney : s.factValue}>{value}{money && basis ? <T style={s.factBasis}>{` ${basis}`}</T> : null}</T>
      {note ? <T variant="meta" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

/**
 * Accepted terms, never copied from the current Task. Compact form under the tabs of Poruke leads back to the overview.
 * The state itself is said once, by the step under these facts.
 */
export function AgreementHero({ agreement: a, compact = false, onOpen, waiting = null }: {
  agreement: DogovorProjekcija; compact?: boolean; onOpen?: () => void;
  /**
   * Compact only: what the Dogovor waits for from me (`agreementWaitsForMe`), or null. It takes the summary's second
   * line, with the waiting dot, and is heard after the summary's name.
   */
  waiting?: string | null;
}) {
  const people = agreementPeople(a);
  const scale = useTextScale();
  // The spoken name carries the visible title, so a Voice Access user can say what they see (verify r4c item 7).
  const title = readableTitle(a.naslov);
  if (compact) return <Press accessibilityRole="button" accessibilityLabel={`Pregled uslova: ${title}${waiting ? `. ${waiting}` : ''}`}
    onPress={onOpen} haptic="select" style={s.compact}>
    <FactArt kind="agreements" size={24} />
    <View style={s.grow}>
      <T variant="bodyStrong" style={s.ink} numberOfLines={1}>{title}</T>
      {/* When the Dogovor waits for me, that is the line (review r4 rd: the bar used to say the state above Poruke, and
          the conversation then no longer said it): the waiting foot's orange dot and words, up to two lines. The terms
          are one press away. Otherwise the price, and the people beyond one; the person is in the bar right above, so
          "1 osoba" beside them said them twice. At large text the sentence gets four lines, so it is never cut to "…"
          at 320 dp, and the dot stands beside its first line (verify r4c item 1). */}
      {waiting ? <View style={s.waiting}>
        <View style={{ height: Math.round(sys.type.note.lineHeight * scale), justifyContent: 'center' }}><WaitingDot /></View>
        <T variant="note" style={s.waitingText} numberOfLines={scale >= 1.3 ? 4 : 2}>{waiting}</T></View>
        : <T variant="note" tone="muted" numberOfLines={1}>{a.cena.prikaz || BEZ_IZNOSA}{people ? ` · ${people}` : ''}</T>}
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
  const term = agreementTerm(a), remote = a.rezim === 'DALJINSKI', amount = a.cena.prikaz;
  // The route presents the real next step first. These accepted terms read as an appointment record, not another
  // task advertisement: schedule leads; work, place and group size follow; the total remains a restrained receipt.
  return <View style={s.hero}>
    <View style={s.termsHeading}>
      <T variant="meta" style={s.termsLabel}>Prihvaćeni uslovi</T>
      {a.verzija > 1 ? <T variant="meta" tone="muted">Verzija uslova: {a.verzija}</T> : null}
    </View>
    <View style={s.acceptedAppointment}>
      <AgreementFact art="calendar" label="Termin" value={term.line} note={term.zone} />
      <T accessibilityRole="header" style={s.acceptedTitle}>{title}</T>
      <View style={s.facts}>
        <AgreementFact art={remote ? 'remote' : 'pin'} label="Mesto" value={remote ? 'Na daljinu' : a.putanjaTekst || 'Mesto nije navedeno'} />
        {people ? <AgreementFact art="users" label="Ljudi" value={people} /> : null}
      </View>
    </View>
    {/* A Dogovor without a saved amount says so in words, in ink, and without "ukupno" beside it. */}
    <View style={s.acceptedPrice}>
      <AgreementFact art="money" label="Dogovoreno ukupno" value={amount || BEZ_IZNOSA} basis={amount ? 'ukupno' : null} money={/\d/.test(amount)} />
    </View>
  </View>;
}

/**
 * Both sides of a group Dogovor, each with role and seats; you are marked in words. Flat rows, no card. A 1:1 Dogovor
 * does not draw it: the bar names the one other person (round-1 critique A13).
 */
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <View style={s.people}>
    {/* pkg024a: the read names each side's public profile, so the person you agreed to work with
        has a face here. Without that id there is nothing to read a photograph by, and the initials
        stay — an account id must never be handed to the media service in its place. */}
    {agreement.ucesnici.map(person => <View key={person.id} style={s.person}>
      {person.profilId
        ? <ProfilePhoto profileId={person.profilId} size={56} fallback={<Avatar initials={person.inicijali} size={56} />} />
        : <Avatar initials={person.inicijali} size={56} />}
      <View style={s.grow}>
        <T variant="bodyStrong" style={s.ink}>{person.ime}</T>
        <T variant="note" tone="muted">{person.uloga === 'narucilac' ? (person.viSte ? 'Ti · tražiš pomoć' : 'Traži pomoć') : person.viSte ? 'Ti · uskačeš' : 'Uskače'}
          {person.mesta !== null ? ` · ${osoba(person.mesta)}` : ''}</T>
      </View>
    </View>)}
  </View>;
}

/** A row that opens in place under its hairline: the one `Disclosure`, closed until pressed; `expanded` is spoken. */
export function AgreementSection({ label, summary, art, children }: { label: string; summary?: string; art?: FactArtKind; children: ReactNode }) {
  return <Disclosure label={label} hint={summary} art={art} divider>{children}</Disclosure>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: 2 }, ink: { color: sys.color.ink },
  hero: { gap: 20 },
  termsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  termsLabel: { color: sys.color.muted, fontWeight: '600' },
  acceptedAppointment: { borderLeftWidth: 2, borderLeftColor: sys.color.green, paddingLeft: 18, gap: 12 },
  acceptedTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4, color: sys.color.ink },
  facts: { gap: 4 },
  acceptedPrice: { borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: 12 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 36, paddingVertical: 6 },
  // The box is the drawing's own 24, so it does not spill 1 px over and under (review r4 rd, small note).
  factArt: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  factCopy: { flex: 1, minWidth: 0 },
  factValue: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: sys.color.ink },
  factMoney: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: sys.color.money, fontVariant: ['tabular-nums'] },
  factBasis: { fontSize: 14, lineHeight: 22, fontWeight: '500', color: sys.color.muted },
  // The accepted-summary shortcut stays light; a hairline separates it from the transcript without another tinted box.
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: sys.color.line, backgroundColor: sys.color.surface },
  // The waiting foot's line (TaskFace `CardWaitingLine`), allowed a second line: a whole step does not fit one.
  waiting: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  waitingText: { flexShrink: 1, fontWeight: '700', color: sys.color.warn },
  people: { borderTopWidth: 1, borderTopColor: sys.color.line },
  person: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
});
