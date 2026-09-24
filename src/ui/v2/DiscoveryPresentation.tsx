import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, TextInput, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { MagnifyingGlass, Plus, SlidersHorizontal, X, type Icon } from 'phosphor-react-native';
import { discoveryFiltered, discoveryItems, discoveryStartSnap, initialMarketplaceView, pinPlaces, pointKey, publicPoint,
  type MarketplaceItem, type MarketplaceView } from '../../data/marketplaceView';
import { Press } from '../Press';
import { T } from '../Text';
import { Appear, useAppear } from '../system/Appear';
import { useReducedMotion } from '../system/motion';
import { zadataka } from '../system/plural';
import { ChromeIconButton } from '../system/ScreenChrome';
import { ScreenHeader } from '../system/ScreenHeader';
import { StateView } from '../system/StateView';
import { floating, sys } from '../system/tokens';
import { DiscoveryMap } from './DiscoveryMap';
import { DiscoveryFilterSheet, PLACES, PRICE, WHEN, WHERE, type FilterDraft } from './discovery/DiscoveryFilterSheet';
import { DiscoveryListSheet, SNAP } from './discovery/DiscoveryListSheet';
import { DiscoveryPeek } from './discovery/DiscoveryPeek';
import { TaskCard } from './TaskCard';

export type DiscoveryPresentationProps = { items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onProfile: () => void; onNew?: () => void;
  /** Which of the shown tasks are mine (never listed here) and which I have applied to (labelled). */
  relations?: { owned: ReadonlySet<string>; applied: ReadonlySet<string> };
  /**
   * The relations above are still being read for this list. Until they land the list cannot yet leave my own tasks out,
   * so it says no count (a count that drops from 5 to 3 a moment later is a count that was wrong) and does not yet decide
   * where the sheet starts. A failed read is not pending: the list then counts what it shows.
   */
  relationsPending?: boolean };

const TOOLS_TOP = sys.space.md, GAP = sys.space.md;
/** The sheet's top line before it has been measured: the grab bar and one line of count. */
const PEEK_ESTIMATE = 76;
const Separator = () => <View style={{ height: GAP }} />;
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
const INDEX = { peek: SNAP.peek, half: SNAP.half, full: SNAP.full } as const;

/**
 * "Dodaj zadatak" is the chrome's one icon button with an orange glyph on white: an accent, never an orange fill (B12).
 * The glyph is the only thing that says what the control is, so it is the orange that reads (`orangeInk`, 5.3:1 on
 * white), not the action orange's edge (2.97:1, under the 3:1 a control needs; review r3 item 2).
 */
const AddGlyph: Icon = ({ size }) => <Plus size={size} weight="bold" color={sys.color.orangeInk} />;

const DiscoveryRow = memo(function DiscoveryRow({ item, index, animate, applied, onOpen }: {
  item: MarketplaceItem; index: number; animate: boolean; applied: boolean; onOpen: (item: MarketplaceItem) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <Appear index={index} animate={animate}><TaskCard item={item} onOpen={open} relation={applied ? 'APPLIED' : undefined} /></Appear>;
});

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; critique A5–A7, B8–B12). The map fills the screen under the root
 * chrome; one floating row of tools sits over it (search, Filteri, Dodaj zadatak); the list is a sheet over the map with
 * three heights, so there is no Lista/Mapa switch and nothing that only a gesture reaches: the sheet's top line says how
 * many tasks there are (and how many have no point on the map) and offers "Prikaži listu" / "Prikaži mapu". It starts
 * half open when the map cannot show most of the tasks or there are few, and at its top line otherwise. My own tasks are
 * not listed here at all (they are under Početna, "Moji zadaci"); a task I applied to says so. Choosing a pin opens its
 * card over the map. Presentation only: every callback is the route's own guarded command.
 */
export function DiscoveryPresentation(props: DiscoveryPresentationProps) {
  const { items, loading, error, view } = props, reduced = useReducedMotion(), focused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const relations = props.relations;
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest read); rows get one
  // stable function that calls whatever is current at press time.
  const openRef = useRef(props.onOpen); openRef.current = props.onOpen;
  const openItem = useCallback((item: MarketplaceItem) => openRef.current(item), []);
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });

  // The list is read from what filters it and nothing else: moving the map or choosing a pin changes the view, and must
  // not hand the map a new list (the native source would be set again on every pan).
  const { query, price, area, when, where, places: freePlaces } = view;
  const now = useMemo(() => new Date(), [items, when]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => loading || error ? [] : discoveryItems(items, { ...initialMarketplaceView(), query, price, area, when, where, places: freePlaces },
    relations?.owned, now), [loading, error, items, query, price, area, when, where, freePlaces, relations, now]);
  const withoutPin = useMemo(() => shown.filter(item => !publicPoint(item)).length, [shown]);
  const groups = useMemo(() => pinPlaces(shown), [shown]);
  const byId = useMemo(() => new Map(shown.map(item => [item.id, item] as const)), [shown]);
  const applied = useCallback((item: MarketplaceItem) => !!relations?.applied.has(item.id), [relations]);
  const filtered = discoveryFiltered(view);
  const hasFilter = !!view.query || filtered || !!view.area;

  // Layout: the body under the chrome, the tools' lower edge, the sheet's measured top line.
  const [bodyHeight, setBodyHeight] = useState(0), [toolsBottom, setToolsBottom] = useState(TOOLS_TOP + 48), [peek, setPeek] = useState(PEEK_ESTIMATE);
  const snapPoints = useMemo(() => {
    if (!bodyHeight) return [peek, '50%', '88%'];
    const full = Math.max(peek + 2, bodyHeight - toolsBottom - GAP);
    return [peek, Math.min(full - 1, Math.max(peek + 1, Math.round(bodyHeight / 2))), full];
  }, [bodyHeight, toolsBottom, peek]);
  const position = useSharedValue(0);
  const [sheetIndex, setSheetIndex] = useState<number>(SNAP.half);
  // Where the sheet starts is decided once, when the first read lands (and with it what is mine, so my own tasks do not
  // tip the choice), from how many tasks the map can show.
  const pending = !!props.relationsPending;
  const started = useRef(false);
  useEffect(() => {
    if (started.current || loading || error || pending) return;
    started.current = true;
    setSheetIndex(INDEX[discoveryStartSnap(shown.length, withoutPin)]);
  }, [loading, error, pending, shown.length, withoutPin]);
  // What is listed must be seen. A sheet resting at its top line rises to show why nothing is listed; and when nothing
  // listed has a point on the map (a filter left only "Na daljinu"), it takes the screen, over a map with nothing on it.
  useEffect(() => {
    if (!started.current || loading || sheetIndex !== SNAP.peek) return;
    if (!shown.length) setSheetIndex(SNAP.half);
    else if (withoutPin === shown.length) setSheetIndex(SNAP.full);
  }, [loading, shown.length, withoutPin]); // eslint-disable-line react-hooks/exhaustive-deps

  // A chosen pin: one task, or a place several tasks share. The map follows the list, so a choice the list no longer
  // holds simply has no card.
  const selectedItem = view.selectedId ? byId.get(view.selectedId) ?? null : null;
  const place = view.selectedPlace ? groups.get(view.selectedPlace) : undefined;
  const placeTasks = useMemo(() => place && place.ids.length > 1 ? place.ids.flatMap(id => byId.get(id) ?? []) : [], [place, byId]);
  const chosen = selectedItem && publicPoint(selectedItem) ? selectedItem : null;
  const select = (id: string) => {
    const item = byId.get(id), point = item && publicPoint(item);
    if (!point) return;
    const shared = groups.get(pointKey(point));
    change(shared && shared.ids.length > 1 ? { selectedId: null, selectedPlace: shared.key } : { selectedId: id, selectedPlace: null });
    setSheetIndex(SNAP.peek);
  };
  const selectPlace = (key: string) => {
    const shared = groups.get(key);
    if (!shared) return;
    change(shared.ids.length > 1 ? { selectedId: null, selectedPlace: key } : { selectedId: shared.ids[0], selectedPlace: null });
    setSheetIndex(SNAP.peek);
  };
  const clearSelection = () => { if (view.selectedId || view.selectedPlace) change({ selectedId: null, selectedPlace: null }); };
  // "Prikaži svih N u listi": the list narrows to that one public point, as an area the person can remove.
  const showPlace = () => {
    if (!place) return;
    const { lat, lng } = place.point, half = 0.005;
    change({ area: [Math.max(-180, lng - half), Math.max(-90, lat - half), Math.min(180, lng + half), Math.min(90, lat + half)], selectedId: null, selectedPlace: null });
    setSheetIndex(SNAP.full);
  };
  const onIndex = (index: number) => {
    setSheetIndex(index);
    // Pulling the list up is looking at the list: a pin's card does not stay over it.
    if (index > SNAP.peek) clearSelection();
  };

  const [filterOpen, setFilterOpen] = useState(false);
  const openFilters = () => { Keyboard.dismiss(); setFilterOpen(true); };
  const apply = (draft: FilterDraft) => change({ ...draft, selectedId: null, selectedPlace: null });
  const reset = () => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport });

  // The map is shown once the read has landed and it has something to show (or a place the person already looked at).
  // Its first mount also waits for what is mine, exactly as the sheet's start does: the map fits its pins once, when it
  // mounts, so a mount before that would fit my own tasks for a sheet height the sheet then does not take (review r3b).
  // A later read of the labels does not take the map away again.
  const mapShown = !loading && !error && !(pending && !started.current) && (shown.length - withoutPin > 0 || !!view.viewport);
  const expanded = sheetIndex === SNAP.full;
  // The first fit of the pins keeps them above where the sheet starts: its top line, or half the map (review r3 item 3).
  const halfSheet = typeof snapPoints[1] === 'number' ? snapPoints[1] : Math.round(windowHeight / 2);
  const fitBottom = (discoveryStartSnap(shown.length, withoutPin) === 'peek' ? peek : halfSheet) + GAP;
  // A chosen pin's card: the map's zoom and credits step up above it (review r3 item 11).
  const peekShown = mapShown && (!!chosen || placeTasks.length > 1) && !filterOpen;
  const [cardHeight, setCardHeight] = useState(0);

  const appear = useAppear();
  appear.settle(shown.map(keyOf));
  const appearRef = useRef(appear); appearRef.current = appear;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<MarketplaceItem>) =>
    <DiscoveryRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} applied={applied(item)} onOpen={openItem} />, [applied, openItem]);

  // The one state view: reading, not read, nothing in this view, nothing yet — the meanings the list had before.
  const empty = <View style={s.empty}>
    {loading ? <StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'task' }} />
      : error ? <StateView kind="error" art="tasks" title="Zadatke trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        : hasFilter ? <StateView art="map" title="Nema zadataka u ovom prikazu" body="Promeni pretragu ili poništi filtere."
          primary={{ label: 'Poništi filtere', onPress: reset }} />
          // The brand action is what the screen wants you to do. On the screen a worker meets before anything exists,
          // that is not "refresh" — it is the profile that decides whether a task can ever be offered to them.
          : <StateView art="tasks" title="Trenutno nema otvorenih zadataka"
            body="Zadaci se nude prema tvom radnom profilu — veštinama, području i dostupnosti."
            primary={{ label: 'Dopuni radni profil', onPress: props.onProfile }} quiet={{ label: 'Osveži zadatke', onPress: props.onRefresh }} />}
  </View>;

  // What is on: each filter says itself once, under the count, and removes itself.
  const appliedChips: { key: string; label: string; clear: Partial<MarketplaceView> }[] = [
    ...(view.area ? [{ key: 'area', label: 'Oblast sa mape', clear: { area: null } }] : []),
    ...((view.when ?? 'any') !== 'any' ? [{ key: 'when', label: WHEN.find(([key]) => key === view.when)![1], clear: { when: 'any' as const } }] : []),
    ...((view.where ?? 'any') !== 'any' ? [{ key: 'where', label: WHERE.find(([key]) => key === view.where)![1], clear: { where: 'any' as const } }] : []),
    ...(view.price !== 'all' ? [{ key: 'price', label: PRICE.find(([key]) => key === view.price)![1], clear: { price: 'all' as const } }] : []),
    ...((view.places ?? 'any') !== 'any' ? [{ key: 'places', label: `${PLACES.find(([key]) => key === view.places)![1]} mesta`, clear: { places: 'any' as const } }] : []),
  ];
  // The count says what is listed, so it waits until the list knows which tasks are mine (review r3 item 9).
  const counted = !loading && !error && !pending && shown.length > 0;
  const header = <View style={s.header} onLayout={event => { const next = Math.ceil(event.nativeEvent.layout.height); if (next > 0) setPeek(current => current === next ? current : next); }}>
    <View style={s.grab} />
    <View style={s.headerRow}>
      <T variant="bodyStrong" numberOfLines={2} style={s.count}>
        {counted ? zadataka(shown.length) : ''}
        {counted && withoutPin ? <T variant="note" tone="muted">{` · ${withoutPin} bez tačke na mapi`}</T> : null}
      </T>
      {!expanded || mapShown ? <Press accessibilityRole="button" accessibilityLabel={expanded ? 'Prikaži mapu' : 'Prikaži listu'} haptic="select"
        onPress={() => { Keyboard.dismiss(); setSheetIndex(expanded ? SNAP.peek : SNAP.full); if (!expanded) clearSelection(); }} style={s.toggle}>
        <T style={s.toggleText}>{expanded ? 'Prikaži mapu' : 'Prikaži listu'}</T>
      </Press> : null}
    </View>
    {appliedChips.length ? <View style={s.applied}>{appliedChips.map(chip => <Press key={chip.key} accessibilityRole="button" accessibilityLabel={`Ukloni filter: ${chip.label}`}
      haptic="select" hitSlop={{ top: 6, bottom: 6 }} onPress={() => change({ ...chip.clear, selectedId: null, selectedPlace: null })} style={s.appliedChip}>
      <T style={s.appliedText}>{chip.label}</T><X size={14} weight="bold" color={sys.color.green} />
    </Press>)}</View> : null}
  </View>;

  return <SafeAreaView edges={['top']} style={s.screen}>
    {/* The root chrome: the tab bar already says this is Zadaci, so the name reaches a screen reader with the mark. */}
    <ScreenHeader title="Zadaci" onProfile={props.onProfile} />
    <View style={s.body} onLayout={event => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0) setBodyHeight(next); }}>
      <View style={StyleSheet.absoluteFill}>
        {mapShown ? <DiscoveryMap items={shown} selectedId={chosen?.id ?? null} selectedPlace={placeTasks.length > 1 ? place!.key : null}
          viewport={view.viewport} scopeKey={props.scopeKey} onSelect={select} onSelectPlace={selectPlace}
          onViewport={viewport => change({ viewport })} onSearchArea={area => change({ area, selectedId: null, selectedPlace: null })}
          onList={() => setSheetIndex(SNAP.full)} sheetTop={position} toolsBottom={toolsBottom} fitBottom={fitBottom}
          coverBottom={peekShown && cardHeight ? cardHeight + GAP : 0}
          focusBottom={peek + GAP + Math.min(360, Math.round(windowHeight / 2))} busy={loading || !!props.refreshing} />
          : <View style={s.ground} />}
      </View>
      <View pointerEvents="box-none" style={s.tools} onLayout={event => { const { y, height } = event.nativeEvent.layout; setToolsBottom(Math.ceil(y + height)); }}>
        <View style={s.search}>
          <MagnifyingGlass size={20} color={sys.color.green} />
          <TextInput accessibilityLabel="Pretraži zadatke" placeholder="Pretraži zadatke" placeholderTextColor={sys.color.muted}
            value={view.query} onChangeText={query => change({ query: query.slice(0, 1000), selectedId: null, selectedPlace: null })} maxLength={1000}
            style={s.input} returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
          {view.query ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" haptic="select" style={s.clear}
            onPress={() => change({ query: '', selectedId: null, selectedPlace: null })}><X size={18} weight="bold" color={sys.color.ink} /></Press> : null}
        </View>
        <View style={s.tool}><View style={s.lift} />
          <ChromeIconButton label={filtered ? 'Filteri, aktivni' : 'Filteri'} icon={SlidersHorizontal} active={filtered} onPress={openFilters}>
            {filtered ? <View style={s.filterDot} /> : null}
          </ChromeIconButton>
        </View>
        {/* A deliberate deviation from master plan step 4, which puts the "+" "u zaglavlju liste" (in the list's header;
            review r3 item 14): it stays here, in the floating tools row, which B12 allows, because this row is on screen
            at every height of the sheet, while the list's header is only a top line at its lowest height. */}
        {props.onNew ? <View style={s.tool}><View style={s.lift} />
          <ChromeIconButton label="Dodaj zadatak" hint="Otvara novi Zadatak." icon={AddGlyph} onPress={() => { Keyboard.dismiss(); props.onNew?.(); }} />
        </View> : null}
      </View>
      <DiscoveryListSheet index={sheetIndex} snapPoints={snapPoints} position={position} reduced={reduced} onIndex={onIndex} header={header}>
        {/* Pull to refresh belongs to the list at its full height (review r3 item 10, checked in gorhom 5.2.14: its
            refresh control is enabled only while the list may scroll, which is at the top height). At the lower heights
            a pull down lowers the sheet, as in the map apps people know; the list is read again on every return to
            the screen, and the error and empty states carry their own "Pokušaj ponovo" / "Osveži zadatke". */}
        <BottomSheetFlatList<MarketplaceItem> data={shown} keyExtractor={keyOf} renderItem={renderItem}
          refreshing={!!props.refreshing && !loading} onRefresh={props.onRefresh}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
          // Six cards are more than one phone screen of this card; the window stays modest so a fast
          // scroll fills in quickly without holding the whole list mounted.
          initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
          ItemSeparatorComponent={Separator} ListEmptyComponent={empty} />
      </DiscoveryListSheet>
      {peekShown ? <DiscoveryPeek key={chosen ? `task:${chosen.id}` : `place:${place!.key}`}
        item={chosen} place={placeTasks} applied={applied} active={focused} bottomInset={peek + GAP} reduced={reduced}
        onOpen={openItem} onShowPlace={showPlace} onClose={clearSelection}
        onHeight={next => setCardHeight(current => current === next ? current : next)} /> : null}
    </View>
    {filterOpen ? <DiscoveryFilterSheet items={items} view={view} mine={relations?.owned} now={now} onApply={apply} onClose={() => setFilterOpen(false)} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  body: { flex: 1 },
  ground: { flex: 1, backgroundColor: sys.color.wash },
  // One floating row over the map: the search field and the chrome's icon buttons, each lifted off the map.
  tools: { position: 'absolute', top: TOOLS_TOP, left: sys.space.base, right: sys.space.base, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  search: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48, paddingLeft: 14, paddingRight: 4,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface, ...floating },
  input: { ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 46, paddingVertical: 8 },
  clear: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  tool: { width: 48, height: 48 },
  lift: { position: 'absolute', top: 2, left: 2, width: 44, height: 44, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, ...floating },
  // Green, not orange: the "+" beside it is the screen's one orange accent (review r3 item 6). The dot repeats the
  // filled glyph and "Filteri, aktivni" for a glance.
  filterDot: { position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.green,
    borderWidth: 2, borderColor: sys.color.surface },
  header: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.sm },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 4, backgroundColor: sys.color.lineStrong },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48 },
  count: { flex: 1, minWidth: 0, color: sys.color.ink },
  toggle: { minHeight: 48, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  toggleText: { ...sys.type.copy, fontWeight: '600', color: sys.color.green },
  applied: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingBottom: sys.space.xs },
  appliedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.greenSoft },
  appliedText: { ...sys.type.meta, fontWeight: '600', color: sys.color.green },
  list: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.xxl, flexGrow: 1 },
  empty: { flex: 1, paddingVertical: sys.space.sm },
});
