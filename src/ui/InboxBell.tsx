import { View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import { useInbox } from '../hooks/useInbox';
import { Press } from './Press';
import { iconButton, sys } from './system/tokens';
import { T } from './Text';

export function InboxBell() {
  const { state } = useInbox(null);
  const count = state.error ? null : state.page?.unreadCount;
  const spoken = count == null ? 'Obaveštenja, broj nepročitanih nije dostupan' : `Obaveštenja, ${count} nepročitanih`;
  return <Press accessibilityRole="button" haptic="select" accessibilityLabel={spoken}
    onPress={() => router.push('/obavestenja')} style={iconButton}>
    <Bell size={22} color={sys.color.ink} />
    {count != null && count > 0 && <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20,
      paddingHorizontal: 5, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange, borderWidth: 2, borderColor: sys.color.surface,
      alignItems: 'center', justifyContent: 'center' }}>
      <T variant="label" style={{ color: sys.color.onOrange, lineHeight: 14, letterSpacing: 0 }}>{count > 99 ? '99+' : count}</T>
    </View>}
  </Press>;
}
