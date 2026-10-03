import { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

const SOURCE = require('../../../assets/illustrations/uskoci-work-kit-v1.png');

/** Decorative entry illustration, never a claim about the account's actual equipment or skills. */
export const WorkProfileArt = memo(function WorkProfileArt() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={{ width: 56, height: 56, flexShrink: 0 }}>
    <Image source={SOURCE} contentFit="contain" transition={0} cachePolicy="memory" allowDownscaling
      accessible={false} style={{ width: 56, height: 56 }} />
  </View>;
});
