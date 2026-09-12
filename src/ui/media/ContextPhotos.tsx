import { useCallback, type ReactNode } from 'react';
import { View } from 'react-native';
import { mediaClientService } from '../../data/mediaClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { aiFirst as a } from '../aiFirst/tokens';

export function NeedPhotos({ needId }: { needId: string }) {
  const read = useCallback(() => mediaClientService.readNeedPhotos(needId), [needId]);
  const editor = useOwnedEditor(read);
  return <View style={{ gap: 12 }}>
    {editor.data?.photos.length ? <T accessibilityRole="header" style={{ ...a.text.card, color: a.color.ink }}>Fotografije</T> : null}
    {editor.data?.photos.map((photo, i) => <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId} needId={needId} label={`Fotografija zadatka ${i + 1}`} />)}
    {editor.error ? <><T style={{ ...a.text.meta, color: a.color.muted }}>Fotografije trenutno nisu učitane.</T>
      <V2Action label="Učitaj fotografije" kind="quiet" disabled={editor.loading} onPress={() => { void editor.refresh(); }} /></> : null}
  </View>;
}

export function ProfilePhoto({ profileId, fallback }: { profileId: string; fallback: ReactNode }) {
  const read = useCallback(() => mediaClientService.readProfilePhoto(profileId), [profileId]);
  const editor = useOwnedEditor(read), photo = editor.data?.photo;
  return photo ? <AuthorizedPhoto assetId={photo.assetId} profileId={profileId} label="Profilna fotografija"
    style={{ width: 112, height: 132, borderRadius: 24, aspectRatio: 112 / 132 }} /> : <>{fallback}</>;
}
