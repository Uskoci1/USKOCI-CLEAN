import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CaretLeft, Clock, ArrowRight, ClockCountdown, CheckCircle,
  Phone, MapPin,
} from 'phosphor-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, motion, touch } from '../../theme/tokens';
import { useIzvor } from '../../store/uloga';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useAgreementOutbox } from '../../hooks/useAgreementOutbox';
import { useSesija } from '../../store/sesija';
import { AgreementChat } from '../../ui/AgreementChat';
import { useUloga } from '../../store/uloga';

const naUredjaju = Platform.OS !== 'web';

/** Rok dolazi sa servera kao ISO. Klijent ga samo formatira, nikad ne računa. */
function rokTekst(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('sr-Latn-RS', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function backToAgreements() {
  if (router.canGoBack()) router.back(); else router.replace('/dogovori');
}

function AgreementStatus({ loading = false, error = false, retry }: {
  loading?: boolean; error?: boolean; retry?: () => void;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: palette.ground }}>
    <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={backToAgreements}
      style={{ minHeight: touch.min, padding: space.base, justifyContent: 'center' }}>
      <T variant="action" tone="orange">Nazad na Dogovore</T>
    </Press>
    <View style={{ padding: space.base, gap: space.md }}>
      {loading ? <ActivityIndicator accessibilityLabel="Učitavanje Dogovora" color={palette.teal500} /> : <>
        <T variant="title">{error ? 'Dogovor nije učitan' : 'Dogovor nije dostupan'}</T>
        <T variant="body" tone="muted">{error ? 'Proverite internet vezu i pokušajte ponovo.' : 'Veza je zastarela ili nemate pristup ovom Dogovoru.'}</T>
        {retry && <Press accessibilityRole="button" accessibilityLabel="Ponovo učitaj Dogovor" onPress={retry}
          style={{ minHeight: touch.min, justifyContent: 'center' }}>
          <T variant="action" tone="orange">Pokušajte ponovo</T>
        </Press>}
      </>}
    </View>
  </SafeAreaView>;
}

export default function Dogovor() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const session = useSesija();
  const accountId = session.user?.id;
  const intent = useUloga();
  if (typeof id !== 'string' || id.length !== 36
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !accountId) {
    return <AgreementStatus />;
  }
  return <DogovorContent key={`${accountId}:${session.accountRevision}:${intent}:${id}`} id={id} accountId={accountId} />;
}

function DogovorContent({ id, accountId }: { id: string; accountId: string }) {
  const izvor = useIzvor();
  const uloga = useUloga();
  const jaSamUskocer = uloga === 'uskocer';
  const [tab, setTab] = useState<'pregled' | 'poruke'>('pregled');
  const workspace = useFocusedResource(useCallback(() => izvor.dogovor(id), [izvor, id, accountId]));
  const messages = useFocusedResource(useCallback(() => izvor.poruke(id, accountId), [izvor, id, accountId]));
  const dogovor = workspace.data;
  const writable = !workspace.loading && !workspace.error && dogovor?.chatDostupan === true;
  const { model: outbox, state: outboxState } = useAgreementOutbox(accountId, id, writable);
  const osvezi = workspace.refresh;
  useEffect(() => {
    if (messages.data && !messages.error) void outbox.reconcile(messages.data
      .filter(message => !!message.clientMessageId && !!message.posiljalacAccountId)
      .map(message => ({ clientMessageId: message.clientMessageId!, senderAccountId: message.posiljalacAccountId!,
        messageId: message.id, body: message.telo })));
  }, [messages.data, messages.error, outbox, outboxState.phase]);
  const deniedAttempt = outboxState.entries.filter(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE')
    .map(entry => `${entry.command.clientMessageId}:${entry.attempt}`).join('|');
  useEffect(() => { if (deniedAttempt) void osvezi(); }, [deniedAttempt, osvezi]);

  if (!dogovor) return <AgreementStatus loading={workspace.loading} error={workspace.error} retry={() => void osvezi()} />;

  const p = dogovor.pokrivenost;
  const hero = (<>
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

</>);
  const tabs = (<>        {/* M03: tačno dva taba. D04 nije treći. */}
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

</>);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: palette.ground }}>
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

        {tab === 'pregled' ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.huge, gap: space.base }} showsVerticalScrollIndicator={false}>
          {hero}{tabs}
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
                    <CheckCircle size={19} color={palette.success} weight="fill" />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T variant="bodyStrong">Dogovor je završen</T>
                  </View>
                </View>
              </Card>
            )}

          </Animated.View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: space.base, paddingBottom: space.sm, gap: space.sm }}>
            {tabs}<T variant="heading" numberOfLines={2}>{dogovor.naslov}</T>
          </View>
          <AgreementChat messages={messages.data ?? []} loading={messages.loading} error={messages.error}
            writable={writable} terminal={!dogovor.chatDostupan} refresh={messages.refresh}
            refreshWorkspace={workspace.refresh} outbox={outbox} state={outboxState} />
          </View>
        )}
    </SafeAreaView>
  );
}
