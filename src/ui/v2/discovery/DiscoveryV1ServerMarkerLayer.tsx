import { memo, useEffect, useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { DiscoveryV1MapMarker } from '../../../data/discoveryV1MarketplaceAdapter';
import { discoveryV1ServerMarkerSpecs } from '../../../data/discoveryV1ServerMarkerPresentation';
import { traceDiscoveryV1 } from '../../../data/discoveryV1Trace';
import { sys } from '../../system/tokens';

export type DiscoveryV1ServerMarkerLayerProps = {
  markers: readonly DiscoveryV1MapMarker[];
  selectedKey: string | null;
  onSelect: (marker: DiscoveryV1MapMarker) => void;
};

export const SERVER_MARKER_SOURCE_ID = 'p6-buckets';

/**
 * The server's MAP buckets as native map layers: one GeoJSON point per bucket, drawn on the GL surface with the same circle/count/mark
 * layers the legacy clusters and fallback pins use. A bucket is at most 256 points, and a view annotation (a bitmap of a React view) is
 * the wrong tool for that many: it needs its child laid out inside an offscreen container and snapshot again on every change, and on the
 * emulator none was ever drawn. A layer has no such dependency, survives a style swap (the source is added to the new style), and needs
 * no accessibility node of its own: the list beside the map stays the readable path to every task.
 *
 * TASK: a white disc with the USKOČI mark. PLACE (several tasks on one public point): a green disc with its count. CLUSTER (an area):
 * a white disc with a green ring and its count. The chosen bucket has an orange halo behind it.
 */
export const DiscoveryV1ServerMarkerLayer = memo(function DiscoveryV1ServerMarkerLayer(props: DiscoveryV1ServerMarkerLayerProps) {
  // Validates the bound and the keys (a duplicate or an oversized set is refused, never truncated).
  const specs = discoveryV1ServerMarkerSpecs(props.markers, props.selectedKey);
  const byKey = useMemo(() => new Map(props.markers.map(marker => [marker.key, marker] as const)), [props.markers]);
  const data = useMemo(() => JSON.stringify({ type: 'FeatureCollection', features: props.markers.map(marker => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [marker.point.lng, marker.point.lat] },
    properties: { key: marker.key, kind: marker.kind, count: marker.taskCount },
  })) }), [props.markers]);
  // DEV package only: how many buckets are on the native map.
  useEffect(() => { traceDiscoveryV1('markers', `${Math.min(specs.length, 9999)}/1`); }, [specs.length]);
  return <GeoJSONSource id={SERVER_MARKER_SOURCE_ID} data={data} hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }}
    onPress={event => {
      event.stopPropagation();
      const key = event.nativeEvent?.features?.[0]?.properties?.key;
      const marker = typeof key === 'string' ? byKey.get(key) : undefined;
      if (marker) props.onSelect(marker);
    }}>
    <Layer id="p6-halo" type="circle" filter={['==', ['get', 'key'], props.selectedKey ?? '']}
      paint={{ 'circle-radius': 27, 'circle-color': sys.color.orangeHalo, 'circle-opacity': 0.9 }} />
    <Layer id="p6-discs" type="circle"
      paint={{ 'circle-radius': ['case', ['==', ['get', 'kind'], 'TASK'], 16, 20],
        'circle-color': ['case', ['==', ['get', 'kind'], 'PLACE'], sys.color.green, sys.color.surface],
        'circle-stroke-width': 2, 'circle-stroke-color': sys.color.green }} />
    <Layer id="p6-counts" type="symbol" filter={['!=', ['get', 'kind'], 'TASK']}
      layout={{ 'text-field': ['to-string', ['get', 'count']], 'text-size': 14, 'text-font': ['literal', ['Noto Sans Regular']], 'text-allow-overlap': true }}
      paint={{ 'text-color': ['case', ['==', ['get', 'kind'], 'PLACE'], sys.color.surface, sys.color.green] }} />
    <Layer id="p6-marks" type="symbol" filter={['==', ['get', 'kind'], 'TASK']}
      layout={{ 'icon-image': 'uskoci-task', 'icon-size': 30 / 640, 'icon-allow-overlap': true, 'icon-ignore-placement': true }} />
  </GeoJSONSource>;
});
