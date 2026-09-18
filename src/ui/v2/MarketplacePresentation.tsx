import { useCallback, useMemo, useState } from 'react';
import { FlatList, Keyboard, Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, MagnifyingGlass, Plus, SlidersHorizontal, X } from 'phosphor-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Uloga } from '../../contracts/projections';
import type { MarketplaceItem, MarketplaceView } from '../../data/marketplaceView';
import { hasNeedAttention, initialMarketplaceView, isOwnedNeed, marketplaceItems, publicPoint } from '../../data/marketplaceView';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { HeaderIconButton, ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, intentLabel, sys } from '../system/tokens';
import { T } from '../Text';
import { DiscoveryMap } from './DiscoveryMap';
import { TaskCard } from './TaskCard';
import { V2Action } from './V2Action';

export type MarketplacePresentationProps = { owned: boolean; items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onSwitch: () => void; onProfile: () => void; onNew?: () => void;
  /** Which intent the user is in; the header says it so the context is never implicit. */
  intent?: Uloga };

const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'drafts', label: 'Nacrti' }, { key: 'history', label: 'Istorija' }] as const;
const SECTION_TITLES: Record<MarketplaceView['section'], string> = { active: 'Aktivni zadaci', drafts: 'Nacrti', history: 'Istorija', all: 'Svi zadaci' };
const MODES = [{ key: 'list', label: 'Lista' }, { key: 'map', label: 'Mapa' }] as const;
const PRICES = [['all', 'Svi načini'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']] as const;
const Separator = () => <View style={{ height: 12 }} />;
const keyOf = (item: MarketplaceItem) => item.id;

/**
 * Zadaci. Owned: the requester's own Tasks in three sets (Aktivni · Nacrti ·
 * Istorija). Discovery: open Tasks as a List or a Map. One segmented control,
 * then a section row that names the set and holds search and filters as quiet
 * icon controls, then the cards. Creation is the one orange action, floating
 * above the list. Presentation only: every callback is the route's existing command.
 */
export function MarketplacePresentation(props: MarketplacePresentationProps) {
  const { owned, items, loading, error, view, onOpen } = props, reduced = useReducedMotion();
  const [filterOpen, setFilterOpen] = useState(false), [priceDraft, setPriceDraft] = useState(view.price);
  const [searchOpen, setSearchOpen] = useState(!!view.query);
  const visible = useMemo(() => marketplaceItems(items, view, owned), [items, view, owned]);
  const attentionCount = useMemo(() => owned ? items.filter(item => isOwnedNeed(item) && hasNeedAttention(item) && item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA').length : 0, [items, owned]);
  const sections = useMemo(() => SECTIONS.map(option => option.key === 'active' && attentionCount ? { ...option, badge: attentionCount } : option), [attentionCount]);
  const selected = visible.find(item => item.id === view.selectedId && publicPoint(item)) ?? null;
  const withoutPins = visible.filter(item => !publicPoint(item)).length;
  const hasFilter = !!view.query || view.price !== 'all' || view.attention || !!view.area || owned && view.section !== 'active';
  const filterActive = view.price !== 'all' || view.attention;
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });
  const toggleMode = (mode: 'list' | 'map') => { Keyboard.dismiss(); change({ mode }); };
  const toggleSearch = () => { Keyboard.dismiss(); if (searchOpen && view.query) change({ query: '', selectedId: null }); setSearchOpen(open => !open); };
  const openFilters = () => { Keyboard.dismiss(); setPriceDraft(view.price); setFilterOpen(true); };
  const eyebrow = props.intent ? intentLabel(props.intent) : owned ? 'Meni treba' : 'Ja mogu';
  const sectionTitle = owned ? SECTION_TITLES[view.section] : 'Otvoreni zadaci';
  const count = loading || error ? null : visible.length;
  /** The floating action appears only above cards; an empty set carries its own inline primary, so a screen state never shows two orange actions. */
  const showCards = !loading && !error && visible.length > 0;
  const filterLabel = filterActive ? 'Filteri, aktivni' : 'Filteri';
  // "1 zadataka" was on the map legend. Serbian counts in three shapes, not one.
  const plural = (count: number) => {
    const hundred = count % 100, ten = count % 10;
    if (hundred >= 11 && hundred <= 14) return `${count} zadataka`;
    if (ten === 1) return `${count} zadatak`;
    if (ten >= 2 && ten <= 4) return `${count} zadatka`;
    return `${count} zadataka`;
  };
  // A task that arrives while you are looking says so; the ones that were already there do not
  // replay every time the list is pulled. `Appear` holds that distinction.
  const appear = useAppear();
  appear.settle(visible.map(keyOf));
  const renderItem = useCallback(({ item, index }: { item: MarketplaceItem; index: number }) =>
    <Appear index={index} animate={appear.isNew(keyOf(item))}><TaskCard item={item} onOpen={() => onOpen(item)} /></Appear>, [onOpen, appear]);

  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><SkeletonList count={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatke…</T></>
      : error ? <View style={s.state}><T style={s.stateTitle}>Zadatke trenutno nije moguće učitati</T><T style={s.stateBody}>Proveri internet vezu i pokušaj ponovo.</T>
        <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} style={brandAction} /></View>
        : hasFilter ? <View style={s.state}><T style={s.stateTitle}>Nema zadataka u ovom prikazu</T><T style={s.stateBody}>Promeni pretragu ili poništite filtere.</T>
          <V2Action label="Poništi filtere" onPress={() => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport })} /></View>
          : owned ? <View style={s.state}><T style={s.stateTitle}>{items.length ? 'Nema aktivnih zadataka' : 'Još nemaš Zadatak'}</T>
            <T style={s.stateBody}>{items.length ? 'Nacrti i završeni zadaci su u svojim prikazima.' : 'Reci šta ti treba. Nacrt pregledaš pre objave.'}</T>
            {props.onNew ? <V2Action label={items.length ? 'Napravi novi Zadatak' : 'Napravi prvi Zadatak'} onPress={props.onNew} style={brandAction} /> : null}
            {items.length ? <V2Action label="Prikaži sve moje zadatke" kind="quiet" onPress={() => change({ section: 'all' })} /> : null}</View>
            // The brand action is what the screen wants you to do. On the screen a worker meets
            // before anything exists, that is not "refresh" — it is the profile that decides
            // whether a task can ever be offered to them.
            : <View style={s.state}><T style={s.stateTitle}>Trenutno nema otvorenih zadataka</T>
              <T style={s.stateBody}>Zadaci se nude prema tvom radnom profilu — veštinama, području i dostupnosti.</T>
              <V2Action label="Dopuni radni profil" onPress={props.onProfile} style={brandAction} />
              <V2Action label="Osveži zadatke" kind="quiet" onPress={props.onRefresh} /></View>}
  </View>;

  return <SafeAreaView edges={['top']} style={s.screen}>
    <View accessibilityElementsHidden={filterOpen} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'} style={s.screen}>
      {/* Both tabs used this one presentation and both were titled Zadaci, so two different
          screens carried the same name. The discovery view is what the Mapa tab opens. */}
      <ScreenHeader eyebrow={eyebrow} title={owned ? 'Zadaci' : 'Prilike'} onProfile={props.onProfile} />
      {/* One row of controls, not two. Which set you are looking at and the two ways to narrow it
          belong together, and the count is not a control: it belongs with what it counts, at the top
          of the list. Two bands plus a header pushed the first card to 40% down the screen. */}
      <View style={s.controls}>
        <View style={s.grow}>
          {owned ? <Segmented scroll options={sections} value={view.section} onChange={section => change({ section, selectedId: null })} />
            : <Segmented options={MODES} value={view.mode} onChange={toggleMode} />}
        </View>
        <HeaderIconButton label="Pretraga" hint="Otvara polje za pretragu zadataka." icon={MagnifyingGlass} active={searchOpen} onPress={toggleSearch} />
        <HeaderIconButton label={filterLabel} icon={SlidersHorizontal} active={filterActive} onPress={openFilters} />
      </View>
      {searchOpen ? <View style={s.search}>
        <MagnifyingGlass size={19} color={sys.color.muted} />
        <TextInput accessibilityLabel="Pretraži zadatke" autoFocus placeholder="Naslov, mesto ili uslov…" placeholderTextColor={sys.color.muted}
          value={view.query} onChangeText={query => change({ query: query.slice(0, 1000), selectedId: null })} maxLength={1000} style={s.input}
          returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
        {view.query ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" onPress={() => change({ query: '', selectedId: null })} haptic="select" style={s.clear}>
          <X size={16} weight="bold" color={sys.color.ink} /></Press> : null}
      </View> : null}
      {view.area ? <View style={s.areaNotice}><T variant="note" tone="muted" style={s.grow}>Izabrana oblast sa mape · isti zadaci u Listi i Mapi</T>
        <V2Action label="Ukloni oblast" kind="quiet" onPress={() => change({ area: null, selectedId: null })} /></View> : null}
      {/* With nothing to show, a map is not a data state: the Mapa tab used to open on the whole
          world centred in the Atlantic with "0 zadataka", while the composed empty state sat
          unreachable in the other branch. Emptiness is answered the same way in both modes. */}
      {!owned && view.mode === 'map' && !loading && !error && !visible.length ? empty
        : !owned && view.mode === 'map' && !loading && !error ? <View style={s.mapArea}>
        <DiscoveryMap items={visible} selectedId={selected?.id ?? null} viewport={view.viewport} scopeKey={props.scopeKey}
          onSelect={selectedId => change({ selectedId })} onViewport={viewport => change({ viewport })}
          onSearchArea={area => change({ area, selectedId: null })} onList={() => toggleMode('list')} />
        {selected ? <ScrollView style={s.preview} contentContainerStyle={s.previewContent} showsVerticalScrollIndicator={false}>
          <TaskCard item={selected} compact onOpen={() => onOpen(selected)} />
          <V2Action label="Otvori detalj Zadatka" onPress={() => onOpen(selected)} style={brandAction} />
          <V2Action label="Zatvori pregled pina" kind="quiet" onPress={() => change({ selectedId: null })} />
        </ScrollView> : null}
        <View style={s.mapLegend}><T variant="note" tone="muted" style={s.grow}>{plural(visible.length)} · približne lokacije{withoutPins ? ` · ${withoutPins} bez tačke` : ''}</T>
          {withoutPins || !visible.length ? <V2Action label="Pogledaj listu" kind="quiet" onPress={() => toggleMode('list')} /> : null}</View>
      </View> : <FlatList<MarketplaceItem> data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={props.refreshing ?? loading} onRefresh={props.onRefresh}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={[s.list, !!props.onNew && showCards && s.listWithAction]}
        ItemSeparatorComponent={Separator} ListEmptyComponent={empty} renderItem={renderItem}
        ListHeaderComponent={loading || error || !visible.length ? null : <View style={s.countRow}>
          {count === null ? <T variant="note" tone="muted">Učitavamo…</T>
            : <T variant="note" tone="muted" numberOfLines={1}>{plural(count)}{owned && view.section !== 'active' ? ` · ${sectionTitle.toLocaleLowerCase('sr-Latn-RS')}` : ''}</T>}
        </View>} />}
      {props.onNew && showCards ? <Press accessibilityRole="button" accessibilityLabel="Dodaj zadatak" accessibilityHint="Otvara novi Zadatak."
        onPress={() => { Keyboard.dismiss(); props.onNew?.(); }} haptic="light" scaleTo={0.94} style={s.add}>
        <Plus size={26} weight="bold" color={sys.color.onOrange} /></Press> : null}
    </View>
    <Modal visible={filterOpen} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={() => setFilterOpen(false)}>
      <View style={s.scrim}><SafeAreaView edges={['bottom']} style={s.sheet}><ScrollView contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled">
        <View style={s.handle} />
        <T accessibilityRole="header" variant="title" style={s.sheetTitle}>Filteri</T>
        <T variant="label" style={s.groupLabel}>Način cene</T>
        <View accessibilityRole="radiogroup" style={s.options}>
          {PRICES.map(([value, label]) => <Press key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: priceDraft === value }}
            haptic="select" onPress={() => setPriceDraft(value)} style={[s.option, priceDraft === value && s.optionChecked]}>
            <View style={[s.radio, priceDraft === value && s.radioChecked]}>{priceDraft === value ? <View style={s.radioDot} /> : null}</View>
            <T variant={priceDraft === value ? 'bodyStrong' : 'body'} style={s.optionText}>{label}</T>
          </Press>)}
        </View>
        {owned ? <Press accessibilityRole="checkbox" accessibilityLabel="Treba moja radnja" accessibilityState={{ checked: view.attention }} haptic="select"
          onPress={() => change({ attention: !view.attention })} style={[s.option, view.attention && s.optionChecked]}>
          <View style={[s.check, view.attention && s.checked]}>{view.attention ? <Check size={14} weight="bold" color={sys.color.surface} /> : null}</View>
          <View style={s.grow}><T variant="bodyStrong" style={s.optionText}>Treba moja radnja</T><T variant="note" tone="muted">Samo zadaci sa novim prijavama ili potvrdom.</T></View>
        </Press> : null}
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
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6 },
  countRow: { paddingBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginBottom: 8, paddingLeft: 14, paddingRight: 6, backgroundColor: sys.color.wash,
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line },
  input: { ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 48, paddingVertical: 10 },
  clear: { width: 36, height: 36, borderRadius: sys.radius.chip, alignItems: 'center', justifyContent: 'center' },
  areaNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: sys.color.greenSoft, paddingHorizontal: 20, paddingVertical: 2 },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  listWithAction: { paddingBottom: 96 },
  // Above the map legend and the attribution it used to cover, not on them.
  add: { position: 'absolute', right: 20, bottom: 72, width: 56, height: 56, borderRadius: sys.radius.cardCompact, alignItems: 'center', justifyContent: 'center',
    backgroundColor: sys.color.orange, ...sys.elevation.raised },
  empty: { paddingVertical: 8, gap: 16, flex: 1 }, center: { textAlign: 'center' },
  state: { paddingVertical: 28, paddingHorizontal: 4, gap: 12, alignItems: 'flex-start' },
  stateTitle: { ...sys.type.title, color: sys.color.ink }, stateBody: { ...sys.type.copy, color: sys.color.muted, marginBottom: 6 },
  mapArea: { flex: 1, minHeight: 180 },
  preview: { position: 'absolute', left: 12, right: 12, bottom: 40, maxHeight: '70%', backgroundColor: sys.color.surface, borderRadius: sys.radius.sheet, borderWidth: 1, borderColor: sys.color.line, ...sys.elevation.raised },
  previewContent: { padding: 14, gap: 10 },
  mapLegend: { paddingHorizontal: 20, paddingVertical: 6, backgroundColor: sys.color.surface, borderTopWidth: 1, borderColor: sys.color.line, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: sys.color.scrim },
  sheet: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet, maxHeight: '90%' },
  sheetContent: { padding: 24, paddingTop: 12, gap: 12 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: sys.radius.pill, backgroundColor: sys.color.lineStrong, marginBottom: 8 },
  sheetTitle: { color: sys.color.ink },
  groupLabel: { color: sys.color.muted, marginTop: 4 },
  options: { gap: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  optionChecked: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft }, optionText: { color: sys.color.ink, flex: 1 },
  radio: { width: 22, height: 22, borderRadius: sys.radius.pill, borderWidth: 1.5, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  radioChecked: { borderColor: sys.color.green }, radioDot: { width: 11, height: 11, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  check: { width: 22, height: 22, borderRadius: sys.radius.badge, borderWidth: 1.5, borderColor: sys.color.green, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  checked: { backgroundColor: sys.color.green },
  sheetRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
