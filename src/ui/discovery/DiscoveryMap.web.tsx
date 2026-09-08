import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GeoJSONSource, Map as MapInstance } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DISCOVERY_MAP_STYLE, type DiscoveryMapProps } from './DiscoveryMap.types';
import { MapFeedback } from './MapFeedback';

export function DiscoveryMap(props: DiscoveryMapProps) {
  const container = useRef<HTMLDivElement>(null), map = useRef<MapInstance | null>(null);
  const latest = useRef(props); latest.current = props;
  const [attempt, setAttempt] = useState(0), [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    let active = true;
    let interaction = 0;
    let motion: { scope: DiscoveryMapProps['scope']; epoch: number | null } | null = null;
    setStatus('loading');
    const timer = setTimeout(() => { if (active) setStatus(value => value === 'loading' ? 'failed' : value); }, 15000);
    void import('maplibre-gl').then(({ Map, NavigationControl }) => {
      if (!active || !container.current) return;
      const view = latest.current.viewport;
      const instance = new Map({ container: container.current, style: DISCOVERY_MAP_STYLE, center: view.center, zoom: view.zoom,
        minZoom: 2, maxZoom: 16, attributionControl: { compact: false }, dragRotate: false, pitchWithRotate: false,
        locale: { 'Map.Title': 'Mapa približnih područja zadataka', 'NavigationControl.ZoomIn': 'Uvećajte mapu', 'NavigationControl.ZoomOut': 'Umanjite mapu' } });
      map.current = instance;
      instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      instance.on('load', () => {
        if (!active) return;
        instance.addSource('uskoci-public-tasks', { type: 'geojson', data: latest.current.pins, cluster: true, clusterRadius: 48, clusterMaxZoom: 13 });
        instance.addLayer({ id: 'task-clusters', type: 'circle', source: 'uskoci-public-tasks', filter: ['has', 'point_count'],
          paint: { 'circle-radius': 23, 'circle-color': '#142F30', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
        instance.addLayer({ id: 'task-cluster-count', type: 'symbol', source: 'uskoci-public-tasks', filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 15, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#FFFFFF' } });
        instance.addLayer({ id: 'task-points', type: 'circle', source: 'uskoci-public-tasks', filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': ['case', ['==', ['get', 'id'], latest.current.selectedId ?? ''], 18, 14],
            'circle-color': '#FA6B32', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
        setStatus('ready'); clearTimeout(timer);
      });
      instance.on('click', 'task-points', event => {
        interaction++;
        const id = event.features?.[0]?.properties?.id;
        const scope = latest.current.scope;
        if (active && scope.owns(scope.capture()) && typeof id === 'string'
          && latest.current.pins.features.some(pin => pin.properties.id === id)) latest.current.onSelect(id);
      });
      instance.on('click', 'task-clusters', event => {
        const scope = latest.current.scope, epoch = scope.capture();
        if (!scope.owns(epoch)) return;
        const request = ++interaction, ownedPins = latest.current.pins;
        const owns = () => active && request === interaction && latest.current.pins === ownedPins
          && latest.current.scope === scope && scope.owns(epoch);
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== 'Point' || typeof feature.properties?.cluster_id !== 'number') return;
        const center: [number, number] = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
        void (instance.getSource('uskoci-public-tasks') as GeoJSONSource).getClusterExpansionZoom(feature.properties.cluster_id).then(zoom => {
          if (owns()) instance.jumpTo({ center, zoom: Math.min(16, zoom) });
        }).catch(() => { if (owns()) setStatus('failed'); });
      });
      instance.on('movestart', event => {
        const scope = latest.current.scope; motion = { scope, epoch: scope.capture() };
        if (event.originalEvent) interaction++;
      });
      instance.on('moveend', () => {
        const started = motion; motion = null;
        if (active && started?.scope === latest.current.scope && started.scope.owns(started.epoch)) {
          const center = instance.getCenter(); latest.current.onViewport({ center: [center.lng, center.lat], zoom: instance.getZoom() });
        }
      });
      instance.on('error', () => { if (active) setStatus('failed'); });
    }).catch(() => { if (active) setStatus('failed'); });
    return () => { active = false; clearTimeout(timer); map.current?.remove(); map.current = null; };
  }, [attempt]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !instance.getSource('uskoci-public-tasks')) return;
    (instance.getSource('uskoci-public-tasks') as GeoJSONSource).setData(props.pins);
    instance.setPaintProperty('task-points', 'circle-radius', ['case', ['==', ['get', 'id'], props.selectedId ?? ''], 18, 14]);
  }, [props.pins, props.selectedId, status]);
  return <View style={styles.frame}>
    <div ref={container} aria-label="Mapa približnih područja zadataka" style={{ width: '100%', height: '100%' }} />
    {status !== 'ready' ? <MapFeedback failed={status === 'failed'} onRetry={() => setAttempt(value => value + 1)} onList={props.onList} /> : null}
  </View>;
}
const styles = StyleSheet.create({ frame: { height: 340, borderRadius: 24, overflow: 'hidden', backgroundColor: '#EDF0EA' } });
