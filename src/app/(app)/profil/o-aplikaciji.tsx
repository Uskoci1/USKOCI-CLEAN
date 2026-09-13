import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { BuildIdentity } from '../../../ui/BuildIdentity';
import { SettingsText as T, SettingsScreen, SettingsPanel, SettingsAction } from '../../../ui/settings/SettingsPresentation';

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
    <T variant="display">USKOČI</T>
    <T>Pomoć počinje dogovorom. Objavi šta ti treba ili ponudi ono što znaš i možeš.</T>
    <SettingsPanel>
      <T variant="heading">Jedan nalog, obe mogućnosti</T>
      <T>MENI TREBA vodi te od ideje do zadatka i izbora saradnika. JA MOGU povezuje tvoj radni profil i dostupnost sa zadacima na koje želiš da se prijaviš.</T>
    </SettingsPanel>
    <T tone="muted">AI pomaže da sastaviš zadatak. Ti pregledaš podatke i odlučuješ o objavi. Uslove saradnje dogovaraš sa drugom osobom kroz Dogovor.</T>
    <SettingsAction label="Pravila i saglasnosti" kind="secondary" onPress={() => navigate(() => router.push('/profil/pravna'))} />
    <SettingsAction label="Privatnost i podaci" kind="secondary" onPress={() => navigate(() => router.push('/profil/privatnost'))} />
    <BuildIdentity />
  </SettingsScreen>;
}
