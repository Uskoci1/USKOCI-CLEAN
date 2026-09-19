import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretRight, ChatCircle, Clock, MapPin, Users, Wallet } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { Fact, FactGrid } from '../system/Detail';
import { Segmented } from '../system/Segmented';
import { card, sys } from '../system/tokens';
import { T } from '../Text';

export type AgreementTab = 'pregled' | 'poruke';
const TABS = [{ key: 'pregled', label: 'Pregled' }, { key: 'poruke', label: 'Poruke' }] as const;
/** Pregled | Poruke are the two main sections of a Dogovor (V5 CODEX §16); actions live in rows and sheets. */
export function AgreementTabs({ tab, onChange }: { tab: AgreementTab; onChange: (tab: AgreementTab) => void }) {
  return <Segmented options={TABS} value={tab} onChange={onChange} />;
}

const states: Record<DogovorProjekcija['stanje'], string> = {
  CONFIRMED: 'Dogovoreno', AWAITING_REQUESTER: 'Čeka se potvrda završetka', COMPLETED: 'Završeno', CANCELLED: 'Otkazano',
};
export const agreementStateText = (state: DogovorProjekcija['stanje']) => states[state];
export const peopleText = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'osoba' : n % 10 >= 2 && n % 10 <= 4 ? 'osobe' : 'osoba'}`;

/**
 * The accepted facts of a Dogovor: the title and a four-fact grid (where, when,
 * agreed price, people). Compact form is the pill above Poruke that leads back to
 * the overview. The state itself is spoken by the top bar and the next-step card.
 */
export function AgreementHero({ agreement: a, compact = false, onOpen }: {
  agreement: DogovorProjekcija; compact?: boolean; onOpen?: () => void;
}) {
  if (compact) return <Press accessibilityRole="button" accessibilityLabel="Pregled uslova Dogovora" onPress={onOpen} haptic="select" style={s.compact}>
    <View style={s.compactIcon}><ChatCircle size={20} color={sys.color.green} /></View>
    <View style={s.grow}>
      <T variant="bodyStrong" style={s.ink} numberOfLines={2}>{a.naslov}</T>
      <T variant="note" tone="muted">{a.cena.prikaz} · {peopleText(a.pokrivenost.popunjeno)} · {states[a.stanje]}</T>
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
  return <View style={s.hero}>
    <T accessibilityRole="header" style={s.title}>{a.naslov}</T>
    <FactGrid>
      <Fact icon={MapPin} label="Mesto" value={a.rezim === 'DALJINSKI' ? 'Na daljinu' : a.putanjaTekst} />
      <Fact icon={Clock} label="Termin" value={a.vremeTekst} />
      <Fact icon={Wallet} label="Dogovoreno ukupno" value={a.cena.prikaz} money />
      <Fact icon={Users} label="Ljudi" value={peopleText(a.pokrivenost.popunjeno)} note={a.verzija > 1 ? `verzija ${a.verzija}` : undefined} />
    </FactGrid>
  </View>;
}

/** Both sides of the Dogovor, each with role and seats; you are marked in words. */
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <View style={[card, s.people]}>
    {agreement.ucesnici.map((person, index) => <View key={person.id} style={[s.person, index ? s.personDivider : null]}>
      <View style={s.avatar}><T variant="label" style={s.initials}>{person.inicijali}</T></View>
      <View style={s.grow}>
        <T variant="bodyStrong" style={s.ink}>{person.ime}</T>
        <T variant="note" tone="muted">{person.uloga === 'narucilac' ? (person.viSte ? 'Ti · objavio si zadatak' : 'Objavio zadatak') : person.viSte ? 'Ti · uskočio si' : 'Uskočio'}
          {person.mesta !== null ? ` · ${peopleText(person.mesta)}` : ''}</T>
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
  title: { ...sys.type.pageTitle, color: sys.color.ink },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 13, borderRadius: sys.radius.control, backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  compactIcon: { width: 36, height: 36, borderRadius: sys.radius.chip, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  people: { paddingVertical: 4 },
  person: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personDivider: { borderTopWidth: 1, borderTopColor: sys.color.line },
  avatar: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { color: sys.color.green, letterSpacing: 0 },
  section: { padding: 0, overflow: 'hidden' },
  sectionRow: { minHeight: 62, paddingHorizontal: 18, paddingVertical: 14, gap: 12, flexDirection: 'row', alignItems: 'center' },
  sectionBody: { paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
});
