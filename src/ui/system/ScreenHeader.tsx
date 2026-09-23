import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { User, type Icon } from 'phosphor-react-native';
import { InboxBell } from '../InboxBell';
import { Press } from '../Press';
import { T } from '../Text';
import { accountButton, iconButton, sys } from './tokens';

/** Shared 48dp icon control. Selected state is expressed by colour and weight, not a second badge. */
export function HeaderIconButton({ label, hint, icon: IconComponent, active = false, onPress, children }: {
  label: string; hint?: string; icon: Icon; active?: boolean; onPress: () => void; children?: ReactNode;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ selected: active }}
    onPress={onPress} haptic="select" style={[iconButton, active && s.active]}>
    <IconComponent size={24} color={active ? sys.color.green : sys.color.ink} weight={active ? 'fill' : 'regular'} />
    {children}
  </Press>;
}

/**
 * Shared top chrome for primary list surfaces.
 *
 * The account entry is stable on the left and the inbox is stable on the right. Screen identity
 * stays in the middle; optional view controls are grouped after the title without changing the
 * meaning of the account or inbox controls. There is no global role/intent switch here.
 */
export function ScreenHeader({ eyebrow, title, onProfile, right }: { eyebrow: string; title: string; onProfile: () => void; right?: ReactNode }) {
  return <View style={s.header}>
    <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={onProfile} haptic="select" style={accountButton}>
      <User size={25} color={sys.color.green} weight="bold" />
    </Press>
    <View style={s.copy}>
      <T variant="label" style={s.eyebrow} numberOfLines={1}>{eyebrow}</T>
      <T accessibilityRole="header" variant="title" style={s.title} numberOfLines={2}>{title}</T>
    </View>
    {right ? <View style={s.tools}>{right}</View> : null}
    <InboxBell />
  </View>;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 72, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  copy: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
  eyebrow: { color: sys.color.muted, fontWeight: '600', letterSpacing: 0.25, marginBottom: 1 },
  title: { color: sys.color.ink },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  active: { backgroundColor: sys.color.greenSoft },
});
