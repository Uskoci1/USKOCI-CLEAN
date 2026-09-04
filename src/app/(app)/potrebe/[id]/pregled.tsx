import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight, Clock, MapPin, PencilSimple, Users } from 'phosphor-react-native';

import type { PotrebaProjekcija, StanjePotrebe } from '../../../../contracts/projections';
import { ru4Izvor } from '../../../../data';
import { mozeIzmenaJavnogZadatka } from '../../../../data/ru4Source';
import { useIzvor } from '../../../../store/uloga';
import { palette, space, radius, elevation, touch } from '../../../../theme/tokens';
import { Button, Card } from '../../../../ui/Button';
import { Press } from '../../../../ui/Press';
import { T } from '../../../../ui/Text';

const STATUS: Record<StanjePotrebe, string> = {
  NACRT: 'Nacrt',
  OBJAVLJENA: 'Objavljen',
  CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjen',
  POPUNJENA: 'Popunjen',
  ZATVORENA: 'Zatvoren',
};

export default function PregledPotrebe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const izvor = useIzvor();
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [ucitava, setUcitava] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [akcijaGreska, setAkcijaGreska] = useState<string | null>(null);
  const [pripremaIzmenu, setPripremaIzmenu] = useState(false);
  const reviseRequestId = useRef(`ru4-revise-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const ucitaj = useCallback(() => {
    let ziv = true;
    if (!id) {
      setGreska('Zadatak nije naveden.');
      setUcitava(false);
      return () => {
        ziv = false;
      };
    }

    setUcitava(true);
    setGreska(null);
    void izvor
      .potreba(id)
      .then((rezultat) => {
        if (!ziv) return;
        setPotreba(rezultat);
        if (!rezultat) setGreska('Zadatak nije pronađen ili više nije dostupan.');
      })
      .catch((error: unknown) => {
        if (!ziv) return;
        setGreska(error instanceof Error ? error.message : 'Zadatak nije mogao da se učita.');
      })
      .finally(() => {
        if (ziv) setUcitava(false);
      });

    return () => {
      ziv = false;
    };
  }, [id, izvor]);

  useFocusEffect(ucitaj);

  const pripremiBezbednuIzmenu = useCallback(async () => {
    if (!potreba || pripremaIzmenu) return;
    setPripremaIzmenu(true);
    setAkcijaGreska(null);
    try {
      const rezultat = await ru4Izvor.pripremiIzmenu({
        zadatakId: potreba.id,
        ocekivanaRevizija: potreba.revizija,
        clientRequestId: reviseRequestId.current,
        razlog: 'REQUESTER_EDIT_FROM_R04',
      });
      if (!rezultat.ok) {
        setAkcijaGreska(rezultat.poruka);
        return;
      }
      router.push({ pathname: '/potrebe/[id]/izmeni', params: { id: rezultat.podatak.zadatakId } });
    } finally {
      setPripremaIzmenu(false);
    }
  }, [potreba, pripremaIzmenu]);

  const potvrdiIzmenu = useCallback(() => {
    Alert.alert(
      'Izmeniti Zadatak?',
      'Zadatak će prvo biti sklonjen iz javnosti. Neizabrane Prijave će morati ponovo da se pregledaju, a postojeći Dogovori ostaju nepromenjeni.',
      [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Nastavi', onPress: () => void pripremiBezbednuIzmenu() },
      ],
    );
  }, [pripremiBezbednuIzmenu]);

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
                    {potreba.pokrivenost.popunjeno} od {potreba.pokrivenost.ukupno} mesta pokriveno
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

          {akcijaGreska ? (
            <Card>
              <View style={{ padding: space.md }}>
                <T variant="body" tone="danger">{akcijaGreska}</T>
              </View>
            </Card>
          ) : null}

          {mozeIzmenaJavnogZadatka(potreba.stanje) ? (
            <Card>
              <View style={{ padding: space.base, gap: space.sm }}>
                <T variant="heading">Potrebna je izmena?</T>
                <T variant="meta" tone="muted">
                  Pre izmene Zadatak se bezbedno sklanja iz javnosti. Izabrani Dogovori se ne menjaju.
                </T>
                <Button
                  label={pripremaIzmenu ? 'Pripremam izmenu…' : 'Izmeni Zadatak'}
                  kind="secondary"
                  full
                  disabled={pripremaIzmenu}
                  icon={<PencilSimple size={18} color={palette.ink} />}
                  onPress={potvrdiIzmenu}
                />
              </View>
            </Card>
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
