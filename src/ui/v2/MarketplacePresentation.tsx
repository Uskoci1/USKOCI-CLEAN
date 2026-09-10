import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MagnifyingGlass, SlidersHorizontal, User } from 'phosphor-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { MarketplaceItem, MarketplaceView } from '../../data/marketplaceView';
import { initialMarketplaceView, marketplaceItems, publicPoint } from '../../data/marketplaceView';
import { InboxBell } from '../InboxBell';
import { Press } from '../Press';
import { T } from '../Text';
import { TaskCard } from './TaskCard';
import { DiscoveryMap } from './DiscoveryMap';
import { V2Action } from './V2Action';
import { v2 } from './tokens';
export type MarketplacePresentationProps = { owned: boolean; items: readonly MarketplaceItem[]; loading: boolean; error: boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onSwitch: () => void; onProfile: () => void; onNew?: () => void };
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Press accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} haptic="select" onPress={onPress}
    style={[s.choice, active && s.chosen]}><T style={[s.choiceText, active && { color: v2.color.ink }]}>{label}</T></Press>;
}
/** Same existing read and filter state for both views; map gestures only change viewport until explicit application. */
export function MarketplacePresentation(props: MarketplacePresentationProps) {
  const { owned, items, loading, error, view } = props, reduced = useReducedMotion();
  const [filterOpen, setFilterOpen] = useState(false), [priceDraft, setPriceDraft] = useState(view.price);
  const visible = useMemo(() => marketplaceItems(items, view, owned), [items, view, owned]);
  const selected = visible.find(item => item.id === view.selectedId && publicPoint(item)) ?? null;
  const withoutPins = visible.filter(item => !publicPoint(item)).length;
  const hasFilter = !!view.query || view.price !== 'all' || view.attention || !!view.area || owned && view.section !== 'active';
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });
  const toggleMode = (mode: 'list' | 'map') => { Keyboard.dismiss(); change({ mode }); };
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><ActivityIndicator color={v2.color.teal} accessibilityLabel="Učitavamo zadatke" /><T style={s.body}>Učitavamo zadatke…</T></>
      : error ? <><T style={s.title}>Zadatke trenutno nije moguće učitati</T><T style={s.body}>Proverite internet vezu i pokušajte ponovo.</T><V2Action label="Pokušajte ponovo" onPress={props.onRefresh} /></>
        : hasFilter ? <><T style={s.title}>Nema zadataka u ovom prikazu</T><T style={s.body}>Promenite pretragu ili poništite filtere.</T><V2Action label="Poništi filtere" onPress={() => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport })} /></>
          : owned ? <><T style={s.title}>{items.length ? 'Nema aktivnih zadataka' : 'Još nemate Zadatak'}</T><T style={s.body}>Recite šta Vam treba. Pregledaćete nacrt pre objave.</T>
            {props.onNew ? <V2Action label="Napravite prvi Zadatak" onPress={props.onNew} style={s.orangeAction} /> : null}
            {items.length ? <V2Action label="Prikaži sve moje zadatke" onPress={() => change({ section: 'all' })} /> : null}</>
            : <><T style={s.title}>Trenutno nema otvorenih zadataka</T><T style={s.body}>Možete osvežiti listu ili urediti svoj profil.</T><V2Action label="Osveži zadatke" onPress={props.onRefresh} /><V2Action label="Moj profil" onPress={props.onProfile} /></>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View accessibilityElementsHidden={filterOpen} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'} style={s.screen}>
      <View style={s.header}><View style={s.grow}><T style={s.caption}>{owned ? 'Ono što ti je potrebno' : 'Istraži · približne lokacije'}</T><T accessibilityRole="header" style={s.heading}>Zadaci</T></View>
        <InboxBell /><Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={props.onProfile} haptic="select" style={s.profile}><User size={21} color={v2.color.ink} /></Press>
      </View>
      <View style={s.scope}><Choice label="Moji" active={owned} onPress={() => { if (!owned) props.onSwitch(); }} /><Choice label="Istraži" active={!owned} onPress={() => { if (owned) props.onSwitch(); }} /></View>
      <View style={s.search}><MagnifyingGlass size={19} color={v2.color.muted} /><TextInput accessibilityLabel="Pretraži zadatke" placeholder="Naslov, mesto ili uslov…" placeholderTextColor={v2.color.muted}
        value={view.query} onChangeText={query => change({ query: query.slice(0, 1000), selectedId: null })} maxLength={1000} style={s.input} returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} /></View>
      <View style={s.toolbar}>
        {owned ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {([['active', 'Aktivni'], ['drafts', 'Nacrti'], ['history', 'Istorija'], ['all', 'Svi']] as const).map(([key, label]) => <Choice key={key} label={label} active={view.section === key} onPress={() => change({ section: key, selectedId: null })} />)}
        </ScrollView> : <View style={s.tabs}><Choice label="Lista" active={view.mode === 'list'} onPress={() => toggleMode('list')} /><Choice label="Mapa" active={view.mode === 'map'} onPress={() => toggleMode('map')} /></View>}
        <Press accessibilityRole="button" accessibilityLabel={`Filteri${view.price === 'all' ? '' : ', aktivni'}`} onPress={() => { Keyboard.dismiss(); setPriceDraft(view.price); setFilterOpen(true); }} haptic="select" style={s.filter}><SlidersHorizontal size={21} color={v2.color.ink} /></Press>
      </View>
      {owned ? <Press accessibilityRole="checkbox" accessibilityLabel="Treba moja radnja" accessibilityState={{ checked: view.attention }} haptic="select" onPress={() => change({ attention: !view.attention })} style={s.attention}>
        <View style={[s.check, view.attention && { backgroundColor: v2.color.teal }]} /><T style={s.body}>Treba moja radnja</T>
      </Press> : null}
      {view.area ? <View style={s.areaNotice}><T style={[s.caption, s.grow]}>Izabrana oblast sa mape · isti zadaci u Listi i Mapi</T><V2Action label="Ukloni oblast" kind="quiet" onPress={() => change({ area: null, selectedId: null })} /></View> : null}
      {!owned && view.mode === 'map' && !loading && !error ? <View style={s.mapArea}>
        <DiscoveryMap items={visible} selectedId={selected?.id ?? null} viewport={view.viewport} scopeKey={props.scopeKey}
          onSelect={selectedId => change({ selectedId })} onViewport={viewport => change({ viewport })}
          onSearchArea={area => change({ area, selectedId: null })} onList={() => toggleMode('list')} />
        {selected ? <ScrollView style={s.preview} contentContainerStyle={s.previewContent} showsVerticalScrollIndicator={false}>
          <TaskCard item={selected} compact onOpen={() => props.onOpen(selected)} />
          <V2Action label="Otvori detalj Zadatka" onPress={() => props.onOpen(selected)} style={s.orangeAction} />
          <V2Action label="Zatvori pregled pina" kind="quiet" onPress={() => change({ selectedId: null })} />
        </ScrollView> : null}
        <View style={s.mapLegend}><T style={s.caption}>{visible.length} zadataka · približne lokacije{withoutPins ? ` · ${withoutPins} bez tačke` : ''}</T>
          {withoutPins || !visible.length ? <V2Action label="Pogledaj listu" kind="quiet" onPress={() => toggleMode('list')} /> : null}</View>
      </View> : <FlatList<MarketplaceItem> data={loading || error ? [] : visible} keyExtractor={item => item.id} refreshing={loading} onRefresh={props.onRefresh}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />} ListEmptyComponent={empty}
        renderItem={({ item }) => <TaskCard item={item} onOpen={() => props.onOpen(item)} />} />}
    </View>
    <Modal visible={filterOpen} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={() => setFilterOpen(false)}>
      <View style={s.scrim}><SafeAreaView edges={['bottom']} style={s.sheet}><ScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
        <T accessibilityRole="header" style={s.title}>Filteri</T><T style={s.body}>Način cene</T>
        {([['all', 'Svi načini'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']] as const).map(([value, label]) => <Choice key={value} label={label} active={priceDraft === value} onPress={() => setPriceDraft(value)} />)}
        <V2Action label="Prikaži zadatke" onPress={() => { change({ price: priceDraft, selectedId: null }); setFilterOpen(false); }} style={s.orangeAction} />
        <V2Action label="Poništi izbor" kind="quiet" onPress={() => setPriceDraft('all')} /><V2Action label="Odustani od filtera" kind="quiet" onPress={() => setFilterOpen(false)} />
      </ScrollView></SafeAreaView></View>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2.color.canvas }, grow: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  caption: { ...v2.text.label, color: v2.color.muted }, heading: { ...v2.text.title, color: v2.color.ink }, title: { ...v2.text.hero, color: v2.color.ink }, body: { ...v2.text.body, color: v2.color.ink },
  profile: { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: v2.color.soft, alignItems: 'center', justifyContent: 'center' }, scope: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 15, padding: 4, backgroundColor: '#E6EEEA' },
  choice: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, chosen: { backgroundColor: v2.color.surface }, choiceText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: v2.color.muted },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginTop: 16, paddingHorizontal: 13, backgroundColor: '#F0F4F1', borderRadius: 15 }, input: { ...v2.text.body, color: v2.color.ink, flex: 1, minHeight: 48, paddingVertical: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }, tabs: { flexDirection: 'row', gap: 4, flexGrow: 1 }, filter: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: v2.color.line },
  attention: { flexDirection: 'row', gap: 9, alignItems: 'center', minHeight: 44, marginHorizontal: 20, marginBottom: 8 }, check: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: v2.color.teal }, list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, flexGrow: 1 }, empty: { paddingVertical: 32, gap: 18, flex: 1, justifyContent: 'center' },
  orangeAction: { backgroundColor: v2.color.orange, borderWidth: 0, minHeight: 50 }, areaNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: v2.color.soft, paddingHorizontal: 16 },
  mapArea: { flex: 1, minHeight: 180 }, preview: { position: 'absolute', left: 10, right: 10, bottom: 38, maxHeight: '70%', backgroundColor: v2.color.surface, borderRadius: 24, borderWidth: 1, borderColor: v2.color.line }, previewContent: { padding: 14, gap: 10 },
  mapLegend: { paddingHorizontal: 14, paddingVertical: 5, backgroundColor: v2.color.surface, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#143D3566' }, sheet: { backgroundColor: v2.color.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }, sheetContent: { padding: 24, gap: 12 },
});
