import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight, Clock, MapPin, PencilSimple, UserMinus, Users } from 'phosphor-react-native';

import type { PotrebaProjekcija, StanjePotrebe } from '../../../../contracts/projections';
import { ru4Production } from '../../../../data/ru4Production';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { useIzvor } from '../../../../store/uloga';
import { palette, space, radius, elevation, touch } from '../../../../theme/tokens';
import { Card } from '../../../../ui/Button';
import { Press } from '../../../../ui/Press';
import { T } from '../../../../ui/Text';

const STATUS: Record<StanjePotrebe, string> = {
  NACRT: 'Nacrt',
  OBJAVLJENA: 'Objavljena',
  CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjena',
  POPUNJENA: 'Popunjena',
  ZATVORENA: 'Zatvorena',
};

export default function PregledPotrebe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const izvor = useIzvor();
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [ucitava, setUcitava] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [preostalaPotragaZatvorena, setPreostalaPotragaZatvorena] = useState(false);
  const [akcijaUToku, setAkcijaUToku] = useState(false);

  const ucitaj = useCallback(() => {
    let ziv = true;
    if (!id) {
      setGreska('Potreba nije navedena.');
      setUcitava(false);
      return () => {
        ziv = false;
      };
    }

    setUcitava(true);
    setGreska(null);
    void Promise.all([izvor.potreba(id), ru4Production.remainingSearchState(id)])
      .then(([rezultat, searchState]) => {
        if (!ziv) return;
        setPotreba(rezultat);
        setPreostalaPotragaZatvorena(searchState.closed);
        if (!rezultat) setGreska('Potreba nije pronađena ili više nije dostupna.');
      })
      .catch((error: unknown) => {
        if (!ziv) return;
        setGreska(error instanceof Error ? error.message : 'Potreba nije mogla da se učita.');
      })
      .finally(() => {
        if (ziv) setUcitava(false);
      });

    return () => {
      ziv = false;
    };
  }, [id, izvor]);

  useFocusEffect(ucitaj);

  const zatvoriPreostaluPotragu = useCallback(() => {
    if (!potreba || akcijaUToku) return;
    const preostalo = potreba.pokrivenost.preostalo;
    Alert.alert(
      'Ne traži više nikoga?',
      `Zatvorićemo potragu za preostalih ${preostalo} ${preostalo === 1 ? 'mestom' : 'mesta'}. Postojeći Dogovori i originalni uslovi Zadatka ostaju nepromenjeni.`,
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Zatvori potragu',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setAkcijaUToku(true);
              const ishod = await ru4Production.closeRemainingSearch(
                potreba.id,
                potreba.revizija,
                noviZahtevId('zatvori-preostalu-potragu'),
              );
              setAkcijaUToku(false);
              if (!ishod.ok) {
                Alert.alert('Potraga nije zatvorena', ishod.poruka);
                return;
              }
              setPreostalaPotragaZatvorena(true);
              Alert.alert(
                'Preostala potraga je zatvorena',
                'Postojeći Dogovori ostaju isti. Originalni Zadatak nije prepisan.',
              );
            })();
          },
        },
      ],
    );
  }, [akcijaUToku, potreba]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View
        style={{
          minHeight: 58,
          paddingHorizontal: space.base,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
        }}
      >
        <Press
          accessibilityRole="button"
          accessibilityLabel="Nazad"
          haptic="select"
          onPress={() => router.back()}
          style={{
            width: touch.min,
            height: touch.min,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={21} color={palette.ink} />
        </Press>
        <T variant="title" style={{ flex: 1 }}>Pregled Zadatka</T>
      </View>

      {ucitava ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.teal500} />
        </View>
      ) : greska || !potreba ? (
        <View style={{ flex: 1, padding: space.base, justifyContent: 'center', gap: space.md }}>
          <T variant="heading">Zadatak nije dostupan</T>
          <T variant="body" tone="muted">{greska ?? 'Pokušajte ponovo.'}</T>
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
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.base, paddingBottom: space.xxl, gap: space.base }}
          showsVerticalScrollIndicator={false}
        >
          <Card style={elevation.card}>
            <View style={{ padding: space.base, gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.orange }} />
                <T variant="label" tone="muted" style={{ flex: 1 }}>ZADATAK</T>
                <T variant="meta" tone="orange" style={{ fontWeight: '800' }}>
                  {STATUS[potreba.stanje]}
                </T>
              </View>

              <T variant="display">{potreba.naslov}</T>
              <T variant="body" tone="muted">{potreba.opis}</T>

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: palette.line100,
                  paddingTop: space.md,
                  gap: space.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <MapPin size={17} color={palette.teal500} />
                  <T variant="body" style={{ flex: 1 }}>{potreba.podrucjeTekst}</T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Clock size={17} color={palette.teal500} />
                  <T variant="body" style={{ flex: 1 }}>{potreba.vremeTekst}</T>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Users size={17} color={palette.teal500} />
                  <T variant="body" style={{ flex: 1 }}>
                    {potreba.pokrivenost.popunjeno} od {potreba.pokrivenost.ukupno} mesta dogovoreno
                  </T>
                </View>
              </View>

              <View style={{ height: 7, borderRadius: radius.pill, backgroundColor: palette.cream050, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, potreba.pokrivenost.udeo * 100))}%`,
                    borderRadius: radius.pill,
                    backgroundColor: palette.teal500,
                  }}
                />
              </View>

              {potreba.ponudjenaCena && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: palette.cream050,
                  }}
                >
                  <T variant="meta" tone="muted">Vaša cena</T>
                  <T variant="heading">{potreba.ponudjenaCena.prikaz}</T>
                </View>
              )}

              {potreba.uslovi.length > 0 && (
                <View style={{ gap: space.sm }}>
                  <T variant="label" tone="muted">USLOVI</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {potreba.uslovi.map((uslov) => (
                      <View
                        key={uslov}
                        style={{
                          borderWidth: 1,
                          borderColor: palette.line100,
                          borderRadius: radius.pill,
                          paddingHorizontal: space.md,
                          paddingVertical: 6,
                        }}
                      >
                        <T variant="meta" tone="muted" style={{ fontWeight: '700' }}>{uslov}</T>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </Card>

          {preostalaPotragaZatvorena ? (
            <View
              style={{
                padding: space.base,
                borderRadius: radius.lg,
                backgroundColor: palette.cream050,
                borderWidth: 1,
                borderColor: palette.line100,
                gap: 4,
              }}
            >
              <T variant="bodyStrong">Preostala potraga je zatvorena</T>
              <T variant="meta" tone="muted">
                Originalni Zadatak i postojeći Dogovori ostaju nepromenjeni.
              </T>
            </View>
          ) : null}

          {potreba.pokrivenost.popunjeno === 0 &&
          !preostalaPotragaZatvorena &&
          potreba.stanje !== 'NACRT' &&
          potreba.stanje !== 'ZATVORENA' ? (
            <Press
              accessibilityRole="button"
              accessibilityLabel="Izmeni Zadatak"
              haptic="light"
              onPress={() => router.push({ pathname: '/potrebe/[id]/izmeni' as any, params: { id: potreba.id } })}
              style={{
                minHeight: touch.min,
                paddingHorizontal: space.base,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: palette.line100,
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.surface,
              }}
            >
              <PencilSimple size={18} color={palette.ink} />
              <T variant="action">Izmeni Zadatak</T>
            </Press>
          ) : null}

          {potreba.pokrivenost.popunjeno > 0 &&
          potreba.pokrivenost.preostalo > 0 &&
          !preostalaPotragaZatvorena ? (
            <Press
              accessibilityRole="button"
              accessibilityLabel="Ne traži više nikoga"
              accessibilityState={{ disabled: akcijaUToku }}
              disabled={akcijaUToku}
              haptic="medium"
              onPress={zatvoriPreostaluPotragu}
              style={{
                minHeight: touch.min,
                paddingHorizontal: space.base,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: palette.line100,
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: akcijaUToku ? 0.55 : 1,
              }}
            >
              {akcijaUToku ? <ActivityIndicator size="small" color={palette.ink} /> : <UserMinus size={18} color={palette.ink} />}
              <T variant="action">Ne traži više nikoga</T>
            </Press>
          ) : null}

          <Press
            accessibilityRole="button"
            accessibilityLabel={`Otvori prijave, ukupno ${potreba.brojPrijava}`}
            haptic="light"
            onPress={() =>
              router.push({ pathname: '/potrebe/[id]/kandidati', params: { id: potreba.id } })
            }
          >
            <Card style={elevation.card}>
              <View
                style={{
                  minHeight: 72,
                  padding: space.base,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                }}
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="heading">Prijave</T>
                  <T variant="meta" tone="muted">
                    {potreba.brojPrijava === 0
                      ? 'Još nema kandidata za ovaj Zadatak.'
                      : `${potreba.brojPrijava} ${potreba.brojPrijava === 1 ? 'kandidat' : 'kandidata'} za pregled`}
                  </T>
                </View>
                <CaretRight size={19} color={palette.ink} />
              </View>
            </Card>
          </Press>

          <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>
            Revizija {potreba.revizija}. Izbor kandidata se vezuje za ovu autoritativnu verziju Zadatka.
          </T>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
