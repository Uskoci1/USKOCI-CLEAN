import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaClientService, type MediaAsset, type TaskPhotos } from '../../data/mediaClientService';
import { pickPreparedPhoto, photoSelectionMessage, type PreparedPhoto, type PhotoSource } from '../../features/media/nativePhotoPicker';
import { sesijaSada, useSesija } from '../../store/sesija';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { uuid } from '../../data/serverReceipt';
import { PermissionRecovery } from '../../ui/system/PermissionRecovery';
import { plural } from '../../ui/system/plural';
import { StateView } from '../../ui/system/StateView';
import { useConfirmSheet } from '../../ui/system/ConfirmSheet';
import { useReducedMotion } from '../../ui/system/motion';
import { SettingsText as T, SettingsScreen, SettingsAction } from '../../ui/settings/SettingsPresentation';
import { PhotoGrid, PhotoStatus, PhotoTile, PhotosLoading, PhotosPrivacyNote, type PhotoTone } from '../../ui/objava/TaskPhotosPresentation';

type Pending = { id: string; photo?: PreparedPhoto };
/** Which action the one write in flight belongs to, so only that button spins. Presentation only: it gates nothing. */
type Working = 'LIBRARY' | 'CAMERA' | 'RETRY' | 'CANCEL' | 'REFRESH' | `REMOVE:${string}` | null;
const MAX_PHOTOS = 6;
const fotografija = (count: number) => plural(count, 'fotografija', 'fotografije', 'fotografija');
export default function TaskPhotosRoute() {
  const params = useLocalSearchParams<{ conversationId?: string }>(), { user, accountRevision } = useSesija();
  const id = typeof params.conversationId === 'string' && uuid(params.conversationId) ? params.conversationId : null;
  return <TaskPhotosEditor key={`${user?.id}:${accountRevision}:${id}`} conversationId={id} />;
}
function TaskPhotosEditor({ conversationId }: { conversationId: string | null }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const key = accountId && conversationId ? `uskoci:media-upload:${accountId}:TASK:${conversationId}` : null;
  const focused = useRef<object | null>(null), operation = useRef(false), pending = useRef<Pending | null>(null);
  const abort = useRef<AbortController | null>(null), navigateOnce = useRef(false);
  const [photos, setPhotos] = useState<TaskPhotos | null>(null), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null), [unconfirmed, setUnconfirmed] = useState(false);
  const [recovered, setRecovered] = useState(false), [canRetry, setCanRetry] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  // How the status line looks; every sentence is still the one it was, set in the same place.
  const [tone, setTone] = useState<PhotoTone>('info'), [working, setWorking] = useState<Working>(null);
  const confirm = useConfirmSheet({ reduced: useReducedMotion() });
  const say = (text: string | null, kind: PhotoTone = 'info') => { setMessage(text); setTone(kind); };
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const settle = async (asset: MediaAsset, current: () => boolean) => {
    if (!current() || asset.scope !== 'TASK' || asset.conversationId !== conversationId || asset.clientRequestId !== pending.current?.id) return;
    if (!asset.selected || asset.state === 'READY' || asset.state === 'FAILED') {
      if (key) await AsyncStorage.removeItem(key);
      if (!current()) return;
      pending.current = null; setUnconfirmed(false); setCanRetry(false);
      if (asset.selected && asset.state === 'READY') say('Fotografija je dodata privatnom nacrtu.', 'success');
      else say('Fotografija nije dodata. Možeš izabrati drugu.');
    } else { setUnconfirmed(true); say('Obrada fotografije još nije potvrđena. Proveri ishod.', 'error'); }
  };
  const read = async (current: () => boolean) => {
    if (!conversationId || !key || !current()) return;
    const stored = await AsyncStorage.getItem(key);
    if (!current()) return;
    if (stored && !uuid(stored)) {
      // Not a command identity: it can never be reconciled or replayed, so it must not strand the picker.
      await AsyncStorage.removeItem(key);
      if (!current()) return;
      say('Zapis nepotvrđenog slanja nije čitljiv, pa je uklonjen. Proveri fotografije.');
    } else if (stored && !pending.current) pending.current = { id: stored };
    if (pending.current) {
      setUnconfirmed(true);
      const receipt = await mediaClientService.readUploadCommand(pending.current.id);
      if (!current()) return;
      if (receipt.ok) await settle(receipt.podatak, current);
      else {
        // PKG-008: absence alone is never success and never erases the identity. The owner keeps
        // the same-key retry while the bytes exist and always has the authoritative cancel below.
        const missing = receipt.kod === 'MEDIA_NOT_FOUND', retained = !!pending.current?.photo;
        setCanRetry(retained);
        say(!missing ? 'Ishod slanja nije učitan. Proveri vezu i osveži prikaz.'
          : retained ? 'Slanje nije primljeno. Možeš da pošalješ istu fotografiju ponovo ili da odustaneš od slanja.'
            : 'Slanje nije primljeno, a fotografija više nije na uređaju. Odustani od slanja pa izaberi fotografiju ponovo.', 'error');
      }
    }
    if (!current()) return;
    const result = await mediaClientService.readTaskPhotos(conversationId);
    if (!current()) return;
    if (result.ok) { setPhotos(result.podatak); setRecovered(true); }
    else { say(result.poruka, 'error'); setRecovered(false); }
  };
  useFocusEffect(useCallback(() => {
    const token = {}; focused.current = token; navigateOnce.current = false;
    const current = () => focused.current === token && owns();
    operation.current = true; setBusy(true); setRecovered(false); setPhotos(null);
    void read(current).catch(() => { if (current()) say('Ishod nije učitan. Proveri vezu i osveži prikaz.', 'error'); })
      .finally(() => { if (current()) { operation.current = false; setBusy(false); } });
    return () => { if (focused.current === token) focused.current = null; abort.current?.abort();
      if (pending.current) pending.current = { id: pending.current.id }; setPhotos(null); };
  }, [conversationId, key, owns]));
  const token = focused.current;
  const current = () => !!token && focused.current === token && owns() && !navigateOnce.current;
  const begin = (what: Working = null) => { if (!current() || operation.current) return false; operation.current = true; setBusy(true); setWorking(what); return true; };
  const finish = () => { if (current()) { operation.current = false; setBusy(false); setWorking(null); } };
  const refresh = async () => { if (!begin('REFRESH')) return;
    try { await read(current); } catch { if (current()) say('Ishod nije učitan. Proveri vezu i pokušaj ponovo.', 'error'); } finally { finish(); } };
  const send = async (command: Pending) => {
    if (!conversationId || !key || !command.photo || !current()) return;
    await AsyncStorage.setItem(key, command.id);
    if (!current()) return;
    const controller = new AbortController(); abort.current = controller;
    say('Šaljem fotografiju…', 'progress');
    const result = await mediaClientService.uploadTaskPhoto({ conversationId, clientRequestId: command.id,
      bytes: command.photo.bytes, contentType: command.photo.contentType }, { signal: controller.signal });
    if (!current()) return;
    if (result.ok) await settle(result.podatak, current);
    else { setUnconfirmed(true); say(result.poruka, 'error'); }
    await read(current);
  };
  const pick = async (source: PhotoSource) => {
    if (!recovered || !photos || photos.photos.length >= MAX_PHOTOS || pending.current || !key || !begin(source)) return;
    try {
      say(null); setPermissionDenied(false);
      const photo = await pickPreparedPhoto(source, current, () => { if (current()) say('Pripremamo fotografiju…', 'progress'); });
      if (!photo || !current()) return;
      const command = { id: noviUuidZahtevId(), photo }; pending.current = command;
      // Persist identity before I/O, never pixels, path, or metadata.
      setUnconfirmed(true); await send(command);
    } catch (error) { if (current()) { say(pending.current ? 'Slanje nije potvrđeno. Proveri ishod pre novog izbora.' : photoSelectionMessage(error), 'error'); setUnconfirmed(!!pending.current);
      // Owner decision 4: a denied camera permission always leaves a way forward (settings or the gallery).
      setPermissionDenied(!pending.current && (error as { code?: string } | null)?.code === 'PERMISSION'); } }
    finally { finish(); }
  };
  const retry = async () => {
    if (!canRetry || !pending.current?.photo || !begin('RETRY')) return;
    try { await send(pending.current); } catch { if (current()) say('Ishod nije potvrđen. Proveri fotografije.', 'error'); } finally { finish(); }
  };
  // PKG-008 / GAP-0036: the server owns the exit. A tombstone (absent key) or a
  // deselection (admitted key) is the only thing that retires the journal identity;
  // an unconfirmed cancellation keeps it, so nothing is erased on a missing row.
  const cancel = async () => {
    const command = pending.current;
    if (!command || !conversationId || !key || !begin('CANCEL')) return;
    try {
      abort.current?.abort();
      const result = await mediaClientService.cancelUploadCommand({ conversationId, clientRequestId: command.id });
      if (!current()) return;
      if (!result.ok) { say(result.poruka, 'error'); return; }
      await AsyncStorage.removeItem(key);
      if (!current()) return;
      pending.current = null; setUnconfirmed(false); setCanRetry(false);
      say(result.podatak.previousState === null ? 'Slanje je otkazano. Zakasnela fotografija sa ovog zahteva neće biti prihvaćena.'
        : 'Slanje je otkazano. Fotografija nije u nacrtu.', 'success');
      await read(current);
    } catch { if (current()) say('Otkazivanje nije potvrđeno. Osveži prikaz pre novog pokušaja.', 'error'); }
    finally { finish(); }
  };
  const remove = async (assetId: string) => {
    if (!recovered || pending.current || !conversationId || !begin(`REMOVE:${assetId}`)) return;
    try {
      const result = await mediaClientService.removeTaskPhoto({ conversationId, assetId });
      if (!current()) return;
      if (result.ok) { setPhotos(result.podatak); say('Fotografija je uklonjena iz nacrta.', 'success'); }
      else { setRecovered(false); say(result.poruka, 'error'); }
    } finally { finish(); }
  };
  // With no screen behind it (a cold start from a link), the arrow returns to the conversation these
  // photos belong to, not to a blank new one.
  const back = () => { if (!current()) return; navigateOnce.current = true;
    if (router.canGoBack()) router.back();
    else router.replace(conversationId ? { pathname: '/nova', params: { conversationId } } : '/nova'); };
  const full = (photos?.photos.length ?? MAX_PHOTOS) >= MAX_PHOTOS;
  const addDisabled = busy || unconfirmed || !recovered || full;
  // A grey add button always says why (owner rule); while one is at work its spinner says it.
  const addReason = busy ? null : !recovered ? 'Fotografije još nisu učitane.' : unconfirmed ? 'Prvo završi ili otkaži nepotvrđeno slanje.'
    : full ? 'Dodato je najviše fotografija. Ukloni jednu da dodaš drugu.' : null;
  const list = photos?.photos ?? [];
  const readError = !busy && !recovered && !!message && !!conversationId && !permissionDenied;
  const sending = working === 'LIBRARY' || working === 'CAMERA' || working === 'RETRY';
  // Removing asks first; the sheet stays open until the removal settles and the status line reports it.
  const askRemove = (assetId: string) => confirm.ask({ title: 'Ukloniti fotografiju?', message: 'Fotografija se uklanja iz nacrta zadatka.',
    confirmLabel: 'Ukloni', tone: 'danger', onConfirm: () => remove(assetId) });
  const removeDisabled = busy || unconfirmed || !recovered;
  return <SettingsScreen title="Fotografije zadatka" onBack={back} footer={<>
    {/* One reason for both add actions, said once under the last of them. */}
    <SettingsAction label="Izaberi iz galerije" loading={working === 'LIBRARY'} disabled={addDisabled}
      onPress={() => { void pick('LIBRARY'); }} />
    <SettingsAction label="Fotografiši" kind="secondary" loading={working === 'CAMERA'} disabled={addDisabled} reason={addReason}
      onPress={() => { void pick('CAMERA'); }} />
  </>}>
    {!conversationId ? <StateView kind="error" art="photo" title="Fotografije nisu dostupne" body="Otvori fotografije iz razgovora o zadatku." />
      : readError ? <StateView kind="error" art="photo" title="Fotografije nisu učitane" body={message ?? undefined}
        primary={{ label: 'Osveži i proveri fotografije', onPress: () => { void refresh(); } }} />
      : <>
        {message && permissionDenied ? <PermissionRecovery message={message} alternative="Izaberi iz galerije" onAlternative={() => { void pick('LIBRARY'); }} />
          : message ? <PhotoStatus text={message} tone={tone} /> : null}
        {list.length ? <T variant="meta" tone="muted">{`${fotografija(list.length)} od ${MAX_PHOTOS}`}</T> : null}
        {list.length || pending.current ? <PhotoGrid>{tile => <>
          {list.map((photo, i) => <PhotoTile key={photo.assetId} index={i} size={tile}
            state={photo.state === 'READY' ? { kind: 'READY', assetId: photo.assetId }
              : { kind: photo.state === 'FAILED' ? 'FAILED' : 'PROCESSING', assetId: photo.assetId }}
            removeDisabled={removeDisabled} onRemove={photo.state === 'READY' || photo.state === 'FAILED' ? () => askRemove(photo.assetId) : undefined} />)}
          {pending.current ? <PhotoTile index={list.length} size={tile} removeDisabled
            state={{ kind: sending ? 'SENDING' : 'UNCONFIRMED' }} /> : null}
        </>}</PhotoGrid> : null}
        {/* The three ways out of an unconfirmed send, and the check that brings a photo still being processed up to date. */}
        {unconfirmed || list.some(photo => photo.state !== 'READY' && photo.state !== 'FAILED') ? <>
          {unconfirmed && canRetry ? <SettingsAction label="Nastavi slanje iste fotografije" kind="secondary" loading={working === 'RETRY'} disabled={busy}
            onPress={() => { void retry(); }} /> : null}
          {unconfirmed ? <SettingsAction label="Odustani od nepotvrđenog slanja" kind="quiet" loading={working === 'CANCEL'} disabled={busy}
            onPress={() => { void cancel(); }} /> : null}
          <SettingsAction label="Osveži i proveri fotografije" kind="quiet" loading={working === 'REFRESH'} disabled={busy} onPress={() => { void refresh(); }} />
        </> : null}
        {recovered && !list.length && !pending.current ? <StateView kind="empty" art="photo" title="Još nema fotografija" /> : null}
        {busy && !recovered && !message ? <PhotosLoading /> : null}
      </>}
    <PhotosPrivacyNote limits={`Do ${MAX_PHOTOS} fotografija, do 10 MB po slici. Uklanjamo metapodatke i smanjujemo slike. Nacrt vidiš samo ti; fotografije postaju dostupne uz objavljen zadatak.`} />
    {confirm.sheet}
  </SettingsScreen>;
}
