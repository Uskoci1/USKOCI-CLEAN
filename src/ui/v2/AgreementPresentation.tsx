import { useState, type ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { ProductFact, ProductFacts, ProductTitle } from '../product/ProductDetails';
import { FactArt } from '../system/FactArt';
import { Segmented } from '../system/Segmented';
import { card, sys } from '../system/tokens';
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
      <T variant="note" tone="muted">{a.cena.prikaz} · {osoba(a.pokrivenost.popunjeno)} · {states[a.stanje]}</T>
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
  return <View style={s.hero}>
    <ProductTitle>{readableTitle(a.naslov)}</ProductTitle>
    <ProductFacts>
      <ProductFact art={a.rezim === 'DALJINSKI' ? 'remote' : 'pin'} label="Mesto" value={a.rezim === 'DALJINSKI' ? 'Na daljinu' : a.putanjaTekst} />
      <ProductFact art="calendar" label="Termin" value={a.vremeTekst} />
      <ProductFact art="users" label="Ljudi" value={osoba(a.pokrivenost.popunjeno)} note={a.verzija > 1 ? `verzija ${a.verzija}` : undefined} />
      <ProductFact art="money" label="Dogovoreno ukupno" value={a.cena.prikaz} prominent />
    </ProductFacts>
  </View>;
}

/** Both sides of the Dogovor, each with role and seats; you are marked in words. */
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <View style={[card, s.people]}>
    {/* pkg024a: the read names each side's public profile, so the person you agreed to work with
        has a face here. Without that id there is nothing to read a photograph by, and the initials
        stay — an account id must never be handed to the media service in its place. */}
    {agreement.ucesnici.map((person, index) => <View key={person.id} style={[s.person, index ? s.personDivider : null]}>
      {person.profilId
        ? <ProfilePhoto profileId={person.profilId} size={64} fallback={<View style={s.avatar}><T variant="label" style={s.initials}>{person.inicijali}</T></View>} />
        : <View style={s.avatar}><T variant="label" style={s.initials}>{person.inicijali}</T></View>}
      <View style={s.grow}>
        <T variant="bodyStrong" style={s.ink}>{person.ime}</T>
        <T variant="note" tone="muted">{person.uloga === 'narucilac' ? (person.viSte ? 'Ti · objavio si zadatak' : 'Objavio zadatak') : person.viSte ? 'Ti · uskočio si' : 'Uskočio'}
          {person.mesta !== null ? ` · ${osoba(person.mesta)}` : ''}</T>
      </View>
    </View>)}
  </View>;
}

/** A section that opens in place; `expanded` is spoken. */
export function AgreementSection({ label, summary, children }: { label: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={[card, s.section]}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} haptic="select"
      onPress={() => setOpen(value => !value)} style={s.sectionRow}>
      <View style={s.grow}><T variant="bodyStrong" style={s.ink}>{label}</T>
        {summary ? <T variant="note" tone="muted">{summary}</T> : null}</View>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><CaretRight size={18} color={sys.color.muted} /></View>
    </Press>
    {open ? <View style={s.sectionBody}>{children}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: 2 }, ink: { color: sys.color.ink },
  hero: { gap: 12 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 13, borderRadius: sys.radius.control, backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  people: { paddingVertical: 4 },
  person: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personDivider: { borderTopWidth: 1, borderTopColor: sys.color.line },
  avatar: { width: 64, height: 64, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { color: sys.color.green, letterSpacing: 0, fontSize: 22, lineHeight: 28 },
  section: { padding: 0, overflow: 'hidden' },
  sectionRow: { minHeight: 62, paddingHorizontal: 18, paddingVertical: 14, gap: 12, flexDirection: 'row', alignItems: 'center' },
  sectionBody: { paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
});
