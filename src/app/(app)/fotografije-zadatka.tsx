import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaClientService, type MediaAsset, type TaskPhotos } from '../../data/mediaClientService';
import { pickPreparedPhoto, photoSelectionMessage, type PreparedPhoto, type PhotoSource } from '../../features/media/nativePhotoPicker';
import { sesijaSada, useSesija } from '../../store/sesija';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { uuid } from '../../data/serverReceipt';
import { AuthorizedPhoto } from '../../ui/media/AuthorizedPhoto';
import { PermissionRecovery } from '../../ui/system/PermissionRecovery';
import { plural } from '../../ui/system/plural';
import { sys } from '../../ui/system/tokens';
import { SettingsText as T, SettingsScreen, SettingsPanel, SettingsAction } from '../../ui/settings/SettingsPresentation';

type Pending = { id: string; photo?: PreparedPhoto };
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
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const settle = async (asset: MediaAsset, current: () => boolean) => {
    if (!current() || asset.scope !== 'TASK' || asset.conversationId !== conversationId || asset.clientRequestId !== pending.current?.id) return;
    if (!asset.selected || asset.state === 'READY' || asset.state === 'FAILED') {
      if (key) await AsyncStorage.removeItem(key);
      if (!current()) return;
      pending.current = null; setUnconfirmed(false); setCanRetry(false);
      setMessage(asset.selected && asset.state === 'READY' ? 'Fotografija je dodata privatnom nacrtu.' : 'Fotografija nije dodata. Možeš izabrati drugu.');
    } else { setUnconfirmed(true); setMessage('Obrada fotografije još nije potvrđena. Proveri ishod.'); }
  };
  const read = async (current: () => boolean) => {
    if (!conversationId || !key || !current()) return;
    const stored = await AsyncStorage.getItem(key);
    if (!current()) return;
    if (stored && !uuid(stored)) {
      // Not a command identity: it can never be reconciled or replayed, so it must not strand the picker.
      await AsyncStorage.removeItem(key);
      if (!current()) return;
      setMessage('Zapis nepotvrđenog slanja nije čitljiv, pa je uklonjen. Proveri fotografije.');
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
        setMessage(!missing ? 'Ishod slanja nije učitan. Proveri vezu i osveži prikaz.'
          : retained ? 'Server nema ovo slanje. Možeš da pošalješ istu fotografiju ponovo ili da odustaneš od slanja.'
            : 'Server nema ovo slanje, a fotografija više nije na uređaju. Odustani od slanja pa izaberi fotografiju ponovo.');
      }
    }
    if (!current()) return;
    const result = await mediaClientService.readTaskPhotos(conversationId);
    if (!current()) return;
    if (result.ok) { setPhotos(result.podatak); setRecovered(true); }
    else { setMessage(result.poruka); setRecovered(false); }
  };
  useFocusEffect(useCallback(() => {
    const token = {}; focused.current = token; navigateOnce.current = false;
    const current = () => focused.current === token && owns();
    operation.current = true; setBusy(true); setRecovered(false); setPhotos(null);
    void read(current).catch(() => { if (current()) setMessage('Ishod nije učitan. Proveri vezu i osveži prikaz.'); })
      .finally(() => { if (current()) { operation.current = false; setBusy(false); } });
    return () => { if (focused.current === token) focused.current = null; abort.current?.abort();
      if (pending.current) pending.current = { id: pending.current.id }; setPhotos(null); };
  }, [conversationId, key, owns]));
  const token = focused.current;
  const current = () => !!token && focused.current === token && owns() && !navigateOnce.current;
  const begin = () => { if (!current() || operation.current) return false; operation.current = true; setBusy(true); return true; };
  const finish = () => { if (current()) { operation.current = false; setBusy(false); } };
  const refresh = async () => { if (!begin()) return;
    try { await read(current); } catch { if (current()) setMessage('Ishod nije učitan. Proveri vezu i pokušaj ponovo.'); } finally { finish(); } };
  const send = async (command: Pending) => {
    if (!conversationId || !key || !command.photo || !current()) return;
    await AsyncStorage.setItem(key, command.id);
    if (!current()) return;
    const controller = new AbortController(); abort.current = controller;
    setMessage('Šaljem fotografiju…');
    const result = await mediaClientService.uploadTaskPhoto({ conversationId, clientRequestId: command.id,
      bytes: command.photo.bytes, contentType: command.photo.contentType }, { signal: controller.signal });
    if (!current()) return;
    if (result.ok) await settle(result.podatak, current);
    else { setUnconfirmed(true); setMessage(result.poruka); }
    await read(current);
  };
  const pick = async (source: PhotoSource) => {
    if (!recovered || !photos || photos.photos.length >= MAX_PHOTOS || pending.current || !key || !begin()) return;
    try {
      setMessage(null); setPermissionDenied(false);
      const photo = await pickPreparedPhoto(source, current, () => { if (current()) setMessage('Pripremamo fotografiju…'); });
      if (!photo || !current()) return;
      const command = { id: noviUuidZahtevId(), photo }; pending.current = command;
      // Persist identity before I/O, never pixels, path, or metadata.
      setUnconfirmed(true); await send(command);
    } catch (error) { if (current()) { setMessage(pending.current ? 'Slanje nije potvrđeno. Proveri ishod pre novog izbora.' : photoSelectionMessage(error)); setUnconfirmed(!!pending.current);
      // Owner decision 4: a denied camera permission always leaves a way forward (settings or the gallery).
      setPermissionDenied(!pending.current && (error as { code?: string } | null)?.code === 'PERMISSION'); } }
    finally { finish(); }
  };
  const retry = async () => {
    if (!canRetry || !pending.current?.photo || !begin()) return;
    try { await send(pending.current); } catch { if (current()) setMessage('Ishod nije potvrđen. Proveri fotografije.'); } finally { finish(); }
  };
  // PKG-008 / GAP-0036: the server owns the exit. A tombstone (absent key) or a
  // deselection (admitted key) is the only thing that retires the journal identity;
  // an unconfirmed cancellation keeps it, so nothing is erased on a missing row.
  const cancel = async () => {
    const command = pending.current;
    if (!command || !conversationId || !key || !begin()) return;
    try {
      abort.current?.abort();
      const result = await mediaClientService.cancelUploadCommand({ conversationId, clientRequestId: command.id });
      if (!current()) return;
      if (!result.ok) { setMessage(result.poruka); return; }
      await AsyncStorage.removeItem(key);
      if (!current()) return;
      pending.current = null; setUnconfirmed(false); setCanRetry(false);
      setMessage(result.podatak.previousState === null ? 'Slanje je otkazano. Zakasnela fotografija sa ovog zahteva neće biti prihvaćena.'
        : 'Slanje je otkazano. Fotografija nije u nacrtu.');
      await read(current);
    } catch { if (current()) setMessage('Otkazivanje nije potvrđeno. Osveži prikaz pre novog pokušaja.'); }
    finally { finish(); }
  };
  const remove = async (assetId: string) => {
    if (!recovered || pending.current || !conversationId || !begin()) return;
    try {
      const result = await mediaClientService.removeTaskPhoto({ conversationId, assetId });
      if (!current()) return;
      if (result.ok) { setPhotos(result.podatak); setMessage('Fotografija je uklonjena iz nacrta.'); }
      else { setRecovered(false); setMessage(result.poruka); }
    } finally { finish(); }
  };
  // With no screen behind it (a cold start from a link), the arrow returns to the conversation these
  // photos belong to, not to a blank new one.
  const back = () => { if (!current()) return; navigateOnce.current = true;
    if (router.canGoBack()) router.back();
    else router.replace(conversationId ? { pathname: '/nova', params: { conversationId } } : '/nova'); };
  const full = (photos?.photos.length ?? MAX_PHOTOS) >= MAX_PHOTOS;
  const addDisabled = busy || unconfirmed || !recovered || full;
  return <SettingsScreen title="Fotografije zadatka" onBack={back}>
    <T tone="muted">{`Do ${MAX_PHOTOS} fotografija, do 10 MB po slici. Uklanjamo metapodatke i smanjujemo slike. Nacrt vidiš samo ti; fotografije postaju dostupne uz objavljen zadatak.`}</T>
    <T tone="muted">Izabrane fotografije šaljemo Google Gemini servisu radi provere sadržaja pre objave. Obrada može biti van Evrope i uključuje privremene bezbednosne zapise kod Google-a.</T>
    {message && permissionDenied ? <PermissionRecovery message={message} alternative="Izaberi iz galerije" onAlternative={() => { void pick('LIBRARY'); }} />
      : message ? <T accessibilityLiveRegion="polite">{message}</T> : null}
    {busy ? <T>Radnja je u toku…</T> : null}
    {photos?.photos.length ? <T>{`${fotografija(photos.photos.length)} od ${MAX_PHOTOS}`}</T> : null}
    {/* A grid, two square tiles to a row, each with its small remove control (owner, 2026-09-23). It used to be a
        card and a full-width button per photo — six photos were six screens of buttons. */}
    {photos?.photos.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm }}>
      {photos.photos.map((photo, i) => <View key={photo.assetId} style={{ width: '48%', gap: sys.space.xs }}>
        {photo.state === 'READY' ? <AuthorizedPhoto assetId={photo.assetId} label={`Fotografija zadatka ${i + 1}`} contentFit="cover" style={{ aspectRatio: 1 }} />
          : <SettingsPanel soft style={{ aspectRatio: 1, marginTop: 0, marginBottom: 0, justifyContent: 'center' }}><T variant="meta" tone="muted">{photo.state === 'FAILED' ? 'Fotografija nije obrađena.' : 'Fotografija se obrađuje.'}</T></SettingsPanel>}
        <SettingsAction label={`Ukloni fotografiju ${i + 1}`} kind="destructive" compact disabled={busy || unconfirmed || !recovered}
          onPress={() => { void remove(photo.assetId); }} />
      </View>)}
    </View> : null}
    {/* The two grey add buttons say why they are grey; the other reasons (a run in progress, an
        unconfirmed upload, a failed read) are already the message above them. */}
    {full && recovered && !busy && !unconfirmed ? <T tone="muted">Dodato je najviše fotografija. Ukloni jednu da bi dodao drugu.</T> : null}
    <SettingsAction label="Izaberi iz galerije" disabled={addDisabled} onPress={() => { void pick('LIBRARY'); }} />
    <SettingsAction label="Fotografiši" kind="secondary" disabled={addDisabled} onPress={() => { void pick('CAMERA'); }} />
    <SettingsAction label="Osveži i proveri fotografije" kind="quiet" disabled={busy} onPress={() => { void refresh(); }} />
    {unconfirmed && canRetry ? <SettingsAction label="Nastavi slanje iste fotografije" kind="secondary" disabled={busy} onPress={() => { void retry(); }} /> : null}
    {unconfirmed ? <SettingsAction label="Odustani od nepotvrđenog slanja" kind="quiet" disabled={busy} onPress={() => { void cancel(); }} /> : null}
  </SettingsScreen>;
}
