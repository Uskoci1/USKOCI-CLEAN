import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Keyboard, Platform, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo,
  type NativeScrollEvent, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import Animated, { FadeIn, FadeOut, useSharedValue } from 'react-native-reanimated';
import { BottomSheetFlatList, type BottomSheetFlatListMethods } from '@gorhom/bottom-sheet';
import { MapTrifold, X } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryConditions, discoveryFiltered, discoveryShown, discoveryStartSnap, initialMarketplaceView, openPlaces,
  pinPlaces, placeKey, pointKey, publicInitialBounds, publicPoint, sameBounds, saysWhen, saysWorkMode, undatedCount, type DiscoveryShown,
  type DiscoverySnap, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter } from '../../data/marketplaceView';
import { Press } from '../Press';
import { T } from '../Text';
import { Appear, useAppear } from '../system/Appear';
import { ActionSheet } from '../system/ActionSheet';
import { useReducedMotion } from '../system/motion';
import { zadataka } from '../system/plural';
import { StateView } from '../system/StateView';
import { floating, sys } from '../system/tokens';
import { DiscoveryMap } from './DiscoveryMap';
import { DiscoveryListSheet, SNAP } from './discovery/DiscoveryListSheet';
import { DiscoveryPeek } from './discovery/DiscoveryPeek';
import { DiscoverySearchBar, type QuickChip } from './discovery/DiscoverySearchBar';
import { useNearbyMap } from './discovery/useNearbyMap';
import { DiscoverySearchPanel, type SearchDraft, type SearchReadiness, type SearchStep } from './discovery/DiscoverySearchPanel';
import { CLEAR_ALL, PRICE, QUICK_WHEN, WHEN, WHERE, conditionsWords, countLineWords, datesWords, placesWords, quoted, removeWords, said,
  undatedWords, whereWords } from './discovery/discoveryWords';
import { TaskCard } from './TaskCard';
import type { TaskCardRelation } from './TaskFace';
import type { TaskRelationIndex } from '../../data/taskRelation';
import { TaskPublisherPortrait } from './TaskPublisherPortrait';

export type DiscoveryPresentationProps = { items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onProfile: () => void; onNew?: () => void; onNotifications?: () => void;
  /** Account-owned answers, only for the IDs the read covered. Missing coverage remains UNKNOWN. */
  relations?: TaskRelationIndex;
  /** These labels do not delay public rows, counts, map fit or the sheet's initial position. */
  relationsPending?: boolean; relationsError?: boolean };

const GAP = sys.space.md;
/** The tools' lower edge before it has been measured: the search pill's row and one row of chips under it. */
const TOOLS_ESTIMATE = sys.space.md + 56 + sys.space.sm + 48;
/** The room the row of quick chips takes before the bar has measured it: one row of chips and the gap above it. */
const CHIPS_ROOM_ESTIMATE = sys.space.sm + 48;
/** The sheet's top line before it has been measured: the grab bar and one line of count. */
const PEEK_ESTIMATE = 76;
/**
 * While a pin's card covers the bottom of the map, the list sheet sinks to this sliver behind it (Discovery V47): its top
 * line is not a second strip under the card. Closing the card brings the top line back.
 */
export const HIDDEN = 1;
/** The pin card's gap above the bottom of the screen, which ends where the tab bar begins: it sits just above the bar. */
const CARD_BOTTOM = sys.space.md;
/** The list scrolled at least this far is scrolled: at its full height the quick chips may then fold away. */
const SCROLLED = 8;
/**
 * The quick chips fold away only when the list stays longer than its window by at least this much more than their own
 * room: otherwise the list, taking their room, would fit, fall back to its top and bring them back, over and over.
 */
const FOLD_MARGIN = sys.space.sm;
/** How long after the list stops moving its offset is written into the route's view, to be found again on return. */
export const OFFSET_SETTLE_MS = 250;
/** How long the list's area stays still before iOS VoiceOver hears the new count (Android hears it by the live region). */
export const AREA_ANNOUNCE_MS = 1000;
const Separator = () => <View style={s.separator} />;
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
const INDEX = { peek: SNAP.peek, half: SNAP.half, full: SNAP.full } as const;
const SNAP_NAME: readonly DiscoverySnap[] = ['peek', 'half', 'full'];
/** Nothing to show yet (reading) or at all (a failed read). */
const NOTHING: DiscoveryShown = { mapped: [], inArea: [], withoutPoint: [], listed: [] };

const DiscoveryRow = memo(function DiscoveryRow({ item, index, animate, relation, onOpen, section, portraitVisible }: {
  item: MarketplaceItem; index: number; animate: boolean; relation?: TaskCardRelation; onOpen: (item: MarketplaceItem) => void;
  portraitVisible: boolean;
  /** The first task without a point under a map area: the quiet heading of those tasks, with how many there are. */
  section?: number;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <>
    {section !== undefined ? <View testID="section-without-point" accessible accessibilityRole="header"
      accessibilityLabel={`Bez tačke na mapi, ${zadataka(section)}`} style={s.section}>
      <T variant="meta" style={s.sectionTitle}>Bez tačke na mapi</T><T variant="meta" style={s.sectionCount}>{section}</T>
    </View> : null}
    <Appear index={index} animate={animate}><TaskCard item={item} bare onOpen={open} relation={relation}
      portrait={portraitVisible ? <TaskPublisherPortrait item={item} size={40} /> : undefined} /></Appear>
  </>;
});

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; critique A5–A7, B8–B12; Discovery V47, Airbnb's interaction in
 * USKOČI's look). Search is the screen's header. Over the map floats one white pill that says
 * the search in two lines and opens the search panel, "Uslovi pretrage", a menu of secondary destinations, and quick chips that
 * toggle real filters at once (they fold away while the whole list is up and scrolled well past them).
 *
 * The list is a sheet over the map with three heights, and it follows the map: after the person's own move settles, the
 * list holds what the map shows, then, under a quiet "Bez tačke na mapi", every task that has no point at all, which an
 * area can never leave out. The camera's own moves never change what is listed. A place's "Prikaži sve u listi" narrows
 * the list to exactly that point instead. The search pill says either narrowing and carries its "×" back to every task.
 * The sheet's top line says honestly how many tasks there are (never blank: while the list is read it says so) and is
 * itself the button that opens the list; at the full height a floating "Mapa" brings the same map back, as does Android
 * Back. It starts half open when the map cannot show most of the tasks or there are few, and at its top line otherwise;
 * where it rests, how far the list is scrolled and where the camera stands are kept in the route's view. Choosing a pin
 * opens one floating card for it, over the sheet's top line, which steps out of sight (and out of a screen reader's
 * reach) behind it. An empty list under the map rests at half the screen at most, so its own green action and the green
 * "Mapa" are never on screen together.
 *
 * Own tasks remain visible with "Tvoj zadatak"; applied and unknown relationships are labeled distinctly.
 * Presentation only: every callback is the route's own guarded command.
 */
export function DiscoveryPresentation(props: DiscoveryPresentationProps) {
  const { items, loading, error, view } = props, reduced = useReducedMotion(), focused = useIsFocused();
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [props.scopeKey]);
  useEffect(() => { if (!focused) setMore(false); }, [focused]);
  const nearby = useNearbyMap(props.scopeKey, focused);
  const { height: windowHeight } = useWindowDimensions();
  const relations = props.relations;
  const pending = !!props.relationsPending;
  // Every change goes through the route's latest guarded `onView`, and two changes in one turn (a chip that also closes a
  // pin's card) build on each other, not on the same render's view.
  const latestView = useRef(view); latestView.current = view;
  const onViewRef = useRef(props.onView); onViewRef.current = props.onView;
  const change = useCallback((patch: Partial<MarketplaceView>) => {
    const next = { ...latestView.current, ...patch };
    latestView.current = next;
    onViewRef.current(next);
  }, []);
  // The list's scroll offset, written into the route's view a moment after the list stops (see the list below).
  const offset = useRef(view.listOffset ?? 0), offsetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeOffset = useCallback(() => {
    offsetTimer.current = null;
    const at = Math.round(offset.current);
    if (Math.abs((latestView.current.listOffset ?? 0) - at) > 1) change({ listOffset: at });
  }, [change]);
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest read); rows get one
  // stable function that calls whatever is current at press time. A scroll that is not written yet is written first:
  // once the task is open, this screen is not in front and the route takes no more changes of its view.
  const openRef = useRef(props.onOpen); openRef.current = props.onOpen;
  const openItem = useCallback((item: MarketplaceItem) => {
    if (offsetTimer.current) { clearTimeout(offsetTimer.current); writeOffset(); }
    openRef.current(item);
  }, [writeOffset]);

  // The search panel, opened at "Gde" from the pill and at "Kada" from "Uslovi pretrage".
  const [search, setSearch] = useState<SearchStep | null>(null);
  // The list is read from what filters it and nothing else: moving the map or choosing a pin changes the view, and must
  // not hand the map a new list (the native source would be set again on every pan). The map's own set leaves the area
  // out, so a move of the map never takes a pin away; only the list follows the area. "Now" is read again with every new
  // read, every time choice and every opening of the panel, so "Danas" and the past days of its grid are today's.
  const { query, price, area, when, where, places: freePlaces, place: chosenPlace, dates, pinPlace } = view;
  const now = useMemo(() => new Date(), [items, when, dates, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const filters = useMemo(() => ({ ...initialMarketplaceView(), query, price, area, when, where, places: freePlaces, place: chosenPlace, dates,
    pinPlace: pinPlace ?? null }), [query, price, area, when, where, freePlaces, chosenPlace, dates, pinPlace]);
  const { mapped, inArea, withoutPoint, listed } = useMemo((): DiscoveryShown => loading || error ? NOTHING : discoveryShown(items, filters, undefined, now),
    [loading, error, items, filters, now]);
  const mappedWithoutPin = useMemo(() => mapped.filter(item => !publicPoint(item)).length, [mapped]);
  const groups = useMemo(() => pinPlaces(mapped), [mapped]);
  const byId = useMemo(() => new Map(mapped.map(item => [item.id, item] as const)), [mapped]);
  const relation = useCallback((item: MarketplaceItem): TaskCardRelation | undefined => {
    const answer = relations?.relation(item.id);
    return answer?.kind === 'OWNER' ? 'OWNED' : answer?.kind === 'APPLIED' ? 'APPLIED'
      : answer?.kind === 'NONE' ? undefined : pending ? 'PENDING' : 'UNKNOWN';
  }, [relations, pending]);
  const undated = useMemo(() => loading || error ? 0 : undatedCount(items, filters, undefined, now), [loading, error, items, filters, now]);
  const conditionCount = discoveryConditions(view);
  const hasFilter = !!view.query.trim() || discoveryFiltered(view) || !!view.area || !!view.place || !!view.pinPlace;
  // Ownership only labels rows: counts describe the same public subset before and after the overlay arrives.
  const readiness: SearchReadiness = loading ? 'loading' : error ? 'error' : 'ready';

  // Where the sheet rests is remembered in the route's view; a view that has one is where the sheet starts again.
  const [sheetIndex, setSheetIndex] = useState<number>(() => view.sheet ? INDEX[view.sheet] : SNAP.half);
  const started = useRef(!!view.sheet);
  useEffect(() => {
    if (!started.current) return;
    const name = SNAP_NAME[sheetIndex];
    if (name && latestView.current.sheet !== name) change({ sheet: name });
  }, [sheetIndex, change]);
  // Where the sheet starts is decided once from public pin coverage; labels cannot move it afterward.
  useEffect(() => {
    if (started.current || loading || error) return;
    started.current = true;
    const start = discoveryStartSnap(mapped.length, mappedWithoutPin);
    setSheetIndex(INDEX[start]);
    // Remembered at once: a start equal to the height the sheet already had changes no state to remember it by later.
    if (latestView.current.sheet !== start) change({ sheet: start });
  }, [loading, error, mapped.length, mappedWithoutPin, change]);
  // What is found must be seen. A sheet resting at its top line rises to show why nothing is found; and when nothing found
  // has a point on the map (a filter left only "Na daljinu"), it takes the screen, over a map with nothing on it. The map's
  // area is not a reason: moving the map never moves the sheet the person is looking past.
  useEffect(() => {
    if (!started.current || loading || sheetIndex !== SNAP.peek) return;
    if (!mapped.length) setSheetIndex(SNAP.half);
    else if (mappedWithoutPin === mapped.length) setSheetIndex(SNAP.full);
  }, [loading, mapped.length, mappedWithoutPin]); // eslint-disable-line react-hooks/exhaustive-deps

  // The map is shown once the read has landed and it has something to show (or a place the person already looked at).
  // Relations never remove a public pin, so the first map fit does not wait for the account overlay.
  const mapShown = !loading && !error && (mapped.length - mappedWithoutPin > 0 || !!view.viewport || nearby.mapRequested);
  // One filled action at a time: an empty list's own green action (its state view) and the floating green "Mapa" of the
  // full height would stand on one screen, so an empty list over the map rests at half at most (review of V47).
  const emptyOverMap = !loading && !error && !listed.length && mapShown;

  // A chosen pin: one task, or a place several tasks share, of what the map shows. The list's area never takes it away;
  // a new read that no longer has it does.
  useEffect(() => {
    if (loading || error) return;
    const { selectedId, selectedPlace } = latestView.current;
    const lostTask = !!selectedId && !byId.has(selectedId), lostPlace = !!selectedPlace && !groups.has(selectedPlace);
    if (lostTask || lostPlace) change({ ...(lostTask ? { selectedId: null } : {}), ...(lostPlace ? { selectedPlace: null } : {}) });
  }, [loading, error, byId, groups, change]);
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
  // "Prikaži sve u listi": the list narrows to exactly that one public point — not an area, so no task without a point
  // joins it and the map's area is left as it was — and the search pill says so and takes it away.
  const showPlace = () => {
    if (!place) return;
    change({ pinPlace: place.key, selectedId: null, selectedPlace: null });
    setSheetIndex(SNAP.full);
  };
  // Every task again: the map's area and the one point are gone (the pill's "×", or an empty list's way back).
  const showAll = () => change({ area: null, pinPlace: null });
  const onIndex = (index: number) => {
    setSheetIndex(index);
    // Pulling the list up is looking at the list: a pin's card does not stay over it.
    if (index > SNAP.peek) clearSelection();
  };
  // The list follows the map: a settled move of the person's own hands up the bounds it shows, and it is a new "where",
  // so the one point a place's list was narrowed to is let go.
  const followArea = (bounds: PublicBounds) => {
    const current = latestView.current;
    if (!sameBounds(bounds, current.area) || current.pinPlace) change({ area: bounds, pinPlace: null });
  };

  // Layout: the body under the chrome, the tools' lower edge, the sheet's measured top line.
  const [bodyHeight, setBodyHeight] = useState(0), [toolsBottom, setToolsBottom] = useState(TOOLS_ESTIMATE), [peek, setPeek] = useState(PEEK_ESTIMATE);
  const [toolsMeasured, setToolsMeasured] = useState(false);
  const [creditsHeight, setCreditsHeight] = useState(Platform.OS === 'web' ? 0 : 48);
  const creditsRoom = mapShown && creditsHeight ? creditsHeight + GAP : 0;
  const [headerLeadHeight, setHeaderLeadHeight] = useState(PEEK_ESTIMATE);
  // The measured fixed header may be taller than the available map at large text. In that case its whole content
  // joins the registered list scroll; a minimum based on that header must never override the attribution reserve.
  const availableSheet = bodyHeight ? Math.max(3, bodyHeight - toolsBottom - creditsRoom - GAP) : 0;
  const scrollHeader = !!availableSheet && peek + 2 > availableSheet;
  // A chosen pin's card: the list's top line steps out of sight behind it, and the map's zoom and credits step up above it.
  const cardShown = mapShown && (!!chosen || placeTasks.length > 1) && search === null;
  const [cardHeight, setCardHeight] = useState(0);
  const snapPoints = useMemo(() => {
    const collapsed = scrollHeader ? Math.min(headerLeadHeight, availableSheet - 2) : peek;
    const low = cardShown ? HIDDEN : collapsed;
    if (!bodyHeight) return [low, '50%', '88%'];
    const full = availableSheet;
    return [low, Math.min(full - 1, Math.max(collapsed + 1, Math.round(bodyHeight / 2))), full];
  }, [bodyHeight, availableSheet, scrollHeader, headerLeadHeight, peek, cardShown]);
  // An oversized empty-state header still needs the registered scroll's full stop. It does not acquire a second
  // brand action: the map shortcut remains absent for an empty list, as before.
  const highest = emptyOverMap && !scrollHeader ? SNAP.half : SNAP.full;
  useEffect(() => { if (sheetIndex > highest) setSheetIndex(highest); }, [sheetIndex, highest]);
  const position = useSharedValue(0);
  const expanded = sheetIndex === SNAP.full;
  // The floating "Mapa" stands over the end of the list at the full height.
  const pillShown = expanded && mapShown && !emptyOverMap;
  // The first fit of the pins keeps them above where the sheet starts: its top line, or half the map (review r3 item 3).
  const halfSheet = typeof snapPoints[1] === 'number' ? snapPoints[1] : Math.round(windowHeight / 2);
  const fitBottom = (discoveryStartSnap(mapped.length, mappedWithoutPin) === 'peek' ? snapPoints[0] as number : halfSheet) + GAP + creditsRoom;
  const previewMaxHeight = bodyHeight ? Math.max(48, bodyHeight - toolsBottom - creditsRoom - CARD_BOTTOM - 2 * GAP - HIDDEN) : undefined;
  // Android Back with the whole list up over the map lowers it to its top line, as the card and the panel close on Back.
  useEffect(() => {
    if (!focused || !expanded || !mapShown || cardShown || search !== null) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setSheetIndex(SNAP.peek); return true; });
    return () => back.remove();
  }, [focused, expanded, mapShown, cardShown, search]);

  // The search panel's draft applies all at once; a newly chosen place brings its pins into view (the camera's own
  // move, never an area).
  const openSearch = (step: SearchStep) => { Keyboard.dismiss(); setSearch(step); };
  const [fit, setFit] = useState<{ key: number; bounds: PublicBounds; bottom: number } | null>(null);
  const findNearby = () => {
    if (!nearby.start()) return;
    Keyboard.dismiss(); clearSelection(); setFit(null); setSheetIndex(SNAP.peek);
  };
  const fits = useRef(0);
  const apply = (draft: SearchDraft) => {
    const before = latestView.current.place;
    change({ ...draft, selectedId: null, selectedPlace: null });
    if (!draft.place || (before && placeKey(before) === placeKey(draft.place))) return;
    const bounds = publicInitialBounds(discoveryShown(items, latestView.current, undefined, now).mapped);
    if (bounds) setFit({ key: ++fits.current, bounds, bottom: (sheetIndex === SNAP.peek ? peek : halfSheet) + GAP });
  };
  const reset = () => props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport, sheet: view.sheet });

  // Quick chips: each toggles one existing filter at once, and is offered only when the loaded tasks carry the fact it
  // reads (or it is already on and must be removable). "N+ mesta" is offered only on a count of open places the read gave.
  const timed = useMemo(() => saysWhen(items, now), [items, now]);
  const workModes = useMemo(() => saysWorkMode(items), [items]);
  const toggle = (patch: Partial<MarketplaceView>) => change({ ...patch, selectedId: null, selectedPlace: null });
  const currentWhen = dateRange(view.dates) ? 'any' : view.when ?? 'any';
  const chips: QuickChip[] = [
    ...QUICK_WHEN.filter(key => timed || currentWhen === key).map(key => ({ key: `when:${key}`, label: said(WHEN, key), selected: currentWhen === key,
      onPress: () => toggle({ when: currentWhen === key ? 'any' : key as WhenFilter, dates: null }) })),
    ...(['onsite', 'remote'] as const).filter(key => workModes || view.where === key).map(key => ({ key: `where:${key}`, label: said(WHERE, key),
      selected: view.where === key, onPress: () => toggle({ where: view.where === key ? 'any' : key }) })),
    ...(['MY_PRICE', 'OFFERS'] as const).filter(key => view.price === key || items.some(item => item.rezimCene === key)).map(key => ({
      key: `price:${key}`, label: said(PRICE, key), selected: view.price === key, onPress: () => toggle({ price: view.price === key ? 'all' : key }) })),
    ...(atLeast(freePlaces) > 1 || items.some(item => (openPlaces(item) ?? 0) >= 2) ? [{ key: 'places',
      label: atLeast(freePlaces) > 1 ? placesWords(freePlaces) : placesWords(2), selected: atLeast(freePlaces) > 1,
      onPress: () => toggle({ places: atLeast(freePlaces) > 1 ? 1 : 2 }) }] : []),
  ];

  // The list's scroll offset: remembered in the route's view a moment after the list stops, found again when the list
  // is read anew (a return after a while, or after the app was away), and back at the top when the search changes. A
  // restore still waiting for the rows is dropped the moment the person takes hold of the list or refreshes it. At the
  // full height a list scrolled well past the chips folds them away and takes their room; they come back at its top.
  const listRef = useRef<BottomSheetFlatListMethods | null>(null);
  const [scrolled, setScrolled] = useState(() => (view.listOffset ?? 0) > SCROLLED);
  const scrolledRef = useRef(scrolled);
  const contentHeight = useRef(0);
  const [chipsRoom, setChipsRoom] = useState(CHIPS_ROOM_ESTIMATE);
  // The list's own window at the full height: the sheet there, less its top line.
  const listWindow = typeof snapPoints[2] === 'number' ? snapPoints[2] - (scrollHeader ? 0 : peek) : 0;
  const fold = useRef({ listWindow, chipsRoom }); fold.current = { listWindow, chipsRoom };
  const onScroll = useCallback((event: { nativeEvent: NativeScrollEvent }) => {
    const y = Math.max(0, event?.nativeEvent?.contentOffset?.y ?? 0);
    offset.current = y;
    if (!scrolledRef.current) {
      const { listWindow: frame, chipsRoom: room } = fold.current;
      if (y > SCROLLED && frame > 0 && contentHeight.current - frame >= room + FOLD_MARGIN) { scrolledRef.current = true; setScrolled(true); }
    } else if (y <= 0) { scrolledRef.current = false; setScrolled(false); }
    if (offsetTimer.current) clearTimeout(offsetTimer.current);
    offsetTimer.current = setTimeout(writeOffset, OFFSET_SETTLE_MS);
  }, [writeOffset]);
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
    contentHeight.current = height;
    const at = restore.current;
    if (at !== null && height >= at) { restore.current = null; listRef.current?.scrollToOffset?.({ offset: at, animated: false }); }
  };
  const refreshList = () => { restore.current = null; props.onRefresh(); };
  const searchKey = JSON.stringify([query, price, area, when, where, freePlaces, chosenPlace, dates, pinPlace ?? null]);
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
  appear.settle(listed.map(keyOf), searchKey);
  const appearRef = useRef(appear); appearRef.current = appear;
  // Under a map area the tasks without a point follow the area's own, under their quiet heading.
  const section = withoutPoint.length ? { at: inArea.length, count: withoutPoint.length } : null;
  const sectionRef = useRef(section); sectionRef.current = section;
  // The render window is wider than the visible list. Start authorized photo reads only for settled visible rows,
  // and unmount them when the sheet is hidden or this route loses focus; AuthorizedPhoto aborts on unmount.
  // Gorhom sizes its content to the highest detent even at half height, so native viewability is trusted only at full.
  const [portraitIds, setPortraitIds] = useState<ReadonlySet<string>>(() => new Set());
  const portraitViewability = useRef({ itemVisiblePercentThreshold: 30, minimumViewTime: 180 }).current;
  const onVisibleRows = useCallback(({ viewableItems }: { viewableItems: ViewToken<MarketplaceItem>[] }) => {
    const next = new Set(viewableItems.filter(token => token.isViewable).slice(0, 6).map(token => token.item.id));
    setPortraitIds(current => current.size === next.size && [...next].every(id => current.has(id)) ? current : next);
  }, []);
  useEffect(() => { setPortraitIds(new Set()); }, [props.scopeKey]);
  const showPortraits = focused && !cardShown && sheetIndex === SNAP.full;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<MarketplaceItem>) =>
    <DiscoveryRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} relation={relation(item)} onOpen={openItem}
      portraitVisible={showPortraits && portraitIds.has(item.id)}
      section={sectionRef.current?.at === index ? sectionRef.current.count : undefined} />, [relation, openItem, showPortraits, portraitIds]);

  // The one state view: reading, not read, nothing in this view, nothing yet — the meanings the list had before.
  const empty = <View style={s.empty}>
    {loading ? <StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'task' }} />
      : error ? <StateView kind="error" art="tasks" title="Zadatke trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: refreshList }} />
        // Only the map's area or its one point leaves nothing: the tasks are elsewhere on the map, one move or one tap away.
        : (pinPlace || area) && mapped.length ? <StateView art="map" title={pinPlace ? 'Nema zadataka na ovom mestu' : 'Nema zadataka u ovoj oblasti'}
          body="Pomeri mapu ili prikaži sve zadatke." primary={{ label: 'Prikaži sve zadatke', onPress: showAll }} />
          : hasFilter ? <StateView art="map" title="Nema zadataka u ovom prikazu" body="Promeni pretragu ili obriši sve uslove."
            primary={{ label: CLEAR_ALL, onPress: reset }} />
            // The brand action is what the screen wants you to do. On the screen a worker meets before anything exists,
            // that is not "refresh" — it is the profile that decides whether a task can ever be offered to them.
            : <StateView art="tasks" title="Trenutno nema otvorenih zadataka"
              body="Zadaci se nude prema tvom radnom profilu — veštinama, području i dostupnosti."
              primary={{ label: 'Dopuni radni profil', onPress: props.onProfile }} quiet={{ label: 'Osveži zadatke', onPress: refreshList }} />}
  </View>;
  // A time choice leaves out the tasks whose schedule names no day; the list says how many instead of hiding them silently.
  const footer = undated ? <T variant="note" tone="muted" style={s.undated}>{undatedWords(undated)}</T> : null;

  // What is on and has no quick chip of its own says itself once, under the count, and removes itself: the place, the
  // searched words and the time choices the chips do not carry. A quick chip removes its own filter. The map's area and
  // the one point are said by the search pill and taken away by its "×": a chip here that came and went with every move
  // of the map changed the height of the sheet's top line, and the sheet jumped with it.
  const range = dateRange(view.dates);
  const appliedChips: { key: string; label: string; clear: Partial<MarketplaceView> }[] = [
    ...(view.place ? [{ key: 'place', label: view.place, clear: { place: null } }] : []),
    ...(view.query.trim() ? [{ key: 'query', label: quoted(view.query), clear: { query: '' } }] : []),
    ...(range ? [{ key: 'dates', label: datesWords(range, now), clear: { dates: null } }]
      : currentWhen !== 'any' && !QUICK_WHEN.includes(currentWhen) ? [{ key: 'when', label: said(WHEN, currentWhen), clear: { when: 'any' as const } }] : []),
  ];
  // The count says what is listed, honestly: under a map area, the area's tasks and, apart, those with no point at all;
  // on one point, that point's tasks. It is independent of the account overlay.
  const line = countLineWords({ status: loading ? 'loading' : error ? 'error' : 'ready', listed: listed.length, inArea: inArea.length,
    withoutPoint: withoutPoint.length, pinless: mappedWithoutPin, area: !!area, pinPlace: !!pinPlace });
  const spoken = `${line.words}${line.extra}`;
  const count = <T variant="bodyStrong" numberOfLines={2} style={s.count}>
    {line.words}{line.extra ? <T variant="note" tone="muted">{line.extra}</T> : null}
  </T>;
  // iOS has no live region: a screen reader hears the new count once the list's area has stayed still for a second.
  const spokenRef = useRef(spoken); spokenRef.current = spoken;
  const whereKey = JSON.stringify([area ?? null, pinPlace ?? null]), lastWhere = useRef(whereKey);
  useEffect(() => {
    if (lastWhere.current === whereKey) return;
    lastWhere.current = whereKey;
    if (Platform.OS !== 'ios' || !focused) return;
    const timer = setTimeout(() => { AccessibilityInfo.announceForAccessibility?.(spokenRef.current); }, AREA_ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [whereKey, focused]);
  // The top line is the gesture-free way into the list: from the top line to half the map, from half to the whole list
  // (while there is a higher height to go to; an empty list over the map stops at half).
  const canRise = sheetIndex < highest;
  const openList = () => { Keyboard.dismiss(); clearSelection(); setSheetIndex(sheetIndex === SNAP.peek ? SNAP.half : SNAP.full); };
  const header = <View testID="discovery-list-header" style={s.header}
    onLayout={event => { const next = Math.ceil(event.nativeEvent.layout.height); if (next > 0) setPeek(current => current === next ? current : next); }}>
    <View testID="discovery-list-header-lead" onLayout={event => {
      const next = Math.ceil(event.nativeEvent.layout.height) + sys.space.sm;
      if (next > sys.space.sm) setHeaderLeadHeight(current => current === next ? current : next);
    }}>
    <View style={s.grab} />
    {/* A polite live region: TalkBack hears the count when it changes (a new area, a new read), without moving its focus. */}
    {canRise ? <Press testID="list-count" accessibilityRole="button" accessibilityLabel={spoken} accessibilityState={{ expanded: sheetIndex > SNAP.peek }}
      accessibilityHint={sheetIndex === SNAP.peek ? 'Otvara listu zadataka.' : 'Otvara celu listu.'} accessibilityLiveRegion="polite"
      haptic="select" scaleTo={0.99} onPress={openList} style={s.countRow}>{count}</Press>
      : <View testID="list-count-words" accessibilityLiveRegion="polite" style={s.countRow}>{count}</View>}
    </View>
    {!loading && !error && items.length > 0 && props.relationsError ? <View style={s.relationsRecovery}>
      <T variant="note" tone="muted" style={s.relationsMessage}>Tvoj status uz zadatke nije učitan.</T>
      <Press accessibilityRole="button" accessibilityLabel="Proveri status zadataka" onPress={refreshList}
        style={s.relationsRetry}><T variant="action" style={s.relationsRetryText}>Proveri</T></Press>
    </View> : null}
    {appliedChips.length ? <View style={s.applied}>{appliedChips.map(chip => <Press key={chip.key} accessibilityRole="button"
      accessibilityLabel={removeWords(chip.label)} haptic="select" hitSlop={{ top: sys.space.xs, bottom: sys.space.xs }}
      onPress={() => change({ ...chip.clear, selectedId: null, selectedPlace: null })} style={s.appliedChip}>
      <T variant="meta" style={s.appliedText} numberOfLines={1}>{chip.label}</T><X size={14} weight="bold" color={sys.color.green} />
    </Press>)}</View> : null}
  </View>;

  return <SafeAreaView edges={['top']} style={s.screen}>
    {/* Search is this screen's header. Identity belongs to Home; the existing account/publication entries stay in Još. */}
    <View style={s.body} onLayout={event => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0) setBodyHeight(next); }}>
      <View style={StyleSheet.absoluteFill}>
        {mapShown ? <DiscoveryMap items={mapped} selectedId={chosen?.id ?? null} selectedPlace={placeTasks.length > 1 ? place!.key : null}
          viewport={view.viewport} scopeKey={props.scopeKey} onSelect={select} onSelectPlace={selectPlace} onClear={clearSelection}
          onViewport={viewport => change({ viewport })} onArea={followArea} fitTo={fit} centerNearby={nearby.target} onNearbyConsumed={nearby.consume}
          onFitted={key => setFit(current => current?.key === key ? null : current)}
          onList={() => setSheetIndex(SNAP.full)} sheetTop={position} toolsBottom={toolsBottom} fitBottom={fitBottom}
          cameraLayoutReady={bodyHeight > 0 && toolsMeasured}
          onCreditsHeight={next => setCreditsHeight(current => current === next ? current : next)}
          coverBottom={cardShown && cardHeight ? cardHeight + CARD_BOTTOM + GAP : 0}
          focusBottom={CARD_BOTTOM + GAP + creditsRoom + Math.min(360, Math.round(windowHeight / 2))} />
          : <View style={s.ground} />}
      </View>
      <DiscoverySearchBar where={whereWords(view)} conditions={conditionsWords(view, now)} conditionCount={conditionCount}
        nearby={{ onPress: findNearby, busy: nearby.busy, message: nearby.message, onSettings: nearby.settings }}
        chips={chips} chipsShown={!folded} onSearch={() => openSearch('gde')} onConditions={() => openSearch('kada')}
        onMore={() => { Keyboard.dismiss(); setMore(true); }}
        onClearWhere={area || pinPlace ? showAll : undefined}
        onLayout={bottom => { setToolsBottom(current => current === bottom ? current : bottom); setToolsMeasured(true); }}
        onChipsHeight={room => setChipsRoom(current => current === room ? current : room)} />
      <DiscoveryListSheet index={sheetIndex} snapPoints={snapPoints} position={position} reduced={reduced} onIndex={onIndex} header={scrollHeader ? null : header}
        sunk={cardShown}>
        {/* Pull to refresh belongs to the list at its full height (review r3 item 10, checked in gorhom 5.2.14: its
            refresh control is enabled only while the list may scroll, which is at the top height). At the lower heights
            a pull down lowers the sheet, as in the map apps people know; the list is read again on every return to
            the screen, and the error and empty states carry their own "Pokušaj ponovo" / "Osveži zadatke". */}
        <BottomSheetFlatList<MarketplaceItem> ref={listRef} data={listed} keyExtractor={keyOf} renderItem={renderItem}
          viewabilityConfig={portraitViewability} onViewableItemsChanged={onVisibleRows}
          ListHeaderComponent={scrollHeader ? <View testID="discovery-scrolling-header" style={s.scrollingHeader}>{header}</View> : null}
          extraData={section ? `${section.at}:${section.count}` : ''}
          refreshing={!!props.refreshing && !loading} onRefresh={refreshList} {...scrollProps} onContentSizeChange={onContentSizeChange}
          onScrollBeginDrag={() => { restore.current = null; }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          // The floating "Mapa" stands over the list's end at the full height; the end scrolls clear of it.
          contentContainerStyle={pillShown ? s.listUnderPill : s.list}
          // Six cards are more than one phone screen of this card; the window stays modest so a fast
          // scroll fills in quickly without holding the whole list mounted.
          initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
          ItemSeparatorComponent={Separator} ListEmptyComponent={empty} ListFooterComponent={footer} />
      </DiscoveryListSheet>
      {/* At the full height the same map is one tap away: a floating dark-green "Mapa" that lowers the list to its top line.
          It fades in and out only when motion is allowed; under reduced motion it is simply there. */}
      {pillShown ? <Animated.View pointerEvents="box-none" style={s.mapPillRow}
        entering={reduced ? undefined : FadeIn.duration(sys.motion.enter)} exiting={reduced ? undefined : FadeOut.duration(sys.motion.exit)}>
        <Press accessibilityRole="button" accessibilityLabel="Mapa" accessibilityHint="Spušta listu i prikazuje mapu." haptic="select" scaleTo={0.97}
          onPress={() => setSheetIndex(SNAP.peek)} style={s.mapPill}>
          <MapTrifold size={20} weight="fill" color={sys.color.onGreen} />
          <T variant="action" style={s.mapPillText}>Mapa</T>
        </Press>
      </Animated.View> : null}
      {cardShown ? <DiscoveryPeek key={chosen ? `task:${chosen.id}` : `place:${place!.key}`}
        item={chosen} place={placeTasks} relation={relation} active={focused} bottomInset={CARD_BOTTOM} reduced={reduced}
        maxHeight={previewMaxHeight}
        onOpen={openItem} onShowPlace={showPlace} onClose={clearSelection}
        onHeight={next => setCardHeight(current => current === next ? current : next)} /> : null}
    </View>
    {search ? <DiscoverySearchPanel items={items} view={view} mine={relations?.owned} now={now} mapArea={view.viewport?.bounds ?? null}
      start={search} reduced={reduced} readiness={readiness} onApply={apply} onClose={() => setSearch(null)} /> : null}
    {more && focused ? <ActionSheet title="Još mogućnosti" reduced={reduced} onClose={() => setMore(false)} actions={[
      ...(props.onNew ? [{ key: 'new', label: 'Objavi zadatak', icon: 'tasks' as const, onPress: props.onNew }] : []),
      { key: 'profile', label: 'Moj profil', icon: 'person', onPress: props.onProfile },
      ...(props.onNotifications ? [{ key: 'notifications', label: 'Obaveštenja', icon: 'bell' as const, onPress: props.onNotifications }] : []),
    ]} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  relationsRecovery: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.md },
  relationsMessage: { flex: 1 },
  relationsRetry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  relationsRetryText: { color: sys.color.green },
  screen: { flex: 1, backgroundColor: sys.color.ground },
  body: { flex: 1 },
  separator: { height: 1, backgroundColor: sys.color.line, marginVertical: 18 },
  ground: { flex: 1, backgroundColor: sys.color.ground },
  header: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.sm },
  // Cancel the list's side inset so the moved header keeps the same measured width and cannot oscillate between modes.
  scrollingHeader: { marginHorizontal: -sys.space.lg },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: sys.space.sm, marginBottom: sys.space.xs, backgroundColor: sys.color.lineStrong },
  // The honest count, centred on the sheet's top line: a button while the list can still go higher.
  countRow: { minHeight: 48, justifyContent: 'center', borderRadius: sys.radius.control },
  count: { color: sys.color.ink, textAlign: 'center' },
  applied: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: sys.space.sm, paddingBottom: sys.space.xs },
  // 40 high and 4 more above and under it: 48 to a finger, and two rows of chips 8 apart never share a touch.
  appliedChip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 40, maxWidth: '100%', paddingHorizontal: sys.space.md,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft },
  appliedText: { fontWeight: '600', color: sys.color.green, flexShrink: 1 },
  list: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.base, paddingBottom: sys.space.xxl, flexGrow: 1 },
  // The pill is 48 high and 16 above the bottom: the list's end keeps 80 clear under it.
  listUnderPill: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.base, paddingBottom: sys.space.huge + sys.space.xxl, flexGrow: 1 },
  empty: { flex: 1, paddingVertical: sys.space.sm },
  undated: { paddingTop: sys.space.base, textAlign: 'center' },
  // The quiet heading of the tasks without a point: the list's own words, never a card.
  section: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.sm, paddingTop: sys.space.xs, paddingBottom: sys.space.md },
  sectionTitle: { fontWeight: '600', color: sys.color.muted },
  sectionCount: { color: sys.color.muted, fontVariant: ['tabular-nums'] },
  // Bottom-centre, just above the tab bar (the screen ends where the bar begins).
  mapPillRow: { position: 'absolute', left: 0, right: 0, bottom: sys.space.base, alignItems: 'center' },
  mapPill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48, paddingHorizontal: sys.space.lg, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.green, ...floating },
  mapPillText: { color: sys.color.onGreen },
});
