import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, View } from 'react-native';
import type { ConfirmedLocationPoint, LocationPinOrigin, LocationSlot } from '../../contracts/location';
import { createConfiguredLocationResolver, type ConfiguredLocationResolution, type LocationResolverCandidate } from '../../data/configuredLocationResolver';
import { locationPrivateText } from '../../lib/location';
import { captureCurrentLocation } from '../../data/nativeCurrentLocation';
import { sesijaSada } from '../../store/sesija';
import { V2Action as Button } from '../v2/V2Action';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { brandAction, sys } from '../system/tokens';
import { LocationDetails, LocationField } from './LocationControls';
import { ResolvedPinMap, type ResolvedPinPosition } from './ResolvedPinMap';

/** Optional UI shortcuts for the single point currently shown in the conversation. */
export type PointReplyActions = { confirm?: () => boolean; correct?: () => boolean };

type Props = {
  slot: LocationSlot; title: string; point?: ConfirmedLocationPoint; scopeKey: string; disabled: boolean;
  countryCode: string; initialQuery?: string; resolver?: ReturnType<typeof createConfiguredLocationResolver>;
  /** Look the seeded query up once, so a caller that already knows the address can show the pin
   *  standing on it instead of asking the person to search for what they just said. Opt-in: a
   *  lookup marks the point pending, which the long form treats as an unsaved change. */
  autoLocate?: boolean;
  /** The chat proposes one pin first; the full manual form retains all controls. */
  presentation?: 'form' | 'conversation';
  onCorrectInConversation?: () => void;
  onReplyActionsReady?: (actions: PointReplyActions | null) => void;
  /** Confirming the point is the primary action where nothing else saves (the conversation's point sheet); in the long
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
  autoLocate = false, presentation = 'form', onCorrectInConversation, onReplyActionsReady, confirmAsPrimary = true, disabled, onInvalidate, onConfirm }: Props) {
  const conversation = presentation === 'conversation';
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
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [candidatePage, setCandidatePage] = useState(0);
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
      hereRequest.current?.abort(); hereRequest.current = null; setHere(null);
      const saved = current.current.point;
      // Clearing the search text on blur left the point ask seedless for the rest of the session:
      // the address the conversation worked to obtain was gone, the field empty and "Pronađi na
      // mapi" greyed out. Coming back restores the seed and lets the automatic lookup run again.
      setFocused(false); setLookup({ status: 'IDLE' }); setSelectedLabel(null); setCorrectionOpen(false); setSearchText(initialQuery); located.current = false; setError(false);
      setPosition(saved ? { latitude: saved.latitudeE6 / 1e6, longitude: saved.longitudeE6 / 1e6 } : null);
      setOrigin(saved?.origin ?? { kind: 'MANUAL_PIN' });setAddress(saved?.address ?? '');setNotes(saved?.accessNotes ?? '');
    };
  }, [resolver]));
  useEffect(() => {
    if (!disabled) return;
    requestEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); setSelectedLabel(null); setCorrectionOpen(false);
    hereRequest.current?.abort(); hereRequest.current = null; setHere(null);
    const saved = current.current.point;
    setPosition(saved ? { latitude: saved.latitudeE6 / 1e6, longitude: saved.longitudeE6 / 1e6 } : null);
    setOrigin(saved?.origin ?? { kind: 'MANUAL_PIN' });
    if (conversation) setAddress(saved?.address ?? '');
  }, [disabled, resolver, conversation]);
  const owns = () => alive.current && focus.current && !current.current.disabled && rendered === renderEpoch.current;
  const retireSearch = (clearCandidatePin = false) => {
    renderEpoch.current++; requestEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); setSelectedLabel(null);
    setCandidatePage(0);
    hereRequest.current?.abort(); hereRequest.current = null; setHere(null);
    if (clearCandidatePin && origin.kind === 'PROVIDER_CANDIDATE') { setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); }
  };
  const invalidate = () => { setPending(true); setError(false); onInvalidate(); };
  const lookupAddress = async (next: ResolvedPinPosition, adoptProposal: boolean) => {
    const epoch = requestEpoch.current, owner = sesijaSada();
    const ownsRequest = () => alive.current && focus.current && !current.current.disabled && epoch === requestEpoch.current
      && sesijaSada().user?.id === owner.user?.id && sesijaSada().accountRevision === owner.accountRevision;
    setLookupMode('reverse'); setLookup({ status: 'LOADING' });
    try {
      const result = await resolver.reverse({ position: next, countryCode, scopeKey });
      if (!ownsRequest()) return;
      setLookup(result.status === 'CANCELLED' ? { status: 'IDLE' } : result);
      // The reverse contract admits at most one address. It labels the user's pin;
      // the provider's nearest coordinates must never replace that exact selection.
      if (adoptProposal && result.status === 'PROPOSALS' && result.candidates.length === 1) {
        setAddress(result.candidates[0].label); setSelectedLabel(result.candidates[0].label);
      }
    } catch {
      if (ownsRequest()) setLookup({ status: 'UNAVAILABLE' });
    }
  };
  const choose = (next: ResolvedPinPosition) => {
    if (!owns()) return;
    retireSearch(); setCorrectionOpen(false);
    setPosition(next); setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
    if (conversation) {
      // Conversation: a completed drag/map tap updates the draft address too.
      // Clear the old address now; a newer edit/point/visit retires this lookup.
      setAddress('');
      void lookupAddress(next, true);
    }
  };
  const changeSearch = (value: string) => {
    if (!owns()) return;
    retireSearch(); setSearchText(value); setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
    if (conversation) setAddress('');
  };
  const search = async () => {
    if (!owns() || lookup.status === 'LOADING') return;
    retireSearch(); setLookupMode('search'); setPosition(null); setOrigin({ kind: 'MANUAL_PIN' }); invalidate(); setLookup({ status: 'LOADING' });
    if (conversation) setAddress('');
    const epoch = requestEpoch.current;
    try {
      const result = await resolver.search({ text: searchText, countryCode, scopeKey });
      if (!alive.current || !focus.current || current.current.disabled || epoch !== requestEpoch.current) return;
      setLookup(result.status === 'CANCELLED' ? { status: 'IDLE' } : result);
      // Conversation proposals include the visible draft address. Only the human
      // confirmation saves it; the full form retains its separate explicit adoption.
      if (conversation && result.status === 'PROPOSALS' && result.candidates[0]) {
        const candidate = result.candidates[0];
        setPosition(candidate.position); setOrigin(candidate.origin); setSelectedLabel(candidate.label);
        setAddress(candidate.label);
        setCorrectionOpen(false);
      }
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
    if (!owns() || hereRequest.current) return;
    retireSearch();
    const request = new AbortController();
    const epoch = requestEpoch.current, owner = sesijaSada();
    hereRequest.current = request;
    setHere('BUSY');
    // The BUSY render must not retire its own observation. The request's intent,
    // focus and account own it; another edit or lookup advances the epoch.
    const ownsRequest = () => alive.current && focus.current && !current.current.disabled && !request.signal.aborted
      && hereRequest.current === request && requestEpoch.current === epoch
      && sesijaSada().user?.id === owner.user?.id && sesijaSada().accountRevision === owner.accountRevision;
    try {
      const result = await captureCurrentLocation(request.signal, ownsRequest);
      if (!ownsRequest()) return;
      hereRequest.current = null;
      if (result.kind === 'POINT') {
        retireSearch(); setPlaceByHand(true);
        // Apply a manual proposal under the live request, not the pre-await render's choose callback.
        // Nothing confirms or saves it until the person presses the existing confirmation.
        setPosition({ latitude: result.point.latitude, longitude: result.point.longitude });
        setOrigin({ kind: 'MANUAL_PIN' }); invalidate();
        return;
      }
      setHere(result.kind === 'CANCELLED' ? null : result.kind === 'DENIED' ? 'DENIED' : 'UNAVAILABLE');
    } finally {
      if (hereRequest.current === request) { hereRequest.current = null; if (alive.current) setHere(null); }
    }
  };
  const reverse = async () => {
    if (!owns() || !position || lookup.status === 'LOADING') return;
    // The full form still requires explicit address adoption. The conversation's
    // retry uses the same draft-only lookup as a completed manual pin movement.
    retireSearch();
    await lookupAddress(position, conversation);
  };
  const selectCandidate = (candidate: LocationResolverCandidate) => {
    if (!owns()) return;
    if (lookupMode === 'reverse') {
      // Selecting the proposed address does not move or confirm the manual pin.
      retireSearch(); setAddress(candidate.label); setSelectedLabel(candidate.label); invalidate(); return;
    }
    const alternatives = conversation && lookup.status === 'PROPOSALS' ? lookup : null;
    retireSearch(); setPosition(candidate.position); setOrigin(candidate.origin); setSelectedLabel(candidate.label); setCorrectionOpen(false);
    if (conversation) setAddress(candidate.label);
    if (alternatives) setLookup(alternatives);
    invalidate();
  };
  const useCandidateAddress = () => {
    if (!owns() || !selectedLabel || !position) return;
    const label = selectedLabel;
    retireSearch(); setAddress(label); invalidate();
  };
  const cancelSearch = () => { if (owns()) { retireSearch(lookupMode === 'search'); if (lookupMode === 'search') invalidate(); } };
  const confirm = () => {
    if (!owns() || !position || lookup.status === 'LOADING') return false;
    const privateAddress = address.trim() ? locationPrivateText(address, 1000) : null;
    const accessNotes = notes.trim() ? locationPrivateText(notes, 2000) : null;
    if (privateAddress === undefined || accessNotes === undefined) { setError(true); return false; }
    const latitudeE6 = Math.round(position.latitude * 1e6), longitudeE6 = Math.round(position.longitude * 1e6);
    if (!Number.isSafeInteger(latitudeE6) || !Number.isSafeInteger(longitudeE6)
      || Math.abs(latitudeE6) > 90e6 || Math.abs(longitudeE6) > 180e6) { setError(true); return false; }
    retireSearch();
    onConfirm({ slot, latitudeE6, longitudeE6, origin,
      ...(privateAddress !== null ? { address: privateAddress } : {}), ...(accessNotes !== null ? { accessNotes } : {}) });
    setPending(false); setError(false); return true;
  };
  const correct = () => {
    if (!owns() || !position || lookup.status === 'LOADING') return false;
    // Retire a second activation synchronously, without cancelling the pin or lookup results.
    renderEpoch.current++; setCorrectionOpen(true); return true;
  };
  const replyChanged = useRef(onReplyActionsReady); replyChanged.current = onReplyActionsReady;
  // Refresh closures after each committed view, but clean up only on unmount. Consumers compare capability booleans,
  // so publishing a fresh guarded callback never creates a render-registration loop.
  useEffect(() => {
    replyChanged.current?.(conversation && focused && !disabled && position && lookup.status !== 'LOADING'
      ? { confirm, ...(!correctionOpen ? { correct } : {}) } : null);
  });
  useEffect(() => () => replyChanged.current?.(null), []);
  if (conversation) {
    const loading = lookup.status === 'LOADING';
    // A moved pin keeps the conversation description separate from its new address.
    const manualProposal = !!position && pending && origin.kind === 'MANUAL_PIN';
    const label = !position ? 'Lokacija nije određena' : pending
      ? address.trim() || 'Tačka izabrana na mapi' : selectedLabel || point?.address || 'Tačka potvrđena na mapi';
    const confirmed = !!point && !pending;
    const alternatives = lookup.status === 'PROPOSALS' ? lookup.candidates : [];
    const lastCandidatePage = Math.max(0, Math.ceil(alternatives.length / 3) - 1);
    const visibleCandidates = alternatives.slice(candidatePage * 3, candidatePage * 3 + 3);
    const lookupMessage = lookup.status === 'PROPOSALS' ? 'Mesto nije pronađeno. Obeleži ga na mapi ili ispravi opis u razgovoru.'
      : lookup.status === 'RATE_LIMITED' ? 'Previše pretraga za kratko vreme. Obeleži mesto na mapi ili probaj kasnije.'
        : lookup.status === 'INVALID_QUERY' ? 'Mesto iz razgovora nije dovoljno jasno. Obeleži ga na mapi ili ispravi opis.'
          : lookup.status === 'PROVIDER_ACTIVATION_BLOCKED' ? 'Pretraga mesta nije dostupna. Obeleži mesto na mapi.'
            : 'Pretraga mesta nije uspela. Obeleži ga na mapi ili ispravi opis u razgovoru.';
    return <View style={{ gap: sys.space.md }}>
      <View style={{ gap: sys.space.xs }}>
        <T variant="meta" tone="muted">{title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm }}>
          <FactArt kind="pin" size={24} cut="art" role="location" />
          <T variant="bodyStrong" style={{ flex: 1, minWidth: 0, fontSize: 18, lineHeight: 24, color: sys.color.ink }}>{label || 'Mesto još nije izabrano'}</T>
        </View>
        <T variant="note" tone="muted" accessibilityLiveRegion="polite">{position
          ? confirmed ? 'Potvrđena tačka. Možeš da je izmeniš.'
            : alternatives.length > 1 ? 'Ima više predloga. Proveri pin pre potvrde.' : 'Proveri pin, pa potvrdi mesto.'
          : loading ? 'Tražimo mesto iz razgovora…' : 'Obeleži tačno mesto na mapi.'}</T>
        {(manualProposal || !position) && initialQuery ? <T variant="note" tone="muted">Opis iz razgovora: {initialQuery}</T> : null}
      </View>
      {!position && !loading && lookup.status !== 'IDLE' ? <T variant="meta" tone="muted">
        {lookupMessage}
      </T> : null}
      {!loading || position ? <ResolvedPinMap position={position} onChoose={choose} scopeKey={scopeKey}
        disabled={disabled || !focused} height={220} /> : null}
      {position && (manualProposal || correctionOpen) ? <>
        {loading && lookupMode === 'reverse' ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Tražimo adresu za izabrani pin…</T> : null}
        {!loading && lookupMode === 'reverse' && lookup.status !== 'IDLE'
          && (lookup.status !== 'PROPOSALS' || lookup.candidates.length === 0) ? <>
          <T variant="note" tone="muted" accessibilityLiveRegion="polite">Adresa nije određena. Tačka je ostala tamo gde je izabrana. Upiši adresu ili pokušaj ponovo.</T>
          <Button tone="neutral" label="Ponovo pronađi adresu" kind="quiet" disabled={disabled || !focused} onPress={reverse} />
        </> : null}
        <LocationField label={`${title} — adresa za ovaj pin (opciono)`} value={address} maxLength={1000}
          editable={!disabled && focused} onChangeText={value => {
            if (owns()) { retireSearch(); setAddress(value); invalidate(); }
          }} />
      </> : null}
      <T variant="meta" tone="muted">Svi vide približno područje. Tačno mesto vidi samo osoba s kojom se dogovoriš.</T>
      {position ? <>
        <Button tone="neutral" label="Potvrdi mesto" accessibilityLabel={`Potvrdi tačku: ${title}`} kind="secondary"
          style={confirmAsPrimary ? brandAction : undefined} disabled={disabled || !focused || loading} onPress={confirm} />
        <Button tone="neutral" label={correctionOpen ? 'Završi izmenu' : 'Nije tu'} kind="quiet"
          disabled={disabled || !focused} onPress={() => { if (correctionOpen) { if (owns()) setCorrectionOpen(false); } else correct(); }} />
      </> : null}
      {correctionOpen ? <>
        <T variant="note" tone="muted">Prevuci pin ili dodirni tačno mesto na mapi, pa potvrdi izmenu.</T>
        {alternatives.length > 1 ? visibleCandidates.map((candidate, index) => <Button tone="neutral"
          key={`${candidate.origin.candidateHint ?? 'candidate'}:${candidatePage * 3 + index}`} label={candidate.label}
          accessibilityLabel={`Izaberi predlog: ${candidate.label}`} kind="secondary"
          disabled={disabled || !focused} onPress={() => selectCandidate(candidate)} />) : null}
        {alternatives.length > 3 ? <View style={{ gap: sys.space.xs }}>
          <T variant="meta" tone="muted" accessibilityLiveRegion="polite">Predlozi {candidatePage * 3 + 1}–{Math.min(alternatives.length, candidatePage * 3 + 3)} od {alternatives.length}</T>
          {candidatePage > 0 ? <Button tone="neutral" label="Prethodni predlozi" kind="quiet" disabled={disabled || !focused}
            onPress={() => { if (owns()) setCandidatePage(page => Math.max(0, page - 1)); }} /> : null}
          {candidatePage < lastCandidatePage ? <Button tone="neutral" label="Još predloga" kind="quiet" disabled={disabled || !focused}
            onPress={() => { if (owns()) setCandidatePage(page => Math.min(lastCandidatePage, page + 1)); }} /> : null}
        </View> : null}
      </> : null}
      {(correctionOpen || !position) && onCorrectInConversation ? <Button tone="neutral" label="Ispravi u razgovoru" kind="quiet"
        disabled={disabled || !focused} onPress={() => { if (owns()) onCorrectInConversation(); }} /> : null}
      {lookup.status === 'PROPOSALS' ? <Press accessibilityRole="link" accessibilityLabel="Pretraga: LocationIQ · izvori podataka"
        onPress={() => { void Linking.openURL('https://locationiq.com/attribution').catch(() => {}); }}
        style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <T variant="meta" tone="muted">Pretraga: LocationIQ · izvori podataka</T>
      </Press> : null}
      {error ? <T accessibilityRole="alert" tone="danger">Proveri izabranu tačku i privatne podatke.</T> : null}
    </View>;
  }
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
    {selectedLabel && selectedLabel !== address.trim() ? <Button label="Koristi predlog kao privatnu adresu" kind="quiet"
      disabled={disabled || !focused} onPress={useCandidateAddress} /> : null}
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
      summary={[address, notes].filter(value => value.trim()).join(' · ') || 'Dodaj adresu ili napomenu po potrebi'}>
    <LocationField label={`${title} — privatna adresa (opciono)`} value={address} maxLength={1000} editable={!disabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(); setAddress(value); invalidate(); } }} />
    <LocationField label={`${title} — privatne napomene za pristup (opciono)`} value={notes} maxLength={2000} multiline editable={!disabled && focused}
      onChangeText={value => { if (owns()) { retireSearch(); setNotes(value); invalidate(); } }} />
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
