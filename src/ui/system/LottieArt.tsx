import LottieView, { type AnimationObject } from 'lottie-react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';

/**
 * A Lottie animation the way this app is allowed to use one (owner approval of `lottie-react-native`,
 * 2026-09-23): for a character or a moment that means something — the AI assistant listening or
 * thinking, "Dogovoreno!", an empty state — never for a button or a fact.
 *
 * Two rules travel with it. Under the system's "reduce motion" the animation does not play; it
 * stands on its first frame, which every file we accept must be able to do (the V28 prototype's
 * five animations hid behind their own background circle; a file is checked on a phone before it
 * ships). And it is either spoken — one label saying what the picture shows — or invisible to a
 * screen reader; a decoration next to text is the latter.
 */
export function LottieArt({ source, size, loop = true, autoPlay = true, speed = 1, label, style }: {
  source: AnimationObject | { uri: string };
  /** Square edge in dp; a rectangular file gets `style` instead. */
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  speed?: number;
  /** What the picture shows, for a screen reader. Without it the animation is decoration and stays silent. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useSystemReducedMotion();
  const still = reduced || !autoPlay;
  return <LottieView
    source={source}
    autoPlay={!still}
    loop={!still && loop}
    speed={speed}
    {...(still ? { progress: 0 } : {})}
    accessible={!!label}
    accessibilityLabel={label}
    importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    style={[size ? { width: size, height: size } : null, style]} />;
}
