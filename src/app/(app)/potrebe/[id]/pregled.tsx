import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CaretRight, Clock, MapPin, PencilSimple, UserMinus, Users } from 'phosphor-react-native';

import type { StanjePotrebe } from '../../../../contracts/projections';
import { useFocusedResource } from '../../../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { ru4Production } from '../../../../data/ru4Production';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { ulogaSada, useIzvor, useUloga } from '../../../../store/uloga';
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
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const izvor = useIzvor();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id, intent = useUloga();
  const active = useRef(false), actionLock = useRef(false);
  const current = useCallback(() => active.current && !!accountId && sesijaSada().user?.id === accountId &&
    sesijaSada().accountRevision === accountRevision && ulogaSada() === intent, [accountId, accountRevision, intent]);
  useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; }; }, [current, id]));
  const validId = typeof id === 'string' && id.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const load = useCallback(async () => {
    if (!validId) return null;
    const potreba = await izvor.potreba(id as string);
    if (!potreba || !current()) return null;
    // A saved unpublished draft does not depend on the remaining-search engine.
    const search = potreba.stanje === 'NACRT' ? { closed: false } : await ru4Production.remainingSearchState(potreba.id);
    return { potreba, closed: search.closed };
  }, [current, id, izvor, validId]);
  const resource = useFocusedResource(load);
  const potreba = resource.data?.potreba ?? null;
  const ucitava = resource.loading;
  const greska = resource.error ? 'Zadatak nije mogao da se učita. Proverite vezu i pokušajte ponovo.' : null;
  const preostalaPotragaZatvorena = resource.data?.closed ?? false;
  const [akcijaUToku, setAkcijaUToku] = useState(false);

  const zatvoriPreostaluPotragu = useCallback(() => {
    if (!potreba || akcijaUToku || actionLock.current || !current()) return;
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
            if (!current() || actionLock.current) return;
            actionLock.current = true;
            void (async () => {
              try {
              setAkcijaUToku(true);
              const ishod = await ru4Production.closeRemainingSearch(
                potreba.id,
                potreba.revizija,
                noviZahtevId('zatvori-preostalu-potragu'),
              );
              if (!current()) return;
              if (!ishod.ok) {
                Alert.alert('Potraga nije zatvorena', ishod.poruka);
                return;
              }
              void resource.refresh();
              Alert.alert(
                'Preostala potraga je zatvorena',
                'Postojeći Dogovori ostaju isti. Originalni Zadatak nije prepisan.',
              );
              } catch { if (current()) Alert.alert('Potraga nije zatvorena', 'Potvrda nije stigla. Osvežite Zadatak.'); }
              finally { actionLock.current = false; if (current()) setAkcijaUToku(false); }
            })();
          },
        },
      ],
    );
  }, [akcijaUToku, current, potreba, resource.refresh]);

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
          onPress={() => { if (current()) router.canGoBack() ? router.back() : router.replace('/potrebe'); }}
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
            onPress={() => void resource.refresh()}
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
              {potreba.kategorija && <T variant="meta" tone="muted">Kategorija: {potreba.kategorija}</T>}
              {!!potreba.brojFotografija && <T variant="meta" tone="muted">Sačuvane fotografije: {potreba.brojFotografija}</T>}

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
              {potreba.rezimCene === 'OFFERS' && <T variant="heading">Očekujete ponude</T>}

              {potreba.uslovi.length > 0 && (
                <View style={{ gap: space.sm }}>
                  <T variant="label" tone="muted">USLOVI</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {potreba.uslovi.map((uslov, index) => (
                      <View
                        key={`${index}:${uslov}`}
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
              onPress={() => { if (current()) router.push({ pathname: '/potrebe/[id]/izmeni' as any, params: { id: potreba.id } }); }}
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

          {potreba.stanje !== 'NACRT' ? <Press
            accessibilityRole="button"
            accessibilityLabel={`Otvori prijave, ukupno ${potreba.brojPrijava}`}
            haptic="light"
            onPress={() =>
              current() && router.push({ pathname: '/potrebe/[id]/kandidati', params: { id: potreba.id } })
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
          </Press> : <T variant="body" tone="muted">Nacrt je sačuvan. Još nije objavljen i ne prima prijave.</T>}

          <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>
            {potreba.stanje === 'NACRT' ? 'Sačuvani nacrt je dostupan u Zadacima.' : `Revizija ${potreba.revizija}.`}
          </T>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
