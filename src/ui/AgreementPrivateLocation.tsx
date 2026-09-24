import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../contracts/projections';
import type { ExactLocationReveal, LocationGrant, LocationGrantState } from '../contracts/contact';
import type { Ishod } from '../data/ports';
import { useOwnedEditor } from '../hooks/useOwnedEditor';
import { useSesija } from '../store/sesija';
import { useIzvor } from '../store/uloga';
import { sys } from './system/tokens';
import { FactArt } from './system/FactArt';
import { vreme } from '../lib/vreme';
import { V2Action } from './v2/V2Action';
import { T } from './Text';
import { ResolvedPinMap } from './location/ResolvedPinMap';

type Props = { agreement: DogovorProjekcija; enabled: boolean };
type Snapshot = { state: LocationGrantState; revealed: ExactLocationReveal | null };
const activeGrant = (grant: LocationGrant | undefined) => !!grant && grant.status === 'GRANTED'
  && (grant.expiresAt === null || Date.parse(grant.expiresAt) > Date.now());
const invalid = (): Ishod<never> => ({ ok: false, kod: 'LOCATION_SCOPE_CHANGED', poruka: 'Dozvola za lokaciju je promenjena. Osveži prikaz.' });

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
  const requester = accountId === requesterId;
  // How long the access lasts, when the read says so: a grant with an end names it; one without lasts until it is
  // revoked or the Dogovor ends (this section closes then).
  const lasts = granted ? grant?.expiresAt ? `Važi do ${vreme(grant.expiresAt)}.` : 'Važi dok je ne opozoveš ili dok se Dogovor ne završi.' : null;
  // The section above carries the title ("Lokacija i pristup"); this part starts with the state of the access.
  return <View style={s.stack}>
    <View style={s.status}>
      <FactArt kind={granted ? 'eye' : 'lock'} size={24} muted={!granted} />
      <View style={s.statusCopy}>
        <T variant="bodyStrong">{requester
          ? granted ? 'Lokacija je podeljena u ovom Dogovoru.' : 'Podeli potvrđenu adresu ili tačke na mapi sa osobom koja dolazi.'
          : granted ? 'Prikaz lokacije je dozvoljen u ovom Dogovoru.' : 'Lokacija još nije podeljena sa tobom ili dozvola više ne važi.'}</T>
        {lasts ? <T variant="meta" tone="muted">{lasts}</T> : null}
      </View>
    </View>
    {editor.loading ? <T variant="meta" tone="muted">Proveravamo dozvolu…</T> : null}
    {editor.error ? <T variant="meta" tone="danger" accessibilityRole="alert">{editor.error}</T> : null}
    {requester ? <V2Action label={granted ? 'Opozovi deljenje lokacije' : 'Podeli lokaciju'}
      kind={granted ? 'destructive' : 'secondary'} disabled={locked} loading={editor.busy} onPress={() => { void setGrant(!granted); }} />
      : granted && !privateData ? <V2Action label="Prikaži privatnu lokaciju" kind="secondary" disabled={locked} loading={editor.busy} onPress={() => { void show(); }} /> : null}
    {privateData ? <PrivatePoints key={`${privateData.grantId}:${privateData.grantedAt}:${privateData.needRevision}`} value={privateData}
      scope={`${accountId}:${agreementId}:${privateData.grantId}:${privateData.grantedAt}:${privateData.needRevision}`} /> : null}
    <View style={s.refresh}>
      <V2Action label="Osveži dozvolu za lokaciju" kind="quiet" disabled={editor.busy} style={quietStart} onPress={() => { void editor.refresh(); }} />
      <T variant="meta" tone="muted">Dozvolu proveravamo pri otvaranju i osvežavanju ovog prikaza.</T>
    </View>
  </View>;
}

/** A quiet action keeps to its own width beside the private details, as it always has. */
const quietStart = { alignSelf: 'flex-start' } as const;
const slotLabel = (slot: string) => slot === 'start' ? 'Početno mesto' : slot === 'end' ? 'Završno mesto'
  : slot === 'serviceArea' ? 'Područje rada' : `Usputno mesto ${Number(slot.split('/')[1]) + 1}`;
function PrivatePoints({ value, scope }: { value: ExactLocationReveal; scope: string }) {
  const points = value.resolvedLocation?.value.points ?? [];
  const [selected, setSelected] = useState(points[0]?.slot);
  const point = points.find(item => item.slot === selected);
  const position = point ? { latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 } : value.exactPosition;
  return <View style={s.stack}>
    {value.adresa ? <T>{value.adresa}</T> : null}
    {value.accessNotes ? <T variant="meta">{value.accessNotes}</T> : null}
    {/* Each point is a bare row parted by a hairline; the section around it is the only box. */}
    {points.map(item => <View key={item.slot} style={s.point}>
      <T variant="bodyStrong">{slotLabel(item.slot)}</T>
      {item.address ? <T>{item.address}</T> : null}
      {item.accessNotes ? <T variant="meta">{item.accessNotes}</T> : null}
      <T variant="meta" tone="muted" selectable>{(item.latitudeE6 / 1e6).toFixed(6)}, {(item.longitudeE6 / 1e6).toFixed(6)}</T>
      {points.length > 1 ? <V2Action label={`Prikaži na mapi: ${slotLabel(item.slot)}`} kind="quiet" style={quietStart}
        disabled={selected === item.slot} onPress={() => setSelected(item.slot)} /> : null}
    </View>)}
    {position ? <ResolvedPinMap position={position} onChoose={() => {}} disabled scopeKey={`${scope}:${selected ?? 'legacy'}`} /> : null}
  </View>;
}

const s = StyleSheet.create({
  stack: { paddingVertical: sys.space.md, gap: sys.space.md },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  statusCopy: { flex: 1, gap: 2 },
  point: { gap: sys.space.xs, paddingTop: sys.space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.cardLine },
  refresh: { gap: sys.space.xs },
});
