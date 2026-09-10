import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, DownloadSimple, ShieldCheck } from 'phosphor-react-native';
import type { DataExportFile, DataExportPreparation, DataExportStatus } from '../../../contracts/dataExport';
import { dataExportClientService as exports } from '../../../data/dataExportClientService';
import type { Ishod } from '../../../data/ports';
import { failure, sameId } from '../../../data/serverReceipt';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { saveDataExportFile } from '../../../lib/dataExportFile';
import { noviZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { ulogaSada, useUloga } from '../../../store/uloga';
import { palette, radius, space, touch } from '../../../theme/tokens';
import { Button, Card } from '../../../ui/Button';
import { Press } from '../../../ui/Press';
import { T } from '../../../ui/Text';

const preparationCopy: Record<NonNullable<DataExportPreparation['code']>, string> = {
  POLICY_NOT_READY: 'Priprema kopije trenutno nije dostupna. Vaš zahtev ostaje zabeležen.',
  BUSY: 'Kopija se priprema. Proverite stanje ponovo kasnije.',
  RETRY_REQUIRED: 'Priprema nije završena. Proverite stanje pa pokušajte ponovo.',
  NOT_AVAILABLE: 'Ova kopija trenutno nije dostupna. Proverite stanje zahteva.',
};
type Snapshot = { status: DataExportStatus; preparation: DataExportPreparation | null };
const changed = () => failure('EXPORT_SCOPE_CHANGED', 'Ponovo otvorite izvoz podataka.');

export default function IzvozPodataka() {
  const { user, accountRevision } = useSesija(); const intent = useUloga();
  return <OwnedExport key={`${user?.id ?? ''}:${accountRevision}:${intent}`} />;
}
function OwnedExport() {
  const { user, accountRevision } = useSesija(); const accountId = user?.id, intent = useUloga();
  const identity = useMemo(() => ({}), [accountId, accountRevision, intent]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const focus = useRef<object | null>(null), navigating = useRef(false), dialog = useRef<object | null>(null);
  const download = useRef<AbortController | null>(null), pendingKey = useRef<string | null>(null);
  const [savingFile, setSavingFile] = useState(false), [notice, setNotice] = useState<string | null>(null);
  const [fileReadbackRequired, setFileReadbackRequired] = useState(false);
  const fileReadback = useRef(false);
  const requireFileReadback = (value: boolean) => { fileReadback.current = value; setFileReadbackRequired(value); };
  const [, tick] = useState(0);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false; setSavingFile(false); setNotice(null);
    return () => { if (focus.current === scope) focus.current = null; dialog.current = null;
      download.current?.abort(); download.current = null; };
  }, [identity]));
  const owned = () => focus.current !== null && latestIdentity.current === identity && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const scope = focus.current;
    const result = await exports.readStatus();
    if (!scope || focus.current !== scope || latestIdentity.current !== identity || sesijaSada().user?.id !== accountId
      || sesijaSada().accountRevision !== accountRevision || ulogaSada() !== intent) return changed();
    if (!result.ok) return result;
    requireFileReadback(false);
    if (pendingKey.current && result.podatak.request?.clientRequestId === pendingKey.current) pendingKey.current = null;
    return { ok: true, podatak: { status: result.podatak, preparation: null } };
  }, [identity, accountId, accountRevision, intent]);
  const editor = useOwnedEditor(read), status = editor.data?.status, request = status?.request;
  const latestData = useRef(editor.data); latestData.current = editor.data;
  const renderedFocus = focus.current;
  const current = () => owned() && focus.current === renderedFocus && latestData.current === editor.data && !navigating.current;
  const canAct = () => current() && !!editor.data && !editor.busy && !editor.loading && !editor.uncertain && !fileReadback.current && !download.current;
  const busy = editor.busy || editor.uncertain || savingFile;
  const artifact = status?.fulfillment;
  const expires = artifact ? Date.parse(artifact.artifactExpiresAt) : NaN;
  const available = status?.downloadAvailable === true && request?.status === 'READY'
    && artifact?.artifactAvailable === true && Number.isFinite(expires) && expires > Date.now();
  useEffect(() => {
    if (!Number.isFinite(expires) || expires <= Date.now()) return;
    const timer = setTimeout(() => tick(value => value + 1), Math.min(expires - Date.now() + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expires]);
  const back = () => { if (!owned() || navigating.current) return; navigating.current = true; dialog.current = null;
    download.current?.abort(); router.back(); };
  const refresh = () => { if (!current() || editor.busy || download.current) return;
    dialog.current = null; setNotice(null); void editor.refresh(); };
  const ask = (title: string, copy: string, label: string, command: () => Promise<void>) => {
    if (!canAct() || dialog.current) return; const token = {}; dialog.current = token;
    const cancel = () => { if (dialog.current === token) dialog.current = null; };
    Alert.alert(title, copy, [{ text: 'Odustanite', style: 'cancel', onPress: cancel }, { text: label, onPress: () => {
      if (dialog.current !== token || !canAct()) return; dialog.current = null; void command();
    } }], { cancelable: true, onDismiss: cancel });
  };
  const requestExport = async () => {
    if (!canAct() || (request && ['REQUESTED', 'PROCESSING'].includes(request.status))) return;
    const key = pendingKey.current ?? noviZahtevId('izvoz'); pendingKey.current = key;
    await editor.save(async () => {
      const result = await exports.requestExport(key);
      if (!current()) return changed(); if (!result.ok) return result;
      if (result.podatak.clientRequestId !== key) return failure('EXPORT_INVALID_RECEIPT', 'Zahtev nije potvrđen. Učitajte stanje ponovo.');
      pendingKey.current = null; setNotice('Zahtev za izvoz je zabeležen.'); return read();
    });
  };
  const prepare = async () => {
    if (!canAct() || !request || !['REQUESTED', 'PROCESSING'].includes(request.status)) return;
    await editor.save(async () => {
      const result = await exports.prepareExport(request.receiptId);
      if (!current()) return changed(); if (!result.ok) return result;
      if (!sameId(result.podatak.receiptId, request.receiptId)) return failure('EXPORT_INVALID_RECEIPT', 'Priprema nije potvrđena. Učitajte stanje ponovo.');
      if (result.podatak.kind === 'NOT_READY') return { ok: true, podatak: { ...editor.data!, preparation: result.podatak } };
      setNotice(result.podatak.kind === 'PROCESSING' ? 'Priprema kopije je pokrenuta.' : 'Priprema je potvrđena. Proveravamo dostupnost kopije.');
      return read();
    });
  };
  const cancelRequest = () => {
    if (!request || request.status !== 'REQUESTED') return;
    ask('Otkažite zahtev?', 'Zahtev koji još nije preuzet u obradu biće otkazan.', 'Otkažite zahtev', async () => {
      await editor.save(async () => { const result = await exports.cancelExport(request.receiptId);
        if (!current()) return changed(); if (!result.ok) return result;
        if (!sameId(result.podatak.receiptId, request.receiptId) || result.podatak.status !== 'CANCELLED') return changed();
        setNotice('Zahtev je otkazan.'); return read(); });
    });
  };
  const revoke = () => {
    if (!request || request.status !== 'READY' || !artifact) return;
    ask('Opozovite kopiju?', 'Kopija više neće biti dostupna za preuzimanje. Već sačuvani fajlovi na Vašem uređaju ostaju kod Vas.', 'Opozovite kopiju', async () => {
      await editor.save(async () => { const result = await exports.revokeExport(request.receiptId);
        if (!current()) return changed(); if (!result.ok) return result;
        if (!sameId(result.podatak.receiptId, request.receiptId) || result.podatak.revoked !== true) return changed();
        setNotice('Preuzimanje kopije je opozvano.'); return read(); });
    });
  };
  const saveFile = async () => {
    if (!canAct() || !available || !request || !artifact || Date.now() >= expires) return;
    const controller = new AbortController(); download.current = controller; setSavingFile(true); setNotice(null);
    let bytes: DataExportFile | null = null;
    const ownedDownload = () => current() && download.current === controller && !controller.signal.aborted && Date.now() < expires;
    try {
      const result = await exports.downloadExport({ receiptId: request.receiptId, artifactGeneration: artifact.artifactGeneration }, controller.signal);
      if (!ownedDownload()) { if (result.ok) result.podatak.bytes.fill(0); return; }
      if (!result.ok) { requireFileReadback(true); setNotice(result.poruka); return; }
      bytes = result.podatak;
      if (!sameId(bytes.receiptId, request.receiptId) || !sameId(bytes.artifactGeneration, artifact.artifactGeneration)
        || bytes.byteLength !== artifact.byteLength || bytes.sha256 !== artifact.sha256 || bytes.md5 !== artifact.md5) {
        requireFileReadback(true); setNotice('Preuzeta kopija nije potvrđena. Učitajte stanje ponovo.'); return;
      }
      const saved = await saveDataExportFile({ artifact: bytes, isCurrent: ownedDownload, signal: controller.signal });
      if (!ownedDownload()) return;
      const copy = saved.status === 'SAVED' ? 'Kopija je sačuvana u izabranoj fascikli.'
        : saved.status === 'DOWNLOAD_STARTED' ? 'Preuzimanje je pokrenuto u pregledaču. Proverite gde je fajl sačuvan.'
          : saved.status === 'CANCELLED' ? 'Čuvanje je otkazano. Kopija nije sačuvana.'
            : saved.status === 'UNSUPPORTED' ? 'Čuvanje fajla nije podržano na ovom uređaju.'
              : saved.status === 'BUSY' ? 'Završite prethodni izbor fascikle pre novog pokušaja.'
                : saved.status === 'FAILED' && saved.code === 'EXISTS' ? 'Ova kopija već postoji u izabranoj fascikli. Izaberite drugu fasciklu.'
                  : saved.status === 'FAILED' && saved.code === 'CLEANUP_FAILED' ? 'Čuvanje nije potvrđeno. U izabranoj fascikli može biti nepotpun fajl.'
                    : 'Čuvanje nije potvrđeno. Proverite stanje i pokušajte ponovo.';
      setNotice(copy);
    } catch { if (ownedDownload()) { requireFileReadback(true); setNotice('Preuzimanje nije potvrđeno. Proverite vezu i pokušajte ponovo.'); } }
    finally { bytes?.bytes.fill(0); if (download.current === controller) { download.current = null; if (current()) setSavingFile(false); } }
  };
  const step = (label: string, copy: string, active: boolean) => <View key={label} style={{ padding: space.md, gap: space.xs,
    borderRadius: radius.md, backgroundColor: active ? palette.successBg : 'transparent' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? palette.success : palette.inkMuted }} />
      <T variant="bodyStrong">{label}</T>
    </View><T variant="meta" tone="muted" style={{ paddingLeft: space.base }}>{copy}</T>
  </View>;
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: palette.surface }}>
    <View style={{ minHeight: 58, paddingHorizontal: space.base, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={back}
        style={{ width: touch.min, height: touch.min, justifyContent: 'center', alignItems: 'center' }}><ArrowLeft size={22} color={palette.ink} /></Press>
      <T variant="title">Izvoz podataka</T>
    </View>
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, flexGrow: 1 }}>
      <View style={{ gap: space.md }}><T variant="label" tone="muted">VAŠA KOPIJA</T>
        <T variant="display">Vaši podaci, na jednom mestu.</T>
        <T tone="muted">Zatražite kopiju podataka vezanih za svoj nalog.</T></View>
      {editor.loading ? <ActivityIndicator accessibilityLabel="Učitavanje stanja izvoza" color={palette.teal500} />
        : editor.error || !status || fileReadbackRequired ? <Card><View style={{ padding: space.base, gap: space.md }}>
          <T accessibilityRole="alert">{editor.error ?? (fileReadbackRequired ? 'Učitajte trenutno stanje pre novog pokušaja.' : 'Stanje izvoza nije dostupno.')}</T>
          <Button label="Učitajte stanje ponovo" onPress={refresh} disabled={editor.busy} />
        </View></Card> : <>
          <View style={{ backgroundColor: palette.successBg, borderRadius: radius.xl, padding: space.base, gap: space.sm }}>
            {step('Zahtev', request?.status === 'CANCELLED' ? 'Zahtev je otkazan.' : request ? 'Zahtev je zabeležen na Vašem nalogu.' : 'Kopija podataka Vašeg naloga.', !!request)}
            {step('Priprema kopije', request?.status === 'PROCESSING' ? 'Kopija se priprema.' : request?.status === 'FAILED'
              ? 'Priprema nije završena.' : request?.status === 'READY' ? 'Obrada je završena.' : 'Priprema počinje nakon Vašeg zahteva.', request?.status === 'PROCESSING' || available)}
            {step('Preuzimanje', available ? 'Kopija je dostupna. Izaberite fasciklu za čuvanje.' : request?.status === 'EXPIRED' || (artifact && expires <= Date.now())
              ? 'Dostupnost kopije je istekla.' : 'Dostupno kada stvarna kopija bude spremna.', available)}
          </View>
          {editor.data?.preparation?.kind === 'NOT_READY' ? <T accessibilityRole="alert" tone="muted">{
            preparationCopy[editor.data.preparation.code ?? 'NOT_AVAILABLE']}</T> : null}
          {available && artifact ? <View style={{ gap: space.xs }}><T variant="meta">Dostupno do {new Date(expires).toLocaleString('sr-Latn')}.</T>
            <T variant="meta" tone="muted">JSON · {artifact.byteLength.toLocaleString('sr-Latn')} bajtova</T></View> : null}
          <View style={{ flexDirection: 'row', gap: space.sm, padding: space.base, borderRadius: radius.lg, backgroundColor: palette.successBg }}>
            <ShieldCheck size={20} color={palette.teal500} /><T variant="meta" tone="muted" style={{ flex: 1 }}>Izvoz je vezan za Vaš nalog. Kopiju čuvajte na mestu kome samo Vi imate pristup.</T>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ gap: space.sm }}>
            {available ? <Button label={savingFile ? 'Preuzimanje i čuvanje…' : 'Preuzmite i sačuvajte'} full disabled={busy}
              icon={<DownloadSimple size={20} color={palette.onOrange} />} onPress={() => { void saveFile(); }} />
              : request && ['REQUESTED', 'PROCESSING'].includes(request.status)
                ? <Button label={editor.busy ? 'Radnja je u toku…' : 'Pripremite kopiju'} full disabled={busy} onPress={() => { void prepare(); }} />
                : <Button label={pendingKey.current ? 'Ponovite isti zahtev' : request ? 'Zatražite novu kopiju' : 'Zatražite izvoz'} full disabled={busy} onPress={() => { void requestExport(); }} />}
            {request?.status === 'REQUESTED' ? <Button label="Otkažite zahtev" kind="quiet" disabled={busy} onPress={cancelRequest} /> : null}
            {request?.status === 'READY' && artifact ? <Button label="Opozovite kopiju" kind="quiet" disabled={busy} onPress={revoke} /> : null}
            <Button label="Osvežite stanje" kind="quiet" disabled={busy} onPress={refresh} />
          </View>
        </>}
      {notice ? <T accessibilityLiveRegion="polite">{notice}</T> : null}
    </ScrollView>
  </SafeAreaView>;
}
