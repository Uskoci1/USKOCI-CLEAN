import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from './system/motion';
import { sys } from './system/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

export type HapticKind = 'none' | 'select' | 'light' | 'medium' | 'success' | 'error';

function fire(kind: HapticKind) {
  switch (kind) {
    case 'select':
      Haptics.selectionAsync();
      break;
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'medium':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'success':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'error':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
  }
}

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Koliko se skuplja pod prstom. 1 = bez skupljanja, za velike površine. */
  scaleTo?: number;
  /** Haptika ide na press-in, u istom kadru kad i vizuelni odziv. */
  haptic?: HapticKind;
  children?: React.ReactNode;
};

/**
 * Osnovna dodirna površina.
 *
 * Odziv ide na press-IN, ne kad se prst digne — to je kašnjenje koje se
 * zapravo oseti. Skupljanje nosi i tekst i ikonu sa sobom, zato deluje fizički.
 * Haptika se pali u istom trenutku kad i vizuelni odziv; ako kasni, čita se
 * kao greška a ne kao potvrda.
 *
 * Sve radi na UI niti — dodir ostaje gladak i kad JS radi nešto drugo.
 *
 * Kad je u sistemu uključeno „smanji pokret“, površina se ne skuplja uopšte: haptika i promena stanja ostaju,
 * pokret nestaje. Podešavanje se čita iz jednog izvora (ui/system/motion), pa važi i ako se promeni dok je
 * aplikacija otvorena.
 */
export function Press({
  style,
  scaleTo = sys.motion.pressScale,
  haptic = 'none',
  onPressIn,
  onPressOut,
  hitSlop,
  children,
  ...rest
}: Props) {
  const s = useSharedValue(1);
  const reduced = useReducedMotion();

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: s.get() }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      hitSlop={hitSlop ?? sys.touch.gap}
      style={[style, animated]}
      onPressIn={(e) => {
        if (!reduced) {
          s.set(withTiming(scaleTo, { duration: sys.motion.press, easing: EASE_OUT }));
        }
        if (haptic !== 'none') fire(haptic);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // Under reduced motion the surface is put back at once, even if the setting changed mid-press.
        s.set(
          reduced
            ? 1
            : withSpring(1, { ...sys.motion.spring, reduceMotion: ReduceMotion.System }),
        );
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
