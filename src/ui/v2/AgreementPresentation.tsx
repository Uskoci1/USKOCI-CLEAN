import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Icon } from './icons';

export type AgreementTab = 'pregled' | 'poruke';
export function AgreementTabs({ tab, onChange }: { tab: AgreementTab; onChange: (tab: AgreementTab) => void }) {
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: sys.radius.control + 2, backgroundColor: sys.color.control }}>
    {(['pregled', 'poruke'] as const).map(value => <Press key={value} accessibilityRole="tab"
      accessibilityLabel={value === 'pregled' ? 'Pregled' : 'Poruke'} accessibilityState={{ selected: value === tab }}
      haptic="select" scaleTo={0.98} onPress={() => onChange(value)} style={{ flex: 1, minHeight: 44, borderRadius: sys.radius.control - 2,
        alignItems: 'center', justifyContent: 'center', backgroundColor: value === tab ? sys.color.surface : 'transparent', ...(value === tab ? sys.elevation.card : null) }}>
      <T variant="action" style={{ color: value === tab ? sys.color.ink : sys.color.muted, fontWeight: value === tab ? '700' : '600' }}>
        {value === 'pregled' ? 'Pregled' : 'Poruke'}
      </T>
    </Press>)}
  </View>;
}
const states: Record<DogovorProjekcija['stanje'], string> = {
  CONFIRMED: 'Dogovoreno', AWAITING_REQUESTER: 'Čeka se potvrda završetka', COMPLETED: 'Završeno', CANCELLED: 'Otkazano',
};
export const agreementStateText = (state: DogovorProjekcija['stanje']) => states[state];
export const peopleText = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'osoba' : n % 10 >= 2 && n % 10 <= 4 ? 'osobe' : 'osoba'}`;
const stateColor = (state: DogovorProjekcija['stanje']) => state === 'CANCELLED' ? sys.color.muted : state === 'AWAITING_REQUESTER' ? sys.color.warn : sys.color.green;

export function AgreementHero({ agreement: a, compact = false, onOpen }: {
  agreement: DogovorProjekcija; compact?: boolean; onOpen?: () => void;
}) {
  if (compact) return <Press accessibilityRole="button" accessibilityLabel="Pregled uslova Dogovora" onPress={onOpen}
    haptic="select" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
      backgroundColor: sys.color.greenSoft, borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card - 2 }}>
    <V2Icon name="chat" color={sys.color.green} />
    <View style={{ flex: 1, gap: 3 }}>
      <T variant="bodyStrong" style={{ color: sys.color.ink }} numberOfLines={2}>{a.naslov}</T>
      <T variant="meta" tone="muted">{a.cena.prikaz} · {peopleText(a.pokrivenost.popunjeno)} · {states[a.stanje]}</T>
    </View><V2Icon name="chevron" size={18} color={sys.color.muted} />
  </Press>;
  return <View style={{ gap: sys.space.lg, paddingVertical: sys.space.sm }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stateColor(a.stanje) }} />
      <T variant="meta" style={{ color: stateColor(a.stanje), fontWeight: '600' }}>{states[a.stanje]}{a.verzija > 1 ? ` · verzija ${a.verzija}` : ''}</T>
    </View>
    <T accessibilityRole="header" style={{ ...sys.type.display, fontSize: 28, lineHeight: 33, color: sys.color.ink }}>{a.naslov}</T>
    <View style={{ gap: 6 }}>
      <T variant="meta" tone="muted">{a.rezim === 'DALJINSKI' ? 'Na daljinu' : a.putanjaTekst}</T>
      <T variant="meta" tone="muted">{a.vremeTekst}</T>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: sys.space.md, paddingTop: 6 }}>
      <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
        <T style={{ ...sys.type.price, fontSize: 28, lineHeight: 34, color: sys.color.money }}>{a.cena.prikaz}</T>
        <T variant="meta" tone="muted">dogovoreno</T>
      </View>
      <View style={{ backgroundColor: sys.color.greenSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
        <T variant="meta" style={{ fontWeight: '700', color: sys.color.ink }}>{peopleText(a.pokrivenost.popunjeno)}</T>
      </View>
    </View>
  </View>;
}
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <View style={{ backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card, paddingHorizontal: 18 }}>
    {agreement.ucesnici.map((person, index) => <View key={person.id} style={{ paddingVertical: 16, flexDirection: 'row',
      alignItems: 'center', gap: 12, borderTopWidth: index ? 1 : 0, borderColor: sys.color.line }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
        <T variant="label" style={{ color: sys.color.green }}>{person.inicijali}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" style={{ color: sys.color.ink }}>{person.ime}</T>
        <T variant="meta" tone="muted">{person.viSte ? 'Vi · ' : ''}{person.uloga === 'narucilac' ? 'Naručilac' : 'Uskočer'}
          {person.mesta !== null ? ` · ${peopleText(person.mesta)}` : ''}</T>
      </View>
    </View>)}
  </View>;
}
export function AgreementSection({ label, summary, children }: { label: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={{ borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card, backgroundColor: sys.color.surface, overflow: 'hidden' }}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} haptic="select"
      onPress={() => setOpen(value => !value)} style={{ minHeight: 66, padding: 18, gap: 12, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 2 }}><T variant="bodyStrong" style={{ color: sys.color.ink }}>{label}</T>
        {summary ? <T variant="meta" tone="muted">{summary}</T> : null}</View>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} color={sys.color.muted} /></View>
    </Press>
    {open ? <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>{children}</View> : null}
  </View>;
}
