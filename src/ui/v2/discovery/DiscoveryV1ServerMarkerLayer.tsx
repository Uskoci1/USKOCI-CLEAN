import { memo, useEffect } from 'react';
import { PillAnnotation } from '../DiscoveryMap';
import type { DiscoveryV1MapMarker } from '../../../data/discoveryV1MarketplaceAdapter';
import { discoveryV1ServerMarkerSpecs } from '../../../data/discoveryV1ServerMarkerPresentation';
import { traceDiscoveryV1 } from '../../../data/discoveryV1Trace';

export type DiscoveryV1ServerMarkerLayerProps = {
  markers: readonly DiscoveryV1MapMarker[];
  selectedKey: string | null;
  nativeReady: boolean;
  owns: () => boolean;
  onSelect: (marker: DiscoveryV1MapMarker) => void;
};

export const DiscoveryV1ServerMarkerLayer = memo(function DiscoveryV1ServerMarkerLayer(props: DiscoveryV1ServerMarkerLayerProps) {
  const specs = discoveryV1ServerMarkerSpecs(props.markers, props.selectedKey);
  // DEV package only: how many pills this layer holds, and whether the native map could already draw them (bitmaps have no accessibility node).
  useEffect(() => { traceDiscoveryV1('markers', `${Math.min(specs.length, 9999)}/${props.nativeReady ? 1 : 0}`); }, [specs.length, props.nativeReady]);
  return <>{specs.map(spec => <PillAnnotation key={spec.id} id={spec.id} point={spec.point} label={spec.label}
    content={spec.content} selected={spec.selected} nativeReady={props.nativeReady} owns={props.owns}
    onPress={() => { if (props.owns()) props.onSelect(spec.marker); }} />)}</>;
});
