import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { BottomSheetFlatList, type BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';
import { MapTrifold, X } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryConditions, discoveryFiltered, discoveryShown, discoveryStartSnap, initialMarketplaceView, pinPlaces,
  placeKey, pointKey, publicInitialBounds, publicPoint, sameBounds, saysWhen, saysWorkMode, undatedCount, type DiscoveryShown, type DiscoverySnap,
  type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter } from '../../data/marketplaceView';
import { Press } from '../Press';
import { T } from '../Text';
import { Appear, useAppear } from '../system/Appear';
import { useReducedMotion } from '../system/motion';
import { zadataka } from '../system/plural';
import { ScreenHeader } from '../system/ScreenHeader';
import { StateView } from '../system/StateView';
import { floating, sys } from '../system/tokens';
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
/**
 * While a pin's card covers the bottom of the map, the list sheet sinks to this sliver behind it (Discovery V47): its top
 * line is not a second strip under the card. Closing the card brings the top line back.
 */
export const HIDDEN = 1;
/** The pin card's gap above the bottom of the screen, which ends where the tab bar begins: it sits just above the bar. */
const CARD_BOTTOM = sys.space.md;
/** The list scrolled at least this far is scrolled: at its full height the quick chips then fold away. */
const SCROLLED = 8;
/** How long after the list stops moving its offset is written into the route's view, to be found again on return. */
export const OFFSET_SETTLE_MS = 250;
const Separator = () => <View style={{ height: GAP }} />;
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
const INDEX = { peek: SNAP.peek, half: SNAP.half, full: SNAP.full } as const;
const SNAP_NAME: readonly DiscoverySnap[] = ['peek', 'half', 'full'];
/** Nothing to show yet (reading) or at all (a failed read). */
const NOTHING: DiscoveryShown = { mapped: [], inArea: [], withoutPoint: [], listed: [] };

const DiscoveryRow = memo(function DiscoveryRow({ item, index, animate, applied, onOpen, section }: {
  item: MarketplaceItem; index: number; animate: boolean; applied: boolean; onOpen: (item: MarketplaceItem) => void;
  /** The first task without a point under a map area: the quiet heading of those tasks, with how many there are. */
  section?: number;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <>
    {section !== undefined ? <View testID="section-without-point" accessible accessibilityRole="header"
      accessibilityLabel={`Bez tačke na mapi, ${zadataka(section)}`} style={s.section}>
      <T style={s.sectionTitle}>Bez tačke na mapi</T><T style={s.sectionCount}>{section}</T>
    </View> : null}
    <Appear index={index} animate={animate}><TaskCard item={item} onOpen={open} relation={applied ? 'APPLIED' : undefined} /></Appear>
  </>;
});

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; critique A5–A7, B8–B12; Discovery V47, Airbnb's interaction in
 * USKOČI's look). The map fills the screen under the root chrome. Over it floats the search bar: one white pill that says
 * the search in two lines and opens the search panel, "Uslovi pretrage", "Dodaj zadatak", and a row of quick chips that
 * toggle real filters at once (they fold away while the whole list is up and scrolled).
 *
 * The list is a sheet over the map with three heights, and it follows the map: after the person's own move settles, the
 * list holds what the map shows, then, under a quiet "Bez tačke na mapi", every task that has no point at all, which an
 * area can never leave out. The camera's own moves never change what is listed. The sheet's top line says honestly how
 * many tasks there are and is itself the button that opens the list; at the full height a floating "Mapa" brings the same
 * map back. It starts half open when the map cannot show most of the tasks or there are few, and at its top line
 * otherwise; where it rests, how far the list is scrolled and where the camera stands are kept in the route's view.
 * Choosing a pin opens one floating card for it, over the sheet's top line, which steps out of sight behind it.
 *
 * My own tasks are not listed here at all (they are under Početna, "Moji zadaci"); a task I applied to says so.
 * Presentation only: every callback is the route's own guarded command.
 */
export function DiscoveryPresentation(props: DiscoveryPresentationProps) {
  const { items, loading, error, view } = props, reduced = useReducedMotion(), focused = useIsFocused();
  const { height: windowHeight } = useWindowDimensions();
  const relations = props.relations;
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest read); rows get one
  // stable function that calls whatever is current at press time.
  const openRef = useRef(props.onOpen); openRef.current = props.onOpen;
  const openItem = useCallback((item: MarketplaceItem) => openRef.current(item), []);
  // Every change goes through the route's latest guarded `onView`, and two changes in one turn (a chip that also closes a
  // pin's card) build on each other, not on the same render's view.
  const latestView = useRef(view); latestView.current = view;
  const onViewRef = useRef(props.onView); onViewRef.current = props.onView;
  const change = useCallback((patch: Partial<MarketplaceView>) => {
    const next = { ...latestView.current, ...patch };
    latestView.current = next;
    onViewRef.current(next);
  }, []);

  // The list is read from what filters it and nothing else: moving the map or choosing a pin changes the view, and must
  // not hand the map a new list (the native source would be set again on every pan). The map's own set leaves the area
  // out, so a move of the map never takes a pin away; only the list follows the area.
  const { query, price, area, when, where, places: freePlaces, place: chosenPlace, dates } = view;
  const now = useMemo(() => new Date(), [items, when, dates]); // eslint-disable-line react-hooks/exhaustive-deps
  const filters = useMemo(() => ({ ...initialMarketplaceView(), query, price, area, when, where, places: freePlaces, place: chosenPlace, dates }),
    [query, price, area, when, where, freePlaces, chosenPlace, dates]);
  const { mapped, inArea, withoutPoint, listed } = useMemo((): DiscoveryShown => loading || error ? NOTHING : discoveryShown(items, filters, relations?.owned, now),
    [loading, error, items, filters, relations, now]);
  const mappedWithoutPin = useMemo(() => mapped.filter(item => !publicPoint(item)).length, [mapped]);
  const groups = useMemo(() => pinPlaces(mapped), [mapped]);
  const byId = useMemo(() => new Map(mapped.map(item => [item.id, item] as const)), [mapped]);
  const applied = useCallback((item: MarketplaceItem) => !!relations?.applied.has(item.id), [relations]);
  const others = useMemo(() => relations?.owned.size ? items.filter(item => !relations.owned.has(item.id)) : items, [items, relations]);
  const undated = useMemo(() => loading || error ? 0 : undatedCount(items, filters, relations?.owned, now), [loading, error, items, filters, relations, now]);
  const conditionCount = discoveryConditions(view);
  const hasFilter = !!view.query.trim() || discoveryFiltered(view) || !!view.area || !!view.place;

  // Where the sheet rests is remembered in the route's view; a view that has one is where the sheet starts again.
  const [sheetIndex, setSheetIndex] = useState<number>(() => view.sheet ? INDEX[view.sheet] : SNAP.half);
  const started = useRef(!!view.sheet);
  useEffect(() => {
    if (!started.current) return;
    const name = SNAP_NAME[sheetIndex];
    if (name && latestView.current.sheet !== name) change({ sheet: name });
  }, [sheetIndex, change]);
  // Where the sheet starts is decided once, when the first read lands (and with it what is mine, so my own tasks do not
  // tip the choice), from how many tasks the map can show.
  const pending = !!props.relationsPending;
  useEffect(() => {
    if (started.current || loading || error || pending) return;
    started.current = true;
    const start = discoveryStartSnap(mapped.length, mappedWithoutPin);
    setSheetIndex(INDEX[start]);
    // Remembered at once: a start equal to the height the sheet already had changes no state to remember it by later.
    if (latestView.current.sheet !== start) change({ sheet: start });
  }, [loading, error, pending, mapped.length, mappedWithoutPin, change]);
  // What is found must be seen. A sheet resting at its top line rises to show why nothing is found; and when nothing found
  // has a point on the map (a filter left only "Onlajn"), it takes the screen, over a map with nothing on it. The map's
  // area is not a reason: moving the map never moves the sheet the person is looking past.
  useEffect(() => {
    if (!started.current || loading || sheetIndex !== SNAP.peek) return;
    if (!mapped.length) setSheetIndex(SNAP.half);
    else if (mappedWithoutPin === mapped.length) setSheetIndex(SNAP.full);
  }, [loading, mapped.length, mappedWithoutPin]); // eslint-disable-line react-hooks/exhaustive-deps

  // A chosen pin: one task, or a place several tasks share, of what the map shows. The list's area never takes it away.
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
  // The list follows the map: a settled move of the person's own hands up the bounds it shows.
  const followArea = (bounds: PublicBounds) => { if (!sameBounds(bounds, latestView.current.area)) change({ area: bounds }); };

  // Layout: the body under the chrome, the tools' lower edge, the sheet's measured top line.
  const [bodyHeight, setBodyHeight] = useState(0), [toolsBottom, setToolsBottom] = useState(TOOLS_ESTIMATE), [peek, setPeek] = useState(PEEK_ESTIMATE);
  // The map is shown once the read has landed and it has something to show (or a place the person already looked at).
  // Its first mount also waits for what is mine, exactly as the sheet's start does: the map fits its pins once, when it
  // mounts, so a mount before that would fit my own tasks for a sheet height the sheet then does not take (review r3b).
  // A later read of the labels does not take the map away again.
  const mapShown = !loading && !error && !(pending && !started.current) && (mapped.length - mappedWithoutPin > 0 || !!view.viewport);
  const [search, setSearch] = useState<SearchStep | null>(null);
  // A chosen pin's card: the list's top line steps out of sight behind it, and the map's zoom and credits step up above it.
  const cardShown = mapShown && (!!chosen || placeTasks.length > 1) && search === null;
  const [cardHeight, setCardHeight] = useState(0);
  const snapPoints = useMemo(() => {
    const low = cardShown ? HIDDEN : peek;
    if (!bodyHeight) return [low, '50%', '88%'];
    const full = Math.max(peek + 2, bodyHeight - toolsBottom - GAP);
    return [low, Math.min(full - 1, Math.max(peek + 1, Math.round(bodyHeight / 2))), full];
  }, [bodyHeight, toolsBottom, peek, cardShown]);
  const position = useSharedValue(0);
  const expanded = sheetIndex === SNAP.full;
  // The first fit of the pins keeps them above where the sheet starts: its top line, or half the map (review r3 item 3).
  const halfSheet = typeof snapPoints[1] === 'number' ? snapPoints[1] : Math.round(windowHeight / 2);
  const fitBottom = (discoveryStartSnap(mapped.length, mappedWithoutPin) === 'peek' ? peek : halfSheet) + GAP;

  // The search panel, opened at "Gde" from the pill and at "Kada" from "Uslovi pretrage". Its draft applies all at once;
  // a newly chosen place brings its pins into view (the camera's own move, never an area).
  const openSearch = (step: SearchStep) => { Keyboard.dismiss(); setSearch(step); };
  const [fit, setFit] = useState<{ key: number; bounds: PublicBounds; bottom: number } | null>(null);
  const fits = useRef(0);
  const apply = (draft: SearchDraft) => {
    const before = latestView.current.place;
    change({ ...draft, selectedId: null, selectedPlace: null });
    if (!draft.place || (before && placeKey(before) === placeKey(draft.place))) return;
    const bounds = publicInitialBounds(discoveryShown(items, latestView.current, relations?.owned, now).mapped);
    if (bounds) setFit({ key: ++fits.current, bounds, bottom: (sheetIndex === SNAP.peek ? peek : halfSheet) + GAP });
  };
  const reset = () => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport, sheet: view.sheet });

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

  // The list's scroll offset: remembered in the route's view a moment after the list stops, found again when the list
  // is read anew (a return after a while, or after the app was away), and back at the top when the search changes. At
  // the full height a scrolled list folds the quick chips away and takes their room.
  const listRef = useRef<BottomSheetFlatListMethods | null>(null);
  const offset = useRef(view.listOffset ?? 0), offsetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrolled, setScrolled] = useState(() => (view.listOffset ?? 0) > SCROLLED);
  const scrolledRef = useRef(scrolled);
  const onScroll = useCallback((event: { nativeEvent: NativeScrollEvent }) => {
    const y = Math.max(0, event?.nativeEvent?.contentOffset?.y ?? 0);
    offset.current = y;
    const past = y > SCROLLED;
    if (past !== scrolledRef.current) { scrolledRef.current = past; setScrolled(past); }
    if (offsetTimer.current) clearTimeout(offsetTimer.current);
    offsetTimer.current = setTimeout(() => {
      offsetTimer.current = null;
      const at = Math.round(offset.current);
      if (Math.abs((latestView.current.listOffset ?? 0) - at) > 1) change({ listOffset: at });
    }, OFFSET_SETTLE_MS);
  }, [change]);
  useEffect(() => () => { if (offsetTimer.current) clearTimeout(offsetTimer.current); }, []);
  // gorhom 5.2.14 takes `onScroll` and calls it on the JS thread with `{ nativeEvent }` (useScrollHandler, runOnJS), but its
  // list types leave the prop out; it is handed over as the library reads it.
  const scrollProps = { onScroll } as object;
  const restore = useRef<number | null>(null);
  const hasRows = listed.length > 0, hadRows = useRef(false);
  useEffect(() => {
    if (hasRows && !hadRows.current) {
      const at = latestView.current.listOffset ?? 0;
      if (at > 0) { restore.current = at; listRef.current?.scrollToOffset?.({ offset: at, animated: false }); }
    }
    hadRows.current = hasRows;
  }, [hasRows]);
  const onContentSizeChange = (_width: number, height: number) => {
    const at = restore.current;
    if (at !== null && height >= at) { restore.current = null; listRef.current?.scrollToOffset?.({ offset: at, animated: false }); }
  };
  const searchKey = JSON.stringify([query, price, area, when, where, freePlaces, chosenPlace, dates]);
  const lastSearch = useRef(searchKey);
  useEffect(() => {
    if (lastSearch.current === searchKey) return;
    lastSearch.current = searchKey;
    restore.current = null; offset.current = 0; scrolledRef.current = false; setScrolled(false);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    if ((latestView.current.listOffset ?? 0) !== 0) change({ listOffset: 0 });
  }, [searchKey, change]);
  const folded = expanded && scrolled;

  const appear = useAppear();
  appear.settle(listed.map(keyOf));
  const appearRef = useRef(appear); appearRef.current = appear;
  // Under a map area the tasks without a point follow the area's own, under their quiet heading.
  const section = withoutPoint.length ? { at: inArea.length, count: withoutPoint.length } : null;
  const sectionRef = useRef(section); sectionRef.current = section;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<MarketplaceItem>) =>
    <DiscoveryRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} applied={applied(item)} onOpen={openItem}
      section={sectionRef.current?.at === index ? sectionRef.current.count : undefined} />, [applied, openItem]);

  // The one state view: reading, not read, nothing in this view, nothing yet — the meanings the list had before.
  const empty = <View style={s.empty}>
    {loading ? <StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'task' }} />
      : error ? <StateView kind="error" art="tasks" title="Zadatke trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        // Only the map's area leaves nothing: the tasks are elsewhere on the map, one move or one tap away.
        : area && mapped.length ? <StateView art="map" title="Nema zadataka u ovoj oblasti" body="Pomeri mapu ili prikaži sve zadatke."
          primary={{ label: 'Prikaži sve zadatke', onPress: () => change({ area: null }) }} />
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
  // The count says what is listed, honestly: under a map area, the area's tasks and, apart, those with no point at all.
  // It waits until the list knows which tasks are mine (review r3 item 9).
  const counted = !loading && !error && !pending && (listed.length > 0 || !!area);
  const listedWithoutPin = area ? withoutPoint.length : mappedWithoutPin;
  const countWords = !counted ? '' : area ? inArea.length ? `${zadataka(inArea.length)} u oblasti` : 'Nema zadataka u oblasti' : zadataka(listed.length);
  const extraWords = !counted || !listedWithoutPin ? '' : area ? ` + ${listedWithoutPin} bez tačke` : ` · ${listedWithoutPin} bez tačke na mapi`;
  const count = <T variant="bodyStrong" numberOfLines={2} style={s.count}>
    {countWords}{extraWords ? <T variant="note" tone="muted">{extraWords}</T> : null}
  </T>;
  // The top line is the gesture-free way into the list: from the top line to half the map, from half to the whole list.
  const openList = () => { Keyboard.dismiss(); clearSelection(); setSheetIndex(sheetIndex === SNAP.peek ? SNAP.half : SNAP.full); };
  const header = <View style={s.header} accessibilityElementsHidden={cardShown} importantForAccessibility={cardShown ? 'no-hide-descendants' : 'auto'}
    onLayout={event => { const next = Math.ceil(event.nativeEvent.layout.height); if (next > 0) setPeek(current => current === next ? current : next); }}>
    <View style={s.grab} />
    {expanded ? <View style={s.countRow}>{count}</View>
      : <Press testID="list-count" accessibilityRole="button" accessibilityLabel={countWords ? `${countWords}${extraWords}` : 'Lista zadataka'}
        accessibilityHint={sheetIndex === SNAP.peek ? 'Otvara listu zadataka.' : 'Otvara celu listu.'} haptic="select" scaleTo={0.99}
        onPress={openList} style={s.countRow}>{count}</Press>}
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
        {mapShown ? <DiscoveryMap items={mapped} selectedId={chosen?.id ?? null} selectedPlace={placeTasks.length > 1 ? place!.key : null}
          viewport={view.viewport} scopeKey={props.scopeKey} onSelect={select} onSelectPlace={selectPlace} onClear={clearSelection}
          onViewport={viewport => change({ viewport })} onArea={followArea} fitTo={fit}
          onFitted={key => setFit(current => current?.key === key ? null : current)}
          onList={() => setSheetIndex(SNAP.full)} sheetTop={position} toolsBottom={toolsBottom} fitBottom={fitBottom}
          coverBottom={cardShown && cardHeight ? cardHeight + CARD_BOTTOM + GAP : 0}
          focusBottom={CARD_BOTTOM + GAP + Math.min(360, Math.round(windowHeight / 2))} />
          : <View style={s.ground} />}
      </View>
      <DiscoverySearchBar where={whereWords(view)} conditions={conditionsWords(view, now)} conditionCount={conditionCount}
        chips={chips} chipsShown={!folded} onSearch={() => openSearch('gde')} onConditions={() => openSearch('kada')}
        onNew={props.onNew ? () => { Keyboard.dismiss(); props.onNew?.(); } : undefined}
        onLayout={bottom => setToolsBottom(current => current === bottom ? current : bottom)} />
      <DiscoveryListSheet index={sheetIndex} snapPoints={snapPoints} position={position} reduced={reduced} onIndex={onIndex} header={header}>
        {/* Pull to refresh belongs to the list at its full height (review r3 item 10, checked in gorhom 5.2.14: its
            refresh control is enabled only while the list may scroll, which is at the top height). At the lower heights
            a pull down lowers the sheet, as in the map apps people know; the list is read again on every return to
            the screen, and the error and empty states carry their own "Pokušaj ponovo" / "Osveži zadatke". */}
        <BottomSheetFlatList<MarketplaceItem> ref={listRef} data={listed} keyExtractor={keyOf} renderItem={renderItem}
          extraData={section ? `${section.at}:${section.count}` : ''}
          refreshing={!!props.refreshing && !loading} onRefresh={props.onRefresh} {...scrollProps} onContentSizeChange={onContentSizeChange}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
          // Six cards are more than one phone screen of this card; the window stays modest so a fast
          // scroll fills in quickly without holding the whole list mounted.
          initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
          ItemSeparatorComponent={Separator} ListEmptyComponent={empty} ListFooterComponent={footer} />
      </DiscoveryListSheet>
      {/* At the full height the same map is one tap away: a floating dark-green "Mapa" that lowers the list to its top line.
          It fades in and out only when motion is allowed; under reduced motion it is simply there. */}
      {expanded && mapShown ? <Animated.View pointerEvents="box-none" style={s.mapPillRow}
        entering={reduced ? undefined : FadeIn.duration(sys.motion.enter)} exiting={reduced ? undefined : FadeOut.duration(sys.motion.exit)}>
        <Press accessibilityRole="button" accessibilityLabel="Mapa" accessibilityHint="Spušta listu i prikazuje mapu." haptic="select" scaleTo={0.97}
          onPress={() => setSheetIndex(SNAP.peek)} style={s.mapPill}>
          <MapTrifold size={20} weight="fill" color={sys.color.onGreen} />
          <T style={s.mapPillText}>Mapa</T>
        </Press>
      </Animated.View> : null}
      {cardShown ? <DiscoveryPeek key={chosen ? `task:${chosen.id}` : `place:${place!.key}`}
        item={chosen} place={placeTasks} applied={applied} active={focused} bottomInset={CARD_BOTTOM} reduced={reduced}
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
  // The honest count, centred on the sheet's top line: a button while the list is not yet up.
  countRow: { minHeight: 48, justifyContent: 'center', borderRadius: sys.radius.control },
  count: { color: sys.color.ink, textAlign: 'center' },
  applied: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: sys.space.sm, paddingBottom: sys.space.xs },
  appliedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, maxWidth: '100%', paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.greenSoft },
  appliedText: { ...sys.type.meta, fontWeight: '600', color: sys.color.green, flexShrink: 1 },
  list: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.xxl, flexGrow: 1 },
  empty: { flex: 1, paddingVertical: sys.space.sm },
  undated: { paddingTop: sys.space.base, textAlign: 'center' },
  // The quiet heading of the tasks without a point: the list's own words, never a card.
  section: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.sm, paddingTop: sys.space.xs, paddingBottom: sys.space.md },
  sectionTitle: { ...sys.type.meta, fontWeight: '600', color: sys.color.muted },
  sectionCount: { ...sys.type.meta, color: sys.color.muted, fontVariant: ['tabular-nums'] },
  // Bottom-centre, just above the tab bar (the screen ends where the bar begins).
  mapPillRow: { position: 'absolute', left: 0, right: 0, bottom: sys.space.base, alignItems: 'center' },
  mapPill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48, paddingHorizontal: sys.space.lg, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.green, ...floating },
  mapPillText: { ...sys.type.action, color: sys.color.onGreen },
});
