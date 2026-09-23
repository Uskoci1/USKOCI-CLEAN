import { useCallback, type ReactNode } from 'react';
import { View } from 'react-native';
import { mediaClientService } from '../../data/mediaClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { sys, card } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { FactArt } from '../system/FactArt';

/**
 * `owned` is the owner looking at their own task: for them an absence is something they can still
 * do something about, and saying nothing at all made "no photos" indistinguishable from "photos did
 * not load". For everyone else an empty section is just noise, so it stays hidden.
 */
export function NeedPhotos({ needId, owned = false }: { needId: string; owned?: boolean }) {
  const read = useCallback(() => mediaClientService.readNeedPhotos(needId), [needId]);
  const editor = useOwnedEditor(read);
  if (editor.loading && !editor.data) return null;
  if (!editor.data?.photos.length && !editor.error && !owned) return null;
  if (!editor.data?.photos.length && !editor.error) return <View style={{ ...card, gap: 8 }}>
    <T accessibilityRole="header" variant="heading" style={{ color: sys.color.ink }}>Fotografije</T>
    <T variant="note" tone="muted">Nema nijedne. Fotografija pomaže da neko odmah vidi o čemu se radi.</T>
  </View>;
  return <View style={{ ...card, gap: 12 }}>
    {editor.data?.photos.length ? <T accessibilityRole="header" variant="heading" style={{ color: sys.color.ink }}>Fotografije</T> : null}
    {editor.data?.photos.map((photo, i) => <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId} needId={needId} label={`Fotografija zadatka ${i + 1}`} />)}
    {editor.error ? <><T variant="meta" tone="muted">Fotografije trenutno nisu učitane.</T>
      <V2Action label="Učitaj fotografije" kind="quiet" disabled={editor.loading} onPress={() => { void editor.refresh(); }} /></> : null}
  </View>;
}

/**
 * A person's face, or something standing in for it.
 *
 * Two call sites passed `fallback={null}` and the sheet above them tried to catch that with `??`,
 * which never fired because this component always returned an element. Anyone without a photo got
 * an empty green disc, and a photo that failed to load looked exactly like a person who had none.
 * The decision belongs here: a caller may pass its own fallback, but it cannot ask for nothing.
 */
export function ProfilePhoto({ profileId, fallback, size, initial }: { profileId: string; fallback?: ReactNode; size?: number; initial?: string | null }) {
  const read = useCallback(() => mediaClientService.readProfilePhoto(profileId), [profileId]);
  const editor = useOwnedEditor(read), photo = editor.data?.photo;
  const box = size ? { width: size, height: size, borderRadius: size / 2, aspectRatio: 1 }
    : { width: 112, height: 132, borderRadius: sys.radius.card, aspectRatio: 112 / 132 };
  if (photo) return <AuthorizedPhoto assetId={photo.assetId} profileId={profileId} label="Profilna fotografija"
    contentFit={size ? 'cover' : 'contain'} style={box} />;
  if (editor.loading) return <View accessibilityLabel="Učitavamo fotografiju" style={[box, { backgroundColor: sys.color.skeleton }]} />;
  if (fallback) return <>{fallback}</>;
  const letter = (initial ?? '').trim().slice(0, 1).toLocaleUpperCase('sr-Latn-RS');
  return <View accessibilityLabel={letter ? `Bez fotografije: ${letter}` : 'Bez fotografije'}
    style={[box, { backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' }]}>
    {letter ? <T accessible={false} variant="title" style={{ color: sys.color.green }}>{letter}</T>
      : <FactArt kind="person" size={size ? Math.round(size / 2.2) : 40} />}
  </View>;
}
