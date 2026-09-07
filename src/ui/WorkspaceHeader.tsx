import { View } from 'react-native';
import { router } from 'expo-router';
import { User } from 'phosphor-react-native';
import { useUloga } from '../store/uloga';
import { palette, radius, space } from '../theme/tokens';
import { InboxBell } from './InboxBell';
import { Press } from './Press';
import { T } from './Text';

export function WorkspaceHeader({ title }: { title: string }) {
  const intent = useUloga();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.base, paddingTop: space.sm, paddingBottom: space.md }}>
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="label" tone="muted">{intent === 'narucilac' ? 'MENI TREBA' : 'JA MOGU'}</T>
      <T variant="title">{title}</T>
    </View>
    <InboxBell />
    <Press accessibilityRole="button" accessibilityLabel={intent === 'narucilac' ? 'Profil' : 'Radni profil'}
      haptic="select" onPress={() => router.navigate('/profil')}
      style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: palette.cream050,
        alignItems: 'center', justifyContent: 'center' }}>
      <User size={24} color={palette.ink} />
    </Press>
  </View>;
}
