import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';

/**
 * Shared action. Reuses existing UI-thread press feedback, system reduced motion and haptics.
 * Kinds: primary = strong ink surface; secondary = white with a line; quiet = green text
 * (a link-like action); destructive = danger text. The one brand action on a screen is a
 * secondary with `brandAction` style (orange surface, ink text — white on orange fails AA).
 */
export function V2Action({ label, onPress, disabled = false, kind = 'secondary', icon, style, compact = false }: {
  label: string; onPress: () => void; disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode; style?: StyleProp<ViewStyle>;
  /** Smaller type for a secondary control that must not compete with the content. The
   *  touch target keeps its full minimum height, so it is no harder to hit. */
  compact?: boolean;
}) {
  const color = kind === 'primary' ? sys.color.surface : kind === 'destructive' ? sys.color.danger : kind === 'quiet' ? sys.color.green : sys.color.ink;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    onPress={onPress} disabled={disabled} haptic={disabled ? 'none' : kind === 'primary' ? 'light' : 'select'}
    style={[{ minHeight: kind === 'primary' ? 50 : sys.touch.min, borderRadius: sys.radius.control,
      paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, gap: sys.space.sm,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: kind === 'primary' ? sys.color.ink : kind === 'secondary' ? sys.color.surface : 'transparent',
      borderWidth: kind === 'secondary' ? 1 : 0, borderColor: sys.color.lineStrong, opacity: disabled ? 0.45 : 1 }, style]}>
    {icon}<T variant={compact ? 'meta' : 'action'} style={{ flexShrink: 1, textAlign: 'center', color }}>{label}</T>
  </Press>;
}
