import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, LockKey } from 'phosphor-react-native';

import { ru4Izvor } from '../../../../data';
import type { NacrtIzmeneZadatka } from '../../../../data/ru4Source';
import { palette, radius, space, touch } from '../../../../theme/tokens';
import { Button, Card } from '../../../../ui/Button';
import { Press } from '../../../../ui/Press';
import { T } from '../../../../ui/Text';

function Polje({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
  placeholder?: string;
}) {
  return (
    <View style={{ gap: space.xs }}>
      <T variant="label" tone="muted">{label}</T>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={palette.inkMuted}
        style={{
          minHeight: multiline ? 132 : touch.min,
          borderWidth: 1,
          borderColor: palette.line100,
          borderRadius: radius.md,
          backgroundColor: palette.surface,
          color: palette.ink,
          paddingHorizontal: space.md,
          paddingVertical: multiline ? space.md : 10,
          textAlignVertical: multiline ? 'top' : 'center',
          fontSize: 16,
        }}
      />
    </View>
  );
}

export default function IzmeniZadatak() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [nacrt, setNacrt] = useState<NacrtIzmeneZadatka | null>(null);
  const [naslov, setNaslov] = useState('');
  const [opis, setOpis] = useState('');
  const [grad, setGrad] = useState('');
  const [podrucje, setPodrucje] = useState('');
  const [brojMesta, setBrojMesta] = useState('1');
  const [cena, setCena] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [greska, setGreska] = useState<string | null>(null);

  const primeni = useCallback((data: NacrtIzmeneZadatka) => {
    setNacrt(data);
    setNaslov(data.naslov);
    setOpis(data.opis);
    setGrad(data.grad);
    setPodrucje(data.podrucje);
    setBrojMesta(String(data.brojMesta));
    setCena(data.cenaRsd === null ? '' : String(data.cenaRsd));
  }, []);

  const ucitaj = useCallback(async () => {
    if (!id) {
      setGreska('Zadatak nije naveden.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setGreska(null);
    try {
      const result = await ru4Izvor.nacrtIzmene(id);
      if (!result.ok) {
        setGreska(result.poruka);
        return;
      }
      primeni(result.podatak);
    } finally {
      setLoading(false);
    }
  }, [id, primeni]);

  useEffect(() => {
    void ucitaj();
  }, [ucitaj]);

  const sacuvaj = useCallback(async () => {
    if (!nacrt || saving) return;
    const mesta = Number.parseInt(brojMesta, 10);
    const cenaRsd = cena.trim() === '' ? null : Number.parseInt(cena, 10);

    setSaving(true);
    setGreska(null);
    try {
      const result = await ru4Izvor.sacuvajNacrt({
        zadatakId: nacrt.id,
        ocekivanaRevizija: nacrt.revizija,
        naslov,
        opis,
        grad,
        podrucje,
        brojMesta: mesta,
        rezimCene: nacrt.rezimCene,
        cenaRsd,
      });
      if (!result.ok) {
        setGreska(result.poruka);
        return;
      }
      Alert.alert(
        'Izmena je sačuvana',
        'Nova verzija ostaje nacrt i mora ponovo kroz proveru pre nego što može da bude javno objavljena.',
        [
          {
            text: 'U redu',
            onPress: () => router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: result.podatak.zadatakId } }),
          },
        ],
      );
    } finally {
      setSaving(false);
    }
  }, [brojMesta, cena, grad, nacrt, naslov, opis, podrucje, saving]);

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
        <View style={{ flex: 1 }}>
          <T variant="label" tone="orange">PRIVATNI NACRT</T>
          <T variant="title">Izmeni Zadatak</T>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.teal500} />
        </View>
      ) : !nacrt ? (
        <View style={{ flex: 1, padding: space.base, justifyContent: 'center', gap: space.md }}>
          <T variant="heading">Nacrt nije dostupan</T>
          <T variant="body" tone="danger">{greska ?? 'Pokušajte ponovo.'}</T>
          <Button label="Pokušajte ponovo" onPress={() => void ucitaj()} />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.base, paddingBottom: space.huge, gap: space.base }}
          showsVerticalScrollIndicator={false}
        >
          <Card>
            <View style={{ padding: space.base, gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <LockKey size={19} color={palette.teal500} weight="fill" />
                <T variant="heading" style={{ flex: 1 }}>Revizija {nacrt.revizija} nije javna</T>
              </View>
              <T variant="meta" tone="muted">
                Dok menjate ovaj Zadatak, niko ga ne vidi kao novu javnu priliku. Postojeći Dogovori ostaju kakvi su bili.
              </T>
            </View>
          </Card>

          <Polje label="NASLOV" value={naslov} onChangeText={setNaslov} placeholder="Šta Vam treba?" />
          <Polje label="OPIS" value={opis} onChangeText={setOpis} multiline placeholder="Opišite konkretan Zadatak" />
          <Polje label="GRAD" value={grad} onChangeText={setGrad} placeholder="Novi Sad" />
          <Polje label="PODRUČJE / TRASA" value={podrucje} onChangeText={setPodrucje} placeholder="Liman, Detelinara…" />
          <Polje label="BROJ POTREBNIH OSOBA" value={brojMesta} onChangeText={setBrojMesta} keyboardType="number-pad" />

          {nacrt.rezimCene === 'MY_PRICE' ? (
            <Polje label="VAŠA CENA (RSD)" value={cena} onChangeText={setCena} keyboardType="number-pad" />
          ) : null}

          {greska ? (
            <Card>
              <View style={{ padding: space.md }}>
                <T variant="body" tone="danger">{greska}</T>
              </View>
            </Card>
          ) : null}

          <Button
            label={saving ? 'Čuvam…' : 'Sačuvaj izmenu'}
            full
            disabled={saving}
            onPress={() => void sacuvaj()}
          />
          <T variant="meta" tone="muted" style={{ textAlign: 'center' }}>
            Čuvanje ne objavljuje Zadatak. Nova revizija mora ponovo kroz proveru za javnu objavu.
          </T>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
