import { useCallback, type ReactNode } from 'react';
import { View } from 'react-native';
import { mediaClientService } from '../../data/mediaClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

export function NeedPhotos({ needId }: { needId: string }) {
  const read = useCallback(() => mediaClientService.readNeedPhotos(needId), [needId]);
  const editor = useOwnedEditor(read);
  if (!editor.data?.photos.length && !editor.error) return null;
  return <View style={{ gap: 12, backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 18 }}>
    {editor.data?.photos.length ? <T accessibilityRole="header" variant="heading" style={{ color: sys.color.ink }}>Fotografije</T> : null}
    {editor.data?.photos.map((photo, i) => <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId} needId={needId} label={`Fotografija zadatka ${i + 1}`} />)}
    {editor.error ? <><T variant="meta" tone="muted">Fotografije trenutno nisu učitane.</T>
      <V2Action label="Učitaj fotografije" kind="quiet" disabled={editor.loading} onPress={() => { void editor.refresh(); }} /></> : null}
  </View>;
}

export function ProfilePhoto({ profileId, fallback, size }: { profileId: string; fallback: ReactNode; size?: number }) {
  const read = useCallback(() => mediaClientService.readProfilePhoto(profileId), [profileId]);
  const editor = useOwnedEditor(read), photo = editor.data?.photo;
  return photo ? <AuthorizedPhoto assetId={photo.assetId} profileId={profileId} label="Profilna fotografija"
    contentFit={size ? 'cover' : 'contain'}
    style={size ? { width: size, height: size, borderRadius: size / 2, aspectRatio: 1 }
      : { width: 112, height: 132, borderRadius: sys.radius.card, aspectRatio: 112 / 132 }} /> : <>{fallback}</>;
}
