import { Image } from 'expo-image';
import { View } from 'react-native';
import { FactArt } from './FactArt';

const SOURCE = require('../../../assets/illustrations/uskoci-people-v2.png');

/** Team subject only; the number of illustrated figures is not an authoritative capacity or identity. */
export function PeopleArt({ size, quiet = false }: { size: 24 | 28; quiet?: boolean }) {
  // Preserve the legible quiet vector; never tint material artwork into a new state meaning.
  if (quiet) return <FactArt kind="users" size={size} cut="art" tone="quiet" />;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size }}>
    <Image source={SOURCE} style={{ width: size, height: size }} accessible={false}
      contentFit="contain" cachePolicy="memory" transition={0} allowDownscaling />
  </View>;
}
