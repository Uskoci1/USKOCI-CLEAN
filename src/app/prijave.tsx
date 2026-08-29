import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CaretLeft, Clock, Truck, User, Sparkle, Check, Warning } from 'phosphor-react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
  ReduceMotion,
} from 'react-native-reanimated';

import { T } from '../ui/Text';
import { Press } from '../ui/Press';
import { Card } from '../ui/Button';
import { palette, space, radius, elevation, motion, touch } from '../theme/tokens';
import { useIzvor } from '../store/uloga';
import type { KandidatProjekcija, PotrebaProjekcija } from '../contracts/projections';

const naUredjaju = Platform.OS !== 'web';

/** Durabilan po nameri izbora — isti tap ne sme da napravi dva Dogovora. */
function noviZahtevId(prijavaId: string) {
  return `izbor:${prijavaId}:${Date.now().toString(36)}`;
}

export default function Prijave() {
  const izvor = useIzvor();
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [kandidati, setKandidati] = useState<KandidatProjekcija[]>([]);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [uToku, setUToku] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [greska, setGreska] = useState<{ naslov: string; tekst: string } | null>(null);
  const reduced = useReducedMotion();

  const napredak = useSharedValue(0);
  const traka = useAnimatedStyle(() => ({ width: `${napredak.get() * 100}%` }));
  const prviUcitan = useRef(false);

  const osvezi = useCallback(async () => {
    const [p, k] = await Promise.all([izvor.potreba('ormar'), izvor.prijaveZaPotrebu('ormar')]);
    setPotreba(p);
    setKandidati(k);
    setUcitavanje(false);
    if (p) {
      const udeo = p.pokrivenost.udeo;
      napredak.set(
        reduced || !prviUcitan.current
          ? withTiming(udeo, { duration: prviUcitan.current ? 0 : 350 })
          : withSpring(udeo, { ...motion.spring, reduceMotion: ReduceMotion.System }),
      );
      prviUcitan.current = true;
    }
  }, [napredak, reduced]);

  useEffect(() => {
    osvezi();
  }, [osvezi]);

  const izaberi = useCallback(
    async (k: KandidatProjekcija) => {
      if (!potreba || uToku) return;
      setUToku(k.prijavaId);
      setGreska(null);

      // Izbor vezuje TAČNU reviziju Potrebe i TAČNU verziju/hash Prijave.
      // Bez toga izbor nije atomski i može da potvrdi nešto što niste videli.
      const ishod = await izvor.izaberiPrijavu({
        clientRequestId: noviZahtevId(k.prijavaId),
        potrebaId: potreba.id,
        potrebaRevizija: potreba.revizija,
        prijavaId: k.prijavaId,
        prijavaVerzija: k.verzija,
        prijavaHash: k.hash,
        mesta: k.pokrivaMesta,
      });

      setUToku(null);

      if (!ishod.ok) {
        // Odbijanje nije tihi neuspeh — ekran mora da ga pokaže i ponudi izlaz.
        setGreska({ naslov: ishod.naslov ?? 'Izbor nije moguć', tekst: ishod.poruka });
        await osvezi();
        return;
      }

      await osvezi();
      const p = await izvor.potreba('ormar');
      const ostalo = p?.pokrivenost.preostalo ?? 0;
      setPoruka(
        ostalo > 0
          ? `${k.ime} je izabran · još ${ostalo} ${ostalo === 1 ? 'mesto' : 'mesta'}`
          : `${k.ime} je izabran · sva mesta su popunjena`,
      );
      setTimeout(() => setPoruka(null), 3200);
    },
    [potreba, uToku, osvezi],
  );

  if (ucitavanje || !potreba) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, justifyContent: 'center' }}>
        <ActivityIndicator color={palette.teal500} />
      </SafeAreaView>
    );
  }

  const p = potreba.pokrivenost;
  const izabrani = kandidati.filter((k) => k.stanje === 'IZABRANA');
  const slobodni = kandidati.filter((k) => k.stanje !== 'IZABRANA');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingBottom: space.sm }}>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Nazad"
          haptic="select"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <CaretLeft size={22} color={palette.ink} weight="bold" />
        </Press>
        <T variant="heading" style={{ flex: 1, textAlign: 'center', marginRight: touch.min }}>
          Prijave
        </T>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.huge, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: space.sm }}>
          <T variant="meta" tone="muted" numberOfLines={1}>
            {potreba.naslov}
          </T>

          {p.preostalo > 0 ? (
            <T variant="display">
              Još treba{' '}
              <T variant="display" tone="orange">
                {p.preostalo} {p.preostalo === 1 ? 'osoba' : 'osobe'}
              </T>
            </T>
          ) : (
            <T variant="display">Sva mesta su popunjena</T>
          )}

          <View
            style={{
              height: 8,
              borderRadius: radius.pill,
              backgroundColor: palette.line100,
              overflow: 'hidden',
              marginTop: space.xs,
            }}
          >
            <Animated.View
              style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: palette.forest800 }, traka]}
            />
          </View>

          <T variant="meta" tone="muted">
            <T variant="meta" style={{ fontWeight: '800' }}>{p.popunjeno}</T> od{' '}
            <T variant="meta" style={{ fontWeight: '800' }}>{p.ukupno}</T> popunjeno
          </T>
        </View>

        {/* Server je odbio izbor. Razlog se kaže, ne guta. */}
        {greska && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              gap: space.md,
              padding: space.base,
              borderRadius: radius.lg,
              backgroundColor: palette.warnBg,
              borderWidth: 1,
              borderColor: palette.line100,
            }}
          >
            <Warning size={19} color={palette.warn} weight="fill" />
            <View style={{ flex: 1, gap: 3 }}>
              <T variant="bodyStrong">{greska.naslov}</T>
              <T variant="meta" tone="muted">{greska.tekst}</T>
            </View>
          </View>
        )}

        {izabrani.length > 0 && (
          <Card style={elevation.card}>
            <View style={{ padding: space.base, gap: space.md }}>
              <T variant="label" tone="muted">IZABRANI</T>
              {izabrani.map((k) => (
                <View key={k.prijavaId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View
                    style={{
                      width: 38, height: 38, borderRadius: radius.md,
                      backgroundColor: palette.successBg, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Check size={19} color={palette.success} weight="bold" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{k.ime}</T>
                    <T variant="meta" tone="muted">
                      {k.pokrivaMesta} {k.pokrivaMesta === 1 ? 'mesto' : 'mesta'} · {k.cena.prikaz}
                    </T>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {p.preostalo > 0 && (
          <T variant="label" tone="muted">
            {slobodni.length} PRIJAVA ZA PREOSTALA MESTA
          </T>
        )}

        {p.preostalo > 0 &&
          slobodni.map((k, i) => {
            const preporucen = !!k.razlogPreporuke;
            const radi = uToku === k.prijavaId;

            return (
              <Animated.View
                key={k.prijavaId}
                entering={naUredjaju ? FadeInDown.duration(motion.enter).delay(60 + i * 45) : undefined}
              >
                <Card style={[elevation.card, preporucen && { borderColor: palette.orange, borderWidth: 1.5 }]}>
                  {preporucen && (
                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: palette.orangeSoft,
                        paddingHorizontal: space.base, paddingVertical: space.sm,
                      }}
                    >
                      <Sparkle size={14} color={palette.orangeInk} weight="fill" />
                      <T variant="label" tone="orange">PREPORUČENO</T>
                      <T variant="meta" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                        {k.razlogPreporuke}
                      </T>
                    </View>
                  )}

                  <View style={{ padding: space.base, gap: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <View
                        style={{
                          width: 44, height: 44, borderRadius: radius.md,
                          backgroundColor: palette.successBg, alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <T variant="bodyStrong" tone="success">{k.inicijali}</T>
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <T variant="heading">{k.ime}</T>
                        <T variant="meta" tone="muted">{k.ocenaTekst} · {k.recenzijeTekst}</T>
                      </View>
                      <View
                        style={{
                          backgroundColor: palette.successBg, borderRadius: radius.pill,
                          paddingHorizontal: space.md, paddingVertical: 5,
                        }}
                      >
                        <T variant="meta" tone="success" style={{ fontWeight: '700' }}>
                          {k.pokrivaMesta}/{p.ukupno} mesta
                        </T>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: space.base,
                        borderTopWidth: 1, borderTopColor: palette.line100, paddingTop: space.md,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Clock size={15} color={palette.teal500} />
                        <T variant="meta" tone="muted">{k.dolazakTekst}</T>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {k.prevozTekst === 'Bez vozila' ? (
                          <User size={15} color={palette.teal500} />
                        ) : (
                          <Truck size={15} color={palette.teal500} />
                        )}
                        <T variant="meta" tone="muted">{k.prevozTekst}</T>
                      </View>
                      <View
                        style={{
                          marginLeft: 'auto', backgroundColor: palette.cream050,
                          borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 4,
                        }}
                      >
                        <T variant="meta" style={{ fontWeight: '800' }}>{k.cena.prikaz}</T>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Press
                        accessibilityRole="button"
                        accessibilityLabel={`Profil: ${k.ime}`}
                        haptic="select"
                        style={{
                          minHeight: touch.min, paddingHorizontal: space.base, borderRadius: radius.md,
                          borderWidth: 1, borderColor: palette.line100,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <T variant="action" tone="muted">Profil</T>
                      </Press>

                      <Press
                        accessibilityRole="button"
                        accessibilityLabel={`Izaberi: ${k.ime}`}
                        accessibilityState={{ disabled: !!uToku }}
                        disabled={!!uToku}
                        haptic="success"
                        onPress={() => izaberi(k)}
                        style={{
                          flex: 1, minHeight: touch.min, borderRadius: radius.md,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: preporucen ? palette.orange : 'transparent',
                          borderWidth: preporucen ? 0 : 1.5,
                          borderColor: palette.ink,
                          opacity: uToku && !radi ? 0.45 : 1,
                        }}
                      >
                        {radi ? (
                          <ActivityIndicator size="small" color={preporucen ? palette.onOrange : palette.ink} />
                        ) : (
                          <T variant="action" tone={preporucen ? 'onOrange' : 'ink'}>Izaberi</T>
                        )}
                      </Press>
                    </View>
                  </View>
                </Card>
              </Animated.View>
            );
          })}
      </ScrollView>

      {poruka && (
        <Animated.View
          entering={naUredjaju ? FadeInDown.duration(motion.enter) : undefined}
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute', left: space.base, right: space.base, bottom: space.xl,
            backgroundColor: palette.forest800, borderRadius: radius.lg,
            paddingVertical: space.md, paddingHorizontal: space.base,
            flexDirection: 'row', alignItems: 'center', gap: space.sm,
            ...elevation.raised,
          }}
        >
          <Check size={18} color={palette.onDark} weight="bold" />
          <T variant="meta" tone="onDark" style={{ flex: 1, fontWeight: '600' }}>{poruka}</T>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
