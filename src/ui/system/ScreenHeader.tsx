import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { User, type Icon } from 'phosphor-react-native';
import { InboxBell } from '../InboxBell';
import { BrandMark } from '../entry/BrandAssets';
import { Press } from '../Press';
import { T } from '../Text';
import { iconButton, sys } from './tokens';

/** 44px icon control in a quiet well; `active` is shown by weight and colour together. */
export function HeaderIconButton({ label, hint, icon: IconComponent, active = false, onPress, children }: {
  label: string; hint?: string; icon: Icon; active?: boolean; onPress: () => void; children?: ReactNode;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ selected: active }}
    onPress={onPress} haptic="select" style={[iconButton, active && s.active]}>
    <IconComponent size={22} color={active ? sys.color.green : sys.color.ink} weight={active ? 'fill' : 'regular'} />
    {children}
  </Press>;
}

/**
 * Tab identity, screen context, inbox and the one profile for both intents.
 * `right` remains available to callers; marketplace view controls have their own compact row.
 */
export function ScreenHeader({ eyebrow, title, onProfile, right }: { eyebrow: string; title: string; onProfile: () => void; right?: ReactNode }) {
  return <View style={s.header}>
    <View accessible accessibilityRole="image" accessibilityLabel="USKOČI"><BrandMark size={38} /></View>
    <View style={s.copy}>
      <T variant="label" style={s.eyebrow}>{eyebrow}</T>
      <T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
    </View>
    {right}
    <InboxBell />
    <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={onProfile} haptic="select" style={[iconButton, s.profile]}>
      <User size={28} color={sys.color.green} />
    </Press>
  </View>;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 62, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  title: { color: sys.color.green },
  profile: { width: 48, height: 48, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft },
  active: { backgroundColor: sys.color.greenSoft },
});
