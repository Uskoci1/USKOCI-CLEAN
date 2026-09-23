import { useState, type ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft, CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { DetailFact, DetailFacts, ProductTitle } from '../product/ProductDetails';
import { innerBar } from '../system/DetailTopBar';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Segmented } from '../system/Segmented';
import { iconButton, sys } from '../system/tokens';
import { osoba } from '../system/plural';
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
 * tab never changes whom the screen is about. The arrow is ProductHeader's own, press for press. No rating is
 * drawn: the Dogovor does not carry one, and "Još nema ocena" would be a claim about someone who may have many.
 */
export function AgreementPersonBar({ person, state, back }: {
  person: UcesnikProjekcija; state: DogovorProjekcija['stanje']; back: () => void;
}) {
  const initials = <View style={s.barAvatar}><T variant="label" style={s.barInitials}>{person.inicijali}</T></View>;
  return <View style={s.bar}>
    <Press accessibilityRole="button" accessibilityLabel="Nazad" accessibilityState={{ disabled: false }}
      disabled={false} onPress={back} haptic="select" style={iconButton}>
      <ArrowLeft size={22} color={sys.color.ink} />
    </Press>
    {person.profilId ? <ProfilePhoto profileId={person.profilId} size={44} fallback={initials} /> : initials}
    <View style={s.barCopy}>
      <T accessibilityRole="header" variant="heading" style={s.ink} numberOfLines={1}>{person.ime}</T>
      <T variant="meta" tone="muted" numberOfLines={1}>{states[state]}</T>
    </View>
  </View>;
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
      <T variant="note" tone="muted">{a.cena.prikaz} · {osoba(a.pokrivenost.popunjeno)}</T>
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
      <DetailFact art="money" label="Dogovoreno ukupno" value={a.cena.prikaz} note="dogovoreno ukupno" spokenNote="" money={/\d/.test(a.cena.prikaz)} />
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
        ? <ProfilePhoto profileId={person.profilId} size={48} fallback={<View style={s.avatar}><T variant="label" style={s.initials}>{person.inicijali}</T></View>} />
        : <View style={s.avatar}><T variant="label" style={s.initials}>{person.inicijali}</T></View>}
      <View style={s.grow}>
        <T variant="bodyStrong" style={s.ink}>{person.ime}</T>
        <T variant="note" tone="muted">{person.uloga === 'narucilac' ? (person.viSte ? 'Ti · tražiš pomoć' : 'Traži pomoć') : person.viSte ? 'Ti · uskačeš' : 'Uskače'}
          {person.mesta !== null ? ` · ${osoba(person.mesta)}` : ''}</T>
      </View>
    </View>)}
  </View>;
}

/** A row that opens in place under its hairline; `expanded` is spoken. */
export function AgreementSection({ label, summary, art, children }: { label: string; summary?: string; art?: FactArtKind; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={s.section}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} haptic="select"
      onPress={() => setOpen(value => !value)} style={s.sectionRow}>
      {art ? <View style={s.sectionArt}><FactArt kind={art} size={26} /></View> : null}
      <View style={s.grow}><T variant="bodyStrong" style={s.ink}>{label}</T>
        {summary ? <T variant="note" tone="muted">{summary}</T> : null}</View>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><CaretRight size={20} color={sys.color.muted} /></View>
    </Press>
    {open ? <View style={s.sectionBody}>{children}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: 2 }, ink: { color: sys.color.ink },
  bar: innerBar,
  barCopy: { flex: 1, minWidth: 0 },
  barAvatar: { width: 44, height: 44, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, borderWidth: 1, borderColor: sys.color.line,
    alignItems: 'center', justifyContent: 'center' },
  barInitials: { color: sys.color.green, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  hero: { gap: 12 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 13, borderRadius: sys.radius.control, backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  people: { borderTopWidth: 1, borderTopColor: sys.color.line },
  person: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  personDivider: {},
  avatar: { width: 48, height: 48, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { color: sys.color.green, letterSpacing: 0, fontSize: 17, lineHeight: 22 },
  section: { borderTopWidth: 1, borderTopColor: sys.color.line },
  sectionRow: { minHeight: 60, paddingVertical: 12, gap: 14, flexDirection: 'row', alignItems: 'center' },
  sectionArt: { width: 32, alignItems: 'center' },
  sectionBody: { paddingBottom: 16, paddingLeft: 46, gap: 12 },
});
