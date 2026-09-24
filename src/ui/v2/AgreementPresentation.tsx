import type { ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { DetailFact, DetailFacts, ProductTitle } from '../product/ProductDetails';
import { Avatar } from '../system/Avatar';
import { ScreenChrome } from '../system/ScreenChrome';
import { Disclosure } from '../system/Disclosure';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Segmented } from '../system/Segmented';
import { sys } from '../system/tokens';
import { osoba } from '../system/plural';
import { BEZ_IZNOSA } from '../../lib/novac';
import { T } from '../Text';

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
 * The top bar of a Dogovor (V41, owner 2026-09-23): the arrow back, then the person on the other side, their
 * face or initials and their name, with the Dogovor's state under it. It is the same on Pregled and Poruke, so a
 * tab never changes whom the screen is about. It is the one chrome's detail bar with the face as its lead, so the
 * arrow, the height and the name's style are every other screen's. No rating is drawn: the Dogovor does not carry
 * one, and "Još nema ocena" would be a claim about someone who may have many.
 */
export function AgreementPersonBar({ person, state, back }: {
  person: UcesnikProjekcija; state: DogovorProjekcija['stanje']; back: () => void;
}) {
  // The one Avatar: a missing name draws the person, never an empty disc.
  const initials = <Avatar initials={person.inicijali} size={40} />;
  return <ScreenChrome variant="detail" onBack={back} title={person.ime} subtitle={states[state]}
    lead={person.profilId ? <ProfilePhoto profileId={person.profilId} size={40} fallback={initials} /> : initials} />;
}

/**
 * Accepted terms, never copied from the current Task. Compact form above Poruke leads back to
 * the overview. The state itself is spoken by the top bar and the next-step card.
 */
export function AgreementHero({ agreement: a, compact = false, onOpen }: {
  agreement: DogovorProjekcija; compact?: boolean; onOpen?: () => void;
}) {
  if (compact) return <Press accessibilityRole="button" accessibilityLabel="Pregled uslova Dogovora" onPress={onOpen} haptic="select" style={s.compact}>
    <FactArt kind="agreements" size={32} />
    <View style={s.grow}>
      <T variant="bodyStrong" style={s.ink} numberOfLines={2}>{readableTitle(a.naslov)}</T>
      {/* The state is in the top bar right above; said here too, it was said twice on one screen. */}
      <T variant="note" tone="muted">{a.cena.prikaz || BEZ_IZNOSA} · {osoba(a.pokrivenost.popunjeno)}</T>
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
  // The same four facts as a task, in the same list (2026-09-23), so an agreed Dogovor reads like the task it grew out of.
  return <View style={s.hero}>
    <ProductTitle>{readableTitle(a.naslov)}</ProductTitle>
    <DetailFacts>
      <DetailFact art={a.rezim === 'DALJINSKI' ? 'remote' : 'pin'} label="Mesto" value={a.rezim === 'DALJINSKI' ? 'Na daljinu' : a.putanjaTekst} />
      <DetailFact art="calendar" label="Termin" value={a.vremeTekst} />
      <DetailFact art="users" label="Ljudi" value={osoba(a.pokrivenost.popunjeno)} note={a.verzija > 1 ? `verzija ${a.verzija}` : undefined} />
      {/* A Dogovor without a saved amount says so in words, in ink, and without "dogovoreno ukupno" under it. */}
      <DetailFact art="money" label="Dogovoreno ukupno" value={a.cena.prikaz || BEZ_IZNOSA} note={a.cena.prikaz ? 'dogovoreno ukupno' : undefined} spokenNote=""
        money={/\d/.test(a.cena.prikaz)} />
    </DetailFacts>
  </View>;
}

/** Both sides of the Dogovor, each with role and seats; you are marked in words. Flat rows, no card. */
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <View style={s.people}>
    {/* pkg024a: the read names each side's public profile, so the person you agreed to work with
        has a face here. Without that id there is nothing to read a photograph by, and the initials
        stay — an account id must never be handed to the media service in its place. */}
    {agreement.ucesnici.map((person, index) => <View key={person.id} style={[s.person, index ? s.personDivider : null]}>
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
  hero: { gap: 12 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 13, borderRadius: sys.radius.control, backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  people: { borderTopWidth: 1, borderTopColor: sys.color.line },
  person: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  personDivider: {},
});
