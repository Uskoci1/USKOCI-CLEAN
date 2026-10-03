import { Image } from 'expo-image';
import { View } from 'react-native';
import { FactArt } from './FactArt';

const SOURCE = require('../../../assets/illustrations/uskoci-tool-v1.png');

/** Decorative tool subject; adjacent text remains authoritative. Quiet states keep the existing vector. */
export function ToolArt({ size, quiet = false }: { size: 24 | 28 | 32; quiet?: boolean }) {
  if (quiet) return <FactArt kind="tool" size={size} cut="art" tone="quiet" />;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size }}>
    <Image source={SOURCE} style={{ width: size, height: size }} accessible={false}
      contentFit="contain" cachePolicy="memory" transition={0} allowDownscaling />
  </View>;
}
