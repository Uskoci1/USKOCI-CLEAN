import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import { useInbox } from '../hooks/useInbox';
import { Press } from './Press';
import { useReducedMotion } from './system/motion';
import { iconButton, sys } from './system/tokens';
import { T } from './Text';
import { neprocitanih } from './system/plural';

const s = StyleSheet.create({
  round: { borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 2, borderColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: sys.color.onOrange, lineHeight: 14, letterSpacing: 0 },
});

export function InboxBell() {
  const { state } = useInbox(null);
  const count = state.error ? null : state.page?.unreadCount;
  const spoken = count == null ? 'Obaveštenja, broj nepročitanih nije dostupan' : `Obaveštenja, ${neprocitanih(count)}`;
  // V41's bell notice: when the unread count grows while the screen is open, the bell swings once. The first count
  // the screen reads is not news, and reduced motion keeps it still.
  const reduced = useReducedMotion();
  const swing = useRef(new Animated.Value(0)).current;
  const seen = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const before = seen.current; seen.current = count;
    if (reduced || before === undefined || before == null || count == null || count <= before) return;
    swing.setValue(0);
    const run = Animated.timing(swing, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [count, reduced, swing]);
  const rotate = swing.interpolate({ inputRange: [0, 0.22, 0.48, 0.72, 1], outputRange: ['0deg', '-12deg', '9deg', '-5deg', '0deg'] });
  return <Press accessibilityRole="button" haptic="select" accessibilityLabel={spoken}
    onPress={() => router.push('/obavestenja')} style={[iconButton, s.round]}>
    {/* V41: the bell sits in a white round well and turns orange while something is unread. */}
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Bell size={22} weight={count ? 'fill' : 'regular'} color={count ? sys.color.orange : sys.color.ink} />
    </Animated.View>
    {count != null && count > 0 && <View style={s.badge}>
      <T variant="label" style={s.badgeText}>{count > 99 ? '99+' : count}</T>
    </View>}
  </Press>;
}
