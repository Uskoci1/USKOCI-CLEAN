import { useCallback, useState } from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { CaretRight, Package, Clock, Bell, User, Plus, Check } from 'phosphor-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, motion, touch } from '../../theme/tokens';
import { lazniIzvor as izvor } from '../../data/lazniIzvor';
import type { DogovorProjekcija, PotrebaProjekcija } from '../../contracts/projections';

const naUredjaju = Platform.OS !== 'web';

export default function Pocetna() {
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [dogovori, setDogovori] = useState<DogovorProjekcija[]>([]);

  useFocusEffect(
    useCallback(() => {
      let ziv = true;
      Promise.all([izvor.potreba('ormar'), izvor.mojiDogovori()]).then(([p, d]) => {
        if (!ziv) return;
        setPotreba(p);
        setDogovori(d);
      });
      return () => {
        ziv = false;
      };
    }, []),
  );

  const sledeci = dogovori[0];
  const p = potreba?.pokrivenost;
  const trebaIzbor = !!p && p.preostalo > 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: space.base, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm,
        }}
      >
        <View
          style={{
            width: 34, height: 34, borderRadius: radius.sm, backgroundColor: palette.forest800,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <T variant="label" tone="onDark" style={{ letterSpacing: 0 }}>U</T>
        </View>
        <T variant="heading" style={{ flex: 1, letterSpacing: 0.4 }}>USKOČI</T>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Obaveštenja"
          haptic="select"
          style={{ width: touch.min, height: touch.min, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
        >
          <Bell size={21} color={palette.ink} />
          {trebaIzbor && (
            <View
              style={{
                position: 'absolute', top: 10, right: 11,
                width: 8, height: 8, borderRadius: 4, backgroundColor: palette.orange,
              }}
            />
          )}
        </Press>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Profil"
          haptic="select"
          style={{ width: touch.min, height: touch.min, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
        >
          <User size={21} color={palette.ink} />
        </Press>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.xxl, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >
        <T variant="display" style={{ marginTop: space.xs }}>Danas</T>

        {/* Ono što traži odluku. Jedina glasna stvar na ekranu. */}
        {potreba && trebaIzbor && (
          <Animated.View entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(40) : undefined}>
            <Press haptic="light" scaleTo={0.985} onPress={() => router.push('/prijave')}>
              <Card style={[{ borderColor: palette.orange, borderWidth: 1.5 }, elevation.card]}>
                <View style={{ padding: space.base, gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <T variant="heading" style={{ flex: 1 }}>Prijave čekaju izbor</T>
                    <View
                      style={{
                        backgroundColor: palette.orangeSoft, borderRadius: radius.pill,
                        paddingHorizontal: space.md, paddingVertical: 4,
                      }}
                    >
                      <T variant="bodyStrong" tone="orange">{p!.popunjeno}/{p!.ukupno}</T>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Package size={16} color={palette.teal500} />
                    <T variant="meta" tone="muted" style={{ flex: 1 }} numberOfLines={1}>
                      {potreba.naslov}
                    </T>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: space.sm,
                      borderTopWidth: 1, borderTopColor: palette.line100, paddingTop: space.md,
                    }}
                  >
                    <T variant="action" tone="orange" style={{ flex: 1 }}>Izaberite ko će uskočiti</T>
                    <CaretRight size={17} color={palette.orangeInk} weight="bold" />
                  </View>
                </View>
              </Card>
            </Press>
          </Animated.View>
        )}

        {potreba && !trebaIzbor && (
          <Card style={elevation.card}>
            <View style={{ padding: space.base, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View
                style={{
                  width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.successBg,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Check size={19} color={palette.success} weight="bold" />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="bodyStrong">Sva mesta su popunjena</T>
                <T variant="meta" tone="muted" numberOfLines={1}>{potreba.naslov}</T>
              </View>
            </View>
          </Card>
        )}

        {sledeci && (
          <Animated.View
            entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(90) : undefined}
            style={{ gap: space.md }}
          >
            <T variant="title">Sledeći Dogovor</T>
            <Press haptic="light" scaleTo={0.985} onPress={() => router.push({ pathname: '/dogovor/[id]', params: { id: sledeci.id } })}>
              <Card style={elevation.card}>
                <View style={{ padding: space.base, gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <T variant="heading" style={{ flex: 1 }}>{sledeci.naslov}</T>
                    <View
                      style={{
                        backgroundColor: palette.successBg, borderRadius: radius.pill,
                        paddingHorizontal: space.md, paddingVertical: 4,
                      }}
                    >
                      <T variant="meta" tone="success" style={{ fontWeight: '700' }}>Aktivno</T>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <User size={15} color={palette.teal500} />
                      <T variant="meta" tone="muted">
                        {sledeci.ucesnici.find((u) => !u.viSte)?.ime.split(' ')[0] ?? '—'}
                      </T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={15} color={palette.teal500} />
                      <T variant="meta" tone="muted">{sledeci.vremeTekst}</T>
                    </View>
                  </View>
                </View>
              </Card>
            </Press>
          </Animated.View>
        )}

        <Animated.View entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(140) : undefined}>
          <Press haptic="light" scaleTo={0.985}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.base,
                borderRadius: radius.lg, borderWidth: 1.5, borderColor: palette.line100, borderStyle: 'dashed',
              }}
            >
              <View
                style={{
                  width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.orangeSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={19} color={palette.orangeInk} weight="bold" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodyStrong">Treba Vam još nešto?</T>
                <T variant="meta" tone="muted">Opišite novu Potrebu — Uskočeri je vide odmah.</T>
              </View>
              <CaretRight size={17} color={palette.inkMuted} />
            </View>
          </Press>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
