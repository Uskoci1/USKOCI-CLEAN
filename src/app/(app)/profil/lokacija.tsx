import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { WorkerLocation, WorkerLocationInput } from '../../../contracts/location';
import { workerLocationClientService } from '../../../data/locationClientService';
import { normalizeWorkerLocation } from '../../../lib/location';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { LocationConfirmation, LocationField, LocationScreen, locationStyles as s } from '../../../ui/location/LocationControls';
import { Button } from '../../../ui/Button';
import { T } from '../../../ui/Text';
import { CountryField, selectableCountry, useCountryOptions } from '../../../ui/location/CountryField';

export function WorkerLocationForm({ location, busy, uncertain, onSave }: { location: WorkerLocation; busy: boolean;
  uncertain: boolean; onSave: (value: WorkerLocationInput) => void }) {
  const [city, setCity] = useState(location.city);
  const countryOptions = useCountryOptions();
  const [country, setCountry] = useState<string | null>(location.operatingCountryCode);
  const [radius, setRadius] = useState(String(location.radiusKm));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(false);
  const disabled = busy || uncertain;
  const submit = () => {
    if (disabled || !confirmed || !selectableCountry(countryOptions.countries, country)) return;
    // A newly entered city cannot inherit coordinates belonging to the old city.
    const value = normalizeWorkerLocation({ operatingCountryCode: country, city: city.trim(), radiusKm: /^\d+$/.test(radius) ? Number(radius) : NaN,
      approximatePosition: city.trim() === location.city && country === location.operatingCountryCode ? location.approximatePosition : null });
    if (!value) { setError(true); return; }
    onSave(value);
  };
  return <View style={{ gap: 24 }}>
    <View style={s.section}><T variant="heading" style={{ fontSize: 25, lineHeight: 31 }}>Gde možeš da uskočiš?</T>
      <T tone="muted">Izaberi područje u kom radiš. Kućna adresa i GPS dozvola nisu potrebni.</T></View>
    <CountryField label="Država rada" value={country} disabled={disabled} options={countryOptions}
      onChange={code => { setCountry(code); setConfirmed(false); setError(false); }} />
    <LocationField label="Grad ili mesto rada" value={city} maxLength={160} editable={!disabled}
      onChangeText={text => { setCity(text); setConfirmed(false); setError(false); }} />
    <LocationField label="Radijus rada u kilometrima" value={radius} keyboardType="number-pad" maxLength={3}
      editable={!disabled} hint="Od 1 do 200 km oko sačuvanog područja."
      onChangeText={text => { setRadius(text); setConfirmed(false); setError(false); }} />
    {error ? <T accessibilityRole="alert" tone="danger">Unesi mesto rada i ceo broj od 1 do 200 km.</T> : null}
    <View style={s.notice}><T variant="meta">Ovo je područje rada. Dostupnost, slobodni termini i obaveštenja podešavaju se zasebno.</T></View>
    <LocationConfirmation checked={confirmed} disabled={disabled} onChange={setConfirmed}>Potvrđujem područje u kom mogu da radim.</LocationConfirmation>
    <Button full label={busy ? 'Čuvamo područje…' : 'Sačuvaj područje rada'} onPress={submit}
      disabled={disabled || !confirmed || !selectableCountry(countryOptions.countries, country)} />
  </View>;
}

export default function PodrucjeRada() {
  const read = useCallback(() => workerLocationClientService.read(), []);
  const editor = useOwnedEditor(read);
  const back = () => router.canGoBack() ? router.back() : router.replace('/profil');
  return <LocationScreen title="Područje rada" onBack={back} loading={editor.loading} error={editor.error} onRetry={() => { void editor.refresh(); }}>
    {editor.saved ? <T accessibilityRole="alert" tone="success">Područje rada je sačuvano.</T> : null}
    {editor.data ? <WorkerLocationForm key={editor.data.revision} location={editor.data} busy={editor.busy} uncertain={editor.uncertain}
      onSave={value => { const location = editor.data; if (!location) return;
        void editor.save(async () => { const result = await workerLocationClientService.save({ expectedRevision: location.revision, confirmed: true, value });
          return result.ok ? { ok: true, podatak: result.podatak.location } : result; });
      }} /> : null}
  </LocationScreen>;
}
