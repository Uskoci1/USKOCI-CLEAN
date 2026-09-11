import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Camera, Map, Marker, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { palette, radius, space } from '../../theme/tokens';
import { Button } from '../Button';
import { T } from '../Text';
import { displayedPinPosition, RESOLVED_PIN_MAP_STYLE, type ResolvedPinMapProps } from './ResolvedPinMap.types';
export type { ResolvedPinMapProps, ResolvedPinPosition } from './ResolvedPinMap.types';

type FocusOwner = { active: boolean; key: string; epoch: number };
type MapStatus = 'loading' | 'ready' | 'failed';
type Pixel = [number, number];
type PinDrag = { token: object; start: Pixel; origin: Promise<Pixel | null>; cancelled: Promise<null>; stop: () => void;
  released: boolean; timeout: ReturnType<typeof setTimeout> };
const pixel = (value: unknown): Pixel | null => Array.isArray(value) && value.length === 2
  && value.every(item => typeof item === 'number' && Number.isFinite(item)) ? [value[0], value[1]] : null;

/** MapLibre rendering and lifetime pattern adapted from PR67; no provider or save authority. */
function NativePinSession(props: ResolvedPinMapProps & { owns: () => boolean; retry: () => void }) {
  const { position, coarse = false, disabled = false } = props;
  const pin = displayedPinPosition(position, coarse);
  const [status, setStatus] = useState<MapStatus>('loading');
  const load = useRef<MapStatus>('loading');
  const active = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const camera = useRef<CameraRef>(null);
  const map = useRef<MapRef>(null);
  const frameSize = useRef<Pixel | null>(null);
  const drag = useRef<PinDrag | null>(null);
  const [dragOffset, setDragOffset] = useState<{ token: object; delta: Pixel } | null>(null);
  const [imageToken, setImageToken] = useState<object | null>(null);
  const [idleToken, setIdleToken] = useState<object | null>(null);
  const idle = useRef<object | null>(null);
  const [centeredToken, setCenteredToken] = useState<object | null>(null);
  const token = useMemo(() => ({}), [position?.latitude, position?.longitude, coarse, disabled]);
  const latest = useRef({ token, props }); latest.current = { token, props };
  // The neutral world viewport is an overview only. It never becomes a selected pin.
  const initial = useRef(pin ? { center: [pin.longitude, pin.latitude] as [number, number], zoom: coarse ? 10 : 15 }
    : { center: [0, 0] as [number, number], zoom: 1 });
  const owns = () => active.current && props.owns() && latest.current.token === token;
  const cancelDrag = () => {
    if (drag.current) { clearTimeout(drag.current.timeout); drag.current.stop(); }
    drag.current = null;
    if (active.current) setDragOffset(null);
  };
  const mark = (next: MapStatus) => {
    if (!owns() || (next === 'ready' && load.current !== 'loading')) return;
    if (next === 'failed') cancelDrag();
    load.current = next; clearTimeout(timer.current); setStatus(next);
  };
  useEffect(() => {
    active.current = true;
    timer.current = setTimeout(() => {
      if (active.current && latest.current.props.owns() && load.current === 'loading') {
        load.current = 'failed'; setStatus('failed');
      }
    }, 15_000);
    return () => { active.current = false; clearTimeout(timer.current); cancelDrag(); };
  }, []);
  useEffect(() => () => cancelDrag(), [token]);
  useEffect(() => {
    if (pin && status === 'ready' && owns()) {
      camera.current?.jumpTo({ center: [pin.longitude, pin.latitude], zoom: coarse ? 10 : 15 });
    }
  }, [pin?.latitude, pin?.longitude, coarse, disabled, status]);
  const observeCenter = (value: unknown) => {
    if (!owns() || !pin || load.current !== 'ready') return;
    const state = value as { center?: unknown; zoom?: unknown } | null;
    const center = Array.isArray(state?.center) && state.center.length === 2
      ? displayedPinPosition({ longitude: state.center[0], latitude: state.center[1] }) : null;
    idle.current = center && typeof state?.zoom === 'number' && Number.isFinite(state.zoom)
      && state.zoom >= 0 && state.zoom <= (coarse ? 13 : 18) ? token : null;
    setIdleToken(idle.current);
    const centered = center && typeof state?.zoom === 'number' && Number.isFinite(state.zoom)
      && Math.abs(state.zoom - (coarse ? 10 : 15)) < 0.01
      && Math.abs(center.latitude - pin.latitude) < 0.00001 && Math.abs(center.longitude - pin.longitude) < 0.00001;
    setCenteredToken(centered ? token : null);
  };
  const coordinateText = pin ? `Geografska širina ${(Math.round(pin.latitude * 1e6) / 1e6).toFixed(coarse ? 2 : 6)}; geografska dužina ${(Math.round(pin.longitude * 1e6) / 1e6).toFixed(coarse ? 2 : 6)}.` : null;
  const choose = (lngLat: unknown) => {
    if (!owns() || load.current !== 'ready' || latest.current.props.disabled
      || !Array.isArray(lngLat) || lngLat.length !== 2) return;
    const chosen = displayedPinPosition({ latitude: lngLat[1], longitude: lngLat[0] }, coarse);
    if (chosen) latest.current.props.onChoose(chosen);
  };
  const canDrag = () => owns() && !!pin && load.current === 'ready' && !disabled
    && idle.current === token && idleToken === token && imageToken === token && !!map.current && !!frameSize.current;
  const touch = (event: GestureResponderEvent) => event.nativeEvent.touches?.length > 1 ? null
    : pixel([event.nativeEvent.pageX, event.nativeEvent.pageY]);
  const currentDrag = (session: PinDrag) => owns() && drag.current === session && session.token === token
    && idle.current === token && load.current === 'ready' && !latest.current.props.disabled;
  const beginDrag = (event: GestureResponderEvent) => {
    const start = touch(event), nativeMap = map.current;
    if (!canDrag() || !start || !nativeMap || !pin || drag.current) return;
    event.stopPropagation();
    // Both projection directions come from the native map. Screen movement is
    // the real marker responder delta in DIP, matching Map.project/unproject.
    let stop!: () => void;
    const cancelled = new Promise<null>(resolve => { stop = () => resolve(null); });
    const session: PinDrag = { token, start, released: false, cancelled, stop,
      origin: Promise.resolve(null), timeout: setTimeout(() => {
        if (drag.current === session) cancelDrag();
      }, 15_000) };
    drag.current = session; setDragOffset({ token, delta: [0, 0] });
    try { session.origin = nativeMap.project([pin.longitude, pin.latitude]).then(pixel, () => null); }
    catch { cancelDrag(); }
  };
  const moveDrag = (event: GestureResponderEvent) => {
    const session = drag.current, point = touch(event);
    if (!session || !currentDrag(session) || session.released) return;
    if (!point) { cancelDrag(); return; }
    event.stopPropagation();
    setDragOffset({ token, delta: [point[0] - session.start[0], point[1] - session.start[1]] });
  };
  const endDrag = async (event: GestureResponderEvent) => {
    const session = drag.current, point = touch(event), nativeMap = map.current;
    if (!session || !currentDrag(session) || session.released) return;
    event.stopPropagation(); session.released = true;
    try {
      if (!point || !nativeMap) return;
      const delta: Pixel = [point[0] - session.start[0], point[1] - session.start[1]];
      if (Math.hypot(...delta) < 4) return;
      const origin = await Promise.race([session.origin, session.cancelled]);
      if (!currentDrag(session) || !origin) return;
      const target: Pixel = [origin[0] + delta[0], origin[1] + delta[1]], size = frameSize.current;
      if (!size || target.some((value, index) => value < 0 || value > size[index])) return;
      const lngLat = await Promise.race([nativeMap.unproject(target), session.cancelled]);
      if (currentDrag(session)) choose(lngLat);
    } catch { /* Failed projection leaves the parent-owned point untouched. */ }
    finally { if (drag.current === session) cancelDrag(); }
  };
  const offset = dragOffset?.token === token ? dragOffset.delta : null;
  return <View style={styles.container}>
    <View style={styles.frame} onLayout={event => {
      if (!owns()) return;
      const size = pixel([event.nativeEvent.layout.width, event.nativeEvent.layout.height]);
      if (size && size.every(value => value > 0)) {
        if (frameSize.current && size.some((value, index) => value !== frameSize.current![index])) {
          idle.current = null; cancelDrag(); setIdleToken(null); setCenteredToken(null);
        }
        frameSize.current = size;
      }
    }}>
      <Map ref={map} style={styles.map} mapStyle={RESOLVED_PIN_MAP_STYLE} androidView="texture" dragPan={!offset}
        attribution attributionPosition={{ bottom: 8, right: 8 }} logo={false}
        touchPitch={false} touchRotate={false} accessibilityLabel={coarse ? 'Mapa približnog područja rada' : 'Mapa predložene lokacije'}
        onDidFinishLoadingMap={() => mark('ready')} onDidFailLoadingMap={() => mark('failed')}
        onRegionWillChange={() => { if (owns()) { idle.current = null; cancelDrag(); setIdleToken(null); setCenteredToken(null); } }}
        onRegionDidChange={event => observeCenter(event.nativeEvent)}
        onPress={event => { if (!drag.current) choose(event.nativeEvent.lngLat); }}>
        <Camera ref={camera} initialViewState={initial.current} minZoom={0} maxZoom={coarse ? 13 : 18} />
        {pin ? <Marker id="location-proposal" lngLat={[pin.longitude, pin.latitude]} anchor="bottom">
          {/* Marker uses a real Android view on the native map projection.
              Image decode is readiness only; screenshots verify visible pixels. */}
          <View collapsable={false} accessible accessibilityRole="image" accessibilityLabel="Oznaka izabrane tačke na mapi"
            onStartShouldSetResponder={canDrag}
            onResponderGrant={beginDrag} onResponderMove={moveDrag} onResponderRelease={event => { void endDrag(event); }}
            onResponderTerminate={() => { if (owns()) cancelDrag(); }} onResponderTerminationRequest={() => !owns() || !drag.current}
            style={[styles.marker, offset ? { transform: [{ translateX: offset[0] }, { translateY: offset[1] }] } : null]}>
          <Image key={`${pin.latitude}:${pin.longitude}:${coarse}:${disabled}`}
            source={require('../../../assets/resolved-location-pin.png')}
            accessible={false} fadeDuration={0} resizeMode="contain" style={styles.marker}
            onLoad={() => { if (owns()) setImageToken(token); }}
            onError={() => { if (owns()) { setImageToken(null); mark('failed'); } }} />
          </View>
        </Marker> : null}
      </Map>
      {status !== 'ready' ? <View style={styles.feedback}>
        {status === 'loading' ? <><ActivityIndicator color={palette.teal500} accessibilityLabel="Učitavanje mape" /><T>Učitavamo mapu…</T></>
          : <><T accessibilityRole="alert" variant="bodyStrong">Mapa nije učitana.</T><T variant="meta" tone="muted">Proverite vezu. Uneti podaci ostaju u obrascu.</T>
            <Button label="Pokušaj ponovo sa mapom" kind="secondary" onPress={() => { if (owns()) props.retry(); }} /></>}
      </View> : null}
    </View>
    {pin ? <View style={{ gap: space.xs }}>
      <T accessible accessibilityRole="text" accessibilityLiveRegion="polite"
        accessibilityLabel={`${coarse ? 'Približna tačka na mapi' : 'Predložena tačka na mapi'}. ${coordinateText}`}
        variant="meta" tone="muted">{coordinateText}</T>
      <T accessibilityLiveRegion="polite" variant="meta" tone="muted">{centeredToken === token && imageToken === token && status === 'ready' && !offset
        ? 'Mapa je centrirana na izabranu tačku.' : 'Proverite položaj oznake na mapi.'}</T>
    </View> : null}
    {!pin ? <T variant="meta" tone="muted">Tačka nije izabrana. Pronađite područje i dodirnite mapu.</T>
      : <T variant="meta" tone="muted">{disabled ? 'Prikazana je izabrana lokacija.'
        : coarse ? 'Prikazana je približna tačka. Dodirnite mapu ili prevucite oznaku da predložite drugu.'
          : 'Dodirnite mapu ili prevucite oznaku da predložite drugu tačku.'}</T>}
    {!disabled ? <T variant="meta" tone="muted">Izbor na mapi treba potvrditi u obrascu.</T> : null}
    <View style={styles.attribution}>
      <T variant="meta" accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {}); }}>© OpenStreetMap</T>
      <T variant="meta" accessibilityRole="link" onPress={() => { void Linking.openURL('https://openfreemap.org/').catch(() => {}); }}>OpenFreeMap</T>
    </View>
  </View>;
}

export function ResolvedPinMap(props: ResolvedPinMapProps) {
  const [owner, setOwner] = useState<FocusOwner | null>(null);
  const [attempt, setAttempt] = useState(0);
  const current = useRef<FocusOwner | null>(null);
  const latestKey = useRef(props.scopeKey); latestKey.current = props.scopeKey;
  const generation = useRef(0);
  useFocusEffect(useCallback(() => {
    if (!props.scopeKey) return;
    const session = { active: true, key: props.scopeKey, epoch: ++generation.current };
    current.current = session; setOwner(session);
    return () => { session.active = false; if (current.current === session) current.current = null; setOwner(null); };
  }, [props.scopeKey]));
  const valid = owner?.active && owner.key === props.scopeKey && current.current === owner;
  if (!valid) return <View style={styles.container}><T variant="meta" tone="muted">Mapa je dostupna dok je ovaj unos otvoren.</T></View>;
  const owns = () => current.current === owner && owner.active && latestKey.current === owner.key;
  return <NativePinSession key={`${owner.epoch}:${attempt}`} {...props} owns={owns}
    retry={() => { if (owns()) setAttempt(value => value + 1); }} />;
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  frame: { height: 320, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: palette.successBg },
  map: { flex: 1 },
  feedback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: space.lg,
    gap: space.md, backgroundColor: palette.surface },
  attribution: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingTop: space.xs },
  marker: { width: 44, height: 48 },
});
