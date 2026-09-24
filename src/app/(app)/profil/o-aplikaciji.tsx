import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BuildIdentity } from '../../../ui/BuildIdentity';
import { BrandLockup } from '../../../ui/entry/BrandAssets';
import { SettingsText as T, SettingsScreen, SettingsGroup, SettingsRow } from '../../../ui/settings/SettingsPresentation';

/**
 * What USKOČI is, the two ways into its rules, and the build detail support may ask for. The bar already names the
 * screen, so the brand is the mark itself (its own label says "USKOČI") and not a second 28 px title; the prose sits on
 * the page without a card, and the rules are rows like every other way onward in settings. No primary action.
 */
export default function AboutUskoci() {
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [token, setToken] = useState<object | null>(null);
  useFocusEffect(useCallback(() => { const token = {}; focus.current = token; navigating.current = false;
    setToken(token);
    return () => { if (focus.current === token) focus.current = null; };
  }, []));
  const navigate = (action: () => void) => { if (!token || focus.current !== token || navigating.current) return;
    navigating.current = true; action(); };
  return <SettingsScreen title="O aplikaciji" onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}>
    <View style={s.brand}>
      <View accessibilityRole="header"><BrandLockup width={148} /></View>
      <T variant="copy" tone="muted">Pomoć počinje dogovorom. Objavi šta ti treba ili ponudi ono što znaš i možeš.</T>
    </View>
    <View style={s.section}>
      <T variant="heading">Jedan nalog, obe mogućnosti</T>
      <T>„Objavi zadatak“ vodi te od ideje do zadatka i izbora saradnika. „Uskoči i zaradi“ povezuje ono što umeš i kada možeš sa zadacima na koje želiš da se prijaviš. Isti nalog radi oba.</T>
      <T variant="note" tone="muted">AI pomaže da sastaviš zadatak. Ti pregledaš podatke i odlučuješ o objavi. Uslove saradnje dogovaraš sa drugom osobom kroz Dogovor.</T>
    </View>
    <SettingsGroup title="Pravila i privatnost">
      <SettingsRow compact label="Pravila i saglasnosti" detail="Pravni dokumenti i obrada podataka."
        onPress={() => navigate(() => router.push('/profil/pravna'))} />
      <SettingsRow compact last label="Privatnost i podaci" detail="Šta je javno, rokovi čuvanja, zatvaranje naloga."
        onPress={() => navigate(() => router.push('/profil/privatnost'))} />
    </SettingsGroup>
    <BuildIdentity />
  </SettingsScreen>;
}

const s = StyleSheet.create({
  brand: { paddingTop: 8, gap: 12, alignItems: 'flex-start' },
  section: { gap: 8 },
});
