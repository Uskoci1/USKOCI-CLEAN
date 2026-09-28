import type { DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import { zadataka } from '../ui/system/plural';

export type DiscoveryV1ServerMarkerSpec = {
  id: string;
  marker: DiscoveryV1MapMarker;
  point: DiscoveryV1MapMarker['point'];
  label: string;
  content: { text: string; tone: 'count'; spoken: string };
  selected: boolean;
};

const labelFor = (marker: DiscoveryV1MapMarker) => marker.kind === 'TASK'
  ? 'Jedan zadatak na mapi'
  : marker.kind === 'PLACE' ? zadataka(marker.taskCount) + ' na ovom mestu'
    : zadataka(marker.taskCount) + ' u ovoj oblasti';

export function discoveryV1ServerMarkerSpecs(markers: readonly DiscoveryV1MapMarker[], selectedKey: string | null)
  : DiscoveryV1ServerMarkerSpec[] {
  if (markers.length > 256) throw new Error('DISCOVERY_V1_SERVER_MARKER_BOUND');
  const keys = new Set<string>();
  return markers.map(marker => {
    if (keys.has(marker.key)) throw new Error('DISCOVERY_V1_SERVER_MARKER_DUPLICATE');
    keys.add(marker.key);
    const label = labelFor(marker);
    return { id: 'p6:' + marker.key, marker, point: { ...marker.point }, label,
      content: { text: zadataka(marker.taskCount), tone: 'count', spoken: label }, selected: selectedKey === marker.key };
  });
}
