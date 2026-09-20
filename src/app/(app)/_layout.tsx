import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, Handshake, MapPin } from 'phosphor-react-native';
import { sys } from '../../ui/system/tokens';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';

/**
 * One shell for one account: Početna | Mapa | Dogovori (owner decision 1, 2026-09-19, which
 * supersedes the two intent-shaped shells of 2026-09-16). The same person may own tasks, have
 * applied to other people's and hold Dogovori on both sides at once, so what they are to a thing is
 * said on that thing and never chosen for the whole app. There is no mode here to read, and nothing
 * keys the navigator: `Tabs key={intent}` used to remount every screen beneath it on a switch.
 * Zadaci and Prijave keep their routes and their screens; they are reached from Početna now.
 */
/**
 * Around thirty screens live in this navigator with `href: null` — the whole profile family, the
 * review, the location and photo steps, support. They are pushed, not switched to, and with the
 * navigator's `animation: 'none'` not one of them moved: the screen was simply replaced, which is
 * why walking through the app felt like redrawing rather than going somewhere. Switching between
 * the three real tabs stays instant, which is what the tab contract records and what a tab bar is for.
 */
const PUSHED = { animation: 'shift' as const,
  transitionSpec: { animation: 'timing' as const, config: { duration: sys.motion.enter } } };

/**
 * A full screen has no tab bar (owner decision, 2026-09-18). The conversation, the review before
 * publishing and the map point are one task each with one way out, the back arrow. Leaving the tab
 * bar under them made a tap anywhere along the bottom edge an exit from an unfinished Zadatak, and
 * it was not even honest about where you were: the screens are pushed, so no tab was current.
 */
const FULL = { ...PUSHED, tabBarStyle: { display: 'none' as const } };

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <Tabs initialRouteName="index" backBehavior="history" safeAreaInsets={{ bottom: 0 }}
    // Around thirty screens are registered here with `href: null` — the whole profile family, the
    // review, the location and photo steps, support. With `animation: 'none'` not one of them had a
    // push transition: they replaced each other instantly, which is why moving through the app felt
    // like redrawing rather than going somewhere. Switching between the three tabs stays instant,
    // which is what a tab bar is for; only pushes move.
    screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: sys.color.ground },
      tabBarActiveTintColor: sys.color.green, tabBarInactiveTintColor: sys.color.muted,
      tabBarActiveBackgroundColor: sys.color.greenSoft, tabBarAllowFontScaling: true,
      tabBarLabelPosition: 'below-icon',
      tabBarLabel: ({ children, color }) => <T variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}
        style={{ color, letterSpacing: 0, textAlign: 'center', marginTop: 3 }}>{children}</T>,
      tabBarButton: ({ children, style, onPress, onLongPress, testID, 'aria-label': label, 'aria-selected': selected }) =>
        <Press accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: selected === true }}
          onPress={onPress} onLongPress={onLongPress} testID={testID} haptic="select" hitSlop={0}
          style={[style, { borderRadius: sys.radius.cardCompact }]}>{children}</Press>,
      tabBarItemStyle: { borderRadius: sys.radius.cardCompact, overflow: 'hidden' },
      tabBarStyle: { backgroundColor: sys.color.surface, borderColor: sys.color.line, borderWidth: 1,
        borderRadius: sys.radius.card, elevation: 0, shadowOpacity: 0,
        height: 66 + Math.ceil(Math.max(0, fontScale - 1) * 32), padding: 4,
        marginHorizontal: 16, marginTop: 8, marginBottom: Math.max(12, insets.bottom) } }}>
    <Tabs.Screen name="index" options={{ title: 'Početna', tabBarAccessibilityLabel: 'Početna',
      tabBarIcon: ({ color, focused }) => <House size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="potrebe" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="nova" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="moje-prijave" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="moje-aktivnosti" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="prilike" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarAccessibilityLabel: 'Mapa',
      tabBarIcon: ({ color, focused }) => <MapPin size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="dogovori" options={{ title: 'Dogovori', tabBarAccessibilityLabel: 'Dogovori',
      tabBarIcon: ({ color, focused }) => <Handshake size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="profil" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/radnik" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/razgovor" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/podaci" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/fotografija" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/blokirani" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/pravna" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/o-aplikaciji" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="bezbednost" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="podrska/index" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="podrska/novi" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="podrska/[id]" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="podrska/operator" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/lokacija" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/dostupnost" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/izvoz" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/privatnost" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/obavestenja" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="raspored" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="mesto-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pregled-nacrta" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="pregled-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="fotografije-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pitanja-zadatka" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="oceni-dogovor" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="potrebe/[id]/kandidati" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="potrebe/[id]/pregled" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="prilike/[id]" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="prilike/[id]/prijava" options={{ href: null, ...PUSHED }} />
  </Tabs>;
}
