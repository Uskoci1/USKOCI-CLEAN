import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { iconButton, sys } from './tokens';

export type EyebrowTone = 'green' | 'warn' | 'muted' | 'danger';
const toneColor: Record<EyebrowTone, string> = {
  green: sys.color.green, warn: sys.color.warn, muted: sys.color.muted, danger: sys.color.danger,
};

/**
 * Top bar of a screen you arrived at from somewhere else.
 *
 * `ScreenHeader` is the tab version of this: same eyebrow, same title, bell and avatar instead of a
 * back button. Every pushed screen was drawing its own — thirteen of them, agreeing on the idea and
 * disagreeing on the numbers, so nothing in the app lined up at the top edge. The eyebrow is the
 * first line of the screen anatomy: the small word saying what this screen belongs to, which is why
 * the title underneath never has to repeat it. It carries a tone because on the Dogovor it also
 * carries the state — waiting is not the same colour as agreed.
 */
export function DetailTopBar({ eyebrow, title, onBack, backLabel = 'Nazad', tone = 'muted', disabled = false, right }: {
  eyebrow?: string; title: string; onBack: () => void; backLabel?: string; tone?: EyebrowTone;
  disabled?: boolean; right?: ReactNode;
}) {
  return <View style={s.bar}>
    <Press accessibilityRole="button" accessibilityLabel={backLabel} disabled={disabled} accessibilityState={{ disabled }}
      onPress={onBack} haptic="select" style={iconButton}><ArrowLeft size={22} color={sys.color.ink} /></Press>
    <View style={s.copy}>
      {eyebrow ? <T variant="label" style={[s.eyebrow, { color: toneColor[tone] }]}>{eyebrow}</T> : null}
      <T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
    </View>
    {right}
  </View>;
}

const s = StyleSheet.create({
  bar: { minHeight: 62, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', gap: 10, alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  title: { color: sys.color.ink },
});
