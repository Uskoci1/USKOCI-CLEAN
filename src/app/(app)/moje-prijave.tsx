import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Clock, MapPin, NotePencil, WarningCircle, XCircle } from 'phosphor-react-native';

import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import { ru4Production } from '../../data/ru4Production';
import { noviZahtevId } from '../../lib/idempotencija';
import { useIzvor } from '../../store/uloga';
import { palette, radius, space, touch } from '../../theme/tokens';
import { Card } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';

function statusTekst(stanje: MojaPrijavaProjekcija['stanje']) {
  switch (stanje) {
    case 'SUBMITTED': return 'Poslata';
    case 'VIEWED': return 'Naručilac je pregledao';
    case 'SHORTLISTED': return 'U užem izboru';
    case 'SELECTED': return 'Izabrani ste';
    case 'WITHDRAWN': return 'Povukli ste prijavu';
    case 'CLOSED': return 'Potreba je zatvorena';
    case 'STALE_REVIEW_REQUIRED': return 'Potreba je promenjena — pregledajte ponovo';
  }
}

function sectionFor(p: MojaPrijavaProjekcija): 'Čeka Vas' | 'Aktivne' | 'Završene' {
  if (p.traziPaznju) return 'Čeka Vas';
  if (p.stanje === 'SUBMITTED' || p.stanje === 'VIEWED' || p.stanje === 'SHORTLISTED') return 'Aktivne';
  return 'Završene';
}

export default function MojePrijave() {
  const izvor = useIzvor();
  const router = useRouter();
  const [prijave, setPrijave] = useState<MojaPrijavaProjekcija[]>([]);
  const [ucitava, setUcitava] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);
  const [uToku, setUToku] = useState<string | null>(null);
  const [uredjujem, setUredjujem] = useState<string | null>(null);
  const [cena, setCena] = useState('');
  const [mesta, setMesta] = useState('1');
  const [napomena, setNapomena] = useState('');
  const withdrawKeys = useRef(new Map<string, string>());

  const ucitaj = useCallback(async () => {
    setUcitava(true);
    setGreska(null);
    try {
      setPrijave(await izvor.mojePrijave());
    } catch (error) {
      setGreska(error instanceof Error ? error.message : 'Prijave nisu mogle da se učitaju.');
    } finally {
      setUcitava(false);
    }
  }, [izvor]);

  useFocusEffect(useCallback(() => {
    let ziv = true;
    setUcitava(true);
    setGreska(null);
    void izvor.mojePrijave()
      .then((rows) => { if (ziv) setPrijave(rows); })
      .catch((error: unknown) => { if (ziv) setGreska(error instanceof Error ? error.message : 'Prijave nisu mogle da se učitaju.'); })
      .finally(() => { if (ziv) setUcitava(false); });
    return () => { ziv = false; };
  }, [izvor]));

  const razresiStale = useCallback(async (p: MojaPrijavaProjekcija, akcija: 'KEEP' | 'UPDATE' | 'WITHDRAW') => {
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
    await izvor.mojePrijave().then(setPrijave);
  }, [cena, izvor, mesta, napomena, uToku]);

  const povuciAktivnu = useCallback(async (p: MojaPrijavaProjekcija) => {
    if (uToku || !p.mozePovuci) return;
    const signature = `${p.prijavaId}:${p.potrebaRevizija}:${p.prijavaVerzija}`;
    let requestId = withdrawKeys.current.get(signature);
    if (!requestId) {
      requestId = noviZahtevId('povuci-prijavu');
      withdrawKeys.current.set(signature, requestId);
    }
    setUToku(p.prijavaId);
    const result = await izvor.povuciPrijavu({
      prijavaId: p.prijavaId,
      potrebaRevizija: p.potrebaRevizija,
      prijavaVerzija: p.prijavaVerzija,
      clientRequestId: requestId,
      razlog: null,
    });
    setUToku(null);
    if (!result.ok) {
      Alert.alert('Prijava nije povučena', result.poruka);
      return;
    }
    withdrawKeys.current.delete(signature);
    await izvor.mojePrijave().then(setPrijave);
  }, [izvor, uToku]);

  const pocniIzmenu = useCallback((p: MojaPrijavaProjekcija) => {
    setUredjujem(p.prijavaId);
    setCena(String(p.cena.iznos));
    setMesta(String(p.pokrivaMesta));
    setNapomena(p.napomena);
  }, []);

  const renderCard = (p: MojaPrijavaProjekcija) => {
    const stale = p.stanje === 'STALE_REVIEW_REQUIRED';
    const selected = p.stanje === 'SELECTED';
    const editing = uredjujem === p.prijavaId;
    const busy = uToku === p.prijavaId;

    return (
      <Card key={p.prijavaId}>
        <View style={{ padding: space.base, gap: space.md }}>
{stale ? (
  <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.sm, borderRadius: radius.md, backgroundColor: palette.warnBg }}>
    <WarningCircle size={20} color={palette.warn} weight="fill" />
    <View style={{ flex: 1 }}>
      <T variant="bodyStrong">Potreba je promenjena</T>
      <T variant="meta" tone="muted">Pregledajte novu verziju pre nego što Prijava ponovo postane aktivna.</T>
    </View>
  </View>
) : null}

<View style={{ gap: 4 }}>
  <T variant="heading">{p.naslov}</T>
  {p.opis ? <T variant="body" tone="muted">{p.opis}</T> : null}
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
  <View style={{ flex: 1 }}>
    <T variant="meta" tone="muted">Status</T>
    <T variant="bodyStrong">{statusTekst(p.stanje)}</T>
  </View>
  <View style={{ alignItems: 'flex-end' }}>
    <T variant="meta" tone="muted">Vaša prijava</T>
    <T variant="bodyStrong">{p.cena.prikaz} · {p.pokrivaMesta} {p.pokrivaMesta === 1 ? 'mesto' : 'mesta'}</T>
  </View>
</View>

{selected && p.dogovorId ? (
  <Press
    accessibilityRole="button"
    accessibilityLabel="Otvorite Dogovor"
    haptic="light"
    onPress={() => router.push(`/dogovor/${p.dogovorId}` as any)}
    style={{ minHeight: touch.min, borderRadius: radius.md, backgroundColor: palette.forest800, alignItems: 'center', justifyContent: 'center' }}
  >
    <T variant="action" tone="onDark">Otvorite Dogovor</T>
  </Press>
) : null}

{!stale && p.mozePovuci ? (
  <Press
    accessibilityRole="button"
    accessibilityLabel="Povuci prijavu"
    accessibilityState={{ disabled: !!uToku }}
    disabled={!!uToku}
    haptic="medium"
    onPress={() => {
      Alert.alert('Povući prijavu?', 'Prijava više neće biti aktivna za ovaj Zadatak.', [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Povuci', style: 'destructive', onPress: () => void povuciAktivnu(p) },
      ]);
    }}
    style={{ minHeight: touch.min, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line100, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: uToku && !busy ? 0.45 : 1 }}
  >
    {busy ? <ActivityIndicator size="small" color={palette.ink} /> : <XCircle size={17} color={palette.ink} />}
    <T variant="action">Povuci</T>
  </Press>
) : null}

{stale && editing ? (
  <View style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: palette.line100 }}>
    <T variant="bodyStrong">Izmenite svoju Prijavu</T>
    <TextInput value={cena} onChangeText={setCena} keyboardType="numeric" placeholder="Cena u RSD" placeholderTextColor={palette.inkMuted} style={{ minHeight: touch.min, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md, color: palette.ink }} />
    <TextInput value={mesta} onChangeText={setMesta} keyboardType="numeric" placeholder="Koliko mesta pokrivate" placeholderTextColor={palette.inkMuted} style={{ minHeight: touch.min, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, paddingHorizontal: space.md, color: palette.ink }} />
    <TextInput value={napomena} onChangeText={setNapomena} multiline placeholder="Napomena" placeholderTextColor={palette.inkMuted} style={{ minHeight: 84, borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md, padding: space.md, color: palette.ink, textAlignVertical: 'top' }} />
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Press accessibilityRole="button" accessibilityLabel="Odustani od izmene prijave" haptic="select" onPress={() => setUredjujem(null)} style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line100, alignItems: 'center', justifyContent: 'center' }}>
        <T variant="action">Odustani</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Sačuvaj izmenjenu prijavu" accessibilityState={{ disabled: busy }} disabled={busy} haptic="success" onPress={() => void razresiStale(p, 'UPDATE')} style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.55 : 1 }}>
        {busy ? <ActivityIndicator size="small" color={palette.onOrange} /> : <T variant="action" tone="onOrange">Sačuvaj Prijavu</T>}
      </Press>
    </View>
  </View>
) : null}

{stale && !editing ? (
  <View style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: palette.line100 }}>
    <Press accessibilityRole="button" accessibilityLabel="Zadrži prijavu" accessibilityState={{ disabled: !!uToku }} disabled={!!uToku} haptic="success" onPress={() => void razresiStale(p, 'KEEP')} style={{ minHeight: touch.min, borderRadius: radius.md, backgroundColor: palette.forest800, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', opacity: uToku && !busy ? 0.45 : 1 }}>
      {busy ? <ActivityIndicator size="small" color={palette.onDark} /> : <CheckCircle size={18} color={palette.onDark} weight="fill" />}
      <T variant="action" tone="onDark">Zadrži</T>
    </Press>
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Press accessibilityRole="button" accessibilityLabel="Izmeni prijavu" disabled={!!uToku} haptic="light" onPress={() => pocniIzmenu(p)} style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line100, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        <NotePencil size={17} color={palette.ink} />
        <T variant="action">Izmeni</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Povuci stale prijavu" disabled={!!uToku} haptic="medium" onPress={() => Alert.alert('Povući prijavu?', 'Ova Prijava više neće biti aktivna za izmenjeni Zadatak.', [{ text: 'Odustani', style: 'cancel' }, { text: 'Povuci', style: 'destructive', onPress: () => void razresiStale(p, 'WITHDRAW') }])} style={{ flex: 1, minHeight: touch.min, borderRadius: radius.md, borderWidth: 1, borderColor: palette.line100, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        <XCircle size={17} color={palette.ink} />
        <T variant="action">Povuci</T>
      </Press>
    </View>
  </View>
) : null}
        </View>
      </Card>
    );
  };

  const sections: Array<'Čeka Vas' | 'Aktivne' | 'Završene'> = ['Čeka Vas', 'Aktivne', 'Završene'];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <View style={{ paddingHorizontal: space.base, paddingTop: space.md, paddingBottom: space.sm, gap: 4 }}>
        <T variant="display">Prijave</T>
        <T variant="body" tone="muted">Šta se dešava sa Vašim prijavama i gde treba da reagujete.</T>
      </View>

      {ucitava ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.teal500} /></View>
      ) : greska ? (
        <View style={{ padding: space.base, gap: space.md }}>
<T variant="bodyStrong">Prijave nisu dostupne</T>
<T variant="body" tone="muted">{greska}</T>
<Press accessibilityRole="button" accessibilityLabel="Pokušaj ponovo" haptic="light" onPress={() => void ucitaj()} style={{ minHeight: touch.min, borderRadius: radius.md, backgroundColor: palette.forest800, alignItems: 'center', justifyContent: 'center' }}>
  <T variant="action" tone="onDark">Pokušajte ponovo</T>
</Press>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.base, paddingBottom: space.huge, gap: space.lg }}>
{prijave.length === 0 ? (
  <Card><View style={{ padding: space.base, gap: space.sm }}><T variant="heading">Još nemate Prijave</T><T variant="body" tone="muted">Kada se prijavite na Zadatak, videćete ga ovde.</T></View></Card>
) : null}
{sections.map((section) => {
  const rows = prijave.filter((p) => sectionFor(p) === section);
  if (!rows.length) return null;
  return <View key={section} style={{ gap: space.sm }}><T variant="heading">{section}</T>{rows.map(renderCard)}</View>;
})}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
