import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import type { DogovorProjekcija } from '../contracts/projections';
import type { ExactLocationReveal, LocationGrant, LocationGrantState } from '../contracts/contact';
import type { Ishod } from '../data/ports';
import { useOwnedEditor } from '../hooks/useOwnedEditor';
import { useSesija } from '../store/sesija';
import { useIzvor } from '../store/uloga';
import { space } from '../theme/tokens';
import { Button } from './Button';
import { T } from './Text';
import { ResolvedPinMap } from './location/ResolvedPinMap';

type Props = { agreement: DogovorProjekcija; enabled: boolean };
type Snapshot = { state: LocationGrantState; revealed: ExactLocationReveal | null };
const activeGrant = (grant: LocationGrant | undefined) => !!grant && grant.status === 'GRANTED'
  && (grant.expiresAt === null || Date.parse(grant.expiresAt) > Date.now());
const invalid = (): Ishod<never> => ({ ok: false, kod: 'LOCATION_SCOPE_CHANGED', poruka: 'Dozvola za lokaciju je promenjena. Osvežite prikaz.' });

/** Unmount the private session on background, account, revision, participant or terminal state changes. */
export function AgreementPrivateLocation({ agreement, enabled }: Props) {
  const session = useSesija();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const foregroundNow = useRef(foreground);
  const appActive = useCallback(() => foregroundNow.current, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foregroundNow.current = state === 'active'; setForeground(foregroundNow.current);
    });
    return () => subscription.remove();
  }, []);
  const me = agreement.ucesnici.find(party => party.viSte && party.id === session.user?.id);
  const requester = agreement.ucesnici.find(party => party.uloga === 'narucilac');
  const worker = agreement.ucesnici.find(party => party.uloga === 'uskocer');
  const visible = enabled && foreground && me && requester && worker && requester.id !== worker.id
    && agreement.rezim !== 'DALJINSKI' && agreement.kontakt.lokacijaPostoji
    && (agreement.stanje === 'CONFIRMED' || agreement.stanje === 'AWAITING_REQUESTER');
  if (!visible) return null;
  return <LocationSession key={`${session.user!.id}:${session.accountRevision}:${agreement.id}:${agreement.verzija}:${agreement.stanje}:${requester.id}:${worker.id}`}
    agreementId={agreement.id} accountId={session.user!.id} requesterId={requester.id} workerId={worker.id} appActive={appActive} />;
}

function LocationSession({ agreementId, accountId, requesterId, workerId, appActive }: {
  agreementId: string; accountId: string; requesterId: string; workerId: string; appActive: () => boolean;
}) {
  const source = useIzvor();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    if (!appActive()) return invalid();
    const result = await source.lokacijskaDozvola(agreementId);
    if (!result.ok) return result;
    const state = result.podatak;
    if (!appActive() || state.agreementId !== agreementId || state.accountId !== accountId || state.grants.length > 1
      || state.grants.some(grant => grant.ownerAccountId !== requesterId || grant.recipientAccountId !== workerId)) return invalid();
    return { ok: true, podatak: { state, revealed: null } };
  }, [source, agreementId, accountId, requesterId, workerId, appActive]);
  const editor = useOwnedEditor(read);
  const grant = editor.data?.state.grants[0];
  const granted = activeGrant(grant);
  const privateData = !editor.loading && !editor.busy && !editor.uncertain && !editor.error && granted ? editor.data?.revealed : null;
  const expiry = grant?.expiresAt;
  useEffect(() => {
    if (!expiry || !granted) return;
    const expire = () => { if (Date.parse(expiry) <= Date.now()) void editor.refresh(); };
    // Long leases are rechecked at the largest safe native timer interval.
    const timer = setTimeout(() => { expire(); if (Date.parse(expiry) > Date.now()) void editor.refresh(); },
      Math.min(2_147_483_647, Math.max(0, Date.parse(expiry) - Date.now())));
    return () => clearTimeout(timer);
  }, [expiry, granted, editor.refresh]);

  const setGrant = (allow: boolean) => editor.save(async () => {
    if (!appActive()) return invalid();
    const result = await (allow ? source.podeliTacnuLokaciju(agreementId) : source.opoziviTacnuLokaciju(agreementId));
    if (!result.ok) return result;
    if (!mounted.current || !appActive()) return invalid();
    // A write receipt is followed by existing server state before another write is enabled.
    return read();
  });
  const show = () => editor.save(async () => {
    if (!appActive()) return invalid();
    const result = await source.otkrijTacnuLokaciju(agreementId);
    if (!result.ok) return result;
    if (!mounted.current || !appActive()) return invalid();
    const current = await read();
    if (!current.ok) return current;
    const value = result.podatak, latest = current.podatak.state.grants[0];
    if (!activeGrant(latest) || !latest || value.authoritative !== true || value.agreementId !== agreementId
      || value.ownerAccountId !== requesterId || latest.recipientAccountId !== accountId
      || value.grantId !== latest.id || Date.parse(value.grantedAt) !== Date.parse(latest.grantedAt)
      || (value.expiresAt === null ? latest.expiresAt !== null
        : latest.expiresAt === null || Date.parse(value.expiresAt) !== Date.parse(latest.expiresAt))) return invalid();
    return { ok: true, podatak: { ...current.podatak, revealed: value } };
  });
  const locked = editor.loading || editor.busy || editor.uncertain || !editor.data;
  return <View style={{ paddingVertical: space.md, gap: space.md }}>
    <T variant="bodyStrong">Privatna lokacija</T>
    <T variant="meta" tone="muted">{accountId === requesterId
      ? granted ? 'Lokacija je podeljena sa Uskočerom u ovom Dogovoru.' : 'Podelite potvrđenu adresu ili tačke na mapi sa Uskočerom.'
      : granted ? 'Naručilac je dozvolio prikaz lokacije u ovom Dogovoru.' : 'Naručilac još nije podelio lokaciju ili dozvola više ne važi.'}</T>
    {editor.loading ? <T variant="meta" tone="muted">Proveravamo dozvolu…</T> : null}
    {editor.error ? <T variant="meta" tone="danger" accessibilityRole="alert">{editor.error}</T> : null}
    {accountId === requesterId ? <Button label={granted ? 'Opozovite deljenje lokacije' : 'Podelite lokaciju'}
      kind={granted ? 'danger' : 'secondary'} disabled={locked} onPress={() => { void setGrant(!granted); }} />
      : granted && !privateData ? <Button label="Prikažite privatnu lokaciju" kind="secondary" disabled={locked} onPress={() => { void show(); }} /> : null}
    {privateData ? <PrivatePoints key={`${privateData.grantId}:${privateData.grantedAt}:${privateData.needRevision}`} value={privateData}
      scope={`${accountId}:${agreementId}:${privateData.grantId}:${privateData.grantedAt}:${privateData.needRevision}`} /> : null}
    <Button label="Osvežite dozvolu za lokaciju" kind="quiet" disabled={editor.busy} onPress={() => { void editor.refresh(); }} />
    <T variant="meta" tone="muted">Dozvolu proveravamo pri otvaranju i osvežavanju ovog prikaza.</T>
  </View>;
}

const slotLabel = (slot: string) => slot === 'start' ? 'Početno mesto' : slot === 'end' ? 'Završno mesto'
  : slot === 'serviceArea' ? 'Područje rada' : `Usputno mesto ${Number(slot.split('/')[1]) + 1}`;
function PrivatePoints({ value, scope }: { value: ExactLocationReveal; scope: string }) {
  const points = value.resolvedLocation?.value.points ?? [];
  const [selected, setSelected] = useState(points[0]?.slot);
  const point = points.find(item => item.slot === selected);
  const position = point ? { latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 } : value.exactPosition;
  return <View style={{ gap: space.md }}>
    {value.adresa ? <T>{value.adresa}</T> : null}
    {value.accessNotes ? <T variant="meta">{value.accessNotes}</T> : null}
    {points.map(item => <View key={item.slot} style={{ gap: space.xs }}>
      <T variant="bodyStrong">{slotLabel(item.slot)}</T>
      {item.address ? <T>{item.address}</T> : null}
      {item.accessNotes ? <T variant="meta">{item.accessNotes}</T> : null}
      <T variant="meta" selectable>{(item.latitudeE6 / 1e6).toFixed(6)}, {(item.longitudeE6 / 1e6).toFixed(6)}</T>
      {points.length > 1 ? <Button label={`Prikažite na mapi: ${slotLabel(item.slot)}`} kind="quiet"
        disabled={selected === item.slot} onPress={() => setSelected(item.slot)} /> : null}
    </View>)}
    {position ? <ResolvedPinMap position={position} onChoose={() => {}} disabled scopeKey={`${scope}:${selected ?? 'legacy'}`} /> : null}
  </View>;
}
