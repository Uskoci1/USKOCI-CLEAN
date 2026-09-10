import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { v2 } from './tokens';

/** Reuses existing UI-thread press feedback, system reduced motion and haptics. */
export function V2Action({ label, onPress, disabled = false, kind = 'secondary', icon, style }: {
  label: string; onPress: () => void; disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    onPress={onPress} disabled={disabled} haptic={disabled ? 'none' : kind === 'primary' ? 'light' : 'select'}
    style={[{ minHeight: kind === 'primary' ? v2.target.primary : v2.target.minimum, borderRadius: v2.radius.button,
      paddingHorizontal: v2.space.md, paddingVertical: v2.space.sm, gap: v2.space.sm,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: kind === 'primary' ? v2.color.ink : kind === 'secondary' ? v2.color.surface : 'transparent',
      borderWidth: kind === 'secondary' ? 1 : 0, borderColor: v2.color.line, opacity: disabled ? 0.45 : 1 }, style]}>
    {icon}<T style={[v2.text.body, { fontSize: 14, lineHeight: 20, fontWeight: '700', flexShrink: 1,
      color: kind === 'primary' ? v2.color.surface : kind === 'destructive' ? v2.color.danger : v2.color.ink }]}>{label}</T>
  </Press>;
}
