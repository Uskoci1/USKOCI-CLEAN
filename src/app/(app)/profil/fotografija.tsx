import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaClientService, type MediaAsset, type ProfileAvatar } from '../../../data/mediaClientService';
import { pickPreparedPhoto, photoSelectionMessage, type PreparedPhoto, type PhotoSource } from '../../../features/media/nativePhotoPicker';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { failure, record, uuid } from '../../../data/serverReceipt';
import type { Ishod } from '../../../data/ports';
import { AuthorizedPhoto, mediaAssetId } from '../../../ui/media/AuthorizedPhoto';
import { SettingsText as T, SettingsScreen, SettingsPanel, SettingsAction } from '../../../ui/settings/SettingsPresentation';

type Intent = { phase: 'UPLOAD' | 'APPLY' | 'CLEAR' | 'DISCARD'; requestId: string | null; assetId: string | null; expectedPath: string | null };
type Snapshot = { profile: ProfileAvatar; asset: MediaAsset | null; intent: Intent | null };
const changed = () => failure('MEDIA_SCOPE_CHANGED', 'Ponovo otvori fotografiju za trenutni profil.');
function decodeIntent(value: string | null): Intent | null {
  if (value === null) return null;
  const v = record(JSON.parse(value));
  if (!v || Object.keys(v).length !== 4 || !['UPLOAD', 'APPLY', 'CLEAR', 'DISCARD'].includes(String(v.phase))
    || (v.phase === 'CLEAR' ? v.requestId !== null || v.assetId !== null : !uuid(v.requestId))
    || ((v.phase === 'APPLY' || v.phase === 'DISCARD') && !uuid(v.assetId)) || (v.phase === 'UPLOAD' && v.assetId !== null)
    || (v.expectedPath !== null && (typeof v.expectedPath !== 'string' || v.expectedPath.length > 2000))) throw new Error('invalid intent');
  return v as Intent;
}
export default function AvatarRoute() {
  const params = useLocalSearchParams<{ profileId?: string }>(), { user, accountRevision } = useSesija();
  const id = typeof params.profileId === 'string' && uuid(params.profileId) ? params.profileId : null;
  return <AvatarEditor key={`${user?.id}:${accountRevision}:${id}`} profileId={id} />;
}
function AvatarEditor({ profileId }: { profileId: string | null }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const key = accountId && profileId ? `uskoci:media-upload:${accountId}:AVATAR:${profileId}` : null;
  const focus = useRef<object | null>(null), bytes = useRef<PreparedPhoto | null>(null), abort = useRef<AbortController | null>(null);
  const intent = useRef<Intent | null>(null), readAttempted = useRef(false), navigating = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision,
    [accountId, accountRevision]);
  useFocusEffect(useCallback(() => { const token = {}; focus.current = token; navigating.current = false;
    return () => { if (focus.current === token) focus.current = null; bytes.current = null; abort.current?.abort(); };
  }, [owns, profileId]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const token = focus.current, current = () => !!token && focus.current === token && owns();
    if (!profileId || !key || !current()) return changed();
    try {
      const profile = await mediaClientService.readProfileAvatar(profileId);
      if (!current()) return changed(); if (!profile.ok) return profile;
      const stored = await AsyncStorage.getItem(key);
      if (!current()) return changed(); intent.current = decodeIntent(stored); readAttempted.current = !!intent.current;
      let asset: MediaAsset | null = null;
      if (intent.current?.requestId) {
        readAttempted.current = true;
        const uploaded = await mediaClientService.readUploadCommand(intent.current.requestId);
        if (!current()) return changed();
        if (!uploaded.ok) {
          setNotice(uploaded.poruka);
          return { ok: true, podatak: { profile: profile.podatak, asset: null, intent: intent.current } };
        }
        if (uploaded.podatak.scope !== 'AVATAR' || uploaded.podatak.profileId !== profileId) return changed();
        asset = uploaded.podatak;
      }
      const discarded = intent.current?.phase === 'DISCARD' && asset?.selected === false;
      const resolved = intent.current?.phase === 'CLEAR' ? profile.podatak.avatarPath === null
        : discarded || intent.current?.phase === 'APPLY' && asset?.state === 'READY' && profile.podatak.avatarPath === asset.ref;
      if (resolved || (intent.current?.phase === 'UPLOAD' && asset && (!asset.selected || asset.state === 'FAILED'))) {
        await AsyncStorage.removeItem(key); if (!current()) return changed();
        intent.current = null; bytes.current = null; asset = null;
        setNotice(discarded ? 'Odustao/la si od izabrane fotografije.' : resolved ? 'Fotografija profila je sačuvana.' : 'Fotografija nije dodata. Možeš izabrati drugu.');
      }
      return { ok: true, podatak: { profile: profile.podatak, asset, intent: intent.current } };
    } catch { return failure('MEDIA_READ_UNCONFIRMED', 'Sačuvana fotografija nije potvrđena. Proveri ishod.'); }
  }, [profileId, key, owns]);
  const editor = useOwnedEditor(read), snapshot = editor.data, candidate = snapshot?.asset;
  const token = focus.current, view = useRef(snapshot); view.current = snapshot;
  const current = () => !!token && focus.current === token && owns() && !navigating.current;
  const canAct = () => current() && !editor.loading && !editor.busy && !editor.uncertain && !editor.error && view.current === snapshot;
  const persist = async (next: Intent) => {
    if (!key || !current()) return false;
    await AsyncStorage.setItem(key, JSON.stringify(next));
    if (!current()) return false; intent.current = next; readAttempted.current = false; return true;
  };
  const finishCommand = async (): Promise<Ishod<Snapshot>> => {
    if (!key || !current()) return changed();
    await AsyncStorage.removeItem(key);
    if (!current()) return changed(); intent.current = null; bytes.current = null;
    setNotice('Promena je zabeležena. Prikazujem trenutnu fotografiju.'); return read();
  };
  const upload = async (command: Intent, photo: PreparedPhoto): Promise<Ishod<Snapshot>> => {
    if (!profileId || !command.requestId || !(await persist(command))) return changed();
    const controller = new AbortController(); abort.current = controller;
    const result = await mediaClientService.uploadAvatar({ profileId, clientRequestId: command.requestId,
      bytes: photo.bytes, contentType: photo.contentType }, { signal: controller.signal });
    if (!current()) return changed();
    const checked = await read(); // Unknown writes always read before any explicit retry.
    return checked.ok ? checked : result.ok ? checked : result;
  };
  const pick = async (source: PhotoSource) => {
    if (!canAct() || !snapshot || intent.current) return;
    await editor.save(async () => {
      try {
        setNotice(null); const photo = await pickPreparedPhoto(source, current);
        if (!current()) return changed(); if (!photo) return { ok: true, podatak: snapshot };
        bytes.current = photo; readAttempted.current = false;
        return upload({ phase: 'UPLOAD', requestId: noviUuidZahtevId(), assetId: null, expectedPath: null }, photo);
      } catch (error) { return failure('MEDIA_PREPARE_FAILED', photoSelectionMessage(error)); }
    });
  };
  const apply = async () => {
    if (!canAct() || !profileId || candidate?.state !== 'READY' || snapshot?.intent?.phase !== 'UPLOAD'
      || intent.current?.phase !== 'UPLOAD' || intent.current.requestId !== candidate.clientRequestId) return;
    const next: Intent = { phase: 'APPLY', requestId: candidate.clientRequestId, assetId: candidate.assetId, expectedPath: snapshot.profile.avatarPath };
    await editor.save(async () => {
      if (!(await persist(next))) return changed();
      const result = await mediaClientService.applyAvatar({ profileId, assetId: candidate.assetId, expectedAvatarPath: next.expectedPath });
      if (!current()) return changed(); return result.ok ? finishCommand() : result;
    });
  };
  const clear = async () => {
    if (!canAct() || !profileId || !snapshot?.profile.avatarPath || intent.current) return;
    const next: Intent = { phase: 'CLEAR', requestId: null, assetId: null, expectedPath: snapshot.profile.avatarPath };
    await editor.save(async () => {
      if (!(await persist(next))) return changed();
      const result = await mediaClientService.clearAvatar({ profileId, expectedAvatarPath: next.expectedPath });
      if (!current()) return changed(); return result.ok ? finishCommand() : result;
    });
  };
  const discard = async () => {
    if (!canAct() || !candidate || candidate.state !== 'READY' || intent.current?.phase !== 'UPLOAD') return;
    const next: Intent = { phase: 'DISCARD', requestId: candidate.clientRequestId, assetId: candidate.assetId, expectedPath: null };
    await editor.save(async () => {
      if (!(await persist(next))) return changed();
      const result = await mediaClientService.discardAvatar(candidate.assetId);
      if (!current()) return changed(); return result.ok ? finishCommand() : result;
    });
  };
  const retry = async () => {
    if (!current() || !profileId || editor.loading || editor.busy || !intent.current || !readAttempted.current) return;
    const command = intent.current;
    await editor.save(async () => {
      if (command.phase === 'UPLOAD') return bytes.current && readAttempted.current ? upload(command, bytes.current) : read();
      const result = command.phase === 'APPLY' && command.assetId
        ? await mediaClientService.applyAvatar({ profileId, assetId: command.assetId, expectedAvatarPath: command.expectedPath })
        : command.phase === 'DISCARD' && command.assetId ? await mediaClientService.discardAvatar(command.assetId)
        : await mediaClientService.clearAvatar({ profileId, expectedAvatarPath: command.expectedPath });
      if (!current()) return changed();
      if (!result.ok && result.kod === 'MEDIA_VERSION_CONFLICT' && key) {
        await AsyncStorage.removeItem(key); if (!current()) return changed(); intent.current = null; bytes.current = null;
        setNotice('Profil je promenjen. Pregledaj sadašnju fotografiju pre novog izbora.'); return read();
      }
      return result.ok ? finishCommand() : result;
    });
  };
  const existing = snapshot?.profile.avatarPath ? mediaAssetId(snapshot.profile.avatarPath) : null;
  return <SettingsScreen title="Fotografija profila" onBack={() => { if (!current()) return; navigating.current = true;
    if (router.canGoBack()) router.back(); else router.replace('/profil'); }}>
    <T tone="muted">Jedna fotografija ovog profila, do 10 MB. Uklanjamo metapodatke i smanjujemo sliku. Nova fotografija se prikazuje drugima tek kada izabereš „Sačuvaj fotografiju“.</T>
    {existing ? <AuthorizedPhoto assetId={existing} label="Sadašnja fotografija profila" /> : <T>Profil nema novu fotografiju.</T>}
    {candidate?.state === 'READY' && snapshot?.intent?.phase === 'UPLOAD' ? <SettingsPanel>
      <T>Izabrana fotografija</T><AuthorizedPhoto assetId={candidate.assetId} label="Izabrana fotografija profila" />
      <SettingsAction label="Sačuvaj fotografiju" disabled={!canAct()} onPress={() => { void apply(); }} />
      <SettingsAction label="Odustani od izabrane fotografije" kind="quiet" disabled={!canAct()} onPress={() => { void discard(); }} />
    </SettingsPanel> : null}
    {notice ? <T accessibilityLiveRegion="polite">{notice}</T> : null}
    {editor.error ? <T accessibilityRole="alert" tone="danger">{editor.error}</T> : null}
    {editor.busy || editor.loading ? <T>Radnja je u toku…</T> : null}
    {intent.current && candidate?.state !== 'READY' ? <T>Slanje ili promena još nisu potvrđeni. Proveri ishod pre novog izbora.</T> : null}
    <SettingsAction label="Izaberi iz galerije" kind={candidate?.state === 'READY' ? 'secondary' : 'primary'} disabled={!canAct() || !!intent.current} onPress={() => { void pick('LIBRARY'); }} />
    <SettingsAction label="Fotografiši" kind="secondary" disabled={!canAct() || !!intent.current} onPress={() => { void pick('CAMERA'); }} />
    {snapshot?.profile.avatarPath ? <SettingsAction label="Ukloni fotografiju profila" kind="destructive" disabled={!canAct() || !!intent.current} onPress={() => { void clear(); }} /> : null}
    <SettingsAction label="Proveri sačuvanu fotografiju" kind="quiet" disabled={editor.busy || editor.loading} onPress={() => { if (current()) void editor.refresh(); }} />
    {intent.current && readAttempted.current && (intent.current.phase !== 'UPLOAD' || bytes.current) ?
      <SettingsAction label="Ponovi istu promenu" kind="secondary" disabled={editor.busy || editor.loading} onPress={() => { void retry(); }} /> : null}
  </SettingsScreen>;
}
