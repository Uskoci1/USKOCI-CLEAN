import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Icon } from './icons';
import { v2 } from './tokens';

export type AgreementTab = 'pregled' | 'poruke';
export function AgreementTabs({ tab, onChange }: { tab: AgreementTab; onChange: (tab: AgreementTab) => void }) {
  return <View style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: 14, backgroundColor: v2.color.soft }}>
    {(['pregled', 'poruke'] as const).map(value => <Press key={value} accessibilityRole="tab"
      accessibilityLabel={value === 'pregled' ? 'Pregled' : 'Poruke'} accessibilityState={{ selected: value === tab }}
      haptic="select" onPress={() => onChange(value)} style={{ flex: 1, minHeight: 44, borderRadius: 11,
        alignItems: 'center', justifyContent: 'center', backgroundColor: value === tab ? v2.color.surface : 'transparent' }}>
      <T style={{ ...v2.text.body, fontSize: 14, fontWeight: '700', color: value === tab ? v2.color.ink : v2.color.muted }}>
        {value === 'pregled' ? 'Pregled' : 'Poruke'}
      </T>
    </Press>)}
  </View>;
}
const states: Record<DogovorProjekcija['stanje'], string> = {
  CONFIRMED: 'Dogovoreno', AWAITING_REQUESTER: 'Čeka se potvrda završetka', COMPLETED: 'Završeno', CANCELLED: 'Otkazano',
};
const people = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'osoba' : n % 10 >= 2 && n % 10 <= 4 ? 'osobe' : 'osoba'}`;
export function AgreementHero({ agreement: a, compact = false, onOpen }: {
  agreement: DogovorProjekcija; compact?: boolean; onOpen?: () => void;
}) {
  if (compact) return <Press accessibilityRole="button" accessibilityLabel="Pregled uslova Dogovora" onPress={onOpen}
    haptic="select" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
      backgroundColor: v2.color.context, borderWidth: 1, borderColor: v2.color.contextLine, borderRadius: 16 }}>
    <V2Icon name="chat" />
    <View style={{ flex: 1, gap: 3 }}>
      <T style={{ ...v2.text.body, fontSize: 14, fontWeight: '700', color: v2.color.ink }} numberOfLines={2}>{a.naslov}</T>
      <T style={{ ...v2.text.label, color: v2.color.muted }}>{a.cena.prikaz} · {people(a.pokrivenost.popunjeno)} · {states[a.stanje]}</T>
    </View><V2Icon name="chevron" size={18} />
  </Press>;
  return <View style={{ gap: v2.space.lg, paddingVertical: v2.space.sm }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <V2Icon name="chat" size={18} color={v2.color.teal} />
      <T style={{ ...v2.text.label, color: v2.color.teal, fontWeight: '700' }}>{states[a.stanje]}{a.verzija > 1 ? ` · verzija ${a.verzija}` : ''}</T>
    </View>
    <T accessibilityRole="header" style={{ ...v2.text.hero, fontSize: 28, lineHeight: 32, color: v2.color.ink }}>{a.naslov}</T>
    <View style={{ gap: 7 }}>
      <T style={{ ...v2.text.label, color: v2.color.muted }}>{a.rezim === 'DALJINSKI' ? 'Na daljinu' : a.putanjaTekst}</T>
      <T style={{ ...v2.text.label, color: v2.color.muted }}>{a.vremeTekst}</T>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: v2.space.md, paddingTop: 10 }}>
      <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
        <T style={{ ...v2.text.hero, fontSize: 28, lineHeight: 34, color: v2.color.ink }}>{a.cena.prikaz}</T>
        <T style={{ ...v2.text.label, color: v2.color.muted }}>dogovoreno</T>
      </View>
      <View style={{ backgroundColor: v2.color.soft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 }}>
        <T style={{ ...v2.text.label, fontWeight: '700', color: v2.color.ink }}>{people(a.pokrivenost.popunjeno)}</T>
      </View>
    </View>
  </View>;
}
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <View style={{ backgroundColor: v2.color.surface, borderWidth: 1, borderColor: v2.color.line, borderRadius: 18, paddingHorizontal: 18 }}>
    {agreement.ucesnici.map((person, index) => <View key={person.id} style={{ paddingVertical: 17, flexDirection: 'row',
      alignItems: 'center', gap: 12, borderTopWidth: index ? 1 : 0, borderColor: v2.color.line }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: v2.color.soft, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ ...v2.text.label, color: v2.color.ink, fontWeight: '700' }}>{person.inicijali}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ ...v2.text.body, fontWeight: '700', color: v2.color.ink }}>{person.ime}</T>
        <T style={{ ...v2.text.label, color: v2.color.muted }}>{person.viSte ? 'Vi · ' : ''}{person.uloga === 'narucilac' ? 'Naručilac' : 'Uskočer'}
          {person.mesta !== null ? ` · ${people(person.mesta)}` : ''}</T>
      </View>
    </View>)}
  </View>;
}
export function AgreementSection({ label, summary, children }: { label: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={{ borderWidth: 1, borderColor: v2.color.line, borderRadius: 18, backgroundColor: v2.color.surface, overflow: 'hidden' }}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} haptic="select"
      onPress={() => setOpen(value => !value)} style={{ minHeight: 66, padding: 18, gap: 12, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 2 }}><T style={{ ...v2.text.body, color: v2.color.ink }}>{label}</T>
        {summary ? <T style={{ ...v2.text.label, color: v2.color.muted }}>{summary}</T> : null}</View>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} /></View>
    </Press>
    {open ? <View style={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}>{children}</View> : null}
  </View>;
}
