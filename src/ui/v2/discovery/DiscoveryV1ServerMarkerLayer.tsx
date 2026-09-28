import { memo } from 'react';
import { PillAnnotation } from '../DiscoveryMap';
import type { DiscoveryV1MapMarker } from '../../../data/discoveryV1MarketplaceAdapter';
import { zadataka } from '../../system/plural';

export type DiscoveryV1ServerMarkerLayerProps = {
  markers: readonly DiscoveryV1MapMarker[];
  selectedKey: string | null;
  nativeReady: boolean;
  owns: () => boolean;
  onSelect: (marker: DiscoveryV1MapMarker) => void;
};

const labelFor = (marker: DiscoveryV1MapMarker) => marker.kind === 'TASK'
  ? 'Jedan zadatak na mapi'
  : marker.kind === 'PLACE' ? zadataka(marker.taskCount) + ' na ovom mestu'
    : zadataka(marker.taskCount) + ' u ovoj oblasti';

export const DiscoveryV1ServerMarkerLayer = memo(function DiscoveryV1ServerMarkerLayer(props: DiscoveryV1ServerMarkerLayerProps) {
  if (props.markers.length > 256) throw new Error('DISCOVERY_V1_SERVER_MARKER_BOUND');
  const keys = new Set<string>();
  return <>{props.markers.map(marker => {
    if (keys.has(marker.key)) throw new Error('DISCOVERY_V1_SERVER_MARKER_DUPLICATE');
    keys.add(marker.key);
    const label = labelFor(marker), selected = props.selectedKey === marker.key;
    return <PillAnnotation key={marker.key} id={'p6:' + marker.key} point={marker.point} label={label}
      content={{ text: zadataka(marker.taskCount), tone: 'count', spoken: label }} selected={selected}
      nativeReady={props.nativeReady} owns={props.owns}
      onPress={() => { if (props.owns()) props.onSelect(marker); }} />;
  })}</>;
});
