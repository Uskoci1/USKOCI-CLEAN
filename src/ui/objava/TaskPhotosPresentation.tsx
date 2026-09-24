import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { X } from 'phosphor-react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';

/**
 * The parts of the task photo screen (/fotografije-zadatka), drawings only: the route owns the journal, the upload
 * identity, the retry, the cancel and the removal; the design gallery (/dizajn-objava) draws the same parts from fixtures.
 */

export type PhotoTone = 'progress' | 'success' | 'error' | 'info';

/** What just happened, in one line whose look says what kind of news it is. Announced politely; an error as an alert. */
export function PhotoStatus({ text, tone }: { text: string; tone: PhotoTone }) {
  return <View style={s.status} accessibilityLiveRegion="polite">
    {tone === 'progress' ? <ActivityIndicator size="small" color={sys.color.green} />
      : tone === 'success' ? <FactArt kind="check" size={18} /> : null}
    <T variant="body" accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[s.grow, { color: tone === 'success'
      ? sys.color.green : tone === 'error' ? sys.color.danger : sys.color.ink }]}>{text}</T>
  </View>;
}

/** Two square tiles to a row, filling the width exactly (a percentage width wrapped at 320 dp). */
export function PhotoGrid({ children }: { children: (tile: number) => ReactNode }) {
  const [width, setWidth] = useState(0);
  const tile = width ? Math.floor((width - sys.space.sm) / 2) : 0;
  return <View style={s.grid} onLayout={event => setWidth(event.nativeEvent.layout.width)}>{tile ? children(tile) : null}</View>;
}

export type PhotoTileState =
  | { kind: 'READY'; assetId: string }
  | { kind: 'PROCESSING' | 'FAILED'; assetId: string }
  | { kind: 'SENDING' | 'UNCONFIRMED' };

/**
 * One tile. A photo in the draft carries its own small remove control in the corner (a 48 px target around a 36 px
 * white circle), never a full-width button under it; a greyed control stays readable, never faded. A photo being sent
 * or not yet confirmed has a tile of its own, drawn with a dashed edge.
 */
export function PhotoTile({ state, index, size, removeDisabled, onRemove, picture }: { state: PhotoTileState; index: number; size: number;
  removeDisabled: boolean; onRemove?: () => void;
  /** The design gallery's stand-in for the photo, so it reads nothing. */ picture?: ReactNode }) {
  const frame = { width: size, height: size };
  const remove = onRemove ? <Press accessibilityRole="button" accessibilityLabel={`Ukloni fotografiju ${index + 1}`}
    accessibilityState={{ disabled: removeDisabled }} disabled={removeDisabled} haptic="select" onPress={onRemove} style={s.removeTarget}>
    <View style={s.removeCircle}><X size={20} weight="bold" color={removeDisabled ? sys.color.muted : sys.color.ink} /></View>
  </Press> : null;
  if (state.kind === 'READY') return <View style={frame}>
    {picture ?? <AuthorizedPhoto assetId={state.assetId} label={`Fotografija zadatka ${index + 1}`} contentFit="cover" style={s.fill} />}
    {remove}
  </View>;
  const pending = state.kind === 'SENDING' || state.kind === 'UNCONFIRMED';
  return <View style={[frame, s.placeholder, pending && s.pending]}>
    {state.kind === 'PROCESSING' || state.kind === 'SENDING' ? <ActivityIndicator size="small" color={sys.color.green} />
      : <FactArt kind={state.kind === 'FAILED' ? 'photo' : 'info'} size={28} muted />}
    <T variant="note" tone="muted" numberOfLines={3} style={s.center}>{state.kind === 'PROCESSING' ? 'Fotografija se obrađuje.'
      : state.kind === 'FAILED' ? 'Fotografija nije obrađena.' : state.kind === 'SENDING' ? 'Šalje se…' : 'Slanje nije potvrđeno'}</T>
    {remove}
  </View>;
}

/** While the first read runs: two quiet squares where the photos will stand, and one sentence. */
export function PhotosLoading() {
  return <View style={s.loading} accessibilityLiveRegion="polite">
    <PhotoGrid>{tile => <>
      <View style={[{ width: tile, height: tile }, s.placeholder]} />
      <View style={[{ width: tile, height: tile }, s.placeholder]} />
    </>}</PhotoGrid>
    <T variant="meta" tone="muted">Učitavamo fotografije…</T>
  </View>;
}

/** The limits and the processing notice, word for word (privacy text), with the lock. Always on screen before a pick. */
export function PhotosPrivacyNote({ limits }: { limits: string }) {
  return <View style={s.privacy}>
    <FactArt kind="lock" size={20} />
    <View style={s.privacyText}>
      <T variant="note" tone="muted">{limits}</T>
      <T variant="note" tone="muted">Izabrane fotografije šaljemo Google Gemini servisu radi provere sadržaja pre objave. Obrada može biti van Evrope i uključuje privremene bezbednosne zapise kod Google-a.</T>
    </View>
  </View>;
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  center: { textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  fill: { width: '100%', height: '100%', aspectRatio: undefined },
  placeholder: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control, alignItems: 'center', justifyContent: 'center',
    gap: sys.space.sm, padding: sys.space.sm },
  pending: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: sys.color.lineStrong },
  removeTarget: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  removeCircle: { width: 36, height: 36, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1,
    borderColor: sys.color.line, alignItems: 'center', justifyContent: 'center' },
  loading: { gap: sys.space.md },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingTop: sys.space.sm },
  privacyText: { flex: 1, gap: sys.space.sm },
});
