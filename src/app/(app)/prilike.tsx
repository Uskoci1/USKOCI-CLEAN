import { useCallback, useState } from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  CaretRight, Clock, Users, ArrowRight, ListBullets, MapTrifold, Columns, MapPin,
} from 'phosphor-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, motion, touch } from '../../theme/tokens';
import { lazniIzvor as izvor } from '../../data/lazniIzvor';
import type { PrilikaProjekcija } from '../../contracts/projections';

const naUredjaju = Platform.OS !== 'web';

type Prikaz = 'lista' | 'mapa' | 'kombinovano';

/**
 * W03 — M09.
 *
 * Tri prikaza dele JEDAN skup podataka i JEDNU karticu. Nije to pravilo iz
 * lepote — ako bi svaki prikaz imao svoj upit, pokazivali bi različite stvari
 * za isti filter, a korisnik bi mislio da nešto nestaje.
 *
 * Sirov matcher procenat ovde ne postoji: `PrilikaProjekcija` ga nema kao polje.
 */
export default function Prilike() {
  const [prikaz, setPrikaz] = useState<Prikaz>('kombinovano');
  const [prilike, setPrilike] = useState<PrilikaProjekcija[]>([]);

  useFocusEffect(
    useCallback(() => {
      let ziv = true;
      izvor.otvorenePrilike().then((p) => {
        if (ziv) setPrilike(p);
      });
      return () => {
        ziv = false;
      };
    }, []),
  );

  const prikazuje = prikaz === 'mapa' ? [] : prilike;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space.sm,
          paddingHorizontal: space.base, paddingTop: space.sm, paddingBottom: space.md,
        }}
      >
        <T variant="title" style={{ flex: 1 }}>Prilike</T>
        <T variant="meta" tone="muted">{prilike.length}</T>
      </View>

      {/* Isti skup podataka, tri načina gledanja. */}
      <View
        style={{
          flexDirection: 'row', marginHorizontal: space.base, marginBottom: space.md,
          backgroundColor: palette.cream050, borderRadius: radius.md, padding: 4, gap: 4,
        }}
      >
        {([
          ['lista', 'Lista', ListBullets],
          ['mapa', 'Mapa', MapTrifold],
          ['kombinovano', 'Kombinovano', Columns],
        ] as const).map(([kljuc, naziv, Ikona]) => {
          const aktivan = prikaz === kljuc;
          return (
            <Press
              key={kljuc}
              accessibilityRole="tab"
              accessibilityState={{ selected: aktivan }}
              accessibilityLabel={naziv}
              haptic="select"
              scaleTo={0.99}
              onPress={() => setPrikaz(kljuc)}
              style={{
                flex: 1, minHeight: 40, borderRadius: radius.sm, flexDirection: 'row',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: aktivan ? palette.raised : 'transparent',
              }}
            >
              <Ikona size={15} color={aktivan ? palette.ink : palette.inkMuted} weight={aktivan ? 'fill' : 'regular'} />
              <T variant="meta" tone={aktivan ? 'ink' : 'muted'} style={{ fontWeight: '700' }} numberOfLines={1}>
                {naziv}
              </T>
            </Press>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.xxl, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >
        {(prikaz === 'mapa' || prikaz === 'kombinovano') && (
          <Animated.View entering={naUredjaju ? FadeIn.duration(motion.enter) : undefined}>
            <View
              style={{
                height: prikaz === 'mapa' ? 420 : 190,
                borderRadius: radius.lg,
                backgroundColor: palette.sage200,
                alignItems: 'center', justifyContent: 'center', gap: space.sm,
                borderWidth: 1, borderColor: palette.line100,
              }}
            >
              <MapPin size={26} color={palette.forest700} weight="fill" />
              <T variant="meta" style={{ fontWeight: '700' }}>Mapa još nije povezana</T>
              <T variant="meta" tone="muted" style={{ textAlign: 'center', maxWidth: 250 }}>
                Po OD-05 ide Google kroz provider adapter. Dok adapter ne postoji,
                ovde namerno nema lažne mape.
              </T>
              <T variant="meta" tone="muted">
                {prilike.length} {prilike.length === 1 ? 'prilika' : 'prilika'} u ovom području
              </T>
            </View>
          </Animated.View>
        )}

        {prikaz === 'mapa' && prikazuje.length === 0 && (
          <T variant="meta" tone="muted" style={{ textAlign: 'center', paddingTop: space.md }}>
            Prebacite na Lista ili Kombinovano da vidite iste prilike kao spisak.
          </T>
        )}

        {prikazuje.map((p, i) => (
          <Animated.View
            key={p.id}
            entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(i * 45) : undefined}
          >
            <Press haptic="light" scaleTo={0.985}>
              <Card style={elevation.card}>
                <View style={{ padding: space.base, gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.orange }} />
                    <T variant="label" tone="muted" style={{ flex: 1 }}>PRILIKA</T>
                    <T variant="meta" tone="orange" style={{ fontWeight: '800' }}>{p.statusTekst}</T>
                  </View>

                  <T variant="heading">{p.naslov}</T>

                  <View
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: space.base, flexWrap: 'wrap',
                      borderTopWidth: 1, borderTopColor: palette.line100, paddingTop: space.md,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ArrowRight size={15} color={palette.teal500} />
                      <T variant="meta" tone="muted">{p.podrucjeTekst}</T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={15} color={palette.teal500} />
                      <T variant="meta" tone="muted">{p.vremeTekst}</T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Users size={15} color={palette.teal500} />
                      <T variant="meta" tone="muted">
                        {p.pokrivenost.popunjeno}/{p.pokrivenost.ukupno}
                      </T>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                    {p.uslovi.map((u) => (
                      <View
                        key={u}
                        style={{
                          borderWidth: 1, borderColor: palette.line100, borderRadius: radius.pill,
                          paddingHorizontal: space.md, paddingVertical: 5,
                        }}
                      >
                        <T variant="meta" tone="muted" style={{ fontWeight: '600' }}>{u}</T>
                      </View>
                    ))}
                  </View>

                  <View
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: space.md,
                      borderTopWidth: 1, borderTopColor: palette.line100, paddingTop: space.md,
                    }}
                  >
                    <View
                      style={{
                        width: 34, height: 34, borderRadius: radius.sm, backgroundColor: palette.forest800,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <T variant="meta" tone="onDark" style={{ fontWeight: '800' }}>
                        {p.narucilacIme.slice(0, 2).toUpperCase()}
                      </T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="meta" style={{ fontWeight: '700' }}>{p.narucilacIme}</T>
                      {p.narucilacOcena && (
                        <T variant="meta" tone="muted">★ {p.narucilacOcena}</T>
                      )}
                    </View>
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        minHeight: touch.min - 8, paddingHorizontal: space.md,
                      }}
                    >
                      <T variant="action">Detalji</T>
                      <CaretRight size={15} color={palette.ink} />
                    </View>
                  </View>
                </View>
              </Card>
            </Press>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
