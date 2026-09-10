import { useState } from 'react';
import { View } from 'react-native';
import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import type { ConfirmedLocationPoint, LocationSlot, NeedLocationInput, NeedLocationReview } from '../../contracts/location';
import { locationSlots, normalizeNeedLocation } from '../../lib/location';
import { Button } from '../Button';
import { T } from '../Text';
import { LocationChoice, LocationConfirmation, LocationField, PrivateLocationNote, locationStyles as s } from './LocationControls';
import { CountryField, selectableCountry, useCountryOptions } from './CountryField';
import { LocationPointEditor } from './LocationPointEditor';
import type { createConfiguredLocationResolver } from '../../data/configuredLocationResolver';

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

export function NeedLocationForm({ review, busy, uncertain, onSave, resolver }: {
  review: NeedLocationReview; busy: boolean; uncertain: boolean; onSave: (value: NeedLocationInput) => void;
  resolver?: ReturnType<typeof createConfiguredLocationResolver>;
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
  const [points, setPoints] = useState<readonly ConfirmedLocationPoint[]>(review.value.resolvedLocation?.points ?? []);
  const [pinEpoch, setPinEpoch] = useState(0);
  const [activeSlot, setActiveSlot] = useState<LocationSlot | null>(null);
  const [pendingPoint, setPendingPoint] = useState(false);
  const disabled = busy || uncertain || !review.editable;
  const change = (fn: () => void, invalidatePins = true) => {
    if (disabled) return;
    fn(); setConfirmed(false); setInvalid(false);
    if (invalidatePins) { setPoints([]); setPinEpoch(value => value + 1); setActiveSlot(null); setPendingPoint(false); }
  };
  function currentLocation() {
    let geography: NeedTaskGeography;
    switch (mode) {
      case 'REMOTE': geography = { mode }; break;
      case 'STATIONARY': geography = { mode, start }; break;
      case 'POINT_TO_POINT': geography = { mode, start, end }; break;
      case 'MULTI_STOP': geography = { mode, start, ...(Object.keys(end).length ? { end } : {}), waypoints }; break;
      case 'AREA_BASED': geography = { mode, ...(areaStart ? { start: areaStart } : {}),
        ...(Object.keys(area).length ? { serviceArea: area } : {}) }; break;
    }
    return normalizeNeedLocation({ taskCountryCode: country, geography, exactAddress: mode === 'REMOTE' ? null : address.trim() || null,
      accessNotes: mode === 'REMOTE' ? null : notes.trim() || null });
  }
  const baseValue = currentLocation();
  const slots = baseValue ? locationSlots(baseValue.geography) : [];
  const titleForSlot = (slot: LocationSlot) => slot === 'start' ? (mode === 'STATIONARY' ? 'Mesto rada' : 'Polazište')
    : slot === 'end' ? 'Odredište' : slot === 'serviceArea' ? 'Područje rada' : `Stanica ${Number(slot.split('/')[1]) + 1}`;
  const selectedSlot = activeSlot && slots.includes(activeSlot) ? activeSlot : slots[0];
  function submit() {
    if (disabled || pendingPoint || !confirmed || !selectableCountry(countryOptions.countries, country)) return;
    if (!baseValue) { setInvalid(true); return; }
    const value = normalizeNeedLocation({ ...baseValue, resolvedLocation: mode !== 'REMOTE' && points.length ? {
      version: 1, binding: { taskCountryCode: baseValue.taskCountryCode, geography: baseValue.geography, exactAddress: baseValue.exactAddress }, points,
    } : null });
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
          {index > 0 ? <Button label={`Pomeri stanicu ${index + 1} ranije`} kind="quiet" disabled={disabled}
            onPress={() => change(() => setWaypoints(old => { const next = [...old];
              [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }))} /> : null}
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
        editable={!disabled} onChangeText={text => change(() => setNotes(text), false)} />
      <View style={s.section}>
        <T variant="heading">Potvrdite tačke na mapi</T>
        <T variant="meta" tone="muted">Promena države, javnog mesta, redosleda stanica ili tačne adrese traži novu potvrdu tačaka.</T>
        {!baseValue || !slots.length ? <T>Prvo unesite državu i javno mesto za potrebne tačke.</T> : <>
          <T variant="bodyStrong">Potvrđeno tačaka: {points.length} od {slots.length}</T>
          {slots.length > 1 ? <LocationChoice label="Tačka koju uređujete" value={selectedSlot}
            options={slots.map(slot => ({ value: slot, label: `${titleForSlot(slot)}${points.some(point => point.slot === slot) ? ' · potvrđeno' : ''}` }))}
            disabled={disabled || pendingPoint} onChange={slot => { if (!disabled && !pendingPoint) setActiveSlot(slot as LocationSlot); }} /> : null}
          {selectedSlot ? <LocationPointEditor key={`${pinEpoch}:${selectedSlot}`} slot={selectedSlot} title={titleForSlot(selectedSlot)}
            countryCode={baseValue.taskCountryCode}
            resolver={resolver}
            point={points.find(point => point.slot === selectedSlot)} disabled={disabled}
            scopeKey={`${review.accountId}:${review.conversationId}:${review.revision}:${pinEpoch}:${selectedSlot}`}
            onInvalidate={() => change(() => { setPoints(old => old.filter(point => point.slot !== selectedSlot)); setPendingPoint(true); }, false)}
            onConfirm={point => change(() => { setPoints(old => [...old.filter(item => item.slot !== selectedSlot), point]); setPendingPoint(false); }, false)} /> : null}
          {pendingPoint ? <Button label="Odbaci nepotvrđenu tačku" kind="quiet" disabled={disabled}
            onPress={() => { if (!disabled) { setPendingPoint(false); setPinEpoch(value => value + 1); } }} /> : null}
          {points.length < slots.length ? <T variant="meta" tone="muted">Pregled možete sačuvati i dopuniti kasnije. Lokacija je potpuno potvrđena tek kada proverite sve tačke.</T> : null}
        </>}
      </View>
    </>}
    {invalid ? <T accessibilityRole="alert" tone="danger">Unesite mesto za svaku potrebnu tačku. Ruta sa više stanica mora imati odredište ili bar jednu stanicu.</T> : null}
    <LocationConfirmation checked={confirmed} disabled={disabled} onChange={setConfirmed}>
      {mode === 'REMOTE' ? 'Potvrđujem da se Zadatak radi na daljinu.' : 'Proverio/la sam javno mesto i privatne podatke.'}
    </LocationConfirmation>
    <Button full label={busy ? 'Čuvamo lokaciju…' : 'Potvrdi i sačuvaj mesto'}
      disabled={disabled || pendingPoint || !confirmed || !selectableCountry(countryOptions.countries, country)} onPress={submit} />
    <T variant="meta" tone="muted">Čuva se mesto u istom pregledu. Zadatak još nije objavljen.</T>
  </View>;
}
