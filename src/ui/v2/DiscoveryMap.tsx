import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Camera, GeoJSONSource, Images, Layer, Map, ViewAnnotation, type CameraOptions, type CameraRef, type GeoJSONSourceRef, type MapRef } from '@maplibre/maplibre-react-native';
import { Minus, Plus } from 'phosphor-react-native';
import { pinLabel, pinPlaces, pointKey, publicFeatures, publicInitialBounds, publicPoint, publicViewport, type MarketplaceItem, type PinPlace }
  from '../../data/marketplaceView';
import { readableTitle } from '../../data/needDetailPresentation';
import { useMapStyle, type MapStyle } from '../location/mapStyle';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from './V2Action';
import { sys } from '../system/tokens';
import { zadataka } from '../system/plural';
import { useReducedMotion } from '../system/motion';
import { displaysUrgent } from '../../lib/needUrgency';
import { useUrgencyClock } from './NeedUrgencyBadge';
import { PricePill, type PillContent } from './discovery/PricePill';
import type { DiscoveryMapProps } from './DiscoveryMap.types';

type Owner = { key: string; active: boolean; epoch: number };
/** Rich labels are bounded; every other unclustered public point still has a native USKOČI logo marker. */
export const PILL_LIMIT = 40;
const PIN_IMAGES = { 'uskoci-task': require('../../../assets/entry-splash-mark.png') };
/** A changed list reaches the native source a moment later; the visible pins are read after it. */
const PILL_SETTLE_MS = 300;
/**
 * The list follows the map (Discovery V47): this long after a move of the person's own has settled, and only if the map
 * then stays still, the visible bounds become the list's area. A pan in several strokes asks once, for where it ended.
 */
export const AREA_SETTLE_MS = 450;
/**
 * A zoom button or a cluster tap moves the camera by the app's hand, so the map reports that move as the app's; it is
 * still the person's intent, and counts as theirs when it settles within this long.
 */
const INTENT_MS = 1_500;
/** A pill's own press may also reach the map as a tap on empty ground; within this long it is not one. */
const PILL_TAP_MS = 400;
const ZOOM_CAPSULE = { width: 44, height: 88 } as const;
const GAP = sys.space.md;
const CREDITS = [
  { text: '© OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  { text: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { text: 'OpenFreeMap', url: 'https://openfreemap.org/' },
] as const;

const placeWords = (place: PinPlace) => `${zadataka(place.ids.length)} na ovom mestu`;

/** The native SDK otherwise clips an over-padded fit to about one pixel. Keep a useful window at large text. */
function boundedFitPadding(frame: { width: number; height: number }, toolsBottom: number, fitBottom: number) {
  const top = 75 + toolsBottom, bottom = 24 + fitBottom;
  const verticalBudget = Math.max(0, frame.height - Math.min(96, frame.height / 2));
  const verticalScale = Math.min(1, verticalBudget / Math.max(1, top + bottom));
  const side = Math.floor(Math.min(50, Math.max(0, (frame.width - Math.min(96, frame.width / 2)) / 2)));
  return { top: Math.floor(top * verticalScale), right: side, bottom: Math.floor(bottom * verticalScale), left: side };
}

/**
 * Uses installed MapLibre v11 GeoJSON clustering; no map input becomes a business fact. The native source carries
 * only IDs and rounded public points (`publicFeatures`); what a pin says is drawn from the current read, by ID, as a
 * price pill over the pin once the map says which pins stand on their own at this zoom. Clusters stay the native
 * circles with their count.
 */
function MapSession(props: DiscoveryMapProps & { owns: () => boolean; onRetry: () => void; mapStyle: MapStyle }) {
  const reduced = useReducedMotion(), camera = useRef<CameraRef>(null), source = useRef<GeoJSONSourceRef>(null), map = useRef<MapRef>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [viewport, setViewport] = useState(props.viewport);
  // Discovery V47: there is no "Pretraži ovu oblast" any more. A move of the person's own settles, the map waits
  // `AREA_SETTLE_MS`, and the list follows the bounds; a new move of theirs before that starts the wait again.
  const areaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelArea = () => { if (areaTimer.current) { clearTimeout(areaTimer.current); areaTimer.current = null; } };
  /** When the person last asked the camera to move by a tap (a zoom button, a cluster); 0 when nothing is asked. */
  const intent = useRef(0);
  const pendingFocus = useRef<{ key: string; dataKey: string; center: [number, number] } | null>(null);
  const settledZoom = useRef(props.viewport?.zoom ?? null), zoomTarget = useRef<number | null>(null);
  const fitted = useRef<number | null>(null), centeredNearby = useRef<number | null>(null);
  /** When a pill was last pressed, so that the same touch is not also taken as a tap on the empty map. */
  const pillTap = useRef(0);
  const [visibleIds, setVisibleIds] = useState<readonly string[]>([]);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [creditHeight, setCreditHeight] = useState(48);
  const mounted = useRef(true), load = useRef(status);
  const data = useMemo(() => publicFeatures(props.items), [props.items]);
  const places = useMemo(() => pinPlaces(props.items), [props.items]);
  const byId = useMemo(() => new globalThis.Map(props.items.map(item => [item.id, item] as const)), [props.items]);
  const stacked = useMemo(() => [...places.values()].some(place => place.ids.length > 1), [places]);
  const dataKey = JSON.stringify(data), latest = useRef({ props, dataKey, places, byId }); latest.current = { props, dataKey, places, byId };
  const owns = () => mounted.current && props.owns() && latest.current.dataKey === dataKey;
  // Restore the actual visible bounds. Native camera `center` is the padded target after a pin/fit move; restoring
  // that target without its old padding moves the visible geography behind the sheet. Bounds already include that
  // offset, and need no new fit to the task dataset. This constructor runs only when this map session mounts.
  // A new map gets only an unoccluded provisional bounds view: the screen's
  // first render still holds whole-window sheet estimates, so those must never be frozen into the native camera.
  const initialFitPending = useRef(!props.viewport && data.features.length > 0);
  const initial = useRef(props.viewport ? { bounds: props.viewport.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } }
    : data.features.length ? { bounds: publicInitialBounds(props.items)!, padding: { top: 24, right: 50, bottom: 24, left: 50 } }
      : { center: [0, 0] as [number, number], zoom: 1 }); // Neutral overview; never a selected point.
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => { if (mounted.current && props.owns() && load.current === 'loading') { load.current = 'failed'; setStatus('failed'); } }, 15_000);
    return () => { mounted.current = false; clearTimeout(timer); cancelArea(); };
  }, []);
  const mark = (value: 'ready' | 'failed') => { if (!owns() || load.current === 'failed') return; load.current = value; setStatus(value); };
  // Which pins stand on their own at this zoom: the map's own answer, read after it settles. Only IDs come back, and
  // only IDs of the current read become pills. A failed read leaves the native logo markers.
  const query = useRef(0);
  const readVisiblePins = async () => {
    if (!owns() || load.current !== 'ready') return;
    const ask = ++query.current;
    try {
      const features = await map.current?.queryRenderedFeatures?.({ layers: ['need-pins'] });
      if (!owns() || ask !== query.current || !Array.isArray(features)) return;
      setVisibleIds([...new Set(features.flatMap(feature => typeof feature?.properties?.needId === 'string' ? [feature.properties.needId as string] : []))]);
    } catch { /* Native logo markers remain; nothing is invented. */ }
  };
  useEffect(() => {
    if (status !== 'ready') return;
    const timer = setTimeout(() => { void readVisiblePins(); }, PILL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [dataKey, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const moveCamera = (options: { center: [number, number] } & CameraOptions, duration: number) => {
    if (reduced) camera.current?.jumpTo(options); else camera.current?.easeTo({ ...options, duration });
  };
  /** Several tasks on one point are one place: its cluster opens the place instead of zooming into a single spot. */
  const stackOf = async (clusterId: number, count: number): Promise<string | null> => {
    if (!stacked || !latest.current.props.onSelectPlace || !Number.isInteger(count) || count < 2 || count > 100) return null;
    try {
      const leaves = await source.current?.getClusterLeaves?.(clusterId, count, 0);
      if (!owns() || !Array.isArray(leaves)) return null;
      const keys = new Set(leaves.map(leaf => {
        const item = typeof leaf?.properties?.needId === 'string' ? latest.current.byId.get(leaf.properties.needId) : undefined, point = item && publicPoint(item);
        return point ? pointKey(point) : null;
      }));
      const [key] = [...keys];
      return leaves.length === count && keys.size === 1 && typeof key === 'string' && (latest.current.places.get(key)?.ids.length ?? 0) > 1 ? key : null;
    } catch { return null; }
  };
  const pressFeature = async (features: GeoJSON.Feature[]) => {
    if (!owns() || load.current !== 'ready' || !Array.isArray(features)) return;
    const feature = features[0]; if (!feature || feature.geometry?.type !== 'Point') return;
    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return;
    const properties = feature.properties;
    if (properties?.cluster === true && Number.isInteger(properties.cluster_id)) {
      initialFitPending.current = false; pendingFocus.current = null;
      const place = await stackOf(properties.cluster_id, Number(properties.point_count));
      if (!owns() || load.current !== 'ready') return;
      if (place) { latest.current.props.onSelectPlace?.(place); return; }
      try {
        const zoom = await source.current?.getClusterExpansionZoom(properties.cluster_id);
        if (!owns() || load.current !== 'ready' || typeof zoom !== 'number' || !Number.isFinite(zoom)) return;
        // Opening a cluster is the person's move, though the camera makes it: the list follows where it lands.
        intent.current = Date.now();
        moveCamera({ center: [coordinates[0], coordinates[1]] as [number, number], zoom: Math.min(18, Math.max(0, zoom)) }, sys.motion.camera);
      } catch { /* Native source may retire during a refresh; no invented selection. */ }
    } else if (typeof properties?.needId === 'string') {
      const actual = latest.current.props.items.find(item => item.id === properties.needId), point = actual && publicPoint(actual);
      // Android reports rendered/tile geometry, which need not equal source
      // doubles. Resolve the current public item by ID; its canonical coarse
      // point owns the selected annotation. Never adopt native coordinates.
      if (point) { initialFitPending.current = false; latest.current.props.onSelect(actual.id); }
    }
  };
  const selected = props.items.find(item => item.id === props.selectedId), point = selected && publicPoint(selected);
  const selectedPlace = props.selectedPlace ? places.get(props.selectedPlace) : undefined;
  const urgencyNow = useUrgencyClock(props.items.map(item => item.urgency));
  const urgentIds = props.items.filter(item => displaysUrgent(item.urgency, urgencyNow)).map(item => item.id);
  const urgentPlace = (place: PinPlace) => place.ids.some(id => displaysUrgent(byId.get(id)?.urgency, urgencyNow));
  // A new choice gets a neighborhood view, never a tighter location: the target is still the rounded public point.
  // Native padding and zoom are applied together, avoiding a geographic offset computed at the old, possibly
  // continent-wide zoom. A closer settled/user-requested zoom survives; a choice restored on mount stays put.
  const focus = useRef<string | null>(props.selectedPlace ? `place:${props.selectedPlace}` : props.selectedId ? `task:${props.selectedId}` : null);
  useEffect(() => {
    const key = props.selectedPlace ? `place:${props.selectedPlace}` : props.selectedId ? `task:${props.selectedId}` : null;
    if (key !== focus.current) {
      focus.current = key; pendingFocus.current = null;
      const target = selectedPlace?.point ?? point;
      if (key && target && owns()) {
        initialFitPending.current = false;
        cancelArea(); intent.current = 0;
        pendingFocus.current = { key, dataKey, center: [target.lng, target.lat] };
      }
    }
    const request = pendingFocus.current;
    if (!request) return;
    // Layout may arrive later. A new dataset, destination, scope or user gesture retires this one request instead of
    // replaying it over the person's next move. Consumed search/Nearby requests do not prevent later pin choices.
    if (!owns() || request.key !== key || request.dataKey !== dataKey
      || (props.fitTo && props.fitTo.key !== fitted.current)
      || (props.centerNearby && props.centerNearby.key !== centeredNearby.current)) { pendingFocus.current = null; return; }
    if (status !== 'ready' || !frame || props.cameraLayoutReady === false || !camera.current) return;
    pendingFocus.current = null;
    cancelArea(); intent.current = 0;
    const zoom = Math.min(18, Math.max(12, settledZoom.current ?? 12, zoomTarget.current ?? 0));
    moveCamera({ center: request.center, zoom,
      padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.focusBottom ?? 0) }, sys.motion.camera);
  }, [props.selectedId, props.selectedPlace, status, frame, props.cameraLayoutReady, props.toolsBottom, props.focusBottom,
    dataKey, props.fitTo?.key, props.centerNearby?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // The pins that stand on their own become pills; a point shared by several tasks is one pill that says how many.
  const pills = useMemo(() => {
    const seen = new Set<string>(), shown: PinPlace[] = [];
    for (const id of visibleIds) {
      const item = byId.get(id), at = item && publicPoint(item);
      if (!at) continue;
      const key = pointKey(at), place = places.get(key);
      if (seen.has(key) || !place) continue;
      seen.add(key); shown.push(place);
      if (shown.length >= PILL_LIMIT) break;
    }
    return shown;
  }, [visibleIds, byId, places]);
  const chosenKey = selectedPlace?.key ?? (point ? pointKey(point) : null);
  const contentOf = (place: PinPlace): PillContent => place.ids.length > 1
    ? { text: zadataka(place.ids.length), tone: 'count', spoken: placeWords(place) } : pinLabel(byId.get(place.ids[0])!);
  // The zoom buttons answer a finger, so they move at the toggle pace, not the camera's flight. `viewport` only
  // updates when the camera settles, so taps inside one animation build on the target already asked for: three quick
  // taps on "+" are three levels, not one. The target is forgotten when the map reports where it settled.
  const changeZoom = (delta: number) => {
    if (!owns() || load.current !== 'ready' || !viewport) return;
    initialFitPending.current = false; pendingFocus.current = null;
    const next = Math.min(18, Math.max(0, (zoomTarget.current ?? viewport.zoom) + delta));
    zoomTarget.current = next;
    // A zoom button is the person moving the map, though the camera makes the move: the list follows where it settles.
    intent.current = Date.now();
    camera.current?.zoomTo(next, { duration: reduced ? 0 : sys.motion.toggle });
  };
  // Exactly one first fit after BOTH native frame and screen overlays are measured. It is not a live camera binding:
  // changing rows, sheet height, tools or font size later cannot take the map away from the person's chosen view.
  useEffect(() => {
    if (!initialFitPending.current || status !== 'ready' || !owns()) return;
    // A deliberate camera destination always wins, even if it is still waiting for the layout below.
    if (props.fitTo || props.centerNearby) { initialFitPending.current = false; return; }
    if (!frame || props.cameraLayoutReady === false || !camera.current) return;
    const bounds = publicInitialBounds(props.items);
    initialFitPending.current = false;
    if (!bounds) return;
    cancelArea(); intent.current = 0;
    camera.current.fitBounds(bounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.fitBottom ?? 56), duration: 0 });
  }, [status, frame, props.cameraLayoutReady, props.toolsBottom, props.fitBottom, dataKey, props.fitTo?.key, props.centerNearby?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // A place chosen in the search: the camera brings its pins into view once, as its own move (never an area).
  useEffect(() => {
    const request = props.fitTo;
    if (status !== 'ready' || !request || fitted.current === request.key || !owns() || !frame || props.cameraLayoutReady === false) return;
    initialFitPending.current = false; pendingFocus.current = null;
    fitted.current = request.key;
    intent.current = 0;
    camera.current?.fitBounds?.(request.bounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, request.bottom),
      duration: reduced ? 0 : sys.motion.camera });
    props.onFitted?.(request.key);
  }, [props.fitTo?.key, status, props.cameraLayoutReady, frame]); // eslint-disable-line react-hooks/exhaustive-deps
  // One explicit location capture only moves the camera; it is never a pin or an area filter. Its viewport follows
  // the same in-memory screen path as a normal pan. No tracking marker or continuous subscription belongs to the map.
  useEffect(() => {
    const target = props.centerNearby;
    if (status !== 'ready' || !target || target.key === centeredNearby.current || !owns() || !camera.current) return;
    if (target.center.length !== 2 || !target.center.every(Number.isFinite) || Math.abs(target.center[0]) > 180 || Math.abs(target.center[1]) > 90) return;
    initialFitPending.current = false; pendingFocus.current = null;
    centeredNearby.current = target.key;
    cancelArea(); intent.current = 0;
    moveCamera({ center: target.center, zoom: 12 }, sys.motion.camera);
    props.onNearbyConsumed?.(target.key);
  }, [props.centerNearby, status]); // eslint-disable-line react-hooks/exhaustive-deps
  // Credits have their own reserved strip. Zoom is optional when the sheet leaves too little clear map above it.
  const height = frame?.height ?? 0, sheetTop = props.sheetTop;
  const creditsTop = (props.toolsBottom ?? 0) + creditHeight + 2 * GAP;
  const zoomTop = creditsTop + ZOOM_CAPSULE.height + GAP;
  // A chosen pin's card rests on the sheet's top line, exactly where they ride; they step up above it (review r3 item
  // 11), at the sheet's pace or at once under reduced motion, so zoom stays a tap away and the credits stay in sight.
  const cover = useSharedValue(props.coverBottom ?? 0);
  useEffect(() => {
    const next = Math.max(0, props.coverBottom ?? 0);
    cover.value = reduced ? next : withSpring(next, sys.motion.springSheet);
  }, [props.coverBottom, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoomRide = useAnimatedStyle(() => {
    const top = (sheetTop ? sheetTop.value : height) - cover.value;
    return top < zoomTop ? { transform: [{ translateY: -2 * height }], opacity: 0 } : { transform: [{ translateY: Math.min(0, top - height) }], opacity: 1 };
  }, [height, zoomTop, sheetTop, cover]);
  const creditsRide = useAnimatedStyle(() => {
    const top = (sheetTop ? sheetTop.value : height) - cover.value;
    // Never inherit zoom's fit/opacity branch. The screen reserves this measured height at its full sheet stop.
    return { transform: [{ translateY: Math.min(0, Math.max(creditsTop, top) - height) }] };
  }, [height, creditsTop, sheetTop, cover]);
  const zoom = status === 'ready' ? <View style={[s.zoom, { bottom: creditHeight + 2 * GAP }]}>
      {([['Uvećaj mapu', Plus, 1], ['Umanji mapu', Minus, -1]] as const).map(([label, Glyph, delta], index) => <View key={label}>
        {index ? <View style={s.zoomRule} /> : null}
        <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !viewport }} disabled={!viewport}
          // Each half is drawn 44 × 43; its touch reaches 48 × 49 outwards, never into the other half.
          haptic="select" onPress={() => changeZoom(delta)} hitSlop={index ? { left: 2, right: 2, bottom: 6 } : { left: 2, right: 2, top: 6 }} style={s.zoomButton}>
          <Glyph size={22} color={viewport ? sys.color.ink : sys.color.muted} /></Press>
      </View>)}
    </View> : null;
  const credits = <View testID="discovery-map-credits" style={[s.attribution, { height: creditHeight }]} onLayout={event => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    if (Number.isFinite(next) && next >= 48) { setCreditHeight(current => current === next ? current : next); props.onCreditsHeight?.(next); }
  }}>
    <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar keyboardShouldPersistTaps="handled"
      accessibilityLabel="Izvori mape" contentContainerStyle={s.creditRow} onContentSizeChange={(_width, tall) => {
        if (Number.isFinite(tall) && tall > 0) setCreditHeight(Math.max(48, Math.ceil(tall)));
      }}>
      {CREDITS.map(credit => <Press key={credit.url} accessibilityRole="link" accessibilityLabel={credit.text} hitSlop={0} style={s.creditLink}
        onPress={() => { void Linking.openURL(credit.url).catch(() => {}); }}><T variant="label" style={s.credit}>{credit.text}</T></Press>)}
    </ScrollView>
  </View>;
  return <View style={s.container} onLayout={event => { const { width, height: tall } = event.nativeEvent.layout; if (width > 0 && tall > 0) setFrame(current => current?.width === width && current.height === tall ? current : { width, height: tall }); }}>
    <Map ref={map} style={s.map} mapStyle={props.mapStyle} androidView="texture" logo={false}
      attribution={false} tintColor={sys.color.muted}
      touchPitch={false} touchRotate={false} accessibilityLabel="Mapa približnih lokacija Zadatka"
      onDidFinishLoadingMap={() => { mark('ready'); void readVisiblePins(); }} onDidFailLoadingMap={() => mark('failed')}
      // A tap on the map where there is no pin closes an open pin's card. A pin's press stops at its source, and a price
      // pill's own press is not taken as a tap on the ground under it.
      onPress={() => { if (owns() && load.current === 'ready' && Date.now() - pillTap.current > PILL_TAP_MS) { pendingFocus.current = null; latest.current.props.onClear?.(); } }}
      // The person takes hold of the map again before the last move's wait is over: that move was not where they stopped.
      onRegionWillChange={event => { if (event.nativeEvent?.userInteraction === true) { initialFitPending.current = false; pendingFocus.current = null; cancelArea(); } }}
      // The region the camera settles into on first load arrives BEFORE the map reports itself
      // ready, so this guard used to throw it away — and nothing else produces a viewport. On a
      // phone that left both zoom buttons dead, with no reason beside them, on every fresh open of
      // the map until the person happened to drag it. The control now comes alive as soon as the
      // map says where it is; persisting that position upward still waits for ready, so a neutral
      // world overview never becomes the remembered viewport, nor the list's area.
      onRegionDidChange={event => { if (!owns()) return; zoomTarget.current = null; const value = publicViewport(event.nativeEvent); setViewport(value);
        if (value) settledZoom.current = value.zoom;
        if (event.nativeEvent?.userInteraction === true) { initialFitPending.current = false; pendingFocus.current = null; }
        if (value && load.current === 'ready' && !initialFitPending.current) {
          latest.current.props.onViewport(value);
          // Only the person's own move makes the list follow the map: a drag or a pinch (the map says so), or a zoom
          // button or a cluster they tapped. The camera's own moves (the first fit, a chosen pin, a chosen place) never.
          const own = event.nativeEvent?.userInteraction === true || (intent.current > 0 && Date.now() - intent.current <= INTENT_MS);
          intent.current = 0;
          if (own) {
            cancelArea();
            const bounds = value.bounds;
            areaTimer.current = setTimeout(() => {
              areaTimer.current = null;
              if (mounted.current && props.owns() && load.current === 'ready') latest.current.props.onArea(bounds);
            }, AREA_SETTLE_MS);
          }
        }
        void readVisiblePins(); }}>
      <Camera ref={camera} initialViewState={initial.current} minZoom={0} maxZoom={18} />
      <Images images={PIN_IMAGES} />
      <GeoJSONSource id="public-needs" ref={source} data={data} cluster clusterRadius={60} clusterMaxZoom={16}
        hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }}
        onPress={event => { event.stopPropagation(); void pressFeature(event.nativeEvent.features); }}>
        {/* The SDK exposes no annotation-rendered/error event: query/layout success cannot prove a bitmap exists.
            Keep the fallback for failed/absent pills and beyond the label budget. Its 36dp outer disk fits wholly
            inside a rich pill's 40dp solid body, so the fallback never leaves a second ring around a successful pill. */}
        <Layer id="need-clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-radius': 20, 'circle-color': sys.color.surface, 'circle-stroke-width': 2, 'circle-stroke-color': sys.color.green }} />
        <Layer id="need-cluster-count" type="symbol" filter={['has', 'point_count']}
          layout={{ 'text-field': ['to-string', ['get', 'point_count_abbreviated']], 'text-size': 14, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true }} paint={{ 'text-color': sys.color.green }} />
        <Layer id="need-pins" type="circle" filter={['!', ['has', 'point_count']]}
          paint={{ 'circle-radius': 16, 'circle-color': sys.color.surface, 'circle-stroke-width': 2,
            'circle-stroke-color': ['case', ['in', ['get', 'needId'], ['literal', urgentIds]], sys.color.danger, sys.color.green] }} />
        <Layer id="need-pin-marks" type="symbol" filter={['!', ['has', 'point_count']]}
          layout={{ 'icon-image': 'uskoci-task', 'icon-size': 30 / 640, 'icon-allow-overlap': true, 'icon-ignore-placement': true }} />
      </GeoJSONSource>
      {pills.filter(place => place.key !== chosenKey).map(place => {
        const content = contentOf(place), urgent = urgentPlace(place);
        // The native side keys its annotations by `id`: an id that changes with the content, as the React key does, keeps
        // an insert-before-remove in one commit from leaving a dead pill behind (review r3 item 8).
        return <ViewAnnotation key={`pill:${place.key}:${content.text}:${urgent}`} id={`pill-${place.key}-${content.text}-${urgent}`} lngLat={[place.point.lng, place.point.lat]} anchor="center"
          onPress={() => { if (!owns() || load.current !== 'ready') return;
            pillTap.current = Date.now();
            if (place.ids.length > 1 && latest.current.props.onSelectPlace) latest.current.props.onSelectPlace(place.key);
            else latest.current.props.onSelect(place.ids[0]); }}>
          <View collapsable={false} accessible accessibilityRole="button"
            accessibilityLabel={place.ids.length > 1 ? placeWords(place) : `${urgent ? 'HITNO, ' : ''}${readableTitle(byId.get(place.ids[0])?.naslov)}, ${content.spoken}`}>
            <PricePill content={content} urgent={urgent} /></View>
        </ViewAnnotation>;
      })}
      {selectedPlace ? <ViewAnnotation key={`selected-place:${selectedPlace.key}`} id="selected-place" lngLat={[selectedPlace.point.lng, selectedPlace.point.lat]} anchor="center">
        <View collapsable={false} accessible accessibilityLabel={`${placeWords(selectedPlace)}, izabrano`}>
          <PricePill content={contentOf(selectedPlace)} urgent={urgentPlace(selectedPlace)} selected /></View>
      </ViewAnnotation> : point && selected ? <ViewAnnotation key={`selected-need:${selected.id}`} id="selected-need" lngLat={[point.lng, point.lat]} anchor="center">
        <View collapsable={false} accessible accessibilityLabel={`${displaysUrgent(selected.urgency, urgencyNow) ? 'HITNO, ' : ''}${readableTitle(selected.naslov)}, ${pinLabel(selected).spoken}, približna lokacija`}>
          <PricePill content={pinLabel(selected)} urgent={displaysUrgent(selected.urgency, urgencyNow)} selected /></View>
      </ViewAnnotation> : null}
    </Map>
    {sheetTop && height ? <>
      <Animated.View testID="discovery-map-zoom-ride" pointerEvents="box-none" style={[s.ride, { height }, zoomRide]}>{zoom}</Animated.View>
      <Animated.View testID="discovery-map-credits-ride" pointerEvents="box-none" style={[s.ride, { height }, creditsRide]}>{credits}</Animated.View>
    </> : <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{zoom}{credits}</View>}
    {status !== 'ready' ? <View style={[s.feedback, { paddingTop: (props.toolsBottom ?? 0) + 24, paddingBottom: (props.focusBottom ?? 0) + 24 }]}>
      {status === 'loading' ? <><ActivityIndicator color={sys.color.green} /><T variant="body">Učitavamo mapu…</T></>
        : <><T variant="title" accessibilityRole="alert">Mapa nije učitana</T><T variant="body">Proveri vezu. Zadaci i filteri ostaju u listi.</T>
          <V2Action label="Pokušaj ponovo sa mapom" onPress={() => { if (owns()) props.onRetry(); }} />
          {/* A screen whose list is a sheet over the map already offers the list on the sheet's own top line. */}
          {sheetTop ? null : <V2Action label="Pogledaj listu" onPress={props.onList} />}</>}</View> : null}
  </View>;
}
export function DiscoveryMap(props: DiscoveryMapProps) {
  const [owner, setOwner] = useState<Owner | null>(null), [attempt, setAttempt] = useState(0);
  const current = useRef<Owner | null>(null), epoch = useRef(0), latestKey = useRef(props.scopeKey); latestKey.current = props.scopeKey;
  // Place names in Serbian Latin: the map mounts once its style is known (read once for the whole app).
  const mapStyle = useMapStyle();
  useFocusEffect(useCallback(() => {
    const scope = { active: true, key: props.scopeKey, epoch: ++epoch.current }; current.current = scope; setOwner(scope);
    return () => { scope.active = false; if (current.current === scope) current.current = null; };
  }, [props.scopeKey]));
  if (!owner?.active || owner.key !== props.scopeKey || current.current !== owner) return <View style={s.feedback}><T>Mapa je dostupna dok je ovaj pregled otvoren.</T></View>;
  if (!mapStyle) return <View style={[s.feedback, { paddingTop: (props.toolsBottom ?? 0) + 24 }]}><ActivityIndicator color={sys.color.green} /><T variant="body">Učitavamo mapu…</T></View>;
  const owns = () => current.current === owner && owner.active && latestKey.current === owner.key;
  return <MapSession key={`${owner.epoch}:${attempt}`} {...props} mapStyle={mapStyle} owns={owns} onRetry={() => { if (owns()) setAttempt(value => value + 1); }} />;
}
const s = StyleSheet.create({ container: { flex: 1, minHeight: 180, backgroundColor: sys.color.greenSoft }, map: { flex: 1 },
  ride: { position: 'absolute', left: 0, right: 0, top: 0 },
  // One capsule with a hairline between its halves (critique B11), bottom-right above the sheet.
  zoom: { position: 'absolute', right: sys.space.base, bottom: GAP, width: ZOOM_CAPSULE.width, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.line, ...sys.elevation.soft },
  zoomButton: { width: ZOOM_CAPSULE.width - 2, height: ZOOM_CAPSULE.height / 2 - 1, alignItems: 'center', justifyContent: 'center' },
  zoomRule: { height: 1, marginHorizontal: 10, backgroundColor: sys.color.line },
  feedback: { ...StyleSheet.absoluteFill, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: sys.color.surface },
  // Full-width and independent of zoom: at large text the rail scrolls, preserving all three names and touch targets.
  attribution: { position: 'absolute', bottom: GAP, left: sys.space.base, right: sys.space.base,
    minHeight: 48 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  creditLink: { minHeight: 48, minWidth: 48, justifyContent: 'center', paddingVertical: sys.space.xs },
  credit: { fontWeight: '500', letterSpacing: 0, color: sys.color.ink, backgroundColor: sys.color.veil,
    borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1,
    textShadowColor: sys.color.surface, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
});
