import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { X } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryConditions, discoveryFiltered, discoveryItems, discoveryStartSnap, initialMarketplaceView, pinPlaces,
  pointKey, publicPoint, saysWhen, saysWorkMode, undatedCount, type MarketplaceItem, type MarketplaceView, type WhenFilter } from '../../data/marketplaceView';
import { Press } from '../Press';
import { T } from '../Text';
import { Appear, useAppear } from '../system/Appear';
import { useReducedMotion } from '../system/motion';
import { zadataka } from '../system/plural';
import { ScreenHeader } from '../system/ScreenHeader';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { DiscoveryMap } from './DiscoveryMap';
import { DiscoveryListSheet, SNAP } from './discovery/DiscoveryListSheet';
import { DiscoveryPeek } from './discovery/DiscoveryPeek';
import { DiscoverySearchBar, type QuickChip } from './discovery/DiscoverySearchBar';
import { DiscoverySearchPanel, type SearchDraft, type SearchStep } from './discovery/DiscoverySearchPanel';
import { PRICE, QUICK_WHEN, WHEN, WHERE, conditionsWords, datesWords, placesWords, quoted, said, undatedWords, whereWords } from './discovery/discoveryWords';
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

const GAP = sys.space.md;
/** The tools' lower edge before it has been measured: the search pill's row and one row of chips under it. */
const TOOLS_ESTIMATE = sys.space.md + 56 + sys.space.sm + 48;
/** The sheet's top line before it has been measured: the grab bar and one line of count. */
const PEEK_ESTIMATE = 76;
const Separator = () => <View style={{ height: GAP }} />;
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
const INDEX = { peek: SNAP.peek, half: SNAP.half, full: SNAP.full } as const;

const DiscoveryRow = memo(function DiscoveryRow({ item, index, animate, applied, onOpen }: {
  item: MarketplaceItem; index: number; animate: boolean; applied: boolean; onOpen: (item: MarketplaceItem) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <Appear index={index} animate={animate}><TaskCard item={item} onOpen={open} relation={applied ? 'APPLIED' : undefined} /></Appear>;
});

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; critique A5–A7, B8–B12; Discovery V47). The map fills the screen under
 * the root chrome. Over it floats the search bar: one white pill that says the search in two lines and opens the search
 * panel, "Uslovi pretrage", "Dodaj zadatak", and a row of quick chips that toggle real filters at once. The list is a
 * sheet over the map with three heights, so there is no Lista/Mapa switch and nothing that only a gesture reaches: the
 * sheet's top line says how many tasks there are (and how many have no point on the map) and offers "Prikaži listu" /
 * "Prikaži mapu". It starts half open when the map cannot show most of the tasks or there are few, and at its top line
 * otherwise. My own tasks are not listed here at all (they are under Početna, "Moji zadaci"); a task I applied to says
 * so. Choosing a pin opens its card over the map. Presentation only: every callback is the route's own guarded command.
 */
export function DiscoveryPresentation(props: DiscoveryPresentationProps) {
  const { items, loading, error, view } = props, reduced = useReducedMotion(), focused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const relations = props.relations;
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest read); rows get one
  // stable function that calls whatever is current at press time.
  const openRef = useRef(props.onOpen); openRef.current = props.onOpen;
  const openItem = useCallback((item: MarketplaceItem) => openRef.current(item), []);
  // Two changes in one turn (a chip that also closes a pin's card) build on each other, not on the same render's view.
  const latestView = useRef(view); latestView.current = view;
  const change = (patch: Partial<MarketplaceView>) => {
    const next = { ...latestView.current, ...patch };
    latestView.current = next;
    props.onView(next);
  };

  // The list is read from what filters it and nothing else: moving the map or choosing a pin changes the view, and must
  // not hand the map a new list (the native source would be set again on every pan).
  const { query, price, area, when, where, places: freePlaces, place: chosenPlace, dates } = view;
  const now = useMemo(() => new Date(), [items, when, dates]); // eslint-disable-line react-hooks/exhaustive-deps
  const filters = useMemo(() => ({ ...initialMarketplaceView(), query, price, area, when, where, places: freePlaces, place: chosenPlace, dates }),
    [query, price, area, when, where, freePlaces, chosenPlace, dates]);
  const shown = useMemo(() => loading || error ? [] : discoveryItems(items, filters, relations?.owned, now),
    [loading, error, items, filters, relations, now]);
  const withoutPin = useMemo(() => shown.filter(item => !publicPoint(item)).length, [shown]);
  const groups = useMemo(() => pinPlaces(shown), [shown]);
  const byId = useMemo(() => new Map(shown.map(item => [item.id, item] as const)), [shown]);
  const applied = useCallback((item: MarketplaceItem) => !!relations?.applied.has(item.id), [relations]);
  const others = useMemo(() => relations?.owned.size ? items.filter(item => !relations.owned.has(item.id)) : items, [items, relations]);
  const undated = useMemo(() => loading || error ? 0 : undatedCount(items, filters, relations?.owned, now), [loading, error, items, filters, relations, now]);
  const conditionCount = discoveryConditions(view);
  const hasFilter = !!view.query.trim() || discoveryFiltered(view) || !!view.area || !!view.place;

  // Layout: the body under the chrome, the tools' lower edge, the sheet's measured top line.
  const [bodyHeight, setBodyHeight] = useState(0), [toolsBottom, setToolsBottom] = useState(TOOLS_ESTIMATE), [peek, setPeek] = useState(PEEK_ESTIMATE);
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
  const clearSelection = () => { if (latestView.current.selectedId || latestView.current.selectedPlace) change({ selectedId: null, selectedPlace: null }); };
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

  // The search panel, opened at "Gde" from the pill and at "Kada" from "Uslovi pretrage". Its draft applies all at once.
  const [search, setSearch] = useState<SearchStep | null>(null);
  const openSearch = (step: SearchStep) => { Keyboard.dismiss(); setSearch(step); };
  const apply = (draft: SearchDraft) => change({ ...draft, selectedId: null, selectedPlace: null });
  const reset = () => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport });

  // Quick chips: each toggles one existing filter at once, and is offered only when the loaded tasks carry the fact it
  // reads (or it is already on and must be removable).
  const timed = useMemo(() => saysWhen(others, now), [others, now]);
  const workModes = useMemo(() => saysWorkMode(others), [others]);
  const toggle = (patch: Partial<MarketplaceView>) => change({ ...patch, selectedId: null, selectedPlace: null });
  const currentWhen = dateRange(view.dates) ? 'any' : view.when ?? 'any';
  const chips: QuickChip[] = [
    ...QUICK_WHEN.filter(key => timed || currentWhen === key).map(key => ({ key: `when:${key}`, label: said(WHEN, key), selected: currentWhen === key,
      onPress: () => toggle({ when: currentWhen === key ? 'any' : key as WhenFilter, dates: null }) })),
    ...(['onsite', 'remote'] as const).filter(key => workModes || view.where === key).map(key => ({ key: `where:${key}`, label: said(WHERE, key),
      selected: view.where === key, onPress: () => toggle({ where: view.where === key ? 'any' : key }) })),
    ...(['MY_PRICE', 'OFFERS'] as const).filter(key => view.price === key || others.some(item => item.rezimCene === key)).map(key => ({
      key: `price:${key}`, label: said(PRICE, key), selected: view.price === key, onPress: () => toggle({ price: view.price === key ? 'all' : key }) })),
    ...(atLeast(freePlaces) > 1 || others.some(item => (item.pokrivenost?.preostalo ?? 0) >= 2) ? [{ key: 'places',
      label: atLeast(freePlaces) > 1 ? placesWords(freePlaces) : placesWords(2), selected: atLeast(freePlaces) > 1,
      onPress: () => toggle({ places: atLeast(freePlaces) > 1 ? 1 : 2 }) }] : []),
  ];

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
  const peekShown = mapShown && (!!chosen || placeTasks.length > 1) && search === null;
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
  // A time choice leaves out the tasks whose schedule names no day; the list says how many instead of hiding them silently.
  const footer = undated ? <T variant="note" tone="muted" style={s.undated}>{undatedWords(undated)}</T> : null;

  // What is on and has no quick chip of its own says itself once, under the count, and removes itself: the place, the
  // searched words, the map's area and the time choices the chips do not carry. A quick chip removes its own filter.
  const range = dateRange(view.dates);
  const appliedChips: { key: string; label: string; clear: Partial<MarketplaceView> }[] = [
    ...(view.place ? [{ key: 'place', label: view.place, clear: { place: null } }] : []),
    ...(view.query.trim() ? [{ key: 'query', label: quoted(view.query), clear: { query: '' } }] : []),
    ...(view.area ? [{ key: 'area', label: 'Oblast sa mape', clear: { area: null } }] : []),
    ...(range ? [{ key: 'dates', label: datesWords(range, now), clear: { dates: null } }]
      : currentWhen !== 'any' && !QUICK_WHEN.includes(currentWhen) ? [{ key: 'when', label: said(WHEN, currentWhen), clear: { when: 'any' as const } }] : []),
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
      <T style={s.appliedText} numberOfLines={1}>{chip.label}</T><X size={14} weight="bold" color={sys.color.green} />
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
      <DiscoverySearchBar where={whereWords(view)} conditions={conditionsWords(view, now)} conditionCount={conditionCount}
        chips={chips} chipsShown onSearch={() => openSearch('gde')} onConditions={() => openSearch('kada')}
        onNew={props.onNew ? () => { Keyboard.dismiss(); props.onNew?.(); } : undefined}
        onLayout={bottom => setToolsBottom(current => current === bottom ? current : bottom)} />
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
          ItemSeparatorComponent={Separator} ListEmptyComponent={empty} ListFooterComponent={footer} />
      </DiscoveryListSheet>
      {peekShown ? <DiscoveryPeek key={chosen ? `task:${chosen.id}` : `place:${place!.key}`}
        item={chosen} place={placeTasks} applied={applied} active={focused} bottomInset={peek + GAP} reduced={reduced}
        onOpen={openItem} onShowPlace={showPlace} onClose={clearSelection}
        onHeight={next => setCardHeight(current => current === next ? current : next)} /> : null}
    </View>
    {search ? <DiscoverySearchPanel items={items} view={view} mine={relations?.owned} now={now} mapArea={view.viewport?.bounds ?? null}
      start={search} reduced={reduced} onApply={apply} onClose={() => setSearch(null)} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  body: { flex: 1 },
  ground: { flex: 1, backgroundColor: sys.color.wash },
  header: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.sm },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 4, backgroundColor: sys.color.lineStrong },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48 },
  count: { flex: 1, minWidth: 0, color: sys.color.ink },
  toggle: { minHeight: 48, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  toggleText: { ...sys.type.copy, fontWeight: '600', color: sys.color.green },
  applied: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingBottom: sys.space.xs },
  appliedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, maxWidth: '100%', paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.greenSoft },
  appliedText: { ...sys.type.meta, fontWeight: '600', color: sys.color.green, flexShrink: 1 },
  list: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.xxl, flexGrow: 1 },
  empty: { flex: 1, paddingVertical: sys.space.sm },
  undated: { paddingTop: sys.space.base, textAlign: 'center' },
});
