import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import { useInbox } from '../hooks/useInbox';
import { useReducedMotion } from './system/motion';
import { ChromeIconButton } from './system/ScreenChrome';
import { sys } from './system/tokens';
import { T } from './Text';
import { neprocitanih } from './system/plural';

const s = StyleSheet.create({
  // Over the circle's upper right edge (the circle is 44 inside the 48 touch area, so 2 px in from each side).
  badge: { position: 'absolute', top: -1, right: -1, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 2, borderColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  // The spoken label carries the number, so the digits keep their size inside the 20 px capsule at any text setting.
  badgeText: { color: sys.color.onOrange, lineHeight: 14, letterSpacing: 0, fontVariant: ['tabular-nums'] },
});

/**
 * The bell's one swing when the unread count grows (V41's approved notice). It is longer than `sys.motion.enter`
 * because it is a damped swing of four beats, not one move; it is named here so it is not a stray number.
 */
export const BELL_SWING_MS = 620;

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
    const run = Animated.timing(swing, { toValue: 1, duration: BELL_SWING_MS, easing: Easing.out(Easing.quad), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [count, reduced, swing]);
  const rotate = swing.interpolate({ inputRange: [0, 0.22, 0.48, 0.72, 1], outputRange: ['0deg', '-12deg', '9deg', '-5deg', '0deg'] });
  // The chrome's one icon button with a green glyph (round-1 critique B1): the bell used to turn orange while something
  // was unread, which spent the screen's one orange accent on the header. The count keeps the orange badge.
  return <ChromeIconButton label={spoken} icon={Bell} tone="green" glyphStyle={{ transform: [{ rotate }] }}
    onPress={() => router.push('/obavestenja')}>
    {count != null && count > 0 && <View style={s.badge}>
      <T variant="label" maxFontSizeMultiplier={1} style={s.badgeText}>{count > 99 ? '99+' : count}</T>
    </View>}
  </ChromeIconButton>;
}
