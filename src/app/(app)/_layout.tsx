import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FactArt } from '../../ui/system/FactArt';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
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
const PUSH_TRANSITION = { animation: 'shift' as const,
  transitionSpec: { animation: 'timing' as const, config: { duration: sys.motion.enter } } };

const PRIMARY = { index: 'tasks', mapa: 'map', dogovori: 'agreements' } as const;
type Primary = keyof typeof PRIMARY;
function isPrimary(name: string): name is Primary { return Object.hasOwn(PRIMARY, name); }
function sectionOf(state: { index: number; routes: readonly { name: string; key: string }[];
  history?: readonly { type: string; key?: string }[] }): Primary {
  const current = state.routes[state.index]?.name ?? 'index';
  if (isPrimary(current)) return current;
  // Read the navigator's actual history, so Back and different entry points stay consistent.
  // This affects presentation only: a highlighted parent still dispatches its original tab action.
  for (const entry of [...(state.history ?? [])].reverse()) {
    const name = entry.type === 'route' ? state.routes.find(route => route.key === entry.key)?.name : undefined;
    if (name && isPrimary(name)) return name;
  }
  return current === 'prilike' || current.startsWith('prilike/') ? 'mapa'
    : current === 'oceni-dogovor' ? 'dogovori' : 'index';
}

/**
 * A full screen has no tab bar (owner decision, 2026-09-18). The conversation, the review before
 * publishing and the map point are one task each with one way out, the back arrow. Leaving the tab
 * bar under them made a tap anywhere along the bottom edge an exit from an unfinished Zadatak, and
 * it was not even honest about where you were: the screens are pushed, so no tab was current.
 */
// A screen that carries its own bottom action does not also carry the navigator's bar. On a phone
// the public Task stacked the two: an orange "Otvori svoj zadatak" and then Početna│Mapa│Dogovori
// underneath it, together eating about 180dp, and the description was cut mid-sentence between
// them. The owner's 2026-09-18 decision named four screens for this — the ones where a tap along
// the bottom edge abandoned an unfinished Zadatak. The four spine details added on 2026-09-20 are
// the same shape: each ends in one sticky action, and none of them is a tab, so no tab was ever
// current while they were open.
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const reducedMotion = useSystemReducedMotion();
  const PUSHED = reducedMotion ? { animation: 'none' as const } : PUSH_TRANSITION;
  const FULL = { ...PUSHED, tabBarStyle: { display: 'none' as const } };
  return <Tabs initialRouteName="index" backBehavior="history" safeAreaInsets={{ bottom: 0 }}
    // The bottom bar is for the three ROOT screens only (owner's master directive, 2026-09-23): a detail, a flow, a
    // conversation and a setting are "in this job", not in the main menu, so they hide it (FULL). The two exceptions are
    // `prilike`, a root-like copy of Mapa, and `profil/razgovor`, whose composer gets its keyboard-aware inset first.
    // Around thirty screens are registered here with `href: null` — the whole profile family, the
    // review, the location and photo steps, support. With `animation: 'none'` not one of them had a
    // push transition: they replaced each other instantly, which is why moving through the app felt
    // like redrawing rather than going somewhere. Switching between the three tabs stays instant,
    // which is what a tab bar is for; only pushes move.
    screenOptions={({ route, navigation }) => {
      const selected = sectionOf(navigation.getState()) === route.name;
      return { headerShown: false, animation: 'none', sceneStyle: { backgroundColor: sys.color.ground },
      tabBarActiveTintColor: sys.color.green, tabBarInactiveTintColor: sys.color.muted,
      tabBarActiveBackgroundColor: sys.color.greenSoft, tabBarAllowFontScaling: true,
      tabBarLabelPosition: 'below-icon',
      tabBarLabel: ({ children }) => <T variant="label" numberOfLines={2}
        style={{ color: selected ? sys.color.green : sys.color.muted, letterSpacing: 0, textAlign: 'center', marginTop: 3 }}>{children}</T>,
      tabBarIcon: () => isPrimary(route.name) ? <FactArt kind={PRIMARY[route.name]} size={30} muted={!selected} /> : null,
      tabBarButton: ({ children, style, onPress, onLongPress, testID, 'aria-label': label }) =>
        <Press accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }}
          onPress={onPress} onLongPress={onLongPress} testID={testID} haptic="select" hitSlop={0}
          style={[style, { borderRadius: sys.radius.cardCompact, backgroundColor: selected ? sys.color.greenSoft : 'transparent' }]}>{children}</Press>,
      tabBarItemStyle: { borderRadius: sys.radius.cardCompact, overflow: 'hidden' },
      tabBarStyle: { backgroundColor: sys.color.surface, borderColor: sys.color.line, borderWidth: 1,
        borderRadius: sys.radius.card, elevation: 0, shadowOpacity: 0,
        height: 70 + Math.ceil(Math.max(0, fontScale - 1) * 40), padding: 4,
        marginHorizontal: 16, marginTop: 8, marginBottom: Math.max(12, insets.bottom) } }; }}>
    <Tabs.Screen name="index" options={{ title: 'Početna', tabBarAccessibilityLabel: 'Početna' }} />
    <Tabs.Screen name="potrebe" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="nova" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="moje-prijave" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="moje-aktivnosti" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="prilike" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarAccessibilityLabel: 'Mapa' }} />
    <Tabs.Screen name="dogovori" options={{ title: 'Dogovori', tabBarAccessibilityLabel: 'Dogovori' }} />
    <Tabs.Screen name="profil" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/radnik" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/razgovor" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="profil/podaci" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/fotografija" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/blokirani" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/pravna" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/o-aplikaciji" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="bezbednost" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/index" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/novi" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/[id]" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/operator" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/lokacija" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/dostupnost" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/izvoz" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/privatnost" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/obavestenja" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="raspored" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="mesto-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pregled-nacrta" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pregled-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="fotografije-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pitanja-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="oceni-dogovor" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="potrebe/[id]/kandidati" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="potrebe/[id]/pregled" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="prilike/[id]" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="prilike/[id]/prijava" options={{ href: null, ...FULL }} />
  </Tabs>;
}
