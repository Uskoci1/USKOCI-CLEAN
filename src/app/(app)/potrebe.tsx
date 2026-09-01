import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, Clock, MapPin, Plus, Users } from 'phosphor-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import { useIzvor } from '../../store/uloga';
import { palette, space, radius, elevation, motion, touch } from '../../theme/tokens';
import { Card } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';

const naUredjaju = Platform.OS !== 'web';

const STATUS: Record<StanjePotrebe, string> = {
  NACRT: 'Nacrt',
  OBJAVLJENA: 'Objavljena',
  CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjena',
  POPUNJENA: 'Popunjena',
  ZATVORENA: 'Zatvorena',
};

export default function Potrebe() {
  const izvor = useIzvor();
  const [potrebe, setPotrebe] = useState<PotrebaProjekcija[]>([]);
  const [ucitava, setUcitava] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = useCallback(() => {
    let ziv = true;
    setUcitava(true);
    setGreska(null);

    void izvor
      .mojePotrebe()
      .then((rezultat) => {
        if (!ziv) return;
        setPotrebe(rezultat);
      })
      .catch((error: unknown) => {
        if (!ziv) return;
        setGreska(error instanceof Error ? error.message : 'Potrebe nisu mogle da se učitaju.');
      })
      .finally(() => {
        if (ziv) setUcitava(false);
      });

    return () => {
      ziv = false;
    };
  }, [izvor]);

  useFocusEffect(ucitaj);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.base,
          paddingTop: space.sm,
          paddingBottom: space.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <T variant="title">Potrebe</T>
          <T variant="meta" tone="muted">Vaši objavljeni zahtevi i njihova pokrivenost</T>
        </View>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Nova Potreba"
          haptic="light"
          onPress={() => router.push('/nova')}
          style={{
            minHeight: touch.min,
            minWidth: touch.min,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            backgroundColor: palette.orange,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Plus size={17} color={palette.onOrange} weight="bold" />
          <T variant="action" tone="onOrange">Nova</T>
        </Press>
      </View>

      {ucitava ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.teal500} />
        </View>
      ) : greska ? (
        <View style={{ flex: 1, padding: space.base, justifyContent: 'center', gap: space.md }}>
          <T variant="heading">Potrebe trenutno nisu dostupne</T>
          <T variant="body" tone="muted">{greska}</T>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Pokušaj ponovo"
            haptic="light"
            onPress={() => {
              const cleanup = ucitaj();
              void cleanup;
            }}
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
          <T variant="heading" style={{ textAlign: 'center' }}>Još nemate Potrebu</T>
          <T variant="body" tone="muted" style={{ textAlign: 'center' }}>
            Recite šta Vam treba. USKOČI će Vas voditi kroz nacrt pre objave.
          </T>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Kreiraj prvu Potrebu"
            haptic="light"
            onPress={() => router.push('/nova')}
            style={{
              minHeight: touch.min,
              paddingHorizontal: space.xl,
              borderRadius: radius.md,
              backgroundColor: palette.orange,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T variant="action" tone="onOrange">Kreirajte Potrebu</T>
          </Press>
        </View>
      ) : (
        <ScrollView
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
                accessibilityLabel={`Otvori Potrebu ${p.naslov}`}
                haptic="light"
                scaleTo={0.985}
                onPress={() =>
                  router.push({ pathname: '/potrebe/[id]/pregled', params: { id: p.id } })
                }
              >
                <Card style={elevation.card}>
                  <View style={{ padding: space.base, gap: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.orange }} />
                      <T variant="label" tone="muted" style={{ flex: 1 }}>POTREBA</T>
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
                      <T variant="action">Pregled</T>
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
