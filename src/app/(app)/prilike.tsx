import { useCallback } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CaretRight, Clock, MapPin, Users } from 'phosphor-react-native';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Button, Card } from '../../ui/Button';
import { WorkspaceHeader } from '../../ui/WorkspaceHeader';
import { palette, space, radius, elevation } from '../../theme/tokens';
import { useIzvor } from '../../store/uloga';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import type { PrilikaProjekcija } from '../../contracts/projections';

/** W03 uses the current public-safe discovery projection; W04 rereads on entry. */
export default function Prilike() {
  const izvor = useIzvor();
  const router = useRouter();
  const load = useCallback(() => izvor.otvorenePrilike(), [izvor]);
  const { data, loading, error, refresh } = useFocusedResource(load);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <WorkspaceHeader title="Zadaci" />
      <FlatList<PrilikaProjekcija>
        data={data ?? []}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={() => { void refresh(); }}
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.xxl, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: space.base }} />}
        ListEmptyComponent={
          <View style={{ paddingVertical: space.xxl, gap: space.base }} accessibilityLiveRegion="polite">
            {loading ? <>
              <ActivityIndicator color={palette.forest700} accessibilityLabel="Učitavamo zadatke" />
              <T variant="body" tone="muted" style={{ textAlign: 'center' }}>Učitavamo zadatke…</T>
            </> : error ? <>
              <T variant="heading">Zadatke trenutno nije moguće učitati.</T>
              <T variant="body" tone="muted">Proverite internet vezu i pokušajte ponovo.</T>
              <Button label="Pokušajte ponovo" onPress={() => { void refresh(); }} />
            </> : <>
              <T variant="heading">Trenutno nema otvorenih zadataka.</T>
              <T variant="body" tone="muted">Možete urediti Radni profil ili kasnije osvežiti listu.</T>
              <Button label="Uredite Radni profil" onPress={() => router.navigate('/profil/radnik')} />
            </>}
          </View>
        }
        renderItem={({ item: p }) => (
          <Press
            accessibilityRole="button"
            accessibilityLabel={`Otvorite priliku ${p.naslov}`}
            haptic="light"
            scaleTo={0.985}
            onPress={() => router.navigate({ pathname: '/prilike/[id]', params: { id: p.id } })}
          >
            <Card style={elevation.card}>
              <View style={{ padding: space.base, gap: space.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <T variant="label" tone="muted" style={{ flex: 1 }}>ZADATAK</T>
                  <T variant="meta" tone="orange">{p.statusTekst}</T>
                </View>
                <T variant="heading">{p.naslov}</T>
                <View style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <MapPin size={16} color={palette.teal500} />
                    <T variant="meta" tone="muted" style={{ flex: 1 }}>{p.podrucjeTekst}</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Clock size={16} color={palette.teal500} />
                    <T variant="meta" tone="muted" style={{ flex: 1 }}>{p.vremeTekst}</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Users size={16} color={palette.teal500} />
                    <T variant="meta" tone="muted">Popunjeno {p.pokrivenost.popunjeno} od {p.pokrivenost.ukupno} mesta</T>
                  </View>
                </View>
                {p.uslovi.length > 0 && <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                  {p.uslovi.map((uslov, index) => <View key={`${index}:${uslov}`}
                    style={{ backgroundColor: palette.cream050, borderRadius: radius.pill,
                      paddingHorizontal: space.md, paddingVertical: space.xs }}>
                    <T variant="meta" tone="muted">{uslov}</T>
                  </View>)}
                </View>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md,
                  borderTopWidth: 1, borderTopColor: palette.line100, paddingTop: space.md }}>
                  <View style={{ flex: 1, gap: space.xs }}>
                    <T variant="meta">{p.narucilacIme || 'Naručilac'}</T>
                    {p.narucilacOcena && <T variant="meta" tone="muted">★ {p.narucilacOcena}</T>}
                  </View>
                  <CaretRight size={20} color={palette.ink} />
                </View>
              </View>
            </Card>
          </Press>
        )}
      />
    </SafeAreaView>
  );
}
