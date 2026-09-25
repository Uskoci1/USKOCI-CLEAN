import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ArrowsOutSimple, CaretLeft, CaretRight, X } from 'phosphor-react-native';
import { mediaClientService, type MediaPreview } from '../../data/mediaClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { useSesija } from '../../store/sesija';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { FactArt } from '../system/FactArt';
import { inicijali } from '../../lib/inicijali';
import { Press } from '../Press';
import { ChromeIconButton } from '../system/ScreenChrome';
import { useReducedMotion } from '../system/motion';

/** Only actual photos lead the detail. An authoritative empty list stays absent for either side;
 * a failed read remains distinct and retryable. `owned` is retained for caller compatibility. */
export function NeedPhotos({ needId }: { needId: string; owned?: boolean }) {
  const { user, accountRevision } = useSesija();
  const read = useCallback(() => mediaClientService.readNeedPhotos(needId), [needId]);
  const editor = useOwnedEditor(read);
  const photos = editor.data?.photos ?? [];
  if (editor.loading && !editor.data) return null;
  if (!photos.length && !editor.error) return null;
  return <View style={galleryStyles.section}>
    {photos.length ? <NeedPhotoGallery key={`${user?.id}:${accountRevision}:${needId}:${photos.map(photo => photo.assetId).join(':')}`}
      needId={needId} photos={photos} /> : null}
    {editor.error ? <><T variant="note" tone="muted">Fotografije trenutno nisu učitane.</T>
      <V2Action label="Učitaj fotografije" kind="quiet" disabled={editor.loading} onPress={() => { void editor.refresh(); }} /></> : null}
  </View>;
}

/** The actual viewport owns a page's width, including narrow layouts and split-screen resizing.
 * Every image stays on the existing contextual reader: no URL, file copy, or persistent cache. */
function PhotoPages({ needId, photos, index, onIndex, onOpen, full = false }: {
  needId: string; photos: readonly MediaPreview[]; index: number; onIndex: (value: number) => void;
  onOpen?: (value: number) => void; full?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scroll = useRef<ScrollView>(null);
  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
  };
  // Reframing on rotation, or coming back from the viewer, preserves the chosen photo without a slide across unrelated pages.
  useEffect(() => { if (size.width > 0) scroll.current?.scrollTo({ x: index * size.width, animated: false }); }, [index, size.width]);
  const settled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.width <= 0 || !Number.isFinite(event.nativeEvent.contentOffset.x)) return;
    onIndex(Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / size.width))));
  };
  return <View testID={full ? 'task-photo-viewer-viewport' : 'task-photo-viewport'} onLayout={measure}
    style={full ? galleryStyles.viewerViewport : galleryStyles.viewport}>
    {size.width > 0 ? <ScrollView ref={scroll} horizontal pagingEnabled directionalLockEnabled bounces={false}
      testID={full ? 'task-photo-viewer-pages' : 'task-photo-pages'} showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={settled} contentOffset={{ x: index * size.width, y: 0 }} style={galleryStyles.pager}>
      {photos.map((photo, i) => {
        const picture = <AuthorizedPhoto assetId={photo.assetId} needId={needId} label={`Fotografija zadatka ${i + 1} od ${photos.length}`}
          contentFit={full ? 'contain' : 'cover'} style={{ width: size.width, height: size.height, aspectRatio: undefined, borderRadius: 0 }} />;
        return full ? <View key={photo.assetId} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
          style={{ width: size.width, height: size.height }}>{picture}</View>
          : <Press key={photo.assetId} accessibilityRole="button" accessibilityLabel={`Otvori fotografiju ${i + 1} od ${photos.length}`}
            accessibilityHint="Otvara fotografiju preko celog ekrana." accessibilityElementsHidden={i !== index}
            importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'} onPress={() => onOpen?.(i)} scaleTo={1} hitSlop={0}
            style={{ width: size.width, height: size.height }}>{picture}</Press>;
      })}
    </ScrollView> : null}
  </View>;
}

function NeedPhotoGallery({ needId, photos }: { needId: string; photos: readonly MediaPreview[] }) {
  const [index, setIndex] = useState(0), [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  const close = () => setOpen(false);
  const counter = `${index + 1} / ${photos.length}`;
  return <>
    <View style={galleryStyles.inline} accessibilityElementsHidden={open} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
      <PhotoPages needId={needId} photos={photos} index={index} onIndex={setIndex} onOpen={page => { setIndex(page); setOpen(true); }} />
      <View pointerEvents="none" style={galleryStyles.overlay}>
        <View style={galleryStyles.counter}><ArrowsOutSimple size={16} color={sys.color.ink} />
          <T variant="meta" accessibilityLabel={`Fotografija ${index + 1} od ${photos.length}`}>{counter}</T></View>
      </View>
    </View>
    {open ? <Modal visible presentationStyle="fullScreen" animationType={reduced ? 'none' : 'fade'} onRequestClose={close}>
      <SafeAreaView edges={['top', 'bottom']} accessibilityViewIsModal accessibilityLabel="Fotografije zadatka" style={galleryStyles.viewer}>
        <View style={galleryStyles.viewerHeader}><T accessibilityRole="header" variant="bodyStrong" style={galleryStyles.grow}>Fotografije zadatka</T>
          <ChromeIconButton label="Zatvori fotografije" icon={X} onPress={close} /></View>
        <PhotoPages needId={needId} photos={photos} index={index} onIndex={setIndex} full />
        <View style={galleryStyles.viewerFooter}>
          <ChromeIconButton label="Prethodna fotografija" icon={CaretLeft} disabled={index === 0} onPress={() => setIndex(value => Math.max(0, value - 1))} />
          <T variant="bodyStrong" accessibilityLiveRegion="polite" accessibilityLabel={`Fotografija ${index + 1} od ${photos.length}`}>{counter}</T>
          <ChromeIconButton label="Sledeća fotografija" icon={CaretRight} disabled={index === photos.length - 1}
            onPress={() => setIndex(value => Math.min(photos.length - 1, value + 1))} />
        </View>
      </SafeAreaView>
    </Modal> : null}
  </>;
}

const galleryStyles = StyleSheet.create({
  section: { gap: sys.space.sm },
  inline: { borderRadius: sys.radius.cardCompact, overflow: 'hidden' },
  viewport: { width: '100%', aspectRatio: 4 / 3, backgroundColor: sys.color.wash },
  pager: { flex: 1 },
  overlay: { position: 'absolute', bottom: 12, right: 12 },
  counter: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.surface },
  viewer: { flex: 1, backgroundColor: sys.color.surface },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, gap: 12, paddingVertical: 8 },
  grow: { flex: 1, minWidth: 0 },
  viewerViewport: { flex: 1, width: '100%', backgroundColor: sys.color.wash },
  viewerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
});

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
  // The one way to take letters from a name (lib/inicijali, critique A4): no name, no letters, and the person is drawn.
  const letter = inicijali(initial);
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
