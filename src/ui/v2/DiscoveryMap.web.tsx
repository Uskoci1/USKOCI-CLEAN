import { View } from 'react-native';
import type { DiscoveryMapProps } from './DiscoveryMap.types';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { v2 } from './tokens';
export function DiscoveryMap({ onList }: DiscoveryMapProps) {
  return <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center' }}>
    <T style={v2.text.title}>Mapa je dostupna u mobilnoj aplikaciji</T>
    <T style={v2.text.body}>Isti zadaci i izabrani filteri dostupni su u Listi.</T>
    <V2Action label="Pogledaj listu" onPress={onList} />
  </View>;
}
