import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Camera, Map, ViewAnnotation, type CameraRef, type ViewAnnotationRef } from '@maplibre/maplibre-react-native';
import { palette, radius, space } from '../../theme/tokens';
import { Button } from '../Button';
import { T } from '../Text';
import { displayedPinPosition, RESOLVED_PIN_MAP_STYLE, type ResolvedPinMapProps } from './ResolvedPinMap.types';
export type { ResolvedPinMapProps, ResolvedPinPosition } from './ResolvedPinMap.types';

type FocusOwner = { active: boolean; key: string; epoch: number };
type MapStatus = 'loading' | 'ready' | 'failed';

/** MapLibre rendering and lifetime pattern adapted from PR67; no provider or save authority. */
function NativePinSession(props: ResolvedPinMapProps & { owns: () => boolean; retry: () => void }) {
  const { position, coarse = false, disabled = false } = props;
  const pin = displayedPinPosition(position, coarse);
  const [status, setStatus] = useState<MapStatus>('loading');
  const load = useRef<MapStatus>('loading');
  const active = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const camera = useRef<CameraRef>(null);
  const annotation = useRef<ViewAnnotationRef>(null);
  const paint = useRef<{ frame: number } | null>(null);
  const [centeredToken, setCenteredToken] = useState<object | null>(null);
  const token = useMemo(() => ({}), [position?.latitude, position?.longitude, coarse, disabled]);
  const latest = useRef({ token, props }); latest.current = { token, props };
  // The neutral world viewport is an overview only. It never becomes a selected pin.
  const initial = useRef(pin ? { center: [pin.longitude, pin.latitude] as [number, number], zoom: coarse ? 10 : 15 }
    : { center: [0, 0] as [number, number], zoom: 1 });
  const owns = () => active.current && props.owns() && latest.current.token === token;
  const refreshMarker = () => {
    if (!owns() || !pin || load.current !== 'ready') return;
    if (paint.current) cancelAnimationFrame(paint.current.frame);
    const pending = { frame: 0 }; paint.current = pending;
    // Android snapshots annotation children offscreen. Refresh after their
    // native layout and paint, while retaining the existing draggable marker.
    pending.frame = requestAnimationFrame(() => {
      if (paint.current !== pending || !owns() || load.current !== 'ready') return;
      pending.frame = requestAnimationFrame(() => {
        if (paint.current !== pending || !owns() || load.current !== 'ready') return;
        paint.current = null; annotation.current?.refresh();
      });
    });
  };
  const mark = (next: MapStatus) => {
    if (!owns() || (next === 'ready' && load.current !== 'loading')) return;
    load.current = next; clearTimeout(timer.current); setStatus(next);
  };
  useEffect(() => {
    active.current = true;
    timer.current = setTimeout(() => {
      if (active.current && latest.current.props.owns() && load.current === 'loading') {
        load.current = 'failed'; setStatus('failed');
      }
    }, 15_000);
    return () => { active.current = false; clearTimeout(timer.current);
      if (paint.current) cancelAnimationFrame(paint.current.frame); paint.current = null; };
  }, []);
  useEffect(() => {
    if (pin && status === 'ready' && owns()) {
      camera.current?.jumpTo({ center: [pin.longitude, pin.latitude], zoom: coarse ? 10 : 15 });
      refreshMarker();
    }
  }, [pin?.latitude, pin?.longitude, coarse, status]);
  const observeCenter = (value: unknown) => {
    if (!owns() || !pin || load.current !== 'ready') return;
    const state = value as { center?: unknown; zoom?: unknown } | null;
    const center = Array.isArray(state?.center) && state.center.length === 2
      ? displayedPinPosition({ longitude: state.center[0], latitude: state.center[1] }) : null;
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
  // A drag must have started in this exact render and focused input scope.
  const drag = useRef<object | null>(null);
  return <View style={styles.container}>
    <View style={styles.frame}>
      <Map style={styles.map} mapStyle={RESOLVED_PIN_MAP_STYLE} androidView="texture"
        attribution attributionPosition={{ bottom: 8, right: 8 }} logo={false}
        touchPitch={false} touchRotate={false} accessibilityLabel={coarse ? 'Mapa približnog područja rada' : 'Mapa predložene lokacije'}
        onDidFinishLoadingMap={() => mark('ready')} onDidFailLoadingMap={() => mark('failed')}
        onRegionWillChange={() => { if (owns()) setCenteredToken(null); }}
        onRegionDidChange={event => observeCenter(event.nativeEvent)}
        onPress={event => choose(event.nativeEvent.lngLat)}>
        <Camera ref={camera} initialViewState={initial.current} minZoom={0} maxZoom={coarse ? 13 : 18} />
        {pin ? <ViewAnnotation ref={annotation} id="location-proposal" lngLat={[pin.longitude, pin.latitude]} anchor="bottom"
          draggable={!disabled && status === 'ready'}
          onDragStart={() => { drag.current = owns() && !disabled && load.current === 'ready' ? token : null; }}
          onDragEnd={event => {
            const started = drag.current; drag.current = null;
            if (started === token) choose(event.nativeEvent.lngLat);
          }}>
          <View collapsable={false} accessible={false} onLayout={refreshMarker} style={styles.marker}>
            <View style={styles.markerDot} /><View style={styles.markerTip} />
          </View>
        </ViewAnnotation> : null}
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
      <T accessibilityLiveRegion="polite" variant="meta" tone="muted">{centeredToken === token && status === 'ready'
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
  marker: { width: 44, height: 48, alignItems: 'center', paddingTop: 2 },
  markerDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 4, borderColor: palette.raised, backgroundColor: palette.orange },
  markerTip: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: palette.orange, marginTop: -3 },
});
