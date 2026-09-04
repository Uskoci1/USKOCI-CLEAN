import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Clock, MapPin, NotePencil, WarningCircle, XCircle } from 'phosphor-react-native';

import { ru4Production, type Ru4MojaPrijava } from '../../data/ru4Production';
import { noviZahtevId } from '../../lib/idempotencija';
import { palette, radius, space, touch } from '../../theme/tokens';
import { Card } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';

function statusTekst(status: string) {
  switch (status) {
    case 'SUBMITTED': return 'Poslata';
    case 'DELIVERED': return 'Dostavljena';
    case 'VIEWED': return 'Pregledana';
    case 'SHORTLISTED': return 'U užem izboru';
    case 'SELECTED': return 'Izabrana';
    case 'WITHDRAWN': return 'Povučena';
    case 'EXPIRED': return 'Zatvorena';
    case 'STALE_REVIEW_REQUIRED': return 'Čeka Vašu potvrdu';
    default: return status || 'Prijava';
  }
}

export default function MojePrijave() {
  const [prijave, setPrijave] = useState<Ru4MojaPrijava[]>([]);
  const [ucitava, setUcitava] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [uToku, setUToku] = useState<string | null>(null);
  const [uredjujem, setUredjujem] = useState<string | null>(null);
  const [cena, setCena] = useState('');
  const [mesta, setMesta] = useState('1');
  const [napomena, setNapomena] = useState('');

  const osvezi = useCallback(() => {
    let ziv = true;
    setUcitava(true);
    setGreska(null);
    void ru4Production
      .mojePrijave()
      .then((rows) => {
        if (ziv) setPrijave(rows);
      })
      .catch((error: unknown) => {
        if (ziv) setGreska(error instanceof Error ? error.message : 'Prijave nisu mogle da se učitaju.');
      })
      .finally(() => {
        if (ziv) setUcitava(false);
      });
    return () => {
      ziv = false;
    };
  }, []);

  useFocusEffect(osvezi);

  const razresi = useCallback(async (p: Ru4MojaPrijava, akcija: 'KEEP' | 'UPDATE' | 'WITHDRAW') => {
    if (uToku) return;

    let updateCena: number | null = null;
    let updateMesta: number | null = null;
    let updateNapomena: string | null = null;
    if (akcija === 'UPDATE') {
      updateCena = Number(cena);
      updateMesta = Number(mesta);
      if (!Number.isFinite(updateCena) || updateCena <= 0) {
        Alert.alert('Proverite cenu', 'Unesite ispravnu cenu u RSD.');
        return;
      }
      if (!Number.isInteger(updateMesta) || updateMesta < 1) {
        Alert.alert('Proverite broj mesta', 'Unesite koliko mesta pokrivate.');
        return;
      }
      updateNapomena = napomena.trim();
    }

    setUToku(p.prijavaId);
    const result = await ru4Production.resolveChangedApplication({
      prijavaId: p.prijavaId,
      ocekivanaVerzija: p.prijavaVerzija,
      ocekivanaPotrebaRevizija: p.potrebaRevizija,
      clientRequestId: noviZahtevId(`ru4-${akcija.toLowerCase()}`),
      akcija,
      pokrivenaMesta: updateMesta,
      cenaRsd: updateCena,
      predlozeniPocetak: null,
      predlozeniKraj: null,
      napomena: updateNapomena,
    });
    setUToku(null);

    if (!result.ok) {
      Alert.alert('Prijava nije promenjena', result.poruka);
      return;
    }

    setUredjujem(null);
    await ru4Production.mojePrijave().then(setPrijave);
  }, [cena, mesta, napomena, uToku]);

  const pocniIzmenu = useCallback((p: Ru4MojaPrijava) => {
    setUredjujem(p.prijavaId);
    setCena(String(p.cenaRsd));
    setMesta(String(p.pokrivaMesta));
    setNapomena(p.napomena);
  }, []);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View style={{ paddingHorizontal: space.base, paddingTop: space.md, paddingBottom: space.sm, gap: 4 }}>
        <T variant="display">Prijave</T>
        <T variant="body" tone="muted">Vaše prijave i promene Zadataka koje treba ponovo da pregledate.</T>
      </View>

      {ucitava ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.teal500} />
        </View>
      ) : greska ? (
        <View style={{ padding: space.base, gap: space.md }}>
          <T variant="bodyStrong">Prijave nisu dostupne</T>
          <T variant="body" tone="muted">{greska}</T>
          <Press
            accessibilityRole="button"
            accessibilityLabel="Pokušaj ponovo"
            haptic="light"
            onPress={() => {
              const cleanup = osvezi();
              void cleanup;
            }}
            style={{ minHeight: touch.min, borderRadius: radius.md, backgroundColor: palette.forest800, alignItems: 'center', justifyContent: 'center' }}
          >
            <T variant="action" tone="onDark">Pokušajte ponovo</T>
          </Press>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.base, paddingBottom: space.huge, gap: space.base }}>
          {prijave.length === 0 ? (
            <Card>
              <View style={{ padding: space.base, gap: space.sm }}>
                <T variant="heading">Još nemate Prijave</T>
                <T variant="body" tone="muted">Kada se prijavite na Zadatak, videćete ga ovde.</T>
              </View>
            </Card>
          ) : null}

          {prijave.map((p) => {
            const stale = p.promenjenaPotreba && p.status === 'STALE_REVIEW_REQUIRED';
            const editing = uredjujem === p.prijavaId;
            const busy = uToku === p.prijavaId;

            return (
              <Card key={p.prijavaId}>
                <View style={{ padding: space.base, gap: space.md }}>
                  {stale ? (
                    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.sm, borderRadius: radius.md, backgroundColor: palette.warnBg }}>
                      <WarningCircle size={20} color={palette.warn} weight="fill" />
                      <View style={{ flex: 1 }}>
                        <T variant="bodyStrong">Zadatak je izmenjen</T>
                        <T variant="meta" tone="muted">Proverite novu verziju pre nego što Vaša Prijava ponovo postane aktivna.</T>
                      </View>
                    </View>
                  ) : null}

                  <View style={{ gap: 4 }}>
                    <T variant="heading">{p.naslov}</T>
                    <T variant="body" tone="muted">{p.opis}</T>
                  </View>

                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <MapPin size={16} color={palette.teal500} />
                      <T variant="meta" tone="muted">{p.podrucjeTekst}</T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                      <Clock size={16} color={palette.teal500} />
                      <T variant="meta" tone="muted">{p.vremeTekst}</T>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                    <View>
                      <T variant="meta" tone="muted">Status</T>
                      <T variant="bodyStrong">{statusTekst(p.status)}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T variant="meta" tone="muted">Vaša prijava</T>
                      <T variant="bodyStrong">{p.cenaRsd.toLocaleString('sr-Latn-RS')} RSD · {p.pokrivaMesta} {p.pokrivaMesta === 1 ? 'mesto' : 'mesta'}</T>
                    </View>
                  </View>

                  {stale && editing ? (
                    <View style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: palette.line100 }}>
                      <T variant="bodyStrong">Izmenite svoju Prijavu</T>
                      <TextInput
                        value={cena}
                        onChangeText={setCena}
                        keyboardType="numeric"
                        placeholder="Cena u RSD"
                        placeholderTextColor={palette.inkMuted}
                        style={{ minHeight: touch.min, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md, color: palette.ink }}
                      />
                      <TextInput
                        value={mesta}
                        onChangeText={setMesta}
                        keyboardType="numeric"
                        placeholder="Koliko mesta pokrivate"
                        placeholderTextColor={palette.inkMuted}
                        style={{ minHeight: touch.min, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md, color: palette.ink }}
                      />
                      <TextInput
                        value={napomena}
                        onChangeText={setNapomena}
                        multiline
                        placeholder="Napomena"
                        placeholderTextColor={palette.inkMuted}
                        style={{ minHeight: 84, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, padding: space.md, color: palette.ink, textAlignVertical: 'top' }}
                      />
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Press
                          accessibilityRole="button"
                          accessibilityLabel="Odustani od izmene prijave"
                          haptic="select"
                          onPress={() => setUredjujem(null)}
                          style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line100, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <T variant="action">Odustani</T>
                        </Press>
                        <Press
                          accessibilityRole="button"
                          accessibilityLabel="Sačuvaj izmenjenu prijavu"
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          haptic="success"
                          onPress={() => void razresi(p, 'UPDATE')}
                          style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.55 : 1 }}
                        >
                          {busy ? <ActivityIndicator size="small" color={palette.onOrange} /> : <T variant="action" tone="onOrange">Sačuvaj Prijavu</T>}
                        </Press>
                      </View>
                    </View>
                  ) : null}

                  {stale && !editing ? (
                    <View style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: palette.line100 }}>
                      <Press
                        accessibilityRole="button"
                        accessibilityLabel="Prihvatam izmene Zadatka"
                        accessibilityState={{ disabled: !!uToku }}
                        disabled={!!uToku}
                        haptic="success"
                        onPress={() => void razresi(p, 'KEEP')}
                        style={{ minHeight: touch.min, borderRadius: radius.md, backgroundColor: palette.forest800, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', opacity: uToku && !busy ? 0.45 : 1 }}
                      >
                        {busy ? <ActivityIndicator size="small" color={palette.onDark} /> : <CheckCircle size={18} color={palette.onDark} weight="fill" />}
                        <T variant="action" tone="onDark">Prihvatam izmene</T>
                      </Press>

                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        <Press
                          accessibilityRole="button"
                          accessibilityLabel="Izmeni prijavu"
                          disabled={!!uToku}
                          haptic="light"
                          onPress={() => pocniIzmenu(p)}
                          style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line100, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <NotePencil size={17} color={palette.ink} />
                          <T variant="action">Izmeni prijavu</T>
                        </Press>
                        <Press
                          accessibilityRole="button"
                          accessibilityLabel="Povuci prijavu"
                          disabled={!!uToku}
                          haptic="medium"
                          onPress={() => {
                            Alert.alert('Povući Prijavu?', 'Ova Prijava više neće biti aktivna za izmenjeni Zadatak.', [
                              { text: 'Odustani', style: 'cancel' },
                              { text: 'Povuci', style: 'destructive', onPress: () => void razresi(p, 'WITHDRAW') },
                            ]);
                          }}
                          style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line100, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <XCircle size={17} color={palette.ink} />
                          <T variant="action">Povuci</T>
                        </Press>
                      </View>
                    </View>
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
