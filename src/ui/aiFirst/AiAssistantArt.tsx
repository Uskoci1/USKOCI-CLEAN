import { memo, useEffect, useRef, type MutableRefObject } from 'react';
import { Animated, AppState, Easing, View } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

const SOURCE = require('../../../assets/ai/uskoci-assistant.png');

/** Existing USKOČI robot identity, shared by task and work-profile interviews.
 * Static art identifies the assistant; it never signals capture, speech or a completed action. */
export const AiAssistantArt = memo(function AiAssistantArt({ size }: { size: 24 | 88 }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={{ width: size, height: size, flexShrink: 0 }}>
    <Image source={SOURCE} contentFit="contain" transition={0} cachePolicy="memory" allowDownscaling
      accessible={false} style={{ width: size, height: size }} />
  </View>;
});

export type AssistantWelcomeMemory = { key: string | undefined; consumed: boolean };

/** One short opacity arrival for an empty conversation. Not a hand-wave or listening animation.
 * The shell owns the memory so hiding the opening for the keyboard cannot replay it. */
export function AiAssistantWelcome({ conversationKey, memory }: {
  conversationKey?: string;
  memory: MutableRefObject<AssistantWelcomeMemory>;
}) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const first = memory.current.key !== conversationKey || !memory.current.consumed;
    memory.current = { key: conversationKey, consumed: true };
    opacity.stopAnimation(); opacity.setValue(1);
    if (!first || reduced || AppState.currentState !== 'active') return;
    opacity.setValue(0);
    // Follow the app's B22 native-driver policy; no Reanimated view lifecycle or per-frame JS.
    const run = Animated.timing(opacity, { toValue: 1, duration: sys.motion.enter,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true, isInteraction: false });
    const settle = () => { run.stop(); opacity.setValue(1); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') settle(); });
    run.start();
    return () => { subscription.remove(); settle(); };
  }, [conversationKey, memory, opacity, reduced]);
  return <Animated.View style={{ opacity }}><AiAssistantArt size={88} /></Animated.View>;
}
