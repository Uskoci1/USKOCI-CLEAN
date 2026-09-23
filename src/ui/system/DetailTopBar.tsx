import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { iconButton, sys } from './tokens';

export type EyebrowTone = 'green' | 'warn' | 'muted' | 'danger';

/**
 * Top bar of a screen you arrived at from somewhere else: the arrow back, the screen's name, and at
 * most one action on the right. `ScreenHeader` is the tab version (bell and avatar instead of the
 * arrow), and `ProductHeader` draws this same anatomy for the product screens.
 *
 * The eyebrow — the small word above the title saying which part of the app this screen belongs
 * to — is no longer drawn. The owner's rule (2026-09-23): a person who opened a task knows they
 * opened a task; the screen does not explain where they are. Its props stay so callers need not
 * change; a caller that has real information to add puts it in the content, not the bar.
 */
export function DetailTopBar({ title, onBack, backLabel = 'Nazad', disabled = false, right }: {
  /** Kept for callers; not drawn. */
  eyebrow?: string; title: string; onBack: () => void; backLabel?: string; tone?: EyebrowTone;
  disabled?: boolean; right?: ReactNode;
}) {
  return <View style={s.bar}>
    <Press accessibilityRole="button" accessibilityLabel={backLabel} disabled={disabled} accessibilityState={{ disabled }}
      onPress={onBack} haptic="select" style={iconButton}><ArrowLeft size={22} color={sys.color.ink} /></Press>
    <View style={s.copy}><T accessibilityRole="header" variant="title" style={s.title}>{title}</T></View>
    {right}
  </View>;
}

/** One inner bar for the whole app; ProductHeader reads these numbers too. */
export const innerBar = { minHeight: 56, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row' as const, gap: 12, alignItems: 'center' as const };

const s = StyleSheet.create({
  bar: innerBar,
  copy: { flex: 1, minWidth: 0 },
  title: { color: sys.color.ink },
});
