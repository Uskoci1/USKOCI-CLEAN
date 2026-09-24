import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Camera, Image as ImageIcon } from 'phosphor-react-native';
import type { AgreementPhotosController } from '../../hooks/useAgreementPhotos';
import { PHOTO_PERMISSION_MESSAGE } from '../../features/media/nativePhotoPicker';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { TurningCaret } from '../system/Disclosure';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';

/** Every command in the tray is a 48 px target. */
const COMMAND = 48;
/** A prepared photo is a thumbnail in a row, not a picture that fills the chat. */
const THUMB = 96;

/**
 * The photo tray behind the "+" of Poruke (round 6): the two tools first, because they are what the tray was opened
 * for, then the rule of the photos in one line, then the prepared photos as a row of thumbnails, each with its state and
 * its own remove or retry. Every call is the photos controller's own; nothing here picks, sends or deletes by itself.
 */
export function AgreementPhotoComposer({ photos, capturing }: { photos: AgreementPhotosController; capturing: boolean }) {
  const [showSaved, setShowSaved] = useState(false);
  const disabled = photos.busy || capturing;
  const tools = disabled || !photos.available;
  return <View style={s.tray}>
    <View style={s.tools}>
      <Press accessibilityRole="button" accessibilityLabel="Dodaj fotografiju iz galerije" accessibilityState={{ disabled: tools }} disabled={tools}
        onPress={() => { void photos.pick('LIBRARY'); }} haptic={tools ? 'none' : 'select'} style={s.tool}>
        <ImageIcon size={22} color={tools ? sys.color.muted : sys.color.green} />
        <T variant="action" style={tools ? s.toolOff : s.toolOn}>Galerija</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Fotografiši za poruku" accessibilityState={{ disabled: tools }} disabled={tools}
        onPress={() => { void photos.pick('CAMERA'); }} haptic={tools ? 'none' : 'select'} style={s.tool}>
        <Camera size={22} color={tools ? sys.color.muted : sys.color.green} />
        <T variant="action" style={tools ? s.toolOff : s.toolOn}>Kamera</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Proveri fotografije poruke" accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => { void photos.refresh(); }} style={s.text}>
        <T variant="meta" style={disabled ? s.toolOff : s.toolOn}>Proveri ishod</T>
      </Press>
    </View>
    <T variant="meta" tone="muted">Do 6 fotografija uz poruku · do 10 MB po slici. Fotografije su privatne za ovaj Dogovor; uklanjamo metapodatke.</T>
    {photos.message === PHOTO_PERMISSION_MESSAGE ? <PermissionRecovery compact message={photos.message} alternative="Dodaj fotografiju iz galerije" onAlternative={() => { void photos.pick('LIBRARY'); }} />
      : photos.message ? <T variant="meta" accessibilityLiveRegion="polite">{photos.message}</T> : null}
    {photos.versionConflict ? <T variant="meta" accessibilityLiveRegion="polite">Uslovi Dogovora su promenjeni. Ukloni fotografije pripremljene za raniju verziju i ponovo ih izaberi uz važeće uslove.</T> : null}
    {/* A row scrolls sideways, so it takes the height of its tallest photo and its actions: a height cap would clip the
        retry of a photo still on its way (review r6). */}
    {photos.items.length ? <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={s.row}>
      {photos.items.map((item, index) => <View key={item.ref.clientRequestId} style={s.item}>
        {item.receipt?.photo ? <AuthorizedPhoto assetId={item.receipt.photo.assetId} agreementId={photos.agreementId}
          label={`Pripremljena fotografija ${index + 1}`} contentFit="cover" style={s.thumb} />
          : <View style={s.pending}><T variant="meta" tone="muted">{item.receipt?.state === 'ABSENT' ? 'Slanje fotografije nije započeto.' : 'Ishod slanja fotografije još nije potvrđen.'}</T></View>}
        {photos.reserved(item) ? <T variant="meta" tone="muted">Fotografija je vezana za poslatu poruku. Proveri njen ishod.</T> : <>
          <Press accessibilityRole="button" accessibilityLabel={`Ukloni pripremljenu fotografiju ${index + 1}`} accessibilityState={{ disabled }} disabled={disabled}
            onPress={() => { void photos.remove(item.ref); }} style={s.text}>
            <T variant="meta" style={disabled ? s.toolOff : s.ink}>Ukloni</T>
          </Press>
          {photos.canRetry(item.ref.clientRequestId) && item.receipt?.state !== 'READY' ? <Press accessibilityRole="button"
            accessibilityLabel={`Ponovi istu fotografiju ${index + 1}`} accessibilityState={{ disabled }} disabled={disabled}
            onPress={() => { void photos.retry(item.ref); }} style={s.text}>
            <T variant="meta" style={disabled ? s.toolOff : s.toolOn}>Proveri i ponovi</T>
          </Press> : null}
        </>}
      </View>)}
    </ScrollView> : null}
    {photos.saved.length ? <>
      <Press accessibilityRole="button" accessibilityLabel="Prikaži ranije pripremljene fotografije" accessibilityState={{ disabled, expanded: showSaved }}
        disabled={disabled} onPress={() => setShowSaved(old => !old)} style={s.disclosure}>
        <T variant="meta" tone="muted" style={s.flex}>Ranije pripremljene fotografije ({photos.saved.length})</T>
        <TurningCaret open={showSaved} />
      </Press>
      {showSaved && photos.items.length >= 6 ? <T variant="meta" tone="muted">Već je izabrano 6 fotografija.</T> : null}
      {showSaved ? <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
        {photos.saved.map((item, index) => <Press key={item.clientRequestId} accessibilityRole="button"
          accessibilityLabel={`Vrati sačuvanu fotografiju ${index + 1}`} disabled={disabled || photos.items.length >= 6}
          accessibilityHint={photos.items.length >= 6 ? 'Već je izabrano 6 fotografija.' : undefined}
          accessibilityState={{ disabled: disabled || photos.items.length >= 6 }}
          onPress={() => { void photos.restore(item.clientRequestId); }} style={s.text}>
          <T variant="meta">Fotografija {index + 1} · {item.photo ? `${item.photo.width} × ${item.photo.height}` : 'obrada nije potvrđena'} · Vrati u izbor</T>
        </Press>)}
      </ScrollView> : null}
    </> : null}
  </View>;
}

const s = StyleSheet.create({
  tray: { gap: sys.space.sm },
  tools: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sys.space.sm },
  // A tool is a white capsule with the hairline, its glyph and its word: the one thing the tray was opened for.
  tool: { minHeight: COMMAND, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  toolOn: { color: sys.color.green }, toolOff: { color: sys.color.muted }, ink: { color: sys.color.ink },
  text: { minHeight: COMMAND, justifyContent: 'center', paddingHorizontal: sys.space.xs },
  row: { gap: sys.space.md },
  item: { width: THUMB + sys.space.base, gap: 2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: sys.radius.control, overflow: 'hidden' },
  // A photo still on its way is a tinted square of the same width that may grow with its sentence at a large text size.
  pending: { width: THUMB, minHeight: THUMB, borderRadius: sys.radius.control, backgroundColor: sys.color.wash, padding: sys.space.sm, justifyContent: 'center' },
  disclosure: { minHeight: COMMAND, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  flex: { flex: 1 },
});
