import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Platform, StyleSheet, TextInput, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, MagnifyingGlass, Plus, SlidersHorizontal, X } from 'phosphor-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { MarketplaceItem, MarketplaceView } from '../../data/marketplaceView';
import { hasNeedAttention, initialMarketplaceView, isOwnedNeed, marketplaceItems, publicPoint } from '../../data/marketplaceView';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { FactArt } from '../system/FactArt';
import { ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { plural, zadataka } from '../system/plural';
import { HeaderIconButton, ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { DiscoveryMap } from './DiscoveryMap';
import { TaskCard } from './TaskCard';
import { V2Action } from './V2Action';

export type MarketplacePresentationProps = { owned: boolean; items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onSwitch: () => void; onProfile: () => void; onNew?: () => void;
  /** Set when the screen was pushed rather than being a tab: my own tasks are reached from Početna. */
  onBack?: () => void;
  /** In discovery: which of the shown tasks are mine and which I have applied to. Labels only. */
  relations?: { owned: ReadonlySet<string>; applied: ReadonlySet<string> } };

const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'drafts', label: 'Nacrti' }, { key: 'history', label: 'Istorija' }] as const;
const SECTION_TITLES: Record<MarketplaceView['section'], string> = { active: 'Aktivni zadaci', drafts: 'Nacrti', history: 'Istorija', all: 'Svi zadaci' };
const MODES = [{ key: 'list', label: 'Lista' }, { key: 'map', label: 'Mapa' }] as const;
const PRICES = [['all', 'Svi načini'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']] as const;
const Separator = () => <View style={{ height: 12 }} />;
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input that could lose focus. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
type Relation = 'OWNED' | 'APPLIED' | undefined;

/**
 * One row of the list. Memoised on primitives and the row's own object, so a keystroke in the
 * search field or an open filter sheet re-renders the screen and not every card under it; the
 * `onOpen` it receives is the list's one stable function, and the closure over `item` is made here.
 */
const MarketplaceRow = memo(function MarketplaceRow({ item, index, animate, relation, onOpen }: {
  item: MarketplaceItem; index: number; animate: boolean; relation: Relation; onOpen: (item: MarketplaceItem) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <Appear index={index} animate={animate}><TaskCard item={item} onOpen={open} relation={relation} /></Appear>;
});

/**
 * Zadaci. Owned: the requester's own Tasks in three sets (Aktivni · Nacrti ·
 * Istorija). Discovery: open Tasks as a List or a Map. One segmented control,
 * then the cards. Discovery keeps search visible and separates the map/list
 * view from the filter draft. Creation is the one orange action, floating
 * above the list. Presentation only: every callback is the route's existing command.
 */
export function MarketplacePresentation(props: MarketplacePresentationProps) {
  const { owned, items, loading, error, view, onOpen } = props, reduced = useReducedMotion();
  const relations = props.relations;
  const relationOf = useCallback((item: MarketplaceItem): Relation => owned || !relations ? undefined
    : relations.owned.has(item.id) ? 'OWNED' : relations.applied.has(item.id) ? 'APPLIED' : undefined, [owned, relations]);
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest
  // read). The rows get one function that never changes and calls whatever is current at press time.
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const openItem = useCallback((item: MarketplaceItem) => openRef.current(item), []);
  const [filterOpen, setFilterOpen] = useState(false), [priceDraft, setPriceDraft] = useState(view.price);
  const [attentionDraft, setAttentionDraft] = useState(view.attention);
  const [searchOpen, setSearchOpen] = useState(!!view.query);
  const visible = useMemo(() => marketplaceItems(items, view, owned), [items, view, owned]);
  // In discovery the person is looking for work; the tasks they posted themselves sat between the
  // others' with a "Tvoj zadatak" label (seen on the emulator, 2026-09-23: the first two cards).
  // They are kept out of the list by default and one quiet row says how many and shows them.
  const [showMine, setShowMine] = useState(false);
  const mine = useMemo(() => !owned && relations ? visible.filter(item => relations.owned.has(item.id)) : [], [owned, relations, visible]);
  const shown = useMemo(() => showMine || !mine.length ? visible : visible.filter(item => !relations!.owned.has(item.id)), [showMine, mine.length, visible, relations]);
  // The sheet promises what the list will show: own tasks the list keeps hidden are not counted (emulator,
  // 2026-09-23: "Prikaži 8 zadataka" over a list of 6).
  const draftCount = useMemo(() => loading || error ? null
    : marketplaceItems(items, { ...view, price: priceDraft, attention: attentionDraft }, owned)
      .filter(item => showMine || owned || !relations?.owned.has(item.id)).length,
  [items, view, priceDraft, attentionDraft, owned, loading, error, showMine, relations]);
  const attentionCount = useMemo(() => owned ? items.filter(item => isOwnedNeed(item) && hasNeedAttention(item) && item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA').length : 0, [items, owned]);
  const sections = useMemo(() => SECTIONS.map(option => option.key === 'active' && attentionCount ? { ...option, badge: attentionCount } : option), [attentionCount]);
  const selected = shown.find(item => item.id === view.selectedId && publicPoint(item)) ?? null;
  const withoutPins = shown.filter(item => !publicPoint(item)).length;
  const hasFilter = !!view.query || view.price !== 'all' || view.attention || !!view.area || owned && view.section !== 'active';
  const filterActive = view.price !== 'all' || view.attention;
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });
  const toggleMode = (mode: 'list' | 'map') => { Keyboard.dismiss(); change({ mode }); };
  const toggleSearch = () => { Keyboard.dismiss(); if (searchOpen && view.query) change({ query: '', selectedId: null }); setSearchOpen(open => !open); };
  const openFilters = () => { Keyboard.dismiss(); setPriceDraft(view.price); setAttentionDraft(view.attention); setFilterOpen(true); };
  // What the list is, in the two words the product uses for its two sides. It used to name the
  // global mode the app was in; there is no such mode any more.
  const eyebrow = owned ? 'Moje aktivnosti' : 'Uskoči i zaradi', title = owned ? 'Moji zadaci' : 'Pronađi zadatak';
  const sectionTitle = owned ? SECTION_TITLES[view.section] : 'Otvoreni zadaci';
  const count = loading || error ? null : shown.length;
  /** The floating action appears only above cards; an empty set carries its own inline primary, so a screen state never shows two orange actions. */
  const showCards = !loading && !error && shown.length > 0;
  // On a phone the orange "+" sat on top of a task pin near Belgrade. A map is the content a person
  // came to read, and a button parked on it hides one of the very things being looked for. Creation
  // stays reachable from the map — that is a tested decision, not an accident — so it moves off the
  // map surface and into the legend strip below it, which is chrome rather than content.
  const mapShown = !owned && view.mode === 'map' && !loading && !error;
  const sheetShown = filterOpen || mapShown && !!selected;
  const openSelected = () => {
    if (!selected) return;
    // A tab remains mounted behind its detail route. Remove its native Modal
    // before navigation so it cannot cover the newly opened task.
    change({ selectedId: null });
    onOpen(selected);
  };
  const filterLabel = filterActive ? 'Filteri, aktivni' : 'Filteri';
  const headerControls = <>
    <HeaderIconButton label="Pretraga" hint="Otvara polje za pretragu zadataka." icon={MagnifyingGlass} active={searchOpen} onPress={toggleSearch} />
    <HeaderIconButton label={filterLabel} icon={SlidersHorizontal} active={filterActive} onPress={openFilters} />
  </>;
  const searchField = <View style={[s.search, !owned && s.discoverySearch]}>
    <MagnifyingGlass size={21} color={sys.color.green} />
    <TextInput accessibilityLabel="Pretraži zadatke" autoFocus={owned} placeholder="Naslov, mesto ili uslov…" placeholderTextColor={sys.color.muted}
      value={view.query} onChangeText={query => change({ query: query.slice(0, 1000), selectedId: null })} maxLength={1000} style={s.input}
      returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
    {view.query ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" onPress={() => change({ query: '', selectedId: null })} haptic="select" style={s.clear}>
      <X size={18} weight="bold" color={sys.color.ink} /></Press> : null}
  </View>;
  // A task that arrives while you are looking says so; the ones that were already there do not
  // replay every time the list is pulled. `Appear` holds that distinction.
  const appear = useAppear();
  appear.settle(shown.map(keyOf));
  // `useAppear` returns a new object each render over the same two refs; read it through a ref so
  // `renderItem` keeps its identity and the list does not re-render every cell on every render.
  const appearRef = useRef(appear); appearRef.current = appear;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<MarketplaceItem>) =>
    <MarketplaceRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} relation={relationOf(item)} onOpen={openItem} />, [relationOf, openItem]);
  const listStyle = useMemo(() => [s.list, !!props.onNew && showCards && s.listWithAction], [props.onNew, showCards]);

  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><SkeletonList count={3} /><T variant="meta" tone="muted" style={s.center}>Učitavamo zadatke…</T></>
      : error ? <View style={s.state}><View style={s.stateArt}><FactArt kind="tasks" size={56} muted /></View><T style={s.stateTitle}>Zadatke trenutno nije moguće učitati</T><T style={s.stateBody}>Proveri internet vezu i pokušaj ponovo.</T>
        <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} style={brandAction} /></View>
        : hasFilter ? <View style={s.state}><View style={s.stateArt}><FactArt kind="map" size={56} /></View><T style={s.stateTitle}>Nema zadataka u ovom prikazu</T><T style={s.stateBody}>Promeni pretragu ili poništi filtere.</T>
          <V2Action label="Poništi filtere" onPress={() => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport })} /></View>
          : owned ? <View style={s.state}><T style={s.stateTitle}>{items.length ? 'Nema aktivnih zadataka' : 'Još nemaš Zadatak'}</T>
            <T style={s.stateBody}>{items.length ? 'Nacrti i završeni zadaci su u svojim prikazima.' : 'Reci šta ti treba. Nacrt pregledaš pre objave.'}</T>
            {props.onNew ? <V2Action label={items.length ? 'Napravi novi Zadatak' : 'Napravi prvi Zadatak'} onPress={props.onNew} style={brandAction} /> : null}
            {items.length ? <V2Action label="Prikaži sve moje zadatke" kind="quiet" onPress={() => change({ section: 'all' })} /> : null}</View>
            // The brand action is what the screen wants you to do. On the screen a worker meets
            // before anything exists, that is not "refresh" — it is the profile that decides
            // whether a task can ever be offered to them.
            : <View style={s.state}><View style={s.stateArt}><FactArt kind="tasks" size={56} /></View><T style={s.stateTitle}>Trenutno nema otvorenih zadataka</T>
              <T style={s.stateBody}>Zadaci se nude prema tvom radnom profilu — veštinama, području i dostupnosti.</T>
              <V2Action label="Dopuni radni profil" onPress={props.onProfile} style={brandAction} />
              <V2Action label="Osveži zadatke" kind="quiet" onPress={props.onRefresh} /></View>}
  </View>;

  return <SafeAreaView edges={['top']} style={s.screen}>
    <View aria-hidden={sheetShown} accessibilityElementsHidden={sheetShown} importantForAccessibility={sheetShown ? 'no-hide-descendants' : 'auto'} style={s.screen}>
      {/* Both tabs used this one presentation and both were titled Zadaci, so two different
          screens carried the same name. The discovery view is what the Mapa tab opens. */}
      {/* Underlined views scroll at large text sizes; search and filters keep full touch targets. */}
      {props.onBack ? <ProductHeader subtitle={eyebrow} title={title} back={props.onBack} />
        : <ScreenHeader eyebrow={eyebrow} title={title} onProfile={props.onProfile} />}
      {owned ? <View style={s.controls}>
        <View style={s.grow}><Segmented scroll appearance="underline" options={sections} value={view.section} onChange={section => change({ section, selectedId: null })} /></View>
        {headerControls}
      </View> : <>
        {searchField}
        <View style={s.discoveryTools}>
          <View accessibilityRole="tablist" accessibilityLabel="Prikaz zadataka" style={s.viewModes}>
            {MODES.map(mode => <Press key={mode.key} accessibilityRole="tab" accessibilityLabel={mode.label}
              accessibilityState={{ selected: view.mode === mode.key }} aria-selected={view.mode === mode.key} haptic="select"
              onPress={() => { if (view.mode !== mode.key) toggleMode(mode.key); }} style={[s.mode, view.mode === mode.key && s.modeActive]}>
              <FactArt kind={mode.key === 'map' ? 'map' : 'tasks'} size={24} muted={view.mode !== mode.key} />
              <T variant="meta" style={{ color: view.mode === mode.key ? sys.color.green : sys.color.muted }}>{mode.label}</T>
            </Press>)}
          </View>
          <Press accessibilityRole="button" accessibilityLabel={filterLabel} accessibilityState={{ selected: filterActive }} haptic="select"
            onPress={openFilters} style={[s.filterButton, filterActive && s.modeActive]}>
            <SlidersHorizontal size={21} color={sys.color.green} />
            <T variant="meta" style={{ color: sys.color.green }}>Filteri</T>
            {filterActive ? <View style={s.filterDot} /> : null}
          </Press>
        </View>
        {view.price !== 'all' ? <View style={s.appliedFilters}>
          <Press accessibilityRole="button" accessibilityLabel="Ukloni filter cene" haptic="select"
            onPress={() => change({ price: 'all', selectedId: null })} style={s.appliedFilter}>
            <FactArt kind={view.price === 'OFFERS' ? 'offers' : 'money'} size={22} />
            <T variant="meta" style={s.appliedFilterText}>{view.price === 'OFFERS' ? 'Tražim ponude' : 'Navedena cena'}</T>
            <X size={16} color={sys.color.green} />
          </Press>
        </View> : null}
      </>}
      {owned && searchOpen ? searchField : null}
      {view.area ? <View style={s.areaNotice}><T variant="note" tone="muted" style={s.grow}>Izabrana oblast sa mape · isti zadaci u Listi i Mapi</T>
        <V2Action label="Ukloni oblast" kind="quiet" onPress={() => change({ area: null, selectedId: null })} /></View> : null}
      {/* With nothing to show, a map is not a data state: the Mapa tab used to open on the whole
          world centred in the Atlantic with "0 zadataka", while the composed empty state sat
          unreachable in the other branch. Emptiness is answered the same way in both modes. */}
      {!owned && view.mode === 'map' && !loading && !error && !shown.length ? <View style={s.mapEmpty}>{empty}</View>
        : !owned && view.mode === 'map' && !loading && !error ? <View style={s.mapArea}>
        <DiscoveryMap items={shown} selectedId={selected?.id ?? null} viewport={view.viewport} scopeKey={props.scopeKey}
          onSelect={selectedId => change({ selectedId })} onViewport={viewport => change({ viewport })}
          onSearchArea={area => change({ area, selectedId: null })} onList={() => toggleMode('list')} />
        <View style={s.mapLegend}><T variant="note" tone="muted">{zadataka(shown.length)} · približne lokacije{withoutPins ? ` · ${withoutPins} bez tačke` : ''}</T>
          {withoutPins || props.onNew ? <View style={s.mapActions}>
          {withoutPins ? <V2Action label="Pogledaj listu" kind="quiet" compact onPress={() => toggleMode('list')} /> : null}
          {props.onNew ? <V2Action label="Dodaj zadatak" kind="quiet" compact
            onPress={() => { Keyboard.dismiss(); props.onNew?.(); }} /> : null}</View> : null}</View>
      </View> : <FlatList<MarketplaceItem> data={loading || error ? [] : shown} keyExtractor={keyOf} refreshing={props.refreshing ?? loading} onRefresh={props.onRefresh}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={listStyle}
        // Six cards are more than one phone screen of this card; the window stays modest so a fast
        // scroll fills in quickly without holding the whole list mounted.
        initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
        ItemSeparatorComponent={Separator} ListEmptyComponent={empty} renderItem={renderItem}
        ListHeaderComponent={loading || error || (!shown.length && !mine.length) ? null : <View style={s.countRow}>
          {count === null ? <T variant="note" tone="muted">Učitavamo…</T>
            : <T variant="note" tone="muted" numberOfLines={1}>{zadataka(count)}{owned && view.section !== 'active' ? ` · ${sectionTitle.toLocaleLowerCase('sr-Latn-RS')}` : ''}</T>}
          {mine.length ? <Press accessibilityRole="button" accessibilityLabel={showMine ? 'Sakrij moje zadatke' : 'Prikaži i moje zadatke'}
            onPress={() => setShowMine(value => !value)} haptic="select" style={s.mineToggle}>
            <T variant="note" style={s.mineToggleText}>{showMine ? 'Sakrij moje' : `${plural(mine.length, 'tvoj zadatak je sakriven', 'tvoja zadatka su sakrivena', 'tvojih zadataka je sakriveno')} · Prikaži`}</T>
          </Press> : null}
        </View>} />}
      {props.onNew && showCards && !mapShown ? <Press accessibilityRole="button" accessibilityLabel="Dodaj zadatak" accessibilityHint="Otvara novi Zadatak."
        onPress={() => { Keyboard.dismiss(); props.onNew?.(); }} haptic="light" scaleTo={0.94} style={s.add}>
        <Plus size={26} weight="bold" color={sys.color.onOrange} /></Press> : null}
    </View>
    {mapShown && selected && !filterOpen ? <ProductSheet key={selected.id} title="Zadatak na mapi" closeLabel="Zatvori pregled pina"
      reduced={reduced} onClose={() => change({ selectedId: null })}>{dismiss => <>
        <TaskCard item={selected} compact onOpen={openSelected} relation={relationOf(selected)} />
        <V2Action label="Otvori detalj Zadatka" onPress={openSelected} style={brandAction} />
        <V2Action label="Zatvori pregled pina" kind="quiet" onPress={dismiss} />
      </>}</ProductSheet> : null}
    {filterOpen ? <ProductSheet title="Filteri" closeLabel="Zatvori filtere" reduced={reduced} onClose={() => setFilterOpen(false)}>{dismiss => <>
        <T variant="label" style={s.groupLabel}>Način cene</T>
        <View accessibilityRole="radiogroup" style={s.options}>
          {PRICES.map(([value, label]) => <Press key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: priceDraft === value }} aria-checked={priceDraft === value}
            haptic="select" onPress={() => setPriceDraft(value)} style={[s.option, priceDraft === value && s.optionChecked]}>
            <View style={[s.radio, priceDraft === value && s.radioChecked]}>{priceDraft === value ? <View style={s.radioDot} /> : null}</View>
            <T variant={priceDraft === value ? 'bodyStrong' : 'body'} style={s.optionText}>{label}</T>
          </Press>)}
        </View>
        {owned ? <Press accessibilityRole="checkbox" accessibilityLabel="Treba moja radnja" accessibilityState={{ checked: attentionDraft }} aria-checked={attentionDraft} haptic="select"
          onPress={() => setAttentionDraft(value => !value)} style={[s.option, attentionDraft && s.optionChecked]}>
          <View style={[s.check, attentionDraft && s.checked]}>{attentionDraft ? <Check size={14} weight="bold" color={sys.color.surface} /> : null}</View>
          <View style={s.grow}><T variant="bodyStrong" style={s.optionText}>Treba moja radnja</T><T variant="note" tone="muted">Zadaci sa prijavama koje možeš da izabereš.</T></View>
        </Press> : null}
        <V2Action label={draftCount === null ? 'Prikaži zadatke' : `Prikaži ${zadataka(draftCount)}`} disabled={draftCount === null}
          onPress={() => { change({ price: priceDraft, attention: attentionDraft, selectedId: null }); dismiss(); }} style={brandAction} />
        <View style={s.sheetRow}>
          <V2Action label="Poništi izbor" kind="quiet" onPress={() => { setPriceDraft('all'); setAttentionDraft(false); }} />
          <V2Action label="Odustani od filtera" kind="quiet" onPress={dismiss} />
        </View>
      </>}</ProductSheet> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  discoveryTools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
  viewModes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  mode: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: sys.radius.control },
  modeActive: { backgroundColor: sys.color.greenSoft },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.cardLine },
  filterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: sys.color.green },
  appliedFilters: { paddingHorizontal: 20, paddingBottom: 6, alignItems: 'flex-start' },
  appliedFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.control },
  appliedFilterText: { color: sys.color.green, flexShrink: 1 },
  countRow: { paddingBottom: 8 },
  mineToggle: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  mineToggleText: { color: sys.color.green, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginBottom: 8, paddingLeft: 14, paddingRight: 6, backgroundColor: sys.color.wash,
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line },
  discoverySearch: { marginTop: 4, marginBottom: 12, borderColor: sys.color.cardLine, backgroundColor: sys.color.surface },
  input: { ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 48, paddingVertical: 10 },
  clear: { width: 44, height: 44, borderRadius: sys.radius.chip, alignItems: 'center', justifyContent: 'center' },
  areaNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: sys.color.greenSoft, paddingHorizontal: 20, paddingVertical: 2 },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  listWithAction: { paddingBottom: 132 },
  // Above the map legend and the attribution it used to cover, not on them.
  add: { position: 'absolute', right: 20, bottom: 72, width: 48, height: 48, borderRadius: sys.radius.cardCompact, alignItems: 'center', justifyContent: 'center',
    backgroundColor: sys.color.orange, ...sys.elevation.raised },
  empty: { paddingVertical: 8, gap: 16, flex: 1 }, center: { textAlign: 'center' },
  mapEmpty: { flex: 1, paddingHorizontal: 20 },
  stateArt: { width: 80, height: 80, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  state: { paddingVertical: 28, paddingHorizontal: 4, gap: 12, alignItems: 'flex-start' },
  stateTitle: { ...sys.type.title, color: sys.color.ink }, stateBody: { ...sys.type.copy, color: sys.color.muted, marginBottom: 6 },
  mapArea: { flex: 1, minHeight: 180 },
  // Give facts the full width: two actions previously squeezed them into a column of letters.
  mapLegend: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, backgroundColor: sys.color.surface, borderTopWidth: 1, borderColor: sys.color.line, gap: 4 },
  mapActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
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
