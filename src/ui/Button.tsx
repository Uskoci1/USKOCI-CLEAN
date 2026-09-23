import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Press, type HapticKind } from './Press';
import { T } from './Text';
import { radius, space, touch } from '../theme/tokens';
import { sys } from './system/tokens';

type Kind = 'primary' | 'secondary' | 'quiet' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  /** Prati akciju, ne stoji uz nju kao ravnopravno. */
  meta?: string;
  icon?: React.ReactNode;
  full?: boolean;
  disabled?: boolean;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
};

/**
 * Jedan ekran ima jednu primarnu akciju. Ako ih ima pet, nema nijednu —
 * to je bila tačna zamerka na referencu, gde je pet identičnih narandžastih
 * dugmadi značilo da nijedno ne vodi.
 */
export function Button({
  label,
  onPress,
  kind = 'primary',
  meta,
  icon,
  full,
  disabled,
  haptic = 'light',
  style,
}: Props) {
  // The location screens still use this button. It looks exactly like V2Action: the primary green with a white
  // label, every other action white with a green label (the one rule for buttons).
  const skin = {
    primary: { bg: sys.color.green, border: 'transparent', tone: 'onGreen' as const },
    secondary: { bg: sys.color.surface, border: sys.color.lineStrong, tone: 'green' as const },
    quiet: { bg: 'transparent', border: 'transparent', tone: 'green' as const },
    danger: { bg: 'transparent', border: 'transparent', tone: 'danger' as const },
  }[kind];

  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      haptic={disabled ? 'none' : haptic}
      style={[
        {
          minHeight: touch.min,
          paddingHorizontal: space.base,
          borderRadius: radius.primary,
          backgroundColor: skin.bg,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: skin.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.42 : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {icon}
      <T variant="action" tone={skin.tone}>
        {label}
      </T>
      {meta ? (
        <T variant="meta" tone={skin.tone} style={{ opacity: 0.68 }}>
          {meta}
        </T>
      ) : null}
    </Press>
  );
}

/** Površina kartice. Odiže se od podloge za 0.087 svetline — vidi se da lebdi. */
export function Card({
  children,
  style,
  raised,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: sys.color.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: sys.color.cardLine,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
