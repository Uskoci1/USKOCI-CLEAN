import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { User, type Icon } from 'phosphor-react-native';
import { InboxBell } from '../InboxBell';
import { BrandLockup } from '../entry/BrandAssets';
import { Press } from '../Press';
import { iconButton, sys } from './tokens';

/** 44px icon control in a quiet well; `active` is shown by weight and colour together. */
export function HeaderIconButton({ label, hint, icon: IconComponent, active = false, onPress, children }: {
  label: string; hint?: string; icon: Icon; active?: boolean; onPress: () => void; children?: ReactNode;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ selected: active }}
    onPress={onPress} haptic="select" style={[iconButton, s.round, active && s.active]}>
    <IconComponent size={22} color={active ? sys.color.green : sys.color.ink} weight={active ? 'fill' : 'regular'} />
    {children}
  </Press>;
}

/**
 * The one header of the three tabs (V41, owner 2026-09-23): the profile on the left, the USKOČI mark in the middle,
 * the inbox on the right, and nothing between them. The tab bar already says which part of the app this is, so no
 * section title or eyebrow is drawn (V41 audit N01/N02: one header system, fewer rows before the content). The
 * section's name still reaches a screen reader as the header's label. `right` holds at most one screen control,
 * drawn before the bell.
 */
export function ScreenHeader({ title, onProfile, right }: {
  /** Kept for callers; not drawn. */
  eyebrow?: string; title: string; onProfile: () => void; right?: ReactNode;
}) {
  return <View style={s.header}>
    <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={onProfile} haptic="select" style={s.avatar}>
      <User size={22} weight="bold" color={sys.color.green} />
    </Press>
    {/* Centred on the screen, not between the two sides, so it never shifts when the right side holds two controls. */}
    <View pointerEvents="none" style={s.brand}>
      <View accessible accessibilityRole="header" accessibilityLabel={`USKOČI, ${title}`}><BrandLockup width={112} /></View>
    </View>
    <View style={s.side}>
      {right}
      <InboxBell />
    </View>
  </View>;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, borderWidth: 1, borderColor: sys.color.line,
    alignItems: 'center', justifyContent: 'center' },
  brand: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 8 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: { borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line },
  active: { backgroundColor: sys.color.greenSoft },
});
