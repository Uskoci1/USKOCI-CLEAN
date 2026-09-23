import { useCallback, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { mediaClientService } from '../../data/mediaClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { FactArt } from '../system/FactArt';
import { DetailSection } from '../product/ProductDetails';

/**
 * `owned` is the owner looking at their own task: for them an absence is something they can still
 * do something about, and saying nothing at all made "no photos" indistinguishable from "photos did
 * not load". For everyone else an empty section is just noise, so it stays hidden.
 */
export function NeedPhotos({ needId, owned = false }: { needId: string; owned?: boolean }) {
  const read = useCallback(() => mediaClientService.readNeedPhotos(needId), [needId]);
  const editor = useOwnedEditor(read);
  const photos = editor.data?.photos ?? [];
  if (editor.loading && !editor.data) return null;
  if (!photos.length && !editor.error && !owned) return null;
  // The owner is told plainly that there are none, in one line of the task's own reading order: a card
  // with advice and no way to act on it was a box of noise. Photos are added when the task is edited.
  if (!photos.length && !editor.error) return <DetailSection>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 32, alignItems: 'center' }}><FactArt kind="photo" size={28} /></View>
      <T variant="bodyStrong" tone="muted" style={{ flex: 1 }}>Još nema fotografija</T>
    </View>
  </DetailSection>;
  // Photos are a strip to swipe through, each a real picture of the job, not a column of full-width frames.
  return <DetailSection title={photos.length ? `Fotografije · ${photos.length}` : 'Fotografije'}>
    {photos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
      {photos.map((photo, i) => <AuthorizedPhoto key={photo.assetId} assetId={photo.assetId} needId={needId} label={`Fotografija zadatka ${i + 1}`}
        contentFit="cover" style={{ width: photos.length === 1 ? 320 : 248, borderRadius: sys.radius.cardCompact }} />)}
    </ScrollView> : null}
    {editor.error ? <><T variant="note" tone="muted">Fotografije trenutno nisu učitane.</T>
      <V2Action label="Učitaj fotografije" kind="quiet" disabled={editor.loading} onPress={() => { void editor.refresh(); }} /></> : null}
  </DetailSection>;
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
  const letter = (initial ?? '').trim().slice(0, 1).toLocaleUpperCase('sr-Latn-RS');
  // What stands for the person when there is no photograph, or when it cannot be read right now.
  const standIn = fallback ? <>{fallback}</> : <View accessibilityLabel={letter ? `Bez fotografije: ${letter}` : 'Bez fotografije'}
    style={[box, { backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' }]}>
    {letter ? <T accessible={false} variant="title" style={{ color: sys.color.green }}>{letter}</T>
      : <FactArt kind="person" size={size ? Math.round(size / 2.2) : 40} />}
  </View>;
  if (photo) return <AuthorizedPhoto assetId={photo.assetId} profileId={profileId} label="Profilna fotografija"
    contentFit={size ? 'cover' : 'contain'} style={box} unavailable={size ? standIn : undefined} />;
  if (editor.loading) return <View accessibilityLabel="Učitavamo fotografiju" style={[box, { backgroundColor: sys.color.skeleton }]} />;
  return standIn;
}
