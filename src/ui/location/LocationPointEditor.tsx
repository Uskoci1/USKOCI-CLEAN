import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, View } from 'react-native';
import type { ConfirmedLocationPoint, LocationPinOrigin, LocationSlot } from '../../contracts/location';
import { createConfiguredLocationResolver, type ConfiguredLocationResolution, type LocationResolverCandidate } from '../../data/configuredLocationResolver';
import { locationPrivateText } from '../../lib/location';
import { captureCurrentLocation } from '../../data/nativeCurrentLocation';
import { V2Action as Button } from '../v2/V2Action';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { brandAction, sys } from '../system/tokens';
import { LocationDetails, LocationField } from './LocationControls';
import { ResolvedPinMap, type ResolvedPinPosition } from './ResolvedPinMap';

type Props = {
  slot: LocationSlot; title: string; point?: ConfirmedLocationPoint; scopeKey: string; disabled: boolean;
  countryCode: string; initialQuery?: string; resolver?: ReturnType<typeof createConfiguredLocationResolver>;
  /** Look the seeded query up once, so a caller that already knows the address can show the pin
   *  standing on it instead of asking the person to search for what they just said. Opt-in: a
   *  lookup marks the point pending, which the long form treats as an unsaved change. */
  autoLocate?: boolean;
  /** Confirming the point is the green action where nothing else saves (the conversation's point sheet); in the long
   *  form the footer's save is, so there the confirmation is white. */
  confirmAsPrimary?: boolean;
  onInvalidate: () => void; onConfirm: (point: ConfirmedLocationPoint) => void;
};
/** One visible point proposal. Only the explicit confirmation emits a saved value. */
export function LocationPointEditor(props: Props) {
  // A new point/country/account incarnation owns a fresh editor, including A-B-A.
  return <ScopedPointEditor key={JSON.stringify([props.scopeKey, props.countryCode, props.slot])} {...props} />;
}
function ScopedPointEditor({ slot, title, point, scopeKey, countryCode, initialQuery = '', resolver: injectedResolver,
  autoLocate = false, confirmAsPrimary = true, disabled, onInvalidate, onConfirm }: Props) {
  const [defaultResolver] = useState(() => createConfiguredLocationResolver());
  const resolver = injectedResolver ?? defaultResolver;
  const [position, setPosition] = useState<ResolvedPinPosition | null>(point
    ? { latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 } : null);
  const [origin, setOrigin] = useState<LocationPinOrigin>(point?.origin ?? { kind: 'MANUAL_PIN' });
  const [address, setAddress] = useState(point?.address ?? '');
  const [notes, setNotes] = useState(point?.accessNotes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  // With no point the map opens at [0,0] zoom 1 - a hemisphere of empty ocean, which reads as
  // broken. Where the address is already known the map has no job until something resolves,
  // so it waits. Opt-in with autoLocate; the long form still shows it from the start.
  const [placeByHand, setPlaceByHand] = useState(false);
  // "The work starts where I am" is the shortest path to a point, and it was missing. The
  // permission is requested only when this is pressed, never on opening; one foreground
  // observation, no geocoder and no background listener. Opt-in with autoLocate, so the long
  // form gains no permission prompt it did not have.
  const [here, setHere] = useState<null | 'BUSY' | 'DENIED' | 'UNAVAILABLE'>(null);
  const hereRequest = useRef<AbortController | null>(null);
  useEffect(() => () => hereRequest.current?.abort(), []);
  const [searchText, setSearchText] = useState(initialQuery);
  const [lookup, setLookup] = useState<ConfiguredLocationResolution | { status: 'IDLE' | 'LOADING' }>({ status: 'IDLE' });
  const [lookupMode, setLookupMode] = useState<'search' | 'reverse'>('search');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const focus = useRef(false), requestEpoch = useRef(0), renderEpoch = useRef(0);
  const rendered = ++renderEpoch.current;
  const located = useRef(false);
  const alive = useRef(true);
  const current = useRef({ disabled, point }); current.current = { disabled, point };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    focus.current = true; setFocused(true);
    return () => {
      focus.current = false; renderEpoch.current++; requestEpoch.current++; resolver.cancel();
      const saved = current.current.point;
      // Clearing the search text on blur left the point ask seedless for the rest of the session:
      // the address the conversation worked to obtain was gone, the field empty and "Pronađi na
      // mapi" greyed out. Coming back restores the seed and lets the automatic lookup run again.
      setFocused(false); setLookup({ status: 'IDLE' }); setSelectedLabel(null); setSearchText(initialQuery); located.current = false; setError(false);
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
    retireSearch(); setLookupMode('search'); setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); invalidate(); setLookup({ status: 'LOADING' });
    const epoch = requestEpoch.current;
    try {
      const result = await resolver.search({ text: searchText, countryCode, scopeKey });
      if (!alive.current || !focus.current || current.current.disabled || epoch !== requestEpoch.current) return;
      setLookup(result.status === 'CANCELLED' ? { status: 'IDLE' } : result);
    } catch {
      if (alive.current && focus.current && !current.current.disabled && epoch === requestEpoch.current) setLookup({ status: 'UNAVAILABLE' });
    }
  };
  // Placed after `search` so the effect calls the same guarded path a press does, once per scope.
  // A saved point wins: nothing here may move a point the person already confirmed.
  useEffect(() => {
    if (!autoLocate || located.current || !focused || disabled || point || !searchText.trim()) return;
    located.current = true;
    void search();
  }, [autoLocate, focused, disabled, point, searchText]); // eslint-disable-line react-hooks/exhaustive-deps
  const useHere = async () => {
    if (!owns() || here === 'BUSY') return;
    const request = new AbortController();
    hereRequest.current?.abort();
    hereRequest.current = request;
    setHere('BUSY');
    const result = await captureCurrentLocation(request.signal, owns);
    if (!owns() || hereRequest.current !== request) return;
    if (result.kind === 'POINT') {
      setHere(null); setPlaceByHand(true);
      // The same path a tap on the map takes: a manual pin the person still confirms.
      choose({ latitude: result.point.latitude, longitude: result.point.longitude });
      return;
    }
    setHere(result.kind === 'CANCELLED' ? null : result.kind === 'DENIED' ? 'DENIED' : 'UNAVAILABLE');
  };
  const reverse = async () => {
    if (!owns() || !position || lookup.status === 'LOADING') return;
    // Explicit lookup only; preserve the user's point throughout transport.
    // A provider's nearest place may have different coordinates.
    retireSearch(); setLookupMode('reverse'); setLookup({ status: 'LOADING' });
    const epoch = requestEpoch.current;
    try {
      const result = await resolver.reverse({ position, countryCode, scopeKey });
      if (!alive.current || !focus.current || current.current.disabled || epoch !== requestEpoch.current) return;
      setLookup(result.status === 'CANCELLED' ? { status: 'IDLE' } : result);
    } catch {
      if (alive.current && focus.current && !current.current.disabled && epoch === requestEpoch.current) setLookup({ status: 'UNAVAILABLE' });
    }
  };
  const selectCandidate = (candidate: LocationResolverCandidate) => {
    if (!owns()) return;
    if (lookupMode === 'reverse') {
      // Selecting the proposed address does not move or confirm the manual pin.
      retireSearch(); setAddress(candidate.label); setSelectedLabel(candidate.label); invalidate(); return;
    }
    retireSearch(); setPosition(candidate.position); setOrigin(candidate.origin); setSelectedLabel(candidate.label); invalidate();
  };
  const cancelSearch = () => { if (owns()) { retireSearch(lookupMode === 'search'); if (lookupMode === 'search') invalidate(); } };
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
  // No box of its own: the point sits in the form's "Samo u Dogovoru" group, and the conversation's sheet is already a
  // surface (a card here was a card in a card).
  return <View style={{ gap: sys.space.md }}>
    <T variant="bodyStrong">{title} na mapi</T>
    <T variant="meta" tone="muted">Izaberi tačno mesto i potvrdi ga. Tačka i detalji ispod ostaju privatni.</T>
    <LocationField label={`${title} — pronađi mesto`} value={searchText} maxLength={1000} editable={!disabled && focused} onChangeText={changeSearch} />
    <Button label={lookup.status === 'LOADING' ? 'Tražimo mesto…' : lookup.status === 'UNAVAILABLE' ? 'Pokušaj ponovo' : 'Pronađi na mapi'}
      kind="secondary" disabled={disabled || !focused || !searchText.trim() || !countryCode || lookup.status === 'LOADING'} onPress={search} />
    {autoLocate ? <Button label={here === 'BUSY' ? 'Tražimo gde si…' : 'Koristi gde sam'} kind="quiet"
      disabled={disabled || !focused || here === 'BUSY'} onPress={useHere} /> : null}
    {here === 'DENIED' ? <T variant="meta" accessibilityRole="alert">Pristup lokaciji nije dozvoljen. Možeš ga dozvoliti u podešavanjima ili upisati mesto iznad.</T> : null}
    {here === 'UNAVAILABLE' ? <T variant="meta" accessibilityRole="alert">Ne mogu da očitam gde si. Upiši mesto iznad ili izaberi tačku na mapi.</T> : null}
    {lookup.status === 'LOADING' ? <T variant="meta" accessibilityLiveRegion="polite">Tražimo predloge za uneto mesto…</T> : null}
    {lookup.status === 'PROVIDER_ACTIVATION_BLOCKED' ? <T variant="meta" accessibilityLiveRegion="polite">Pretraga mesta još nije aktivirana. Tačku izaberi dodirom na mapi.</T> : null}
    {lookup.status === 'UNAVAILABLE' ? <T variant="meta" accessibilityRole="alert">Predlozi trenutno nisu dostupni. Pokušaj ponovo ili izaberi tačku na mapi.</T> : null}
    {lookup.status === 'RATE_LIMITED' ? <T variant="meta" accessibilityRole="alert">Previše pretraga za kratko vreme. Sačekaj pa pokušaj ponovo ili izaberi tačku na mapi.</T> : null}
    {lookup.status === 'INVALID_QUERY' ? <T variant="meta" accessibilityRole="alert">Unesi mesto i proveri izabranu državu.</T> : null}
    {lookup.status === 'PROPOSALS' && lookup.candidates.length === 0 ? <T variant="meta" accessibilityLiveRegion="polite">{lookupMode === 'reverse'
      ? 'Adresa za ovu tačku nije pronađena. Upiši je ručno.' : 'Nema predloga za uneti tekst. Preciziraj mesto ili izaberi tačku na mapi.'}</T> : null}
    {/* Each proposal is the address itself, on a white row with a pin; what the tap does is its spoken name. */}
    {lookup.status === 'PROPOSALS' ? lookup.candidates.map((candidate, index) => <Button
      key={`${candidate.origin.candidateHint ?? 'candidate'}:${index}`} label={candidate.label}
      accessibilityLabel={`${lookupMode === 'reverse' ? 'Koristi privatnu adresu' : 'Izaberi predlog'}: ${candidate.label}`}
      icon={<FactArt kind="pin" size={18} />} style={{ justifyContent: 'flex-start' }}
      kind="secondary" disabled={disabled || !focused} onPress={() => selectCandidate(candidate)} />) : null}
    {lookup.status === 'PROPOSALS' ? <Press accessibilityRole="link" accessibilityLabel="Pretraga: LocationIQ · izvori podataka"
      onPress={() => { void Linking.openURL('https://locationiq.com/attribution').catch(() => {}); }}
      style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }}>
      <T variant="meta" tone="muted">Pretraga: LocationIQ · izvori podataka</T>
    </Press> : null}
    {/* The address the person is about to confirm is content, not a caption: body size, readable. */}
    {selectedLabel ? <T variant="body">Predlog za proveru: <T variant="bodyStrong">{selectedLabel}</T></T> : null}
    {/* After a suggestion is applied there is no search in flight, so "Otkaži pretragu" was really
        "delete the pin I just chose", under a name that promised the opposite. */}
    {lookup.status !== 'IDLE' ? <Button label="Otkaži pretragu" kind="quiet" disabled={disabled || !focused} onPress={cancelSearch} /> : null}
    {lookup.status === 'IDLE' && selectedLabel ? <Button label="Ukloni izabranu tačku" kind="quiet" disabled={disabled || !focused} onPress={cancelSearch} /> : null}
    {!autoLocate || position || placeByHand
      ? <ResolvedPinMap position={position} onChoose={choose} scopeKey={scopeKey} disabled={disabled || !focused} />
      : <Button label="Izaberi tačku na mapi" kind="quiet" disabled={disabled || !focused}
        onPress={() => setPlaceByHand(true)} />}
    {position ? <Button label={lookupMode === 'reverse' && lookup.status === 'LOADING' ? 'Tražimo adresu…' : 'Pronađi adresu za ovaj pin'}
      kind="quiet" disabled={disabled || !focused || lookup.status === 'LOADING'} onPress={reverse} /> : null}
    <LocationDetails label={`${title} — privatni detalji tačke`} disabled={disabled || !focused}
      summary={address || notes ? 'Privatni detalji su uneti. Otvori za pregled.' : 'Dodaj adresu ili napomenu po potrebi'}>
    <LocationField label={`${title} — privatna adresa (opciono)`} value={address} maxLength={1000} editable={!disabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(true); setAddress(value); invalidate(); } }} />
    <LocationField label={`${title} — privatne napomene za pristup (opciono)`} value={notes} maxLength={2000} multiline editable={!disabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(true); setNotes(value); invalidate(); } }} />
    </LocationDetails>
    {error ? <T accessibilityRole="alert" tone="danger">Proveri izabranu tačku i privatne podatke.</T> : null}
    {/* The line beside the confirm button says why it is grey while there is no point to confirm. */}
    <T variant="meta" tone={point && !pending ? 'success' : 'muted'}>
      {point && !pending ? 'Tačka je potvrđena u ovom obrascu.'
        : pending ? `Izmena tačke još nije potvrđena.${position ? '' : ' Izaberi tačku na mapi ili predlog iz pretrage.'}`
          : position ? 'Tačka još nije potvrđena.' : 'Izaberi tačku na mapi ili predlog iz pretrage, pa je potvrdi.'}
    </T>
    <Button label={`Potvrdi tačku: ${title}`} kind="secondary" style={confirmAsPrimary ? brandAction : undefined} disabled={disabled || !focused || !position || lookup.status === 'LOADING'} onPress={confirm} />
  </View>;
}
