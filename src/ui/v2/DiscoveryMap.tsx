import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Camera, GeoJSONSource, Layer, Map, ViewAnnotation, type CameraRef, type GeoJSONSourceRef } from '@maplibre/maplibre-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { MapPin } from 'phosphor-react-native';
import { publicFeatures, publicInitialBounds, publicPoint, publicViewport } from '../../data/marketplaceView';
import { RESOLVED_PIN_MAP_STYLE } from '../location/ResolvedPinMap.types';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from './V2Action';
import { v2 } from './tokens';
import type { DiscoveryMapProps } from './DiscoveryMap.types';

type Owner = { key: string; active: boolean; epoch: number };
/** Uses installed MapLibre v11 GeoJSON clustering; no map input becomes a business fact. */
function MapSession(props: DiscoveryMapProps & { owns: () => boolean; onRetry: () => void }) {
  const reduced = useReducedMotion(), camera = useRef<CameraRef>(null), source = useRef<GeoJSONSourceRef>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [viewport, setViewport] = useState(props.viewport);
  const mounted = useRef(true), load = useRef(status);
  const data = useMemo(() => publicFeatures(props.items), [props.items]);
  const dataKey = JSON.stringify(data), latest = useRef({ props, dataKey }); latest.current = { props, dataKey };
  const owns = () => mounted.current && props.owns() && latest.current.dataKey === dataKey;
  const initial = useRef(props.viewport ? { center: props.viewport.center, zoom: props.viewport.zoom }
    : data.features.length ? { bounds: publicInitialBounds(props.items)!, padding: { top: 75, right: 50, bottom: 80, left: 50 } }
      : { center: [0, 0] as [number, number], zoom: 1 }); // Neutral overview; never a selected point.
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => { if (mounted.current && props.owns() && load.current === 'loading') { load.current = 'failed'; setStatus('failed'); } }, 15_000);
    return () => { mounted.current = false; clearTimeout(timer); };
  }, []);
  const mark = (value: 'ready' | 'failed') => { if (!owns() || load.current === 'failed') return; load.current = value; setStatus(value); };
  const pressFeature = async (features: GeoJSON.Feature[]) => {
    if (!owns() || load.current !== 'ready' || !Array.isArray(features)) return;
    const feature = features[0]; if (!feature || feature.geometry?.type !== 'Point') return;
    const coordinates = feature.geometry.coordinates;
    if (coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return;
    const properties = feature.properties;
    if (properties?.cluster === true && Number.isInteger(properties.cluster_id)) {
      try {
        const zoom = await source.current?.getClusterExpansionZoom(properties.cluster_id);
        if (!owns() || load.current !== 'ready' || typeof zoom !== 'number' || !Number.isFinite(zoom)) return;
        const options = { center: [coordinates[0], coordinates[1]] as [number, number], zoom: Math.min(18, Math.max(0, zoom)) };
        if (reduced) camera.current?.jumpTo(options); else camera.current?.easeTo({ ...options, duration: v2.motion.screenMs });
      } catch { /* Native source may retire during a refresh; no invented selection. */ }
    } else if (typeof properties?.needId === 'string') {
      const actual = latest.current.props.items.find(item => item.id === properties.needId), point = actual && publicPoint(actual);
      if (point && coordinates[0] === point.lng && coordinates[1] === point.lat) latest.current.props.onSelect(actual.id);
    }
  };
  const selected = props.items.find(item => item.id === props.selectedId), point = selected && publicPoint(selected);
  const changeZoom = (delta: number) => { if (owns() && load.current === 'ready' && viewport) camera.current?.zoomTo(Math.min(18, Math.max(0, viewport.zoom + delta)), { duration: reduced ? 0 : v2.motion.screenMs }); };
  return <View style={s.container}>
    <Map style={s.map} mapStyle={RESOLVED_PIN_MAP_STYLE} androidView="texture" attribution attributionPosition={{ bottom: 8, right: 8 }} logo={false}
      touchPitch={false} touchRotate={false} accessibilityLabel="Mapa približnih lokacija Zadatka"
      onDidFinishLoadingMap={() => mark('ready')} onDidFailLoadingMap={() => mark('failed')}
      onRegionDidChange={event => { if (!owns() || load.current !== 'ready') return; const value = publicViewport(event.nativeEvent); setViewport(value); if (value) latest.current.props.onViewport(value); }}>
      <Camera ref={camera} initialViewState={initial.current} minZoom={0} maxZoom={18} />
      <GeoJSONSource id="public-needs" ref={source} data={data} cluster clusterRadius={48} clusterMaxZoom={16}
        onPress={event => { event.stopPropagation(); void pressFeature(event.nativeEvent.features); }}>
        <Layer id="need-clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-radius': 23, 'circle-color': v2.color.ink, 'circle-stroke-width': 3, 'circle-stroke-color': v2.color.surface }} />
        <Layer id="need-cluster-count" type="symbol" filter={['has', 'point_count']}
          layout={{ 'text-field': ['to-string', ['get', 'point_count_abbreviated']], 'text-size': 14, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true }} paint={{ 'text-color': v2.color.surface }} />
        <Layer id="need-pins" type="circle" filter={['!', ['has', 'point_count']]}
          paint={{ 'circle-radius': ['case', ['==', ['get', 'needId'], props.selectedId ?? ''], 23, 19], 'circle-color': v2.color.ink,
            'circle-stroke-width': 3, 'circle-stroke-color': ['case', ['==', ['get', 'needId'], props.selectedId ?? ''], v2.color.orange, v2.color.surface] }} />
        <Layer id="need-pin-centers" type="circle" filter={['!', ['has', 'point_count']]}
          paint={{ 'circle-radius': 5, 'circle-color': v2.color.surface }} />
      </GeoJSONSource>
      {point && selected ? <ViewAnnotation id="selected-need" lngLat={[point.lng, point.lat]} anchor="center">
        <View collapsable={false} accessible accessibilityLabel={`${selected.naslov}, približna lokacija`} style={s.selectedPin}>
          <MapPin size={23} color={v2.color.surface} />
        </View>
      </ViewAnnotation> : null}
    </Map>
    {status === 'ready' ? <>
      <View style={s.area}><V2Action label="Pretraži ovu oblast" disabled={!viewport} onPress={() => { if (owns() && viewport) props.onSearchArea(viewport.bounds); }} /></View>
      <View style={s.zoom}>{[['Uvećaj mapu', '+', 1], ['Umanji mapu', '−', -1]].map(([label, text, delta]) => <Press key={String(label)} accessibilityRole="button" accessibilityLabel={String(label)}
        accessibilityState={{ disabled: !viewport }} disabled={!viewport} haptic="select" onPress={() => changeZoom(Number(delta))} style={s.zoomButton}><T style={s.zoomText}>{text}</T></Press>)}</View>
    </> : <View style={s.feedback}>{status === 'loading' ? <><ActivityIndicator color={v2.color.teal} /><T style={v2.text.body}>Učitavamo mapu…</T></>
      : <><T accessibilityRole="alert" style={v2.text.title}>Mapa nije učitana</T><T style={v2.text.body}>Proverite vezu. Zadaci i filteri ostaju u Listi.</T>
        <V2Action label="Pokušaj ponovo sa mapom" onPress={() => { if (owns()) props.onRetry(); }} />
        <V2Action label="Pogledaj listu" onPress={props.onList} /></>}</View>}
    <View style={s.attribution}><T style={s.credit} accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {}); }}>© OpenStreetMap</T>
      <T style={s.credit} accessibilityRole="link" onPress={() => { void Linking.openURL('https://openfreemap.org/').catch(() => {}); }}>OpenFreeMap</T></View>
  </View>;
}
export function DiscoveryMap(props: DiscoveryMapProps) {
  const [owner, setOwner] = useState<Owner | null>(null), [attempt, setAttempt] = useState(0);
  const current = useRef<Owner | null>(null), epoch = useRef(0), latestKey = useRef(props.scopeKey); latestKey.current = props.scopeKey;
  useFocusEffect(useCallback(() => {
    const scope = { active: true, key: props.scopeKey, epoch: ++epoch.current }; current.current = scope; setOwner(scope);
    return () => { scope.active = false; if (current.current === scope) current.current = null; };
  }, [props.scopeKey]));
  if (!owner?.active || owner.key !== props.scopeKey || current.current !== owner) return <View style={s.feedback}><T>Mapa je dostupna dok je ovaj pregled otvoren.</T></View>;
  const owns = () => current.current === owner && owner.active && latestKey.current === owner.key;
  return <MapSession key={`${owner.epoch}:${attempt}`} {...props} owns={owns} onRetry={() => { if (owns()) setAttempt(value => value + 1); }} />;
}
const s = StyleSheet.create({ container: { flex: 1, minHeight: 180, backgroundColor: v2.color.soft }, map: { flex: 1 },
  area: { position: 'absolute', top: 12, left: 16, right: 76 }, zoom: { position: 'absolute', top: 12, right: 12, gap: 6 },
  zoomButton: { minWidth: 44, minHeight: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center', backgroundColor: v2.color.surface },
  zoomText: { fontSize: 25, color: v2.color.ink }, selectedPin: { width: 48, height: 48, borderRadius: 15, borderBottomLeftRadius: 5,
    borderWidth: 3, borderColor: v2.color.orange, backgroundColor: v2.color.ink, alignItems: 'center', justifyContent: 'center' },
  feedback: { ...StyleSheet.absoluteFill, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: v2.color.canvas },
  attribution: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: v2.color.surface, padding: 4 },
  credit: { ...v2.text.label, fontSize: 10, color: v2.color.muted },
});
