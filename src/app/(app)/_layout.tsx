import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Handshake, PaperPlaneTilt } from 'phosphor-react-native';
import { useUloga } from '../../store/uloga';
import { sys } from '../../ui/system/tokens';
import { CanonicalMark } from '../../ui/referenceEntry/ReferenceEntryHero';

/** The brand mark carries the center zone; focus is shown by the orange ring (shape, not color alone). */
function CenterMark({ focused }: { focused: boolean }) {
  return <View style={{ width: 52, height: 40, borderRadius: sys.radius.pill, backgroundColor: sys.color.ink,
    borderWidth: 2, borderColor: focused ? sys.color.orange : sys.color.ink, alignItems: 'center', justifyContent: 'center' }}>
    <CanonicalMark size={34} />
  </View>;
}

/**
 * One account, two intents, three visible zones (owner decision 1, 2026-09-16):
 * MENI TREBA = Zadaci | Mapa | Dogovori, JA MOGU = Prijave | Mapa | Dogovori.
 * Hidden routes retain their URLs and stay reachable in both intents.
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
  const intent = useUloga();
  const requester = intent === 'narucilac';
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(18, insets.bottom);
  return <Tabs key={intent} initialRouteName={requester ? 'potrebe' : 'moje-prijave'} backBehavior="history"
    // Around thirty screens are registered here with `href: null` — the whole profile family, the
    // review, the location and photo steps, support. With `animation: 'none'` not one of them had a
    // push transition: they replaced each other instantly, which is why moving through the app felt
    // like redrawing rather than going somewhere. Switching between the three tabs stays instant,
    // which is what a tab bar is for; only pushes move.
    screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: sys.color.ground },
      tabBarActiveTintColor: sys.color.ink, tabBarInactiveTintColor: sys.color.muted,
      tabBarLabelStyle: { ...sys.type.label, letterSpacing: 0.2, marginTop: 3 },
      tabBarItemStyle: { paddingVertical: 6 },
      tabBarStyle: { backgroundColor: sys.color.surface, borderTopColor: sys.color.line,
        borderTopWidth: 1, height: 66 + bottomPadding, paddingTop: 8, paddingBottom: bottomPadding } }}>
    <Tabs.Screen name="index" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="potrebe" options={{ href: requester ? undefined : null, title: 'Zadaci',
      tabBarAccessibilityLabel: 'Zadaci',
      tabBarIcon: ({ color, focused }) => <Package size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="nova" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="moje-prijave" options={{ href: requester ? null : undefined, title: 'Prijave',
      tabBarAccessibilityLabel: 'Prijave',
      tabBarIcon: ({ color, focused }) => <PaperPlaneTilt size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="prilike" options={{ href: null, ...PUSHED }} />
    <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarAccessibilityLabel: 'Mapa', tabBarIcon: ({ focused }) => <CenterMark focused={focused} /> }} />
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
