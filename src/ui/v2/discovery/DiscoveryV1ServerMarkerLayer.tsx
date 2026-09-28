import { memo } from 'react';
import { PillAnnotation } from '../DiscoveryMap';
import type { DiscoveryV1MapMarker } from '../../../data/discoveryV1MarketplaceAdapter';
import { discoveryV1ServerMarkerSpecs } from '../../../data/discoveryV1ServerMarkerPresentation';

export type DiscoveryV1ServerMarkerLayerProps = {
  markers: readonly DiscoveryV1MapMarker[];
  selectedKey: string | null;
  nativeReady: boolean;
  owns: () => boolean;
  onSelect: (marker: DiscoveryV1MapMarker) => void;
};

export const DiscoveryV1ServerMarkerLayer = memo(function DiscoveryV1ServerMarkerLayer(props: DiscoveryV1ServerMarkerLayerProps) {
  const specs = discoveryV1ServerMarkerSpecs(props.markers, props.selectedKey);
  return <>{specs.map(spec => <PillAnnotation key={spec.id} id={spec.id} point={spec.point} label={spec.label}
    content={spec.content} selected={spec.selected} nativeReady={props.nativeReady} owns={props.owns}
    onPress={() => { if (props.owns()) props.onSelect(spec.marker); }} />)}</>;
});
