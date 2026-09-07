import { useCallback } from 'react';
import { View, ScrollView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CaretRight, Clock, User, Handshake, WarningCircle } from 'phosphor-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { T } from '../../ui/Text';
import { WorkspaceHeader } from '../../ui/WorkspaceHeader';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, motion } from '../../theme/tokens';
import { useIzvor, useUloga } from '../../store/uloga';

const naUredjaju = Platform.OS !== 'web';

export default function Dogovori() {
  const izvor = useIzvor();
  const requester = useUloga() === 'narucilac';
  const { data, loading: ucitavanje, error: greska, refresh: ucitaj } = useFocusedResource(
    useCallback(() => izvor.mojiDogovori(), [izvor]),
  );
  const dogovori = data ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <WorkspaceHeader title="Dogovori" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={ucitavanje} onRefresh={() => void ucitaj()} tintColor={palette.teal500} />}
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.xxl, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >

        {ucitavanje && <ActivityIndicator color={palette.teal500} style={{ marginTop: space.xl }} />}

        {!ucitavanje && greska && (
          <Card>
            <View style={{ padding: space.base, gap: space.md, alignItems: 'center' }}>
              <WarningCircle size={26} color={palette.danger} />
              <T variant="heading">Dogovori nisu učitani</T>
              <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>Proverite internet vezu i pokušajte ponovo.</T>
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
              {requester ? 'Kada izaberete nekoga iz Prijava, Dogovor se pojavljuje ovde.' : 'Kada Vaša Prijava bude izabrana, Dogovor se pojavljuje ovde.'}
            </T>
            <Press
              accessibilityRole="button"
              accessibilityLabel="Pogledajte Zadatke"
              haptic="light"
              onPress={() => router.navigate(requester ? '/potrebe' : '/prilike')}
              style={{
                minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.md,
                borderWidth: 1.5, borderColor: palette.ink,
                alignItems: 'center', justifyContent: 'center', marginTop: space.xs,
              }}
            >
              <T variant="action">Pogledajte Zadatke</T>
            </Press>
          </View>
        )}

        {!ucitavanje && !greska && dogovori.length > 0 && (
          <T variant="label" tone="muted">VAŠI DOGOVORI</T>
        )}

        {!greska && dogovori.map((d, i) => {
          const drugi = d.ucesnici.find((u) => !u.viSte);
          return (
            <Animated.View
              key={d.id}
              entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(i * 45) : undefined}
            >
              <Press accessibilityRole="button" accessibilityLabel={`Otvorite Dogovor ${d.naslov}`}
                haptic="light" scaleTo={0.985} onPress={() => router.navigate({ pathname: '/dogovor/[id]', params: { id: d.id } })}>
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
                          {{ CONFIRMED: 'Aktivno', AWAITING_REQUESTER: 'Čeka potvrdu', COMPLETED: 'Završeno', CANCELLED: 'Otkazano' }[d.stanje]}
                        </T>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <User size={15} color={palette.teal500} style={{ flexShrink: 0 }} />
                      <T variant="meta" tone="muted" style={{ flex: 1, minWidth: 0 }}>{drugi?.ime ?? '—'}</T>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                        <Clock size={15} color={palette.teal500} style={{ flexShrink: 0 }} />
                        <T variant="meta" tone="muted" style={{ flexShrink: 1 }}>{d.vremeTekst}</T>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: 'auto', flexShrink: 0 }}>
                        <T variant="meta" style={{ fontWeight: '800' }}>
                          {d.cena.prikaz}
                        </T>
                        <CaretRight size={16} color={palette.inkMuted} />
                      </View>
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
