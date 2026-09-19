import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { User, type Icon } from 'phosphor-react-native';
import { InboxBell } from '../InboxBell';
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
 * Top bar of a tab surface (V5 head): a quiet eyebrow that names the intent you are in (owner
 * decision 2, 2026-09-16), the screen title, bell to the inbox, avatar to the profile.
 *
 * `right` is for the controls that narrow what the screen shows — search, filters, the worker
 * calendar. They used to sit in a row beside the segmented control, which left the segment 217dp on
 * a 361dp phone: enough at the default text size and not enough once the reader has enlarged it, so
 * a section was cut through the middle. Up here they cost no vertical band at all, and the segment
 * has its row to itself at every text size.
 */
export function ScreenHeader({ eyebrow, title, onProfile, right }: { eyebrow: string; title: string; onProfile: () => void; right?: ReactNode }) {
  return <View style={s.header}>
    <View style={s.copy}>
      <T variant="label" style={s.eyebrow}>{eyebrow}</T>
      <T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
    </View>
    {right}
    <InboxBell />
    <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={onProfile} haptic="select" style={iconButton}>
      <User size={22} color={sys.color.ink} />
    </Press>
  </View>;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 62, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  title: { color: sys.color.ink },
  active: { backgroundColor: sys.color.greenSoft },
});
