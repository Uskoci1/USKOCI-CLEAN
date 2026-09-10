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
import { ResolvedPinMap } from '../../../ui/location/ResolvedPinMap';
import { displayedPinPosition } from '../../../ui/location/ResolvedPinMap.types';
import { WorkerAreaSearch } from '../../../ui/location/WorkerAreaSearch';
import type { createConfiguredLocationResolver } from '../../../data/configuredLocationResolver';

type WorkerLocationFormProps = { location: WorkerLocation; busy: boolean; uncertain: boolean;
  resolver?: Pick<ReturnType<typeof createConfiguredLocationResolver>, 'search' | 'cancel'>; onSave: (value: WorkerLocationInput) => void };
export function WorkerLocationForm(props: WorkerLocationFormProps) {
  return <ScopedWorkerLocationForm key={`${props.location.accountId}:${props.location.profileId}:${props.location.revision}`} {...props} />;
}
function ScopedWorkerLocationForm({ location, busy, uncertain, onSave, resolver }: WorkerLocationFormProps) {
  const [city, setCity] = useState(location.city);
  const countryOptions = useCountryOptions();
  const [country, setCountry] = useState<string | null>(location.operatingCountryCode);
  const [radius, setRadius] = useState(String(location.radiusKm));
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(false);
  const [position, setPosition] = useState(location.approximatePosition);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [searchEpoch, setSearchEpoch] = useState(0);
  const disabled = busy || uncertain;
  const changePlace = (change: () => void) => {
    if (disabled) return;
    change(); setPosition(null); setMapEpoch(value => value + 1); setConfirmed(false); setError(false);
  };
  const submit = () => {
    if (disabled || !confirmed || !selectableCountry(countryOptions.countries, country)) return;
    const value = normalizeWorkerLocation({ operatingCountryCode: country, city: city.trim(), radiusKm: /^\d+$/.test(radius) ? Number(radius) : NaN,
      approximatePosition: position });
    if (!value) { setError(true); return; }
    onSave(value);
  };
  return <View style={{ gap: 24 }}>
    <View style={s.section}><T variant="heading" style={{ fontSize: 25, lineHeight: 31 }}>Gde možeš da uskočiš?</T>
      <T tone="muted">Izaberi područje u kom radiš. Kućna adresa i GPS dozvola nisu potrebni.</T></View>
    <CountryField label="Država rada" value={country} disabled={disabled} options={countryOptions}
      onChange={code => changePlace(() => setCountry(code))} />
    <LocationField label="Grad ili mesto rada" value={city} maxLength={160} editable={!disabled}
      onChangeText={text => changePlace(() => setCity(text))} />
    <LocationField label="Radijus rada u kilometrima" value={radius} keyboardType="number-pad" maxLength={3}
      editable={!disabled} hint="Od 1 do 200 km oko sačuvanog područja."
      onChangeText={text => { setRadius(text); setConfirmed(false); setError(false); }} />
    {country && city.trim() ? <View style={s.section}>
      <T variant="heading">Približno područje na mapi</T>
      <T variant="meta" tone="muted">Označi centar područja rada. Čuva se približna tačka, zaokružena na oko kilometar, bez kućne adrese.</T>
      <WorkerAreaSearch city={city} countryCode={country} disabled={disabled} resolver={resolver}
        scopeKey={`${location.accountId}:${location.profileId}:${location.revision}:${mapEpoch}:${searchEpoch}`}
        onChoose={next => { if (!disabled) { setPosition(next); setConfirmed(false); setError(false); } }} />
      <ResolvedPinMap key={mapEpoch} coarse position={position} disabled={disabled}
        scopeKey={`${location.accountId}:${location.profileId}:${location.revision}:${mapEpoch}`}
        onChoose={next => { if (!disabled) {
          const coarse = displayedPinPosition(next, true);
          if (!coarse) return;
          setPosition(coarse); setConfirmed(false); setError(false); setSearchEpoch(value => value + 1);
        } }} />
      {position ? <Button label="Ukloni približnu tačku" kind="quiet" disabled={disabled}
        onPress={() => { if (!disabled) { setPosition(null); setConfirmed(false); setMapEpoch(value => value + 1); } }} /> : null}
    </View> : null}
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
