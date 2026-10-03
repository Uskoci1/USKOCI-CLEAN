import { Image } from 'expo-image';
import { View } from 'react-native';
import { FactArt } from './FactArt';

const SOURCE = require('../../../assets/illustrations/uskoci-calendar-v1.png');

/** Decorative date subject only: no selected day, actual date or confirmation is baked into the image. */
export function CalendarArt({ size, quiet = false }: { size: 24 | 28; quiet?: boolean }) {
  // Keep the existing legible quiet drawing for disabled/historic facts; tinting the bitmap would erase its cells.
  if (quiet) return <FactArt kind="calendar" size={size} cut="art" tone="quiet" />;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size }}>
    <Image source={SOURCE} style={{ width: size, height: size }} accessible={false}
      contentFit="contain" cachePolicy="memory" transition={0} allowDownscaling />
  </View>;
}
