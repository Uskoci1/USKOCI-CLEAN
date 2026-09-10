import { useState } from 'react';
import { View } from 'react-native';
import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import type { NeedLocationInput, NeedLocationReview } from '../../contracts/location';
import { normalizeNeedLocation } from '../../lib/location';
import { Button } from '../Button';
import { T } from '../Text';
import { LocationChoice, LocationConfirmation, LocationField, PrivateLocationNote, locationStyles as s } from './LocationControls';
import { CountryField, selectableCountry, useCountryOptions } from './CountryField';

const MODES: ReadonlyArray<[NeedTaskGeography['mode'], string]> = [
  ['STATIONARY', 'Na jednoj lokaciji'], ['POINT_TO_POINT', 'Od mesta do mesta'],
  ['MULTI_STOP', 'Više stanica'], ['AREA_BASED', 'Na području'], ['REMOTE', 'Na daljinu'],
];

function PlaceFields({ title, value, disabled, onChange }: { title: string; value: NeedTaskGeographyPoint;
  disabled: boolean; onChange: (value: NeedTaskGeographyPoint) => void }) {
  const field = (key: 'city' | 'area' | 'label', text: string) => {
    const next = { ...value };
    if (text) next[key] = text; else delete next[key];
    onChange(next);
  };
  return <View style={s.card}>
    <T variant="heading">{title}</T>
    <LocationField label={`${title} — grad ili mesto`} value={value.city ?? ''} maxLength={160}
      editable={!disabled} onChangeText={text => field('city', text)} />
    <LocationField label={`${title} — deo grada (opciono)`} value={value.area ?? ''} maxLength={160}
      editable={!disabled} onChangeText={text => field('area', text)} />
    <LocationField label={`${title} — javni opis (opciono)`} value={value.label ?? ''} maxLength={240}
      hint="Ovo je javno. Unesite samo približno područje, bez adrese, broja stana ili kontakta."
      editable={!disabled} onChangeText={text => field('label', text)} />
  </View>;
}

export function NeedLocationForm({ review, busy, uncertain, onSave }: {
  review: NeedLocationReview; busy: boolean; uncertain: boolean; onSave: (value: NeedLocationInput) => void;
}) {
  const current = review.value.geography;
  const countryOptions = useCountryOptions();
  const [country, setCountry] = useState<string | null>(review.value.taskCountryCode);
  const [mode, setMode] = useState<NeedTaskGeography['mode']>(current?.mode ?? 'STATIONARY');
  const [start, setStart] = useState<NeedTaskGeographyPoint>(current?.start ?? {});
  const [areaStart, setAreaStart] = useState<NeedTaskGeographyPoint | null>(current?.mode === 'AREA_BASED' ? current.start ?? null : null);
  const [end, setEnd] = useState<NeedTaskGeographyPoint>(current?.end ?? {});
  const [area, setArea] = useState<NeedTaskGeographyPoint>(current?.serviceArea ?? {});
  const [waypoints, setWaypoints] = useState<NeedTaskGeographyPoint[]>(current?.waypoints ?? []);
  const [address, setAddress] = useState(review.value.exactAddress ?? '');
  const [notes, setNotes] = useState(review.value.accessNotes ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const disabled = busy || uncertain || !review.editable;
  const change = (fn: () => void) => { fn(); setConfirmed(false); setInvalid(false); };

  function submit() {
    if (disabled || !confirmed || !selectableCountry(countryOptions.countries, country)) return;
    let geography: NeedTaskGeography;
    switch (mode) {
      case 'REMOTE': geography = { mode }; break;
      case 'STATIONARY': geography = { mode, start }; break;
      case 'POINT_TO_POINT': geography = { mode, start, end }; break;
      case 'MULTI_STOP': geography = { mode, start, ...(Object.keys(end).length ? { end } : {}), waypoints }; break;
      case 'AREA_BASED': geography = { mode, ...(areaStart ? { start: areaStart } : {}), serviceArea: area }; break;
    }
    const value = normalizeNeedLocation({ taskCountryCode: country, geography, exactAddress: mode === 'REMOTE' ? null : address.trim() || null,
      accessNotes: mode === 'REMOTE' ? null : notes.trim() || null });
    if (!value) { setInvalid(true); return; }
    onSave(value);
  }

  return <View style={{ gap: 24 }}>
    <View style={s.section}>
      <T variant="heading" style={{ fontSize: 25, lineHeight: 31 }}>Gde treba uskočiti?</T>
      <T tone="muted">Unesite mesto gde je potrebna pomoć. GPS dozvola nije potrebna.</T>
    </View>
    {!review.editable ? <T accessibilityRole="alert">Ovaj pregled više nije dostupan za izmene. Vratite se na Zadatak.</T> : null}
    <CountryField label="Država Zadatka" value={country} disabled={disabled} options={countryOptions}
      onChange={code => change(() => setCountry(code))} />
    <LocationChoice label="Način rada" value={mode} options={MODES.map(([value, label]) => ({ value, label }))}
      disabled={disabled} onChange={value => change(() => setMode(value as NeedTaskGeography['mode']))} />
    {mode === 'REMOTE' ? <View style={s.notice}><T>Rad na daljinu nema adresu, pin ili radijus. Čuvanjem se uklanjaju podaci o fizičkom mestu iz ovog pregleda.</T></View> : <>
      {mode !== 'AREA_BASED' ? <PlaceFields title={mode === 'STATIONARY' ? 'Mesto rada' : 'Polazište'} value={start}
        disabled={disabled} onChange={value => change(() => setStart(value))} /> : <PlaceFields title="Područje rada" value={area}
        disabled={disabled} onChange={value => change(() => setArea(value))} />}
      {mode === 'AREA_BASED' ? areaStart ? <View style={s.section}>
        <PlaceFields title="Početna tačka" value={areaStart} disabled={disabled}
          onChange={value => change(() => setAreaStart(value))} />
        <Button label="Ukloni početnu tačku" kind="quiet" disabled={disabled}
          onPress={() => { if (!disabled) change(() => setAreaStart(null)); }} />
      </View> : <Button label="Dodaj početnu tačku (opciono)" kind="secondary" disabled={disabled}
        onPress={() => { if (!disabled) change(() => setAreaStart({})); }} /> : null}
      {mode === 'MULTI_STOP' ? <View style={s.section}>
        {waypoints.map((point, index) => <View key={index} style={s.section}>
          <PlaceFields title={`Stanica ${index + 1}`} value={point} disabled={disabled}
            onChange={value => change(() => setWaypoints(points => points.map((old, i) => i === index ? value : old)))} />
          <Button label={`Ukloni stanicu ${index + 1}`} kind="quiet" disabled={disabled}
            onPress={() => change(() => setWaypoints(points => points.filter((_, i) => i !== index)))} />
        </View>)}
        <Button label="Dodaj stanicu" kind="secondary" disabled={disabled || waypoints.length >= 20}
          onPress={() => change(() => setWaypoints(points => [...points, {}]))} />
      </View> : null}
      {mode === 'POINT_TO_POINT' || mode === 'MULTI_STOP' ? <PlaceFields title="Odredište" value={end}
        disabled={disabled} onChange={value => change(() => setEnd(value))} /> : null}
      <PrivateLocationNote />
      <LocationField label="Tačna adresa (privatno, opciono)" value={address} maxLength={1000}
        editable={!disabled} onChangeText={text => change(() => setAddress(text))} />
      <LocationField label="Napomene za pristup (privatno, opciono)" value={notes} maxLength={2000} multiline
        editable={!disabled} onChangeText={text => change(() => setNotes(text))} />
    </>}
    {invalid ? <T accessibilityRole="alert" tone="danger">Unesite mesto za svaku potrebnu tačku. Ruta sa više stanica mora imati odredište ili bar jednu stanicu.</T> : null}
    <LocationConfirmation checked={confirmed} disabled={disabled} onChange={setConfirmed}>
      {mode === 'REMOTE' ? 'Potvrđujem da se Zadatak radi na daljinu.' : 'Proverio/la sam javno mesto i privatne podatke.'}
    </LocationConfirmation>
    <Button full label={busy ? 'Čuvamo lokaciju…' : 'Potvrdi i sačuvaj mesto'}
      disabled={disabled || !confirmed || !selectableCountry(countryOptions.countries, country)} onPress={submit} />
    <T variant="meta" tone="muted">Čuva se mesto u istom pregledu. Zadatak još nije objavljen.</T>
  </View>;
}
