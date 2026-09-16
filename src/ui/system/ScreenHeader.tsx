import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { User } from 'phosphor-react-native';
import { InboxBell } from '../InboxBell';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from './tokens';

/**
 * Top bar of a tab surface: eyebrow (which intent you are in), title, bell → inbox,
 * avatar → profile. Owner decision 2 (2026-09-16): the user must always know
 * which context they are in, so the eyebrow carries the intent, not a slogan.
 */
export function ScreenHeader({ eyebrow, title, onProfile, right }: { eyebrow: string; title: string; onProfile: () => void; right?: ReactNode }) {
  return <View style={s.header}>
    <View style={s.copy}>
      <T variant="meta" tone="muted" style={s.eyebrow}>{eyebrow}</T>
      <T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
    </View>
    {right}
    <InboxBell />
    <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={onProfile} haptic="select" style={s.avatar}>
      <User size={22} color={sys.color.ink} />
    </Press>
  </View>;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  copy: { flex: 1, minWidth: 0, gap: 1 },
  eyebrow: { color: sys.color.green, fontWeight: '600' },
  title: { color: sys.color.ink, fontSize: 26, lineHeight: 31 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
});
