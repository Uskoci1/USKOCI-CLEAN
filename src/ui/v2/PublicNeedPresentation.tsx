import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { needGeographyRows, needPeopleText, needRequirementRows } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';
import { v2 } from './tokens';

const body = { ...v2.text.body, color: v2.color.ink };
const caption = { ...v2.text.label, color: v2.color.muted };
export function PublicNeedPresentation({ need, loading, error, missing, stale, busy, canApply, canRetry, back, retry, apply }: {
  need: PrilikaProjekcija | null; loading: boolean; error: boolean; missing: boolean; stale: boolean; busy: boolean;
  canApply: boolean; canRetry: boolean; back: () => void; retry: () => void; apply: () => void;
}) {
  const [expanded, setExpanded] = useState<'location' | 'requirements' | null>(null);
  const rows = expanded === 'location' && need ? needGeographyRows(need) : expanded === 'requirements' && need ? needRequirementRows(need) : [];
  const remote = need?.detalji?.rezimLokacije === 'REMOTE';
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: v2.color.canvas }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad na Zadatke" accessibilityState={{ disabled: busy }} disabled={busy}
        onPress={back} haptic="select" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><V2Icon name="back" /></Press>
      <T accessibilityRole="header" style={{ ...v2.text.title, color: v2.color.ink }}>Zadatak</T>
    </View>
    <ScrollView contentContainerStyle={{ padding: 22, gap: 22, paddingBottom: 32 }}>
      {loading || error || missing ? <View style={{ gap: 12 }} accessibilityLiveRegion="polite">
        {loading ? <><ActivityIndicator color={v2.color.teal} accessibilityLabel="Učitavamo zadatak" /><T style={caption}>Učitavamo zadatak…</T></>
          : <><T style={{ ...v2.text.title, color: v2.color.ink }}>{error ? 'Zadatak trenutno nije moguće učitati.' : 'Zadatak nije dostupan.'}</T>
            <T style={body}>{error ? 'Proverite internet vezu i pokušajte ponovo.' : 'Možda je zatvoren ili više nije dostupan vašem nalogu. Vratite se na Zadatke.'}</T>
            {canRetry ? <V2Action label="Pokušajte ponovo" onPress={retry} disabled={busy} /> : null}</>}
        {stale ? <T style={caption}>Poslednji učitani podaci. Osvežite zadatak pre nastavka.</T> : null}
      </View> : null}
      {need ? <>
        <View style={{ gap: 12 }}>
          <T style={{ ...caption, color: v2.color.teal, fontWeight: '700' }}>{need.statusTekst}</T>
          <T accessibilityRole="header" style={{ ...v2.text.hero, fontSize: 29, lineHeight: 34, letterSpacing: -0.5, color: v2.color.ink }}>{need.naslov}</T>
          <T style={caption}>{remote ? 'Na daljinu' : need.podrucjeTekst}</T>
          <T style={caption}>{need.vremeTekst}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 8 }}>
            <T style={{ ...v2.text.hero, flex: 1, minWidth: 150, color: v2.color.ink }}>{need.rezimCene === 'OFFERS' ? 'Tražim ponude' : need.ponudjenaCena?.prikaz ?? 'Cena nije navedena'}</T>
            <View style={{ backgroundColor: v2.color.soft, borderRadius: 10, padding: 9 }}><T style={{ ...caption, fontWeight: '700' }}>{needPeopleText(need.pokrivenost.ukupno)}</T></View>
          </View>
          <T style={caption}>Popunjeno {need.pokrivenost.popunjeno} od {need.pokrivenost.ukupno} mesta</T>
        </View>
        {need.opis ? <View style={{ gap: 10 }}><T style={{ ...body, fontWeight: '700' }}>Šta treba uraditi</T><T style={body}>{need.opis}</T></View> : null}
        <View style={{ borderWidth: 1, borderColor: v2.color.line, backgroundColor: v2.color.surface, borderRadius: 18, overflow: 'hidden' }}>
          {(['location', 'requirements'] as const).map((section, index) => <View key={section} style={{ borderTopWidth: index ? 1 : 0, borderColor: v2.color.line }}>
            <Press accessibilityRole="button" accessibilityLabel={section === 'location' ? 'Mesto izvršenja' : 'Uslovi Zadatka'} accessibilityState={{ expanded: expanded === section }}
              onPress={() => setExpanded(value => value === section ? null : section)} haptic="select"
              style={{ minHeight: 66, padding: 18, gap: 12, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 3 }}><T style={{ ...body, fontWeight: '700' }}>{section === 'location' ? remote ? 'Na daljinu' : 'Mesto izvršenja' : 'Uslovi'}</T>
                <T style={caption}>{section === 'location' ? remote ? 'Bez fizičke lokacije' : 'Približno područje' : needRequirementRows(need).length ? 'Pogledaj navedene uslove' : 'Bez dodatnih navedenih uslova'}</T></View>
              <View style={{ transform: [{ rotate: expanded === section ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} /></View>
            </Press>
            {expanded === section ? <View style={{ padding: 18, paddingTop: 0, gap: 14 }}>
              {rows.length ? rows.map((row, index) => <View key={index} style={{ gap: 4 }}><T style={caption}>{row.label}</T><T style={body}>{row.value}</T></View>)
                : <T style={caption}>Nema dodatnih navedenih uslova.</T>}
              {section === 'location' && !remote ? <T style={caption}>Precizni podaci o pristupu dele se u Dogovoru uz dozvolu.</T> : null}
            </View> : null}
          </View>)}
        </View>
        <View style={{ gap: 4 }}><T style={caption}>Naručilac</T><T style={{ ...body, fontWeight: '700' }}>{need.narucilacIme || 'Ime trenutno nije dostupno'}</T>
          {need.narucilacOcena !== null ? <T style={caption}>Ocena {need.narucilacOcena}</T> : null}</View>
      </> : null}
    </ScrollView>
    {need && !loading && !error && !missing ? <View style={{ padding: 18, borderTopWidth: 1, borderColor: v2.color.line, backgroundColor: v2.color.surface }}>
      {canApply ? <V2Action label="Sastavi prijavu" kind="primary" onPress={apply} disabled={busy} style={{ backgroundColor: v2.color.orange, minHeight: 50 }} />
        : <T style={caption}>Nove prijave trenutno nisu dostupne za ovaj zadatak.</T>}
    </View> : null}
  </SafeAreaView>;
}
