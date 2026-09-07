import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Map, Camera, GeoJSONSource, Layer, type CameraRef, type GeoJSONSourceRef } from '@maplibre/maplibre-react-native';
import { DISCOVERY_MAP_STYLE, type DiscoveryMapProps } from './DiscoveryMap.types';
import { MapFeedback } from './MapFeedback';

/** Native map renderer. All task data arrives through the public projection contract. */
function NativeMap({ scope, pins, selectedId, viewport, onSelect, onViewport, onList, onRetry }: DiscoveryMapProps & { onRetry: () => void }) {
  const camera = useRef<CameraRef>(null), source = useRef<GeoJSONSourceRef>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const active = useRef(true);
  const interaction = useRef(0), latestPins = useRef(pins);
  const latestScope = useRef(scope), motion = useRef<{ scope: typeof scope; epoch: number | null } | null>(null);
  latestPins.current = pins;
  latestScope.current = scope;
  const initial = useRef(viewport);
  useEffect(() => {
    active.current = true;
    const timer = setTimeout(() => setStatus(value => value === 'loading' ? 'failed' : value), 15000);
    return () => { active.current = false; interaction.current++; clearTimeout(timer); };
  }, []);
  return <View style={styles.frame}>
    <Map style={styles.map} mapStyle={DISCOVERY_MAP_STYLE} attribution attributionPosition={{ bottom: 8, right: 8 }}
      logo={false} touchPitch={false} touchRotate={false} accessibilityLabel="Mapa približnih područja zadataka"
      onDidFinishLoadingMap={() => { if (active.current) setStatus('ready'); }} onDidFailLoadingMap={() => { if (active.current) setStatus('failed'); }}
      onRegionWillChange={event => {
        motion.current = { scope, epoch: scope.capture() };
        if (event.nativeEvent.userInteraction) interaction.current++;
      }}
      onRegionDidChange={event => {
        const started = motion.current; motion.current = null;
        if (active.current && started?.scope === latestScope.current && started.scope.owns(started.epoch)) {
          onViewport({ center: event.nativeEvent.center, zoom: event.nativeEvent.zoom });
        }
      }}>
      <Camera ref={camera} initialViewState={initial.current} minZoom={2} maxZoom={16} />
      <GeoJSONSource ref={source} id="uskoci-public-tasks" data={pins} cluster clusterRadius={48} clusterMaxZoom={13}
        hitbox={{ top: 24, bottom: 24, left: 24, right: 24 }} onPress={event => {
          event.stopPropagation();
          const epoch = scope.capture();
          if (!active.current || latestScope.current !== scope || !scope.owns(epoch)) return;
          const request = ++interaction.current, ownedPins = pins;
          const owns = () => active.current && request === interaction.current && latestPins.current === ownedPins
            && latestScope.current === scope && scope.owns(epoch);
          const feature = event.nativeEvent.features[0];
          if (!feature || feature.geometry.type !== 'Point') return;
          const properties = feature.properties;
          if (typeof properties?.cluster_id === 'number') {
            const center: [number, number] = [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
            void source.current?.getClusterExpansionZoom(properties.cluster_id).then(zoom => {
              if (owns()) camera.current?.jumpTo({ center, zoom: Math.min(16, zoom) });
            }).catch(() => { if (owns()) setStatus('failed'); });
          } else if (typeof properties?.id === 'string' && pins.features.some(pin => pin.properties.id === properties.id)) onSelect(properties.id);
        }}>
        <Layer id="task-clusters" type="circle" filter={['has', 'point_count']}
          paint={{ 'circle-radius': 23, 'circle-color': '#142F30', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 }} />
        <Layer id="task-cluster-count" type="symbol" filter={['has', 'point_count']}
          layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 15, 'text-font': ['Noto Sans Bold'] }} paint={{ 'text-color': '#FFFFFF' }} />
        <Layer id="task-points" type="circle" filter={['!', ['has', 'point_count']]}
          paint={{ 'circle-radius': ['case', ['==', ['get', 'id'], selectedId ?? ''], 18, 14], 'circle-color': '#FA6B32', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 }} />
      </GeoJSONSource>
    </Map>
    {status !== 'ready' ? <MapFeedback failed={status === 'failed'} onRetry={onRetry} onList={onList} /> : null}
  </View>;
}

export function DiscoveryMap(props: DiscoveryMapProps) {
  const [attempt, setAttempt] = useState(0);
  return <NativeMap key={attempt} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}
const styles = StyleSheet.create({ frame: { height: 340, overflow: 'hidden', borderRadius: 24, backgroundColor: '#EDF0EA' }, map: { flex: 1 } });
