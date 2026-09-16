import { useCallback, useMemo, useState } from 'react';
import { FlatList, Keyboard, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MagnifyingGlass, Plus, SlidersHorizontal } from 'phosphor-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Uloga } from '../../contracts/projections';
import type { MarketplaceItem, MarketplaceView } from '../../data/marketplaceView';
import { initialMarketplaceView, marketplaceItems, publicPoint } from '../../data/marketplaceView';
import { Press } from '../Press';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, intentLabel, sys } from '../system/tokens';
import { T } from '../Text';
import { DiscoveryMap } from './DiscoveryMap';
import { TaskCard } from './TaskCard';
import { V2Action } from './V2Action';

export type MarketplacePresentationProps = { owned: boolean; items: readonly MarketplaceItem[]; loading: boolean; error: boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onSwitch: () => void; onProfile: () => void; onNew?: () => void;
  /** Which intent the user is in; the header says it so the context is never implicit. */
  intent?: Uloga };

const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'drafts', label: 'Nacrti' }, { key: 'history', label: 'Istorija' }, { key: 'all', label: 'Svi' }] as const;
const MODES = [{ key: 'list', label: 'Lista' }, { key: 'map', label: 'Mapa' }] as const;
const PRICES = [['all', 'Svi načini'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']] as const;
const Separator = () => <View style={{ height: 14 }} />;
const keyOf = (item: MarketplaceItem) => item.id;

/**
 * Zadaci — one screen for both intents: the owner's Tasks ("Moji") and public
 * discovery ("Istraži") as List or Map. Same existing read and filter state in
 * both views; map gestures only change the viewport until explicitly applied.
 * Presentation only: every callback is the route's existing command.
 */
export function MarketplacePresentation(props: MarketplacePresentationProps) {
  const { owned, items, loading, error, view, onOpen } = props, reduced = useReducedMotion();
  const [filterOpen, setFilterOpen] = useState(false), [priceDraft, setPriceDraft] = useState(view.price);
  const visible = useMemo(() => marketplaceItems(items, view, owned), [items, view, owned]);
  const selected = visible.find(item => item.id === view.selectedId && publicPoint(item)) ?? null;
  const withoutPins = visible.filter(item => !publicPoint(item)).length;
  const hasFilter = !!view.query || view.price !== 'all' || view.attention || !!view.area || owned && view.section !== 'active';
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });
  const toggleMode = (mode: 'list' | 'map') => { Keyboard.dismiss(); change({ mode }); };
  const eyebrow = props.intent ? intentLabel(props.intent) : owned ? 'Meni treba' : 'Ja mogu';
  const renderItem = useCallback(({ item }: { item: MarketplaceItem }) => <TaskCard item={item} onOpen={() => onOpen(item)} />, [onOpen]);

  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><SkeletonList count={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatke…</T></>
      : error ? <View style={s.state}><T style={s.stateTitle}>Zadatke trenutno nije moguće učitati</T><T style={s.stateBody}>Proverite internet vezu i pokušajte ponovo.</T>
        <V2Action label="Pokušajte ponovo" onPress={props.onRefresh} style={brandAction} /></View>
        : hasFilter ? <View style={s.state}><T style={s.stateTitle}>Nema zadataka u ovom prikazu</T><T style={s.stateBody}>Promenite pretragu ili poništite filtere.</T>
          <V2Action label="Poništi filtere" onPress={() => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport })} /></View>
          : owned ? <View style={s.state}><T style={s.stateTitle}>{items.length ? 'Nema aktivnih zadataka' : 'Još nemate Zadatak'}</T><T style={s.stateBody}>Recite šta Vam treba. Pregledaćete nacrt pre objave.</T>
            {props.onNew ? <V2Action label="Napravite prvi Zadatak" onPress={props.onNew} style={brandAction} /> : null}
            {items.length ? <V2Action label="Prikaži sve moje zadatke" kind="quiet" onPress={() => change({ section: 'all' })} /> : null}</View>
            : <View style={s.state}><T style={s.stateTitle}>Trenutno nema otvorenih zadataka</T><T style={s.stateBody}>Možete osvežiti listu ili urediti svoj profil.</T>
              <V2Action label="Osveži zadatke" onPress={props.onRefresh} style={brandAction} /><V2Action label="Moj profil" kind="quiet" onPress={props.onProfile} /></View>}
  </View>;

  return <SafeAreaView edges={['top']} style={s.screen}>
    <View accessibilityElementsHidden={filterOpen} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'} style={s.screen}>
      <ScreenHeader eyebrow={eyebrow} title="Zadaci" onProfile={props.onProfile} />
      <Segmented options={[{ key: 'owned', label: 'Moji' }, { key: 'discover', label: 'Istraži' }]} value={owned ? 'owned' : 'discover'}
        onChange={() => props.onSwitch()} style={s.scope} />
      <View style={s.search}>
        <MagnifyingGlass size={19} color={sys.color.muted} />
        <TextInput accessibilityLabel="Pretraži zadatke" placeholder="Naslov, mesto ili uslov…" placeholderTextColor={sys.color.muted}
          value={view.query} onChangeText={query => change({ query: query.slice(0, 1000), selectedId: null })} maxLength={1000} style={s.input}
          returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
      </View>
      <View style={s.toolbar}>
        {owned ? <Segmented options={SECTIONS} value={view.section} onChange={section => change({ section, selectedId: null })} scroll style={s.grow} />
          : <Segmented options={MODES} value={view.mode} onChange={toggleMode} style={s.grow} />}
        <Press accessibilityRole="button" accessibilityLabel={`Filteri${view.price === 'all' ? '' : ', aktivni'}`}
          onPress={() => { Keyboard.dismiss(); setPriceDraft(view.price); setFilterOpen(true); }} haptic="select" style={[s.tool, view.price !== 'all' && s.toolActive]}>
          <SlidersHorizontal size={21} color={sys.color.ink} />
        </Press>
        {props.onNew ? <Press accessibilityRole="button" accessibilityLabel="Dodaj zadatak" accessibilityHint="Otvara razgovor za novi Zadatak."
          onPress={() => { Keyboard.dismiss(); props.onNew?.(); }} haptic="light" style={s.add}><Plus size={22} weight="bold" color={sys.color.onOrange} /></Press> : null}
      </View>
      {owned ? <Press accessibilityRole="checkbox" accessibilityLabel="Treba moja radnja" accessibilityState={{ checked: view.attention }} haptic="select"
        onPress={() => change({ attention: !view.attention })} style={s.attention}>
        <View style={[s.check, view.attention && s.checked]}>{view.attention ? <View style={s.checkMark} /> : null}</View>
        <T variant="bodyStrong" style={s.attentionText}>Treba moja radnja</T>
      </Press> : null}
      {view.area ? <View style={s.areaNotice}><T variant="meta" tone="muted" style={s.grow}>Izabrana oblast sa mape · isti zadaci u Listi i Mapi</T>
        <V2Action label="Ukloni oblast" kind="quiet" onPress={() => change({ area: null, selectedId: null })} /></View> : null}
      {!owned && view.mode === 'map' && !loading && !error ? <View style={s.mapArea}>
        <DiscoveryMap items={visible} selectedId={selected?.id ?? null} viewport={view.viewport} scopeKey={props.scopeKey}
          onSelect={selectedId => change({ selectedId })} onViewport={viewport => change({ viewport })}
          onSearchArea={area => change({ area, selectedId: null })} onList={() => toggleMode('list')} />
        {selected ? <ScrollView style={s.preview} contentContainerStyle={s.previewContent} showsVerticalScrollIndicator={false}>
          <TaskCard item={selected} compact onOpen={() => onOpen(selected)} />
          <V2Action label="Otvori detalj Zadatka" onPress={() => onOpen(selected)} style={brandAction} />
          <V2Action label="Zatvori pregled pina" kind="quiet" onPress={() => change({ selectedId: null })} />
        </ScrollView> : null}
        <View style={s.mapLegend}><T variant="meta" tone="muted" style={s.grow}>{visible.length} zadataka · približne lokacije{withoutPins ? ` · ${withoutPins} bez tačke` : ''}</T>
          {withoutPins || !visible.length ? <V2Action label="Pogledaj listu" kind="quiet" onPress={() => toggleMode('list')} /> : null}</View>
      </View> : <FlatList<MarketplaceItem> data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={loading} onRefresh={props.onRefresh}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
        ItemSeparatorComponent={Separator} ListEmptyComponent={empty} renderItem={renderItem} />}
    </View>
    <Modal visible={filterOpen} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={() => setFilterOpen(false)}>
      <View style={s.scrim}><SafeAreaView edges={['bottom']} style={s.sheet}><ScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
        <View style={s.handle} />
        <T accessibilityRole="header" variant="title" style={s.sheetTitle}>Filteri</T>
        <T variant="meta" tone="muted">Način cene</T>
        <View accessibilityRole="radiogroup" style={s.options}>
          {PRICES.map(([value, label]) => <Press key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: priceDraft === value }}
            haptic="select" onPress={() => setPriceDraft(value)} style={[s.option, priceDraft === value && s.optionChecked]}>
            <View style={[s.radio, priceDraft === value && s.radioChecked]}>{priceDraft === value ? <View style={s.radioDot} /> : null}</View>
            <T variant={priceDraft === value ? 'bodyStrong' : 'body'} style={s.optionText}>{label}</T>
          </Press>)}
        </View>
        <V2Action label="Prikaži zadatke" onPress={() => { change({ price: priceDraft, selectedId: null }); setFilterOpen(false); }} style={brandAction} />
        <View style={s.sheetRow}>
          <V2Action label="Poništi izbor" kind="quiet" onPress={() => setPriceDraft('all')} />
          <V2Action label="Odustani od filtera" kind="quiet" onPress={() => setFilterOpen(false)} />
        </View>
      </ScrollView></SafeAreaView></View>
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 },
  scope: { marginHorizontal: 20 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginTop: 12, paddingHorizontal: 14, backgroundColor: sys.color.surface,
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line },
  input: { ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 48, paddingVertical: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  tool: { minWidth: 46, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.control, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line },
  toolActive: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  add: { minWidth: 46, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.control, backgroundColor: sys.color.orange },
  attention: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44, marginHorizontal: 20, marginBottom: 4 },
  attentionText: { color: sys.color.ink },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: sys.color.green, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  checked: { backgroundColor: sys.color.green }, checkMark: { width: 10, height: 10, borderRadius: 2, backgroundColor: sys.color.surface },
  areaNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: sys.color.greenSoft, paddingHorizontal: 20, paddingVertical: 2 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  empty: { paddingVertical: 8, gap: 16, flex: 1 }, center: { textAlign: 'center' },
  state: { paddingVertical: 32, paddingHorizontal: 4, gap: 12, alignItems: 'flex-start' },
  stateTitle: { ...sys.type.title, color: sys.color.ink }, stateBody: { ...sys.type.body, color: sys.color.muted, marginBottom: 6 },
  mapArea: { flex: 1, minHeight: 180 },
  preview: { position: 'absolute', left: 12, right: 12, bottom: 40, maxHeight: '70%', backgroundColor: sys.color.surface, borderRadius: sys.radius.sheet, borderWidth: 1, borderColor: sys.color.line, ...sys.elevation.raised },
  previewContent: { padding: 14, gap: 10 },
  mapLegend: { paddingHorizontal: 20, paddingVertical: 6, backgroundColor: sys.color.surface, borderTopWidth: 1, borderColor: sys.color.line, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: sys.color.scrim },
  sheet: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet, maxHeight: '90%' },
  sheetContent: { padding: 24, paddingTop: 12, gap: 12 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: sys.color.lineStrong, marginBottom: 8 },
  sheetTitle: { color: sys.color.ink },
  options: { gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  optionChecked: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft }, optionText: { color: sys.color.ink, flex: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  radioChecked: { borderColor: sys.color.green }, radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: sys.color.green },
  sheetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
