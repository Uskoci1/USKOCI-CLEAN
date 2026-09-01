import { useCallback, useState } from 'react';
import { View, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { CaretRight, Clock, User, Handshake, WarningCircle } from 'phosphor-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, motion } from '../../theme/tokens';
import { useIzvor } from '../../store/uloga';
import type { DogovorProjekcija } from '../../contracts/projections';

const naUredjaju = Platform.OS !== 'web';

export default function Dogovori() {
  const izvor = useIzvor();
  const [dogovori, setDogovori] = useState<DogovorProjekcija[]>([]);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = useCallback(async (ziv?: () => boolean) => {
    setUcitavanje(true);
    setGreska(null);
    try {
      const rezultat = await izvor.mojiDogovori();
      if (ziv && !ziv()) return;
      setDogovori(rezultat);
    } catch (error) {
      if (ziv && !ziv()) return;
      setDogovori([]);
      setGreska(error instanceof Error ? error.message : 'Dogovori trenutno ne mogu da se učitaju.');
    } finally {
      if (!ziv || ziv()) setUcitavanje(false);
    }
  }, [izvor]);

  // Vraćanje na tab mora da pokaže sveže stanje — izbor je mogao da napravi Dogovor.
  useFocusEffect(
    useCallback(() => {
      let aktivan = true;
      void ucitaj(() => aktivan);
      return () => {
        aktivan = false;
      };
    }, [ucitaj]),
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.xxl, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >
        <T variant="display" style={{ marginTop: space.sm }}>Dogovori</T>

        {ucitavanje && <ActivityIndicator color={palette.teal500} style={{ marginTop: space.xl }} />}

        {!ucitavanje && greska && (
          <Card>
            <View style={{ padding: space.base, gap: space.md, alignItems: 'center' }}>
              <WarningCircle size={26} color={palette.danger} />
              <T variant="heading">Dogovori nisu učitani</T>
              <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>{greska}</T>
              <Press
                accessibilityRole="button"
                accessibilityLabel="Pokušaj ponovo"
                haptic="light"
                onPress={() => void ucitaj()}
                style={{
                  minHeight: 44,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.md,
                  backgroundColor: palette.orange,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <T variant="action" tone="onOrange">Pokušaj ponovo</T>
              </Press>
            </View>
          </Card>
        )}

        {!ucitavanje && !greska && dogovori.length === 0 && (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.huge }}>
            <View
              style={{
                width: 56, height: 56, borderRadius: radius.lg,
                backgroundColor: palette.cream050, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Handshake size={26} color={palette.teal500} />
            </View>
            <T variant="heading">Još nemate Dogovor</T>
            <T variant="meta" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
              Kada izaberete nekoga iz prijava, Dogovor nastaje odmah i pojavljuje se ovde.
            </T>
            <Press
              accessibilityRole="button"
              accessibilityLabel="Pogledaj prijave"
              haptic="light"
              onPress={() => router.push('/prijave')}
              style={{
                minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.md,
                borderWidth: 1.5, borderColor: palette.ink,
                alignItems: 'center', justifyContent: 'center', marginTop: space.xs,
              }}
            >
              <T variant="action">Pogledajte prijave</T>
            </Press>
          </View>
        )}

        {!ucitavanje && !greska && dogovori.length > 0 && (
          <T variant="label" tone="muted">AKTIVNI</T>
        )}

        {!greska && dogovori.map((d, i) => {
          const drugi = d.ucesnici.find((u) => !u.viSte);
          return (
            <Animated.View
              key={d.id}
              entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(i * 45) : undefined}
            >
              <Press haptic="light" scaleTo={0.985} onPress={() => router.push({ pathname: '/dogovor/[id]', params: { id: d.id } })}>
                <Card style={elevation.card}>
                  <View style={{ padding: space.base, gap: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <T variant="heading" style={{ flex: 1 }}>{d.naslov}</T>
                      <View
                        style={{
                          backgroundColor: palette.successBg, borderRadius: radius.pill,
                          paddingHorizontal: space.md, paddingVertical: 4,
                        }}
                      >
                        <T variant="meta" tone="success" style={{ fontWeight: '700' }}>
                          {d.stanje === 'CONFIRMED' ? 'Aktivno' : d.stanje}
                        </T>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <User size={15} color={palette.teal500} />
                        <T variant="meta" tone="muted">{drugi?.ime ?? '—'}</T>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={15} color={palette.teal500} />
                        <T variant="meta" tone="muted">{d.vremeTekst}</T>
                      </View>
                      <T variant="meta" style={{ marginLeft: 'auto', fontWeight: '800' }}>
                        {d.cena.prikaz}
                      </T>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        borderTopWidth: 1, borderTopColor: palette.line100, paddingTop: space.md,
                      }}
                    >
                      <T variant="action" style={{ flex: 1 }}>Otvorite Dogovor</T>
                      <CaretRight size={16} color={palette.inkMuted} />
                    </View>
                  </View>
                </Card>
              </Press>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
