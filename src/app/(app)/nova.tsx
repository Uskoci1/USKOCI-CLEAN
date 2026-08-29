import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  PaperPlaneTilt, Check, Sparkle, PencilSimple, Warning, Info, ShieldCheck,
} from 'phosphor-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, motion, touch } from '../../theme/tokens';
import { useIzvor } from '../../store/uloga';
import type {
  Cinjenica, KljucCinjenice, NacrtPotrebeProjekcija, PorukaRazgovora,
} from '../../contracts/projections';

const naUredjaju = Platform.OS !== 'web';

const NAZIV: Record<KljucCinjenice, string> = {
  naslov: 'Naslov',
  opis: 'Opis',
  kategorija: 'Kategorija',
  datum: 'Datum',
  vreme: 'Vreme',
  polaziste: 'Polazište',
  odrediste: 'Odredište',
  osoba: 'Ljudi',
  vozilo: 'Vozilo',
  uslovi: 'Uslovi',
};

/** Redosled u kartici je fiksan, da se podaci ne premeštaju dok razgovor teče. */
const REDOSLED: KljucCinjenice[] = [
  'naslov', 'kategorija', 'datum', 'vreme', 'polaziste', 'odrediste', 'osoba', 'vozilo', 'uslovi', 'opis',
];

export default function NovaPotreba() {
  const izvor = useIzvor();
  const [razgovorId, setRazgovorId] = useState<string | null>(null);
  const [poruke, setPoruke] = useState<PorukaRazgovora[]>([]);
  const [nacrt, setNacrt] = useState<NacrtPotrebeProjekcija | null>(null);
  const [unos, setUnos] = useState('');
  const [radi, setRadi] = useState(false);
  const [ispravka, setIspravka] = useState<{ id: string; tekst: string } | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const skrol = useRef<ScrollView>(null);

  const osvezi = useCallback(async (id: string) => {
    const s = await izvor.razgovor(id);
    if (!s) return;
    setPoruke(s.poruke);
    setNacrt(s.nacrt);
  }, []);

  useEffect(() => {
    izvor.otvoriRazgovor().then((o) => {
      if (!o.ok) return;
      setRazgovorId(o.podatak.razgovorId);
      osvezi(o.podatak.razgovorId);
    });
  }, [osvezi]);

  const posalji = useCallback(async () => {
    const telo = unos.trim();
    if (!telo || !razgovorId || radi) return;
    setUnos('');
    setRadi(true);
    await izvor.posaljiKorisnikovuPoruku(razgovorId, telo);
    await osvezi(razgovorId);
    setRadi(false);
    requestAnimationFrame(() => skrol.current?.scrollToEnd({ animated: true }));
  }, [unos, razgovorId, radi, osvezi]);

  const potvrdi = useCallback(
    async (c: Cinjenica) => {
      if (!razgovorId) return;
      const i = await izvor.potvrdiCinjenicu(c.id);
      if (!i.ok) setGreska(i.poruka);
      await osvezi(razgovorId);
    },
    [razgovorId, osvezi],
  );

  const sacuvajIspravku = useCallback(async () => {
    if (!ispravka || !razgovorId) return;
    await izvor.ispraviCinjenicu(ispravka.id, ispravka.tekst);
    setIspravka(null);
    await osvezi(razgovorId);
  }, [ispravka, razgovorId, osvezi]);

  const objavi = useCallback(async () => {
    if (!razgovorId) return;
    const i = await izvor.objaviPotrebu(razgovorId);
    if (!i.ok) {
      setGreska(i.poruka);
      return;
    }
    router.replace('/potrebe');
  }, [razgovorId]);

  if (!nacrt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, justifyContent: 'center' }}>
        <ActivityIndicator color={palette.teal500} />
      </SafeAreaView>
    );
  }

  const poKljucu = new Map(nacrt.cinjenice.map((c) => [c.kljuc, c]));
  const vidljive = REDOSLED.map((k) => poKljucu.get(k)).filter(Boolean) as Cinjenica[];
  const zaPotvrdu = vidljive.filter((c) => c.status !== 'POTVRDJENO').length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      {/*
        LIVE KARTICA.
        Ovo nije poseban state — ovo je druga projekcija istog nacrta koji
        vidi i chat. Zato ispravka u razgovoru odmah menja i ovo.
      */}
      <View style={{ paddingHorizontal: space.base, paddingTop: space.sm, paddingBottom: space.md }}>
        <Card style={elevation.card}>
          <View style={{ padding: space.base, gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <T variant="label" tone="muted" style={{ flex: 1 }}>
                {nacrt.cinjenice.length === 0 ? 'POTREBA SE POPUNJAVA' : 'OVAKO ĆE POTREBA IZGLEDATI'}
              </T>
              {zaPotvrdu > 0 && (
                <View
                  style={{
                    backgroundColor: palette.orangeSoft, borderRadius: radius.pill,
                    paddingHorizontal: space.md, paddingVertical: 3,
                  }}
                >
                  <T variant="meta" tone="orange" style={{ fontWeight: '800' }}>
                    {zaPotvrdu} za potvrdu
                  </T>
                </View>
              )}
            </View>

            {vidljive.length === 0 ? (
              <T variant="meta" tone="muted">
                Recite šta Vam treba — podaci će se pojaviti ovde dok razgovaramo.
              </T>
            ) : (
              <View style={{ gap: space.sm }}>
                {vidljive.map((c) => {
                  const potvrdjena = c.status === 'POTVRDJENO';
                  const aiPredlog = c.izvor === 'AI_ZAKLJUCAK';
                  return (
                    <Animated.View
                      key={c.id}
                      entering={naUredjaju ? FadeIn.duration(motion.enter) : undefined}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
                    >
                      <T variant="meta" tone="muted" style={{ width: 78 }}>
                        {NAZIV[c.kljuc]}
                      </T>

                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <T
                          variant="meta"
                          style={{ fontWeight: potvrdjena ? '800' : '600' }}
                          numberOfLines={1}
                        >
                          {c.prikaz}
                        </T>
                        {aiPredlog && !potvrdjena && (
                          <Sparkle size={12} color={palette.orangeInk} weight="fill" />
                        )}
                      </View>

                      {potvrdjena ? (
                        <Check size={16} color={palette.success} weight="bold" />
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <Press
                            accessibilityRole="button"
                            accessibilityLabel={`Izmeni ${NAZIV[c.kljuc]}`}
                            haptic="select"
                            onPress={() => setIspravka({ id: c.id, tekst: c.prikaz })}
                            style={{
                              width: 34, height: 34, borderRadius: radius.sm,
                              borderWidth: 1, borderColor: palette.line100,
                              alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <PencilSimple size={14} color={palette.inkMuted} />
                          </Press>
                          <Press
                            accessibilityRole="button"
                            accessibilityLabel={`Potvrdi ${NAZIV[c.kljuc]}`}
                            haptic="light"
                            onPress={() => potvrdi(c)}
                            style={{
                              width: 34, height: 34, borderRadius: radius.sm,
                              backgroundColor: palette.successBg,
                              alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Check size={15} color={palette.success} weight="bold" />
                          </Press>
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            )}

            {/* Ishod safety gate-a — bez internog obrazloženja. */}
            {nacrt.bezbednost !== 'ALLOW' && nacrt.bezbednostPoruka && (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space.sm,
                  backgroundColor: nacrt.bezbednost === 'BLOCK' ? palette.dangerBg : palette.warnBg,
                  borderRadius: radius.md, padding: space.md,
                }}
              >
                {nacrt.bezbednost === 'BLOCK' ? (
                  <Warning size={16} color={palette.danger} weight="fill" />
                ) : nacrt.bezbednost === 'REVIEW' ? (
                  <ShieldCheck size={16} color={palette.warn} weight="fill" />
                ) : (
                  <Info size={16} color={palette.warn} />
                )}
                <T variant="meta" tone={nacrt.bezbednost === 'BLOCK' ? 'danger' : 'muted'} style={{ flex: 1 }}>
                  {nacrt.bezbednostPoruka}
                </T>
              </View>
            )}

            <Press
              accessibilityRole="button"
              accessibilityLabel="Objavi Potrebu"
              accessibilityState={{ disabled: !nacrt.spremnoZaObjavu }}
              disabled={!nacrt.spremnoZaObjavu}
              haptic="success"
              onPress={objavi}
              style={{
                minHeight: touch.min, borderRadius: radius.md,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: nacrt.spremnoZaObjavu ? palette.orange : palette.cream050,
              }}
            >
              <T variant="action" tone={nacrt.spremnoZaObjavu ? 'onOrange' : 'muted'}>
                {nacrt.spremnoZaObjavu
                  ? 'Objavite Potrebu'
                  : nacrt.nedostaje.length > 0
                    ? `Još ${nacrt.nedostaje.length} ${nacrt.nedostaje.length === 1 ? 'podatak' : 'podatka'}`
                    : 'Potvrdite podatke'}
              </T>
            </Press>
          </View>
        </Card>
      </View>

      {/* RAZGOVOR — druga projekcija istog nacrta. */}
      <ScrollView
        ref={skrol}
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.base, gap: space.sm }}
        showsVerticalScrollIndicator={false}
      >
        {poruke.map((m) => (
          <Animated.View
            key={m.id}
            entering={naUredjaju ? FadeInDown.duration(motion.enter) : undefined}
            style={{
              alignSelf: m.odAI ? 'flex-start' : 'flex-end',
              maxWidth: '86%',
              backgroundColor: m.odAI ? palette.surface : palette.forest800,
              borderWidth: m.odAI ? 1 : 0,
              borderColor: palette.line100,
              borderRadius: radius.lg,
              paddingVertical: space.md, paddingHorizontal: space.base,
              gap: 4,
            }}
          >
            <T variant="body" tone={m.odAI ? 'ink' : 'onDark'}>{m.telo}</T>
            {m.predlozene.length > 0 && (
              <T variant="meta" tone="onDarkMuted" style={{ fontSize: 12 }}>
                Popunjeno {m.predlozene.length} {m.predlozene.length === 1 ? 'podatak' : 'podataka'} sa strane
              </T>
            )}
          </Animated.View>
        ))}
        {radi && <ActivityIndicator color={palette.teal500} style={{ alignSelf: 'flex-start' }} />}
      </ScrollView>

      {greska && (
        <View style={{ paddingHorizontal: space.base, paddingBottom: space.sm }}>
          <T variant="meta" tone="danger">{greska}</T>
        </View>
      )}

      {/* Ispravka jednog podatka — potiskuje stari, ne prepisuje ga. */}
      {ispravka ? (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.sm,
            margin: space.base, padding: space.sm, paddingLeft: space.base,
            backgroundColor: palette.raised, borderRadius: radius.lg,
            borderWidth: 1.5, borderColor: palette.orange,
          }}
        >
          <TextInput
            value={ispravka.tekst}
            onChangeText={(t) => setIspravka({ ...ispravka, tekst: t })}
            autoFocus
            accessibilityLabel="Nova vrednost"
            onSubmitEditing={sacuvajIspravku}
            returnKeyType="done"
            style={{ flex: 1, fontSize: 16, color: palette.ink, paddingVertical: 6 }}
          />
          <Press
            accessibilityRole="button"
            accessibilityLabel="Odustani od izmene"
            haptic="select"
            onPress={() => setIspravka(null)}
            style={{ minHeight: 40, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center' }}
          >
            <T variant="meta" tone="muted">Odustani</T>
          </Press>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Sačuvaj izmenu"
            haptic="light"
            onPress={sacuvajIspravku}
            style={{
              minHeight: 40, paddingHorizontal: space.base, borderRadius: radius.md,
              backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <T variant="meta" tone="onOrange" style={{ fontWeight: '800' }}>Sačuvaj</T>
          </Press>
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.sm,
            margin: space.base, paddingLeft: space.base, paddingRight: space.sm, paddingVertical: space.sm,
            backgroundColor: palette.surface, borderRadius: radius.lg,
            borderWidth: 1, borderColor: palette.line100,
          }}
        >
          <TextInput
            value={unos}
            onChangeText={setUnos}
            placeholder="Šta Vam treba?"
            placeholderTextColor={palette.inkMuted}
            accessibilityLabel="Opišite šta Vam treba"
            onSubmitEditing={posalji}
            returnKeyType="send"
            multiline
            blurOnSubmit
            // Na webu multiline guta Enter, pa se poruka nikad ne pošalje.
            // Shift+Enter i dalje pravi novi red.
            onKeyPress={(e: any) => {
              if (Platform.OS === 'web' && e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
                e.preventDefault?.();
                posalji();
              }
            }}
            style={{ flex: 1, fontSize: 16, color: palette.ink, paddingVertical: 6, maxHeight: 90 }}
          />
          <Press
            accessibilityRole="button"
            accessibilityLabel="Pošalji"
            accessibilityState={{ disabled: !unos.trim() }}
            disabled={!unos.trim()}
            haptic="light"
            onPress={posalji}
            style={{
              width: touch.min, height: touch.min, borderRadius: radius.md,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: unos.trim() ? palette.orange : palette.cream050,
            }}
          >
            <PaperPlaneTilt
              size={19}
              color={unos.trim() ? palette.onOrange : palette.inkMuted}
              weight="fill"
            />
          </Press>
        </View>
      )}
    </SafeAreaView>
  );
}
