import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ListBullets, MagnifyingGlass, MapTrifold, SlidersHorizontal } from 'phosphor-react-native';
import type { PrilikaProjekcija, Uloga } from '../../contracts/projections';
import { DISCOVERY_INITIAL_VIEW, EMPTY_DISCOVERY_FILTERS, type DiscoveryViewport } from '../../contracts/discoveryView';
import type { DiscoveryBrowseState } from '../../data/discoveryBrowse';
import { discoveryPins, filterDiscovery } from '../../data/discoveryView';
import { DiscoveryFilters } from './DiscoveryFilters';
import { DiscoveryMap } from './DiscoveryMap';
import { TaskCard } from './TaskCard';
import type { DiscoveryMapScope } from './discoveryMapScope';

type Props = { state: DiscoveryBrowseState; intent: Uloga; refresh: () => Promise<void>; loadMore: () => Promise<void>;
  cameraScope: DiscoveryMapScope; onOpen: (id: string) => void; onOwn: () => void; onNew: () => void };

export function DiscoveryBody({ state, intent, refresh, loadMore, cameraScope, onOpen, onOwn, onNew }: Props) {
  const [filters, setFilters] = useState(EMPTY_DISCOVERY_FILTERS), [filterOpen, setFilterOpen] = useState(false);
  const [mode, setMode] = useState<'list' | 'map'>('list'), [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<DiscoveryViewport>(DISCOVERY_INITIAL_VIEW);
  const items = useMemo(() => filterDiscovery(state.items, filters), [state.items, filters]);
  const pins = useMemo(() => discoveryPins(items), [items]);
  const selected = items.find(item => item.id === selectedId);
  const activeFilters = [filters.city !== '', filters.location !== 'ALL', filters.price !== 'ALL'].filter(Boolean).length;
  const open = (id: string) => { setSelectedId(id); onOpen(id); };
  return <>
    <FlatList<PrilikaProjekcija> data={mode === 'list' ? items : selected ? [selected] : []}
      keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}
      refreshing={state.refreshing} onRefresh={() => { void refresh(); }} ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListHeaderComponent={<View style={s.header}>
        {intent === 'narucilac' ? <Pressable accessibilityRole="button" onPress={onOwn} style={s.own}>
          <ArrowLeft size={18} color="#142F30" /><Text style={s.action}>Moji zadaci</Text></Pressable> : null}
        <View style={s.heading}><Text accessibilityRole="header" style={s.title}>Neko baš Vas{`\n`}treba.</Text>
          <Text style={s.subtitle}>Istražite otvorene zadatke.{`\n`}Pogledajte gde možete da uskočite.</Text></View>
        <View style={s.searchRow}><View style={s.search}><MagnifyingGlass size={21} color="#5D6E6D" />
          <TextInput accessibilityLabel="Pretražite učitane zadatke" placeholder="Pretražite zadatke" value={filters.query}
            onChangeText={query => setFilters(old => ({ ...old, query }))} style={s.input} placeholderTextColor="#5D6E6D" maxLength={160} />
        </View><Pressable accessibilityRole="button" accessibilityLabel={`Filteri${activeFilters ? `, aktivno ${activeFilters}` : ''}`}
          onPress={() => setFilterOpen(true)} style={s.filter}><SlidersHorizontal size={22} color="#142F30" />
          {activeFilters ? <Text style={s.filterCount}>{activeFilters}</Text> : null}</Pressable></View>
        <View style={s.switchRow}>{([['list', 'Lista', ListBullets], ['map', 'Mapa', MapTrifold]] as const).map(([value, label, Icon]) =>
          <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: mode === value }} onPress={() => setMode(value)}
            style={[s.switchButton, mode === value && s.switchSelected]}><Icon size={19} color={mode === value ? '#FFFFFF' : '#142F30'} />
            <Text style={[s.action, mode === value && s.onDark]}>{label}</Text></Pressable>)}</View>
        <View style={s.resultRow}><Text style={s.resultText}>{items.length} od {state.items.length} učitanih zadataka</Text>
          {activeFilters || filters.query ? <Pressable accessibilityRole="button" onPress={() => setFilters(EMPTY_DISCOVERY_FILTERS)} style={s.clear}><Text style={s.action}>Poništite</Text></Pressable> : null}</View>
        {state.error ? <View style={s.warning} accessibilityLiveRegion="polite"><Text style={s.warningText}>
          {state.error === 'more' ? 'Sledeće zadatke nismo učitali. Postojeći su sačuvani.' : 'Zadatke nismo osvežili. Prikazani podaci mogu biti zastareli.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => { void (state.error === 'more' ? loadMore() : refresh()); }} style={s.clear}><Text style={s.action}>Pokušajte ponovo</Text></Pressable></View> : null}
        {mode === 'map' ? <>
          <Text style={s.caption}>Približna područja. Tačne adrese ostaju privatne.</Text>
          <DiscoveryMap scope={cameraScope} pins={pins} selectedId={selectedId} viewport={viewport} onViewport={setViewport} onSelect={setSelectedId} onList={() => setMode('list')} />
          <Text style={s.caption}>{pins.features.length} zadataka na mapi. {items.length - pins.features.length} bez pina — pogledajte ih u listi.</Text>
          <Text style={s.subtitle}>{selected ? 'Izabrani zadatak' : 'Dodirnite pin da pogledate zadatak.'}</Text>
        </> : null}
      </View>}
      renderItem={({ item }) => <TaskCard task={item} selected={mode === 'map'} onOpen={() => open(item.id)} />}
      ListEmptyComponent={mode === 'list' ? <View style={s.empty} accessibilityLiveRegion="polite">
        {state.refreshing && !state.initialized ? <><ActivityIndicator color="#142F30" /><Text style={s.subtitle}>Učitavamo zadatke…</Text></> : !state.error ? <>
          <Text style={s.emptyTitle}>{state.items.length ? 'Nema zadataka za ovaj izbor.' : 'Za sada nema otvorenih zadataka.'}</Text>
          <Text style={s.subtitle}>{state.nextCursor ? 'Učitajte još zadataka ili promenite filtere.' : 'Promenite izbor ili svratite ponovo. Ako Vama treba pomoć, napravite svoj zadatak.'}</Text>
          <Pressable accessibilityRole="button" onPress={onNew} style={s.more}><Text style={s.action}>Meni treba pomoć</Text></Pressable>
        </> : null}</View> : null}
      ListFooterComponent={<View style={s.footer}>
        {state.nextCursor ? <Pressable accessibilityRole="button" accessibilityLabel="Učitajte još zadataka" disabled={state.loadingMore || state.refreshing}
          accessibilityState={{ disabled: state.loadingMore || state.refreshing, busy: state.loadingMore }} onPress={() => { void loadMore(); }} style={s.more}>
          {state.loadingMore ? <ActivityIndicator color="#142F30" /> : <Text style={s.action}>Učitajte još zadataka</Text>}</Pressable> : null}
      </View>} />
    {filterOpen ? <DiscoveryFilters value={filters} onClose={() => setFilterOpen(false)} onConfirm={value => { setFilters(value); setFilterOpen(false); }} /> : null}
  </>;
}
const s = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingBottom: 32, flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { gap: 16, paddingBottom: 18 }, own: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }, heading: { paddingTop: 12, paddingBottom: 8, gap: 14 },
  title: { color: '#142F30', fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -0.8 }, subtitle: { color: '#5D6E6D', fontSize: 15, lineHeight: 23 },
  searchRow: { flexDirection: 'row', gap: 10 }, search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    minHeight: 54, borderWidth: 1, borderColor: '#DCE3DE', backgroundColor: '#FFFFFF', borderRadius: 16 },
  input: { flex: 1, minHeight: 52, color: '#142F30', fontSize: 15 },
  filter: { minWidth: 54, minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: '#DCE3DE', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  filterCount: { position: 'absolute', top: -4, right: -4, minWidth: 21, minHeight: 21, textAlign: 'center', borderRadius: 11, backgroundColor: '#142F30', color: '#FFFFFF', fontSize: 12, lineHeight: 21 },
  switchRow: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 18, backgroundColor: '#E9EDE8' }, switchButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 48, gap: 8, borderRadius: 14 },
  switchSelected: { backgroundColor: '#142F30' }, action: { color: '#142F30', fontSize: 14, lineHeight: 22, fontWeight: '600' }, onDark: { color: '#FFFFFF' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 }, resultText: { flex: 1, color: '#5D6E6D', fontSize: 13, lineHeight: 20 },
  clear: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }, caption: { color: '#5D6E6D', fontSize: 12, lineHeight: 19 },
  warning: { borderRadius: 16, backgroundColor: '#FFF2DF', padding: 16, gap: 10 }, warningText: { color: '#785019', fontSize: 14, lineHeight: 21 },
  empty: { paddingVertical: 32, gap: 14 }, emptyTitle: { color: '#142F30', fontSize: 24, lineHeight: 32, fontWeight: '700' }, footer: { paddingTop: 24, gap: 12 },
  more: { minHeight: 56, borderWidth: 1, borderColor: '#DCE3DE', backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
