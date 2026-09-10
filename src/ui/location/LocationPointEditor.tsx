import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import type { ConfirmedLocationPoint, LocationPinOrigin, LocationSlot } from '../../contracts/location';
import { createConfiguredLocationResolver, type ConfiguredLocationResolution, type LocationResolverCandidate } from '../../data/configuredLocationResolver';
import { locationPrivateText } from '../../lib/location';
import { Button } from '../Button';
import { T } from '../Text';
import { LocationField, locationStyles as s } from './LocationControls';
import { ResolvedPinMap, type ResolvedPinPosition } from './ResolvedPinMap';

type Props = {
  slot: LocationSlot; title: string; point?: ConfirmedLocationPoint; scopeKey: string; disabled: boolean;
  countryCode: string; initialQuery?: string; resolver?: ReturnType<typeof createConfiguredLocationResolver>;
  onInvalidate: () => void; onConfirm: (point: ConfirmedLocationPoint) => void;
};
/** One visible point proposal. Only the explicit confirmation emits a saved value. */
export function LocationPointEditor(props: Props) {
  // A new point/country/account incarnation owns a fresh editor, including A-B-A.
  return <ScopedPointEditor key={JSON.stringify([props.scopeKey, props.countryCode, props.slot])} {...props} />;
}
function ScopedPointEditor({ slot, title, point, scopeKey, countryCode, initialQuery = '', resolver: injectedResolver,
  disabled, onInvalidate, onConfirm }: Props) {
  const [defaultResolver] = useState(() => createConfiguredLocationResolver());
  const resolver = injectedResolver ?? defaultResolver;
  const [position, setPosition] = useState<ResolvedPinPosition | null>(point
    ? { latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 } : null);
  const [origin, setOrigin] = useState<LocationPinOrigin>(point?.origin ?? { kind: 'MANUAL_PIN' });
  const [address, setAddress] = useState(point?.address ?? '');
  const [notes, setNotes] = useState(point?.accessNotes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [searchText, setSearchText] = useState(initialQuery);
  const [lookup, setLookup] = useState<ConfiguredLocationResolution | { status: 'IDLE' | 'LOADING' }>({ status: 'IDLE' });
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const focus = useRef(false), requestEpoch = useRef(0), renderEpoch = useRef(0);
  const rendered = ++renderEpoch.current;
  const alive = useRef(true);
  const current = useRef({ disabled, point }); current.current = { disabled, point };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    focus.current = true; setFocused(true);
    return () => {
      focus.current = false; renderEpoch.current++; requestEpoch.current++; resolver.cancel();
      const saved = current.current.point;
      setFocused(false); setLookup({ status: 'IDLE' }); setSelectedLabel(null); setSearchText(''); setError(false);
      setPosition(saved ? { latitude: saved.latitudeE6 / 1e6, longitude: saved.longitudeE6 / 1e6 } : null);
      setOrigin(saved?.origin ?? { kind: 'MANUAL_PIN' });setAddress(saved?.address ?? '');setNotes(saved?.accessNotes ?? '');
    };
  }, [resolver]));
  useEffect(() => {
    if (!disabled) return;
    requestEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); setSelectedLabel(null);
    const saved = current.current.point;
    setPosition(saved ? { latitude: saved.latitudeE6 / 1e6, longitude: saved.longitudeE6 / 1e6 } : null);
    setOrigin(saved?.origin ?? { kind: 'MANUAL_PIN' });
  }, [disabled, resolver]);
  const owns = () => alive.current && focus.current && !current.current.disabled && rendered === renderEpoch.current;
  const retireSearch = (clearCandidatePin = false) => {
    renderEpoch.current++; requestEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); setSelectedLabel(null);
    if (clearCandidatePin && origin.kind === 'PROVIDER_CANDIDATE') { setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); }
  };
  const invalidate = () => { setPending(true); setError(false); onInvalidate(); };
  const choose = (next: ResolvedPinPosition) => {
    if (!owns()) return;
    retireSearch();
    setPosition(next); setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
  };
  const changeSearch = (value: string) => {
    if (!owns()) return;
    retireSearch(); setSearchText(value); setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
  };
  const search = async () => {
    if (!owns() || lookup.status === 'LOADING') return;
    retireSearch(); setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); invalidate(); setLookup({ status: 'LOADING' });
    const epoch = requestEpoch.current;
    try {
      const result = await resolver.search({ text: searchText, countryCode, scopeKey });
      if (!alive.current || !focus.current || current.current.disabled || epoch !== requestEpoch.current) return;
      setLookup(result.status === 'CANCELLED' ? { status: 'IDLE' } : result);
    } catch {
      if (alive.current && focus.current && !current.current.disabled && epoch === requestEpoch.current) setLookup({ status: 'UNAVAILABLE' });
    }
  };
  const selectCandidate = (candidate: LocationResolverCandidate) => {
    if (!owns()) return;
    retireSearch(); setPosition(candidate.position); setOrigin(candidate.origin); setSelectedLabel(candidate.label); invalidate();
  };
  const cancelSearch = () => { if (owns()) { retireSearch(true); invalidate(); } };
  const confirm = () => {
    if (!owns() || !position) return;
    const privateAddress = address.trim() ? locationPrivateText(address, 1000) : null;
    const accessNotes = notes.trim() ? locationPrivateText(notes, 2000) : null;
    if (privateAddress === undefined || accessNotes === undefined) { setError(true); return; }
    const latitudeE6 = Math.round(position.latitude * 1e6), longitudeE6 = Math.round(position.longitude * 1e6);
    if (!Number.isSafeInteger(latitudeE6) || !Number.isSafeInteger(longitudeE6)
      || Math.abs(latitudeE6) > 90e6 || Math.abs(longitudeE6) > 180e6) { setError(true); return; }
    retireSearch();
    onConfirm({ slot, latitudeE6, longitudeE6, origin,
      ...(privateAddress !== null ? { address: privateAddress } : {}), ...(accessNotes !== null ? { accessNotes } : {}) });
    setPending(false); setError(false);
  };
  return <View style={s.card}>
    <T variant="heading">{title} na mapi</T>
    <T variant="meta" tone="muted">Izaberite tačno mesto i potvrdite ga. Tačka i detalji ispod ostaju privatni.</T>
    <LocationField label={`${title} — pronađi mesto`} value={searchText} maxLength={1000} editable={!disabled && focused} onChangeText={changeSearch} />
    <Button label={lookup.status === 'LOADING' ? 'Tražimo mesto…' : lookup.status === 'UNAVAILABLE' ? 'Pokušaj ponovo' : 'Pronađi na mapi'}
      kind="secondary" disabled={disabled || !focused || !searchText.trim() || !countryCode || lookup.status === 'LOADING'} onPress={search} />
    {lookup.status === 'LOADING' ? <T variant="meta" accessibilityLiveRegion="polite">Tražimo predloge za uneto mesto…</T> : null}
    {lookup.status === 'PROVIDER_ACTIVATION_BLOCKED' ? <T variant="meta" accessibilityLiveRegion="polite">Pretraga mesta još nije aktivirana. Tačku možete izabrati na mapi.</T> : null}
    {lookup.status === 'UNAVAILABLE' ? <T variant="meta" accessibilityRole="alert">Predlozi trenutno nisu dostupni. Pokušajte ponovo ili izaberite tačku na mapi.</T> : null}
    {lookup.status === 'INVALID_QUERY' ? <T variant="meta" accessibilityRole="alert">Unesite mesto i proverite izabranu državu.</T> : null}
    {lookup.status === 'PROPOSALS' && lookup.candidates.length === 0 ? <T variant="meta" accessibilityLiveRegion="polite">Nema predloga za uneti tekst. Precizirajte mesto ili izaberite tačku na mapi.</T> : null}
    {lookup.status === 'PROPOSALS' ? lookup.candidates.map((candidate, index) => <Button
      key={`${candidate.origin.candidateHint ?? 'candidate'}:${index}`} label={`Izaberi predlog: ${candidate.label}`}
      kind="quiet" disabled={disabled || !focused} onPress={() => selectCandidate(candidate)} />) : null}
    {selectedLabel ? <T variant="meta">Predlog za proveru: {selectedLabel}</T> : null}
    {lookup.status !== 'IDLE' || selectedLabel ? <Button label="Otkaži pretragu" kind="quiet" disabled={disabled || !focused} onPress={cancelSearch} /> : null}
    <ResolvedPinMap position={position} onChoose={choose} scopeKey={scopeKey} disabled={disabled || !focused} />
    <LocationField label={`${title} — privatna adresa (opciono)`} value={address} maxLength={1000} editable={!disabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(true); setAddress(value); invalidate(); } }} />
    <LocationField label={`${title} — privatne napomene za pristup (opciono)`} value={notes} maxLength={2000} multiline editable={!disabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(true); setNotes(value); invalidate(); } }} />
    {error ? <T accessibilityRole="alert" tone="danger">Proverite izabranu tačku i privatne podatke.</T> : null}
    <T variant="meta" tone={point && !pending ? 'success' : 'muted'}>
      {point && !pending ? 'Tačka je potvrđena u ovom obrascu.' : pending ? 'Izmena tačke još nije potvrđena.' : 'Tačka još nije potvrđena.'}
    </T>
    <Button label={`Potvrdi tačku: ${title}`} kind="secondary" disabled={disabled || !focused || !position || lookup.status === 'LOADING'} onPress={confirm} />
  </View>;
}
