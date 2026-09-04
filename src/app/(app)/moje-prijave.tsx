import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowClockwise, CheckCircle, ClockCounterClockwise, WarningCircle } from 'phosphor-react-native';

import { ru4Izvor } from '../../data';
import type { MojaPrijavaRu4 } from '../../data/ru4Source';
import { palette, radius, space } from '../../theme/tokens';
import { Button, Card } from '../../ui/Button';
import { T } from '../../ui/Text';

function statusTekst(prijava: MojaPrijavaRu4): string {
  switch (prijava.stanje) {
    case 'IZABRANA': return 'Izabrani ste';
    case 'STALE_REVIEW_REQUIRED': return 'Potrebno je ponovo pregledati';
    case 'POVUCENA': return 'Povučena';
    case 'ZATVORENA': return 'Zatvorena';
    case 'POPUNJENO': return 'Zadatak je popunjen';
    default: return 'Poslata';
  }
}

function StatusIkona({ prijava }: { prijava: MojaPrijavaRu4 }) {
  if (prijava.stanje === 'STALE_REVIEW_REQUIRED') {
    return <WarningCircle size={22} color={palette.orangeInk} weight="fill" />;
  }
  if (prijava.stanje === 'IZABRANA') {
    return <CheckCircle size={22} color={palette.success} weight="fill" />;
  }
  return <ClockCounterClockwise size={21} color={palette.teal500} />;
}

export default function MojePrijave() {
  const [prijave, setPrijave] = useState<MojaPrijavaRu4[]>([]);
  const [ucitava, setUcitava] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const ucitaj = useCallback(() => {
    let ziv = true;
    setUcitava(true);
    setGreska(null);
    void ru4Izvor.mojePrijave()
      .then((result) => {
        if (!ziv) return;
        if (!result.ok) {
          setGreska(result.poruka);
          setPrijave([]);
          return;
        }
        setPrijave(result.podatak);
      })
      .catch((error: unknown) => {
        if (!ziv) return;
        setGreska(error instanceof Error ? error.message : 'Prijave nisu mogle da se učitaju.');
      })
      .finally(() => {
        if (ziv) setUcitava(false);
      });
    return () => {
      ziv = false;
    };
  }, []);

  useFocusEffect(ucitaj);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View style={{ paddingHorizontal: space.base, paddingTop: space.md, paddingBottom: space.sm, gap: space.xs }}>
        <T variant="display">Prijave</T>
        <T variant="body" tone="muted">Vaše poslate Prijave i promene koje traže pažnju.</T>
      </View>

      {ucitava ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.teal500} />
        </View>
      ) : greska ? (
        <View style={{ flex: 1, padding: space.base, justifyContent: 'center', gap: space.md }}>
          <T variant="heading">Prijave trenutno nisu dostupne</T>
          <T variant="body" tone="danger">{greska}</T>
          <Button label="Pokušajte ponovo" icon={<ArrowClockwise size={18} color={palette.ink} />} kind="secondary" onPress={() => { const cleanup = ucitaj(); void cleanup; }} />
        </View>
      ) : prijave.length === 0 ? (
        <View style={{ flex: 1, padding: space.base, justifyContent: 'center', alignItems: 'center', gap: space.sm }}>
          <T variant="heading">Još nemate Prijave</T>
          <T variant="body" tone="muted" style={{ textAlign: 'center' }}>
            Kada se prijavite na Zadatak, ovde ćete pratiti njegov status.
          </T>
          <Button label="Pogledaj Zadатke" onPress={() => router.push('/prilike')} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.base, paddingBottom: space.huge, gap: space.md }}
          showsVerticalScrollIndicator={false}
        >
          {prijave.map((prijava) => {
            const stale = prijava.stanje === 'STALE_REVIEW_REQUIRED';
            return (
              <Card key={prijava.prijavaId} raised={stale}>
                <View style={{ padding: space.base, gap: space.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                    <StatusIkona prijava={prijava} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <T variant="heading">{prijava.naslov}</T>
                      <T variant="meta" tone={stale ? 'orange' : 'muted'} style={{ fontWeight: '800' }}>
                        {statusTekst(prijava)}
                      </T>
                    </View>
                  </View>

                  {stale ? (
                    <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: palette.warnBg, gap: space.xs }}>
                      <T variant="body" style={{ fontWeight: '800' }}>Zadatak je izmenjen.</T>
                      <T variant="meta" tone="muted">
                        Vaša stara Prijava više nije izborna dok ne pregledate novu verziju. Ne potvrđujemo je automatski u Vaše ime.
                      </T>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    <View style={{ paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: palette.cream050 }}>
                      <T variant="meta">{prijava.cenaRsd.toLocaleString('sr-Latn-RS')} RSD</T>
                    </View>
                    <View style={{ paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: palette.cream050 }}>
                      <T variant="meta">{prijava.pokrivaMesta} {prijava.pokrivaMesta === 1 ? 'mesto' : 'mesta'}</T>
                    </View>
                  </View>

                  <T variant="meta" tone="muted">
                    Poslato na reviziju {prijava.poslataNaReviziju} · {prijava.podnetaTekst}
                  </T>

                  {stale && !prijava.zadatakJavan ? (
                    <T variant="meta" tone="muted">
                      Nova verzija je trenutno privatni nacrt. Kada ponovo bude javno dopuštena, ovde će biti dostupna za pregled.
                    </T>
                  ) : prijava.zadatakJavan ? (
                    <Button
                      label={stale ? 'Pregledaj novu verziju' : 'Otvori Zadatak'}
                      kind="secondary"
                      full
                      onPress={() => router.push({ pathname: '/prilike/[id]', params: { id: prijava.zadatakId } })}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
