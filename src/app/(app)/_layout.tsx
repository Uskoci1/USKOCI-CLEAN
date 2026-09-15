import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package, Handshake, PaperPlaneTilt } from 'phosphor-react-native';
import { palette, radius, type as typeScale } from '../../theme/tokens';
import { useUloga } from '../../store/uloga';
import { CanonicalMark } from '../../ui/referenceEntry/ReferenceEntryHero';

function CenterMark() {
  return <View style={{ width: 56, height: 42, borderRadius: radius.md,
    backgroundColor: palette.forest800, alignItems: 'center', justifyContent: 'center' }}>
    <CanonicalMark size={40} />
  </View>;
}

/** One account, two intents, three visible zones. Hidden routes retain their URLs. */
export default function TabLayout() {
  const intent = useUloga();
  const requester = intent === 'narucilac';
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(18, insets.bottom);
  return <Tabs key={intent} initialRouteName={requester ? 'potrebe' : 'moje-prijave'} backBehavior="history"
    screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: palette.ground },
      tabBarActiveTintColor: palette.ink, tabBarInactiveTintColor: palette.inkMuted,
      tabBarLabelStyle: { ...typeScale.label, letterSpacing: 0.2, marginTop: 3 },
      tabBarItemStyle: { paddingVertical: 6 },
      tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.line100,
        borderTopWidth: 1, height: 66 + bottomPadding, paddingTop: 8, paddingBottom: bottomPadding } }}>
    <Tabs.Screen name="index" options={{ href: null }} />
    <Tabs.Screen name="potrebe" options={{ href: requester ? undefined : null, title: 'Zadaci',
      tabBarAccessibilityLabel: 'Zadaci',
      tabBarIcon: ({ color, focused }) => <Package size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="novi-zadatak" options={{ href: null }} />
    <Tabs.Screen name="nova" options={{ href: null }} />
    <Tabs.Screen name="rucni-zadatak" options={{ href: null }} />
    <Tabs.Screen name="moje-prijave" options={{ href: requester ? null : undefined, title: 'Prijave',
      tabBarAccessibilityLabel: 'Prijave',
      tabBarIcon: ({ color, focused }) => <PaperPlaneTilt size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="prilike" options={{ href: null }} />
    <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarAccessibilityLabel: 'Mapa', tabBarIcon: CenterMark }} />
    <Tabs.Screen name="dogovori" options={{ title: 'Dogovori', tabBarAccessibilityLabel: 'Dogovori',
      tabBarIcon: ({ color, focused }) => <Handshake size={23} color={color as string} weight={focused ? 'fill' : 'regular'} /> }} />
    <Tabs.Screen name="profil" options={{ href: null }} />
    <Tabs.Screen name="profil/radnik" options={{ href: null }} />
    <Tabs.Screen name="profil/razgovor" options={{ href: null }} />
    <Tabs.Screen name="profil/podaci" options={{ href: null }} />
    <Tabs.Screen name="profil/fotografija" options={{ href: null }} />
    <Tabs.Screen name="profil/blokirani" options={{ href: null }} />
    <Tabs.Screen name="profil/pravna" options={{ href: null }} />
    <Tabs.Screen name="profil/o-aplikaciji" options={{ href: null }} />
    <Tabs.Screen name="bezbednost" options={{ href: null }} />
    <Tabs.Screen name="podrska/index" options={{ href: null }} />
    <Tabs.Screen name="podrska/novi" options={{ href: null }} />
    <Tabs.Screen name="podrska/[id]" options={{ href: null }} />
    <Tabs.Screen name="podrska/operator" options={{ href: null }} />
    <Tabs.Screen name="profil/lokacija" options={{ href: null }} />
    <Tabs.Screen name="profil/dostupnost" options={{ href: null }} />
    <Tabs.Screen name="profil/izvoz" options={{ href: null }} />
    <Tabs.Screen name="profil/privatnost" options={{ href: null }} />
    <Tabs.Screen name="profil/obavestenja" options={{ href: null }} />
    <Tabs.Screen name="raspored" options={{ href: null }} />
    <Tabs.Screen name="mesto-zadatka" options={{ href: null }} />
    <Tabs.Screen name="pregled-nacrta" options={{ href: null }} />
    <Tabs.Screen name="pregled-zadatka" options={{ href: null }} />
    <Tabs.Screen name="fotografije-zadatka" options={{ href: null }} />
    <Tabs.Screen name="pitanja-zadatka" options={{ href: null }} />
    <Tabs.Screen name="oceni-dogovor" options={{ href: null }} />
    <Tabs.Screen name="potrebe/[id]/kandidati" options={{ href: null }} />
    <Tabs.Screen name="potrebe/[id]/pregled" options={{ href: null }} />
    <Tabs.Screen name="prilike/[id]" options={{ href: null }} />
    <Tabs.Screen name="prilike/[id]/prijava" options={{ href: null }} />
  </Tabs>;
}
