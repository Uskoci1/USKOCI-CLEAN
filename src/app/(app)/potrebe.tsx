import { useCallback } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, Clock, MapPin, Users } from 'phosphor-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { StanjePotrebe } from '../../contracts/projections';
import { useIzvor } from '../../store/uloga';
import { palette, space, radius, elevation, motion, touch } from '../../theme/tokens';
import { Card } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';
import { WorkspaceHeader } from '../../ui/WorkspaceHeader';
import { useFocusedResource } from '../../hooks/useFocusedResource';

const naUredjaju = Platform.OS !== 'web';

const STATUS: Record<StanjePotrebe, string> = {
  NACRT: 'Nacrt',
  OBJAVLJENA: 'Objavljen',
  CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjen',
  POPUNJENA: 'Popunjen',
  ZATVORENA: 'Zatvoren',
};

export default function Potrebe() {
  const izvor = useIzvor();
  const { data, loading: ucitava, error: greska, refresh: ucitaj } = useFocusedResource(
    useCallback(() => izvor.mojePotrebe(), [izvor]),
  );
  const potrebe = data ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <WorkspaceHeader title="Zadaci" />

      {ucitava ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.teal500} />
        </View>
      ) : greska ? (
        <View style={{ flex: 1, padding: space.base, justifyContent: 'center', gap: space.md }}>
          <T variant="heading">Zadaci trenutno nisu dostupni</T>
          <T variant="body" tone="muted">Proverite internet vezu i pokušajte ponovo.</T>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Pokušaj ponovo"
            haptic="light"
            onPress={() => void ucitaj()}
            style={{
              minHeight: touch.min,
              borderRadius: radius.md,
              backgroundColor: palette.forest800,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T variant="action" tone="onDark">Pokušajte ponovo</T>
          </Press>
        </View>
      ) : potrebe.length === 0 ? (
        <View style={{ flex: 1, padding: space.xl, justifyContent: 'center', alignItems: 'center', gap: space.md }}>
          <T variant="heading" style={{ textAlign: 'center' }}>Još nemate Zadatak</T>
          <T variant="body" tone="muted" style={{ textAlign: 'center' }}>
            Recite šta Vam treba. USKOČI će Vas voditi kroz nacrt pre objave.
          </T>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Napravite prvi Zadatak"
            haptic="light"
            onPress={() => router.navigate('/nova')}
            style={{
              minHeight: touch.min,
              paddingHorizontal: space.xl,
              borderRadius: radius.md,
              backgroundColor: palette.orange,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T variant="action" tone="onOrange">Napravite Zadatak</T>
          </Press>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={ucitava} onRefresh={() => void ucitaj()} tintColor={palette.teal500} />}
          contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.xxl, gap: space.base }}
          showsVerticalScrollIndicator={false}
        >
          {potrebe.map((p, index) => (
            <Animated.View
              key={p.id}
              entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(index * 35) : undefined}
            >
              <Press
                accessibilityRole="button"
                accessibilityLabel={`Otvorite Zadatak ${p.naslov}`}
                haptic="light"
                scaleTo={0.985}
                onPress={() =>
                  router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: p.id } })
                }
              >
                <Card style={elevation.card}>
                  <View style={{ padding: space.base, gap: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.orange }} />
                      <T variant="label" tone="muted" style={{ flex: 1 }}>ZADATAK</T>
                      <T variant="meta" tone="orange" style={{ fontWeight: '800' }}>
                        {STATUS[p.stanje]}
                      </T>
                    </View>

                    <T variant="heading">{p.naslov}</T>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.base }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MapPin size={15} color={palette.teal500} />
                        <T variant="meta" tone="muted">{p.podrucjeTekst}</T>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={15} color={palette.teal500} />
                        <T variant="meta" tone="muted">{p.vremeTekst}</T>
                      </View>
                    </View>

                    <View style={{ gap: 7 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Users size={15} color={palette.teal500} />
                        <T variant="meta" style={{ fontWeight: '700', flex: 1 }}>
                          {p.pokrivenost.popunjeno}/{p.pokrivenost.ukupno} mesta pokriveno
                        </T>
                        <T variant="meta" tone="muted">
                          {p.brojPrijava} {p.brojPrijava === 1 ? 'prijava' : 'prijava'}
                        </T>
                      </View>
                      <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: palette.cream050, overflow: 'hidden' }}>
                        <View
                          style={{
                            width: `${Math.max(0, Math.min(100, p.pokrivenost.udeo * 100))}%`,
                            height: '100%',
                            borderRadius: radius.pill,
                            backgroundColor: palette.teal500,
                          }}
                        />
                      </View>
                    </View>

                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: palette.line100,
                        paddingTop: space.md,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        {p.ponudjenaCena ? (
                          <T variant="meta" style={{ fontWeight: '800' }}>{p.ponudjenaCena.prikaz}</T>
                        ) : (
                          <T variant="meta" tone="muted">Ponude kandidata</T>
                        )}
                      </View>
                      <CaretRight size={16} color={palette.ink} />
                    </View>
                  </View>
                </Card>
              </Press>
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
