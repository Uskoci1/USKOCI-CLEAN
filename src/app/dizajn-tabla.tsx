import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import type { MarketplaceItem } from '../data/marketplaceView';
import { FactArt, type FactArtKind } from '../ui/system/FactArt';
import { Pictogram, pictogramCatalog, type PictogramGroup } from '../ui/system/Pictogram';
import { PickerGrid, PickerTile } from '../ui/system/PickerTile';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { TaskCard } from '../ui/v2/TaskCard';
import { T } from '../ui/Text';
import { sys } from '../ui/system/tokens';
import { router } from 'expo-router';

/**
 * The USKOČI icon and pictogram board, on the real phone (owner's master UI/UX directive, step E, 2026-09-23).
 * Reached only by its address (uskociapp://dizajn-tabla) in the internal build; the store package shows nothing.
 * It draws every system icon and pictogram at 20, 24, 32, 40 and 48 px, the picker states on a real selector,
 * and the icons inside a real task card, on white and on ivory. Nothing here reads or writes data.
 */
const SYSTEM: FactArtKind[] = ['pin', 'calendar', 'clock', 'users', 'person', 'money', 'remote', 'map', 'tasks', 'agreements', 'offers',
  'chat', 'bell', 'phone', 'star', 'check', 'info', 'shield', 'lock', 'eye', 'document', 'download', 'photo', 'support'];
const SIZES = [20, 24, 32, 40, 48];
const GROUPS: [PictogramGroup, string][] = [['vozila', 'Vozila'], ['alat', 'Oprema i alat'], ['usluge', 'Usluge'], ['ljudi', 'Ljudi i kapacitet']];
const IVORY = '#FBF7EF';

const task = {
  id: 'tabla', naslov: 'Prenos ormana do kombija', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '24. sep · 17:00–19:00', statusTekst: 'Otvoren',
  uslovi: ['Zgrada bez lifta', 'Orman je rasklopljen'], pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: { lat: 45.25, lng: 19.83 }, narucilacProfilId: 'p', rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL',
  ponudjenaCena: { iznos: 5500, prikaz: '5.500 RSD' }, narucilacIme: 'Nikola', narucilacOcena: '4,8',
} as unknown as MarketplaceItem;

function Section({ title, children, ground = sys.color.surface }: { title: string; children: ReactNode; ground?: string }) {
  return <View style={[s.section, { backgroundColor: ground }]}>
    <T variant="heading" accessibilityRole="header" style={s.ink}>{title}</T>
    {children}
  </View>;
}

export default function DizajnTabla() {
  const internal = __DEV__ || String(Constants.expoConfig?.android?.package ?? '').endsWith('.dev');
  const [vozila, setVozila] = useState<string[]>(['kombi', 'automobil']);
  const [usluga, setUsluga] = useState('selidba');
  if (!internal) return <View style={s.screen}><T>Nije dostupno.</T></View>;
  const toggle = (kind: string) => setVozila(list => list.includes(kind) ? list.filter(k => k !== kind) : [...list, kind]);
  return <View style={s.screen}>
    <DetailTopBar title="Tabla ikonica i piktograma" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={s.content}>
      <Section title="Sistemske ikonice · 20 · 24 · 32 · 40 · 48">
        {SYSTEM.map(kind => <View key={kind} style={s.iconRow}>
          <T variant="meta" tone="muted" style={s.name}>{kind}</T>
          {SIZES.map(size => <FactArt key={size} kind={kind} size={size} />)}
        </View>)}
      </Section>
      <Section title="Sistemske ikonice na slonovači" ground={IVORY}>
        <View style={s.wrap}>{SYSTEM.slice(0, 12).map(kind => <FactArt key={kind} kind={kind} size={32} />)}</View>
      </Section>
      {GROUPS.map(([group, title]) => <Section key={group} title={`${title} · 32 · 40 · 48 · 64`}>
        {pictogramCatalog.filter(p => p.group === group).map(p => <View key={p.kind} style={s.iconRow}>
          <T variant="meta" tone="muted" style={s.name}>{p.label}</T>
          {[32, 40, 48, 64].map(size => <Pictogram key={size} kind={p.kind} size={size} />)}
        </View>)}
      </Section>)}
      <Section title="Izbor: koja vozila imaš? (više odgovora)">
        <PickerGrid>
          {(['bicikl', 'skuter', 'automobil', 'kombi', 'kamion', 'prikolica'] as const).map(kind =>
            <PickerTile key={kind} kind={kind} label={pictogramCatalog.find(p => p.kind === kind)!.label} selected={vozila.includes(kind)}
              disabled={kind === 'kamion'} reason={kind === 'kamion' ? 'Treba vozačka C' : undefined} onPress={() => toggle(kind)} />)}
        </PickerGrid>
      </Section>
      <Section title="Izbor: šta ti treba? (jedan odgovor)" ground={IVORY}>
        <PickerGrid>
          {(['selidba', 'ciscenje', 'basta', 'montaza'] as const).map(kind =>
            <PickerTile key={kind} kind={kind} mode="single" label={pictogramCatalog.find(p => p.kind === kind)!.label}
              selected={usluga === kind} onPress={() => setUsluga(kind)} />)}
        </PickerGrid>
      </Section>
      <Section title="Na pravoj kartici zadatka">
        <TaskCard item={task} onOpen={() => {}} />
      </Section>
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  content: { paddingBottom: 48 },
  section: { paddingHorizontal: 20, paddingVertical: 24, gap: 14, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  ink: { color: sys.color.ink },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  name: { width: 96 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
});
