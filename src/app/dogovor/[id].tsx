import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Platform, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CaretLeft, CaretRight, Clock, ArrowRight, Users, ClockCountdown, Star,
  ChatCircle, Phone, MapPin, Warning, PaperPlaneTilt,
} from 'phosphor-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, motion, touch } from '../../theme/tokens';
import { lazniIzvor as izvor } from '../../data/lazniIzvor';
import type { DogovorProjekcija, PorukaProjekcija } from '../../contracts/projections';
import { useUloga } from '../../store/uloga';

const naUredjaju = Platform.OS !== 'web';

/** Rok dolazi sa servera kao ISO. Klijent ga samo formatira, nikad ne računa. */
function rokTekst(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('sr-Latn-RS', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export default function Dogovor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uloga = useUloga();
  const jaSamUskocer = uloga === 'uskocer';
  const [tab, setTab] = useState<'pregled' | 'poruke'>('pregled');
  const [dogovor, setDogovor] = useState<DogovorProjekcija | null>(null);
  const [poruke, setPoruke] = useState<PorukaProjekcija[]>([]);
  const [nacrt, setNacrt] = useState('');
  const [ucitavanje, setUcitavanje] = useState(true);

  const osvezi = useCallback(async () => {
    if (!id) return;
    const [d, p] = await Promise.all([izvor.dogovor(id), izvor.poruke(id)]);
    setDogovor(d);
    setPoruke(p);
    setUcitavanje(false);
  }, [id]);

  useEffect(() => {
    osvezi();
  }, [osvezi]);

  const posalji = useCallback(async () => {
    const telo = nacrt.trim();
    if (!telo || !id) return;
    setNacrt('');
    await izvor.posaljiPoruku(id, telo);
    setPoruke(await izvor.poruke(id));
  }, [nacrt, id]);

  if (ucitavanje) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ground, justifyContent: 'center' }}>
        <ActivityIndicator color={palette.teal500} />
      </SafeAreaView>
    );
  }

  if (!dogovor) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
        <View style={{ padding: space.base, gap: space.md }}>
          <T variant="title">Dogovor ne postoji</T>
          <T variant="body" tone="muted">Možda je otkazan ili je veza zastarela.</T>
          <Press haptic="select" onPress={() => router.replace('/dogovori')}>
            <T variant="action" tone="orange">Nazad na Dogovore</T>
          </Press>
        </View>
      </SafeAreaView>
    );
  }

  const p = dogovor.pokrivenost;
  const drugi = dogovor.ucesnici.filter((u) => !u.viSte);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingBottom: space.sm }}>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Nazad"
          haptic="select"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/dogovori'))}
          style={{ width: touch.min, height: touch.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <CaretLeft size={22} color={palette.ink} weight="bold" />
        </Press>
        <T variant="heading" style={{ flex: 1, textAlign: 'center', marginRight: touch.min }}>
          Dogovor
        </T>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.huge, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >
        {/* Prihvaćena verzija je autoritativna. Verzija se vidi, ne krije. */}
        <View
          style={[
            { backgroundColor: palette.forest800, borderRadius: radius.xl, padding: space.base, gap: space.md },
            elevation.raised,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.teal400 }} />
            <T variant="label" tone="onDarkMuted" style={{ flex: 1 }}>
              {dogovor.stanje === 'CONFIRMED' ? 'AKTIVAN' : dogovor.stanje}
              {dogovor.verzija > 1 ? ` · v${dogovor.verzija}` : ''}
            </T>
            <T variant="heading" style={{ color: palette.orange }}>{dogovor.cena.prikaz}</T>
          </View>

          <T variant="title" tone="onDark">{dogovor.naslov}</T>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.base, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ArrowRight size={15} color={palette.onDarkMuted} />
              <T variant="meta" tone="onDarkMuted">{dogovor.putanjaTekst}</T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Clock size={15} color={palette.onDarkMuted} />
              <T variant="meta" tone="onDarkMuted">{dogovor.vremeTekst}</T>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row', alignItems: 'center',
              borderTopWidth: 1, borderTopColor: 'rgba(251,242,229,0.16)', paddingTop: space.md,
            }}
          >
            <T variant="label" tone="onDarkMuted" style={{ flex: 1 }}>UKUPNA POTREBA</T>
            <T variant="bodyStrong" tone="onDark">{p.popunjeno}/{p.ukupno}</T>
          </View>
        </View>

        {/* M03: tačno dva taba. D04 nije treći. */}
        <View
          style={{
            flexDirection: 'row', backgroundColor: palette.cream050,
            borderRadius: radius.md, padding: 4, gap: 4,
          }}
        >
          {(['pregled', 'poruke'] as const).map((t) => {
            const aktivan = tab === t;
            return (
              <Press
                key={t}
                accessibilityRole="tab"
                accessibilityState={{ selected: aktivan }}
                accessibilityLabel={t === 'pregled' ? 'Pregled' : 'Poruke'}
                haptic="select"
                scaleTo={0.99}
                onPress={() => setTab(t)}
                style={{
                  flex: 1, minHeight: 40, borderRadius: radius.sm,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: aktivan ? palette.raised : 'transparent',
                }}
              >
                <T variant="action" tone={aktivan ? 'ink' : 'muted'}>
                  {t === 'pregled' ? 'Pregled' : 'Poruke'}
                </T>
              </Press>
            );
          })}
        </View>

        {tab === 'pregled' ? (
          <Animated.View entering={naUredjaju ? FadeIn.duration(motion.enter) : undefined} style={{ gap: space.base }}>
            <Card style={elevation.card}>
              <View style={{ paddingHorizontal: space.base }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: space.md,
                    borderBottomWidth: 1, borderBottomColor: palette.line100,
                  }}
                >
                  <T variant="heading" style={{ flex: 1 }}>Ko je u ovom Dogovoru</T>
                  <View
                    style={{
                      backgroundColor: palette.successBg, borderRadius: radius.pill,
                      paddingHorizontal: space.md, paddingVertical: 3,
                    }}
                  >
                    <T variant="meta" tone="success" style={{ fontWeight: '800' }}>
                      {dogovor.ucesnici.length}
                    </T>
                  </View>
                </View>

                {dogovor.ucesnici.map((u, i) => (
                  <View
                    key={u.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md,
                      borderBottomWidth: i < dogovor.ucesnici.length - 1 ? 1 : 0,
                      borderBottomColor: palette.line100,
                    }}
                  >
                    <View
                      style={{
                        width: 40, height: 40, borderRadius: radius.md,
                        backgroundColor: u.viSte ? palette.forest800 : palette.successBg,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <T variant="meta" tone={u.viSte ? 'onDark' : 'success'} style={{ fontWeight: '800' }}>
                        {u.inicijali}
                      </T>
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <T variant="bodyStrong">{u.ime}</T>
                      <T variant="meta" tone="muted">
                        {u.uloga === 'narucilac' ? 'Naručilac' : 'Uskočer'}
                        {u.mesta ? ` · ${u.mesta} ${u.mesta === 1 ? 'mesto' : 'mesta'}` : ''}
                      </T>
                    </View>
                    {u.viSte && <T variant="meta" tone="muted">to ste Vi</T>}
                  </View>
                ))}

                {p.preostalo > 0 && (
                  <Press
                    accessibilityRole="button"
                    accessibilityLabel={`Još ${p.preostalo} mesta nije popunjeno`}
                    haptic="light"
                    onPress={() => router.push('/prijave')}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md,
                      borderTopWidth: 1, borderTopColor: palette.line100,
                    }}
                  >
                    <Users size={20} color={palette.orangeInk} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <T variant="bodyStrong">
                        Još {p.preostalo} {p.preostalo === 1 ? 'mesto' : 'mesta'} nije popunjeno
                      </T>
                      <T variant="meta" tone="muted">Izaberite iz prijava</T>
                    </View>
                    <CaretRight size={16} color={palette.inkMuted} />
                  </Press>
                )}
              </View>
            </Card>

            {/* Hronologija je deo Pregleda, ne treći tab. */}
            {dogovor.hronologija.length > 0 && (
              <Card>
                <View style={{ padding: space.base, gap: space.md }}>
                  <T variant="label" tone="muted">HRONOLOGIJA</T>
                  {dogovor.hronologija.map((h, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
                      <View
                        style={{
                          width: 7, height: 7, borderRadius: 4, marginTop: 7,
                          backgroundColor: palette.teal500,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <T variant="meta">{h.tekst}</T>
                        <T variant="meta" tone="muted" style={{ fontSize: 12 }}>{h.vremeTekst}</T>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* M04: kontakt je odvojena, eksplicitna i USMERENA dozvola.
                Dva reda, jer to što ja podelim ne znači da vidim njihov broj. */}
            <Card>
              <View style={{ paddingHorizontal: space.base }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md,
                    paddingVertical: space.md,
                    borderBottomWidth: 1, borderBottomColor: palette.line100,
                  }}
                >
                  <Phone size={17} color={palette.teal500} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <T variant="meta" style={{ fontWeight: '700' }}>Vaš broj</T>
                    <T variant="meta" tone="muted">
                      {dogovor.kontakt.mojTelefonPodeljen
                        ? 'Podeljen sa drugom stranom'
                        : 'Nije podeljen'}
                    </T>
                  </View>
                  <Press
                    accessibilityRole="button"
                    accessibilityLabel={dogovor.kontakt.mojTelefonPodeljen ? 'Opozovi deljenje broja' : 'Podeli svoj broj'}
                    haptic="light"
                    onPress={async () => {
                      if (!id) return;
                      if (dogovor.kontakt.mojTelefonPodeljen) await izvor.opoziviTelefon(id);
                      else await izvor.podeliTelefon(id);
                      osvezi();
                    }}
                    style={{
                      minHeight: 40, paddingHorizontal: space.base, borderRadius: radius.md,
                      borderWidth: 1, borderColor: palette.line100,
                      backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <T variant="meta" style={{ fontWeight: '800' }}>
                      {dogovor.kontakt.mojTelefonPodeljen ? 'Opozovi' : 'Podeli'}
                    </T>
                  </Press>
                </View>

                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: space.md,
                    paddingVertical: space.md,
                    borderBottomWidth: dogovor.kontakt.lokacijaPostoji ? 1 : 0,
                    borderBottomColor: palette.line100,
                  }}
                >
                  <Phone size={17} color={palette.teal500} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <T variant="meta" style={{ fontWeight: '700' }}>
                      Broj druge strane
                    </T>
                    <T variant="meta" tone="muted">
                      {dogovor.kontakt.njihovTelefon ?? 'Nisu podelili svoj broj'}
                    </T>
                  </View>
                </View>

                {dogovor.kontakt.lokacijaPostoji && (
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}
                  >
                    <MapPin size={17} color={palette.teal500} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <T variant="meta" style={{ fontWeight: '700' }}>Tačna lokacija</T>
                      <T variant="meta" tone="muted">
                        {dogovor.kontakt.tacnaLokacija ?? 'Otkriva se po pravilima Dogovora'}
                      </T>
                    </View>
                    {!dogovor.kontakt.tacnaLokacija && (
                      <Press
                        accessibilityRole="button"
                        accessibilityLabel="Prikaži tačnu lokaciju"
                        haptic="light"
                        onPress={async () => {
                          if (!id) return;
                          await izvor.otkrijTacnuLokaciju(id);
                          osvezi();
                        }}
                        style={{
                          minHeight: 40, paddingHorizontal: space.base, borderRadius: radius.md,
                          borderWidth: 1, borderColor: palette.line100,
                          backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <T variant="meta" style={{ fontWeight: '800' }}>Prikaži</T>
                      </Press>
                    )}
                  </View>
                )}
              </View>
            </Card>

            {/* M07: završetak. Prozor drži server — ovde se samo prikazuje.
                Referenca je ovu poruku izgubila; bez nje korisnik ne zna
                da se Dogovor sam zatvara. */}
            {dogovor.stanje !== 'COMPLETED' && (
              <Card style={elevation.card}>
                <View style={{ padding: space.base, gap: space.md }}>
                  {dogovor.stanje === 'AWAITING_REQUESTER' ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                        <ClockCountdown size={20} color={palette.orangeInk} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <T variant="bodyStrong">
                            {jaSamUskocer ? 'Čeka se Naručilac' : 'Uskočer je označio da je završio'}
                          </T>
                          <T variant="meta" tone="muted">
                            {dogovor.problemOtvoren
                              ? 'Prijavljen je problem — Dogovor se neće zatvoriti sam dok se to ne reši.'
                              : jaSamUskocer
                                ? `Naručilac ima rok do ${rokTekst(dogovor.rokPotvrdeIso)}. Bez odgovora se Dogovor zatvara sam.`
                                : `Potvrdite ili prijavite problem do ${rokTekst(dogovor.rokPotvrdeIso)}. Bez odgovora se Dogovor zatvara sam.`}
                          </T>
                        </View>
                      </View>
                      {!jaSamUskocer && (
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Press
                          accessibilityRole="button"
                          accessibilityLabel="Prijavi problem"
                          haptic="medium"
                          onPress={async () => {
                            if (!id) return;
                            await izvor.prijaviProblem(id, 'Problem prijavljen iz Dogovora.');
                            osvezi();
                          }}
                          style={{
                            minHeight: touch.min, paddingHorizontal: space.base, borderRadius: radius.md,
                            borderWidth: 1, borderColor: palette.line100,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <T variant="action" tone="muted">Prijavi problem</T>
                        </Press>
                        <Press
                          accessibilityRole="button"
                          accessibilityLabel="Potvrdi završetak"
                          haptic="success"
                          onPress={async () => {
                            if (!id) return;
                            await izvor.potvrdiZavrsetak(id);
                            osvezi();
                          }}
                          style={{
                            flex: 1, minHeight: touch.min, borderRadius: radius.md,
                            backgroundColor: palette.orange,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <T variant="action" tone="onOrange">Potvrdi završetak</T>
                        </Press>
                      </View>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                        <ClockCountdown size={20} color={palette.teal500} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <T variant="bodyStrong">
                            {jaSamUskocer ? 'Kada završite posao' : 'Kada posao bude završen'}
                          </T>
                          <T variant="meta" tone="muted">
                            {jaSamUskocer
                              ? 'Označite završetak. Naručilac tada ima 48h da potvrdi ili prijavi problem.'
                              : 'Možete potvrditi završetak i sami, ne morate čekati Uskočera.'}
                          </T>
                        </View>
                      </View>
                      <Press
                        accessibilityRole="button"
                        accessibilityLabel={jaSamUskocer ? 'Završio sam' : 'Potvrdi završetak'}
                        haptic="success"
                        onPress={async () => {
                          if (!id) return;
                          if (jaSamUskocer) await izvor.oznaciZavrsetak(id);
                          else await izvor.potvrdiZavrsetak(id);
                          osvezi();
                        }}
                        style={{
                          minHeight: touch.min, borderRadius: radius.md,
                          backgroundColor: jaSamUskocer ? palette.orange : 'transparent',
                          borderWidth: jaSamUskocer ? 0 : 1.5,
                          borderColor: palette.ink,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <T variant="action" tone={jaSamUskocer ? 'onOrange' : 'ink'}>
                          {jaSamUskocer ? 'Završio sam' : 'Potvrdi završetak'}
                        </T>
                      </Press>
                    </>
                  )}
                </View>
              </Card>
            )}

            {dogovor.stanje === 'COMPLETED' && (
              <Card style={elevation.card}>
                <View style={{ padding: space.base, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View
                    style={{
                      width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.successBg,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Star size={19} color={palette.success} weight="fill" />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T variant="bodyStrong">Dogovor je završen</T>
                    <T variant="meta" tone="muted">
                      {dogovor.ocenaMoguca ? 'Možete ostaviti ocenu.' : 'Ocena još nije moguća.'}
                    </T>
                  </View>
                  {dogovor.ocenaMoguca && <CaretRight size={16} color={palette.inkMuted} />}
                </View>
              </Card>
            )}

            {/* M06: otkazivanje je jednostrano. Tiho i odvojeno od primarnog.
                Završen Dogovor se ne otkazuje — akcija tada nestaje. */}
            {dogovor.stanje !== 'COMPLETED' && (
              <Press
                accessibilityRole="button"
                accessibilityLabel="Problem ili otkazivanje"
                haptic="medium"
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: space.sm, minHeight: touch.min, marginTop: space.sm,
                }}
              >
                <Warning size={16} color={palette.danger} />
                <T variant="action" tone="danger">Problem / otkazivanje</T>
              </Press>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={naUredjaju ? FadeIn.duration(motion.enter) : undefined} style={{ gap: space.md }}>
            {/* M04: chat radi nezavisno od grantova za privatne podatke. */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.md,
                padding: space.md, borderRadius: radius.md, backgroundColor: palette.successBg,
              }}
            >
              <ChatCircle size={18} color={palette.success} weight="fill" />
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="bodyStrong">Razgovor o Dogovoru</T>
                <T variant="meta" tone="muted">Vide ga učesnici ovog Dogovora</T>
              </View>
            </View>

            {poruke.length === 0 && (
              <T variant="meta" tone="muted" style={{ textAlign: 'center', paddingVertical: space.lg }}>
                Još nema poruka.
              </T>
            )}

            {poruke.map((m) => (
              <View
                key={m.id}
                style={{
                  alignSelf: m.moja ? 'flex-end' : 'flex-start',
                  maxWidth: '84%',
                  backgroundColor: m.moja ? palette.forest800 : palette.surface,
                  borderWidth: m.moja ? 0 : 1,
                  borderColor: palette.line100,
                  borderRadius: radius.lg,
                  paddingVertical: space.md, paddingHorizontal: space.base, gap: 3,
                }}
              >
                {!m.moja && (
                  <T variant="meta" tone="muted" style={{ fontWeight: '700' }}>{m.posiljalacIme}</T>
                )}
                <T variant="body" tone={m.moja ? 'onDark' : 'ink'}>{m.telo}</T>
                <T variant="meta" tone={m.moja ? 'onDarkMuted' : 'muted'} style={{ fontSize: 12 }}>
                  {m.vremeTekst}
                </T>
              </View>
            ))}

            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.sm,
                backgroundColor: palette.surface, borderRadius: radius.lg,
                borderWidth: 1, borderColor: palette.line100,
                paddingLeft: space.base, paddingRight: space.sm, paddingVertical: space.sm,
                marginTop: space.sm,
              }}
            >
              <TextInput
                value={nacrt}
                onChangeText={setNacrt}
                placeholder="Poruka…"
                placeholderTextColor={palette.inkMuted}
                accessibilityLabel="Napišite poruku"
                onSubmitEditing={posalji}
                returnKeyType="send"
                style={{ flex: 1, fontSize: 16, color: palette.ink, paddingVertical: 6 }}
              />
              <Press
                accessibilityRole="button"
                accessibilityLabel="Pošalji poruku"
                accessibilityState={{ disabled: !nacrt.trim() }}
                disabled={!nacrt.trim()}
                haptic="light"
                onPress={posalji}
                style={{
                  width: touch.min, height: touch.min, borderRadius: radius.md,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: nacrt.trim() ? palette.orange : palette.cream050,
                }}
              >
                <PaperPlaneTilt
                  size={19}
                  color={nacrt.trim() ? palette.onOrange : palette.inkMuted}
                  weight="fill"
                />
              </Press>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
