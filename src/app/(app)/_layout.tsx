import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { House, Package, Plus, Handshake, User, PaperPlaneTilt, MapTrifold } from 'phosphor-react-native';
import { palette, radius, type as typeScale } from '../../theme/tokens';
import { useUloga } from '../../store/uloga';

/**
 * Kanon:
 *   Naručilac: Početna · Potrebe · + · Dogovori · Profil
 *   Uskočer:   Početna · Prijave · [USKOČI znak] · Dogovori · Profil
 *
 * Isti nalog, dva prostora. Tabovi koji ne pripadaju prostoru se sklanjaju
 * (`href: null`), ne prepisuju — pa se ruta ne može dohvatiti ni slučajno.
 *
 * Tabovi se NE klizaju pri prebacivanju: ravnopravni su, nisu hijerarhija.
 */
export default function TabLayout() {
  const uloga = useUloga();
  const narucilac = uloga === 'narucilac';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: { backgroundColor: palette.ground },
        tabBarActiveTintColor: palette.ink,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarLabelStyle: { ...typeScale.label, letterSpacing: 0.2, marginTop: 3 },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.line100,
          borderTopWidth: 1,
          height: 84,
          paddingTop: 8,
          paddingBottom: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Početna',
          tabBarIcon: ({ color, focused }) => (
            <House size={23} color={color as string} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />

      {/* Naručilac */}
      <Tabs.Screen
        name="potrebe"
        options={{
          href: narucilac ? undefined : null,
          title: 'Potrebe',
          tabBarIcon: ({ color, focused }) => (
            <Package size={23} color={color as string} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="nova"
        options={{
          href: narucilac ? undefined : null,
          title: '',
          tabBarIcon: () => (
            <View
              style={{
                width: 54, height: 40, borderRadius: radius.md,
                backgroundColor: palette.orange,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={24} color={palette.onOrange} weight="bold" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="pregled-nacrta"
        options={{ href: null }}
      />

      {/* Uskočer */}
      <Tabs.Screen
        name="moje-prijave"
        options={{
          href: narucilac ? null : undefined,
          title: 'Prijave',
          tabBarIcon: ({ color, focused }) => (
            <PaperPlaneTilt size={23} color={color as string} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="prilike"
        options={{
          href: narucilac ? null : undefined,
          title: 'Prilike',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 54, height: 40, borderRadius: radius.md,
                backgroundColor: focused ? palette.orange : palette.forest800,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <MapTrifold size={22} color={focused ? palette.onOrange : palette.onDark} weight="fill" />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="dogovori"
        options={{
          title: 'Dogovori',
          tabBarIcon: ({ color, focused }) => (
            <Handshake size={23} color={color as string} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <User size={23} color={color as string} weight={focused ? 'fill' : 'regular'} />
          ),
        }}
      />
    </Tabs>
  );
}
