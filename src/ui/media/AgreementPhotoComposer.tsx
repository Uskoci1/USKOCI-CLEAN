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
/** The one reason a saved photo cannot come back and the tools cannot take another: the row is full. */
const SIX = 'Već je izabrano 6 fotografija.';

/**
 * The photo tray behind the "+" of Poruke (round 6): the two tools first, because they are what the tray was opened
 * for, then the privacy/size rule and selected photos. Ready photos share a compact strip; pending/reserved/retry
 * explanations get full reading width with their exact remove or retry. Every call is the photos controller's own;
 * nothing here picks, sends or deletes by itself.
 * Every command is spoken by its visible words first, so a person who says what they see is understood.
 */
export function AgreementPhotoComposer({ photos, capturing }: { photos: AgreementPhotosController; capturing: boolean }) {
  const [showSaved, setShowSaved] = useState(false);
  const disabled = photos.busy || capturing;
  const tools = disabled || !photos.available;
  // Why the two tools are grey when the tray itself is not busy, in the order the controller withholds them: a photo
  // still on its way, a full row, or a Dogovor that no longer takes a photo. A read that failed explains itself in its
  // own message, so it gets no second line here (review r6: the tools went grey with no reason while a photo pended).
  const pending = photos.items.some(item => !item.receipt || !['READY', 'CANCELLED', 'FAILED'].includes(item.receipt.state));
  const why = !tools || disabled ? null : pending ? 'Prvo sačekaj ishod fotografije koja se šalje.' : photos.items.length >= 6 ? SIX
    : photos.loaded ? 'Osveži uslove Dogovora pre nove fotografije.' : null;
  // Ready thumbnails can share a strip. A recovery sentence cannot fit inside a 96 dp picture, especially with
  // enlarged text: give the selected set full-width rows until every explanation can retire. The order and the
  // controller's reserved/retry decisions stay exactly the same.
  const preparedItems = photos.items.map(item => {
    const reserved = photos.reserved(item);
    return { item, reserved, retry: !reserved && photos.canRetry(item.ref.clientRequestId) && item.receipt?.state !== 'READY' };
  });
  const roomy = preparedItems.some(({ item, reserved, retry }) => !item.receipt?.photo || reserved || retry);
  const prepared = preparedItems.map(({ item, reserved, retry }, index) => <View key={item.ref.clientRequestId}
    testID={`agreement-photo-item-${index + 1}`} style={roomy ? s.recoveryItem : s.item}>
    {roomy ? <View style={s.recoveryHeading}>
      {item.receipt?.photo ? <AuthorizedPhoto assetId={item.receipt.photo.assetId} agreementId={photos.agreementId}
        label={`Pripremljena fotografija ${index + 1}`} contentFit="cover" style={s.recoveryThumb} />
        : <View style={s.recoveryArt}><ImageIcon size={24} color={sys.color.muted} /></View>}
      <T variant="bodyStrong" style={s.flex}>{`Fotografija ${index + 1}`}</T>
    </View> : item.receipt?.photo ? <AuthorizedPhoto assetId={item.receipt.photo.assetId} agreementId={photos.agreementId}
      label={`Pripremljena fotografija ${index + 1}`} contentFit="cover" style={s.thumb} /> : null}
    {!item.receipt?.photo ? <T variant="meta" tone="muted">{item.receipt?.state === 'ABSENT'
      ? 'Slanje fotografije nije započeto.' : 'Ishod slanja fotografije još nije potvrđen.'}</T> : null}
    {reserved ? <T variant="meta" tone="muted">Fotografija je vezana za poslatu poruku. Proveri njen ishod.</T> : <View style={roomy ? s.recoveryActions : undefined}>
      <Press accessibilityRole="button" accessibilityLabel={`Ukloni pripremljenu fotografiju ${index + 1}`} accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => { void photos.remove(item.ref); }} style={s.text}>
        <T variant="meta" style={disabled ? s.toolOff : s.toolOn}>Ukloni</T>
      </Press>
      {retry ? <Press accessibilityRole="button" accessibilityLabel={`Proveri i ponovi fotografiju ${index + 1}`}
        accessibilityState={{ disabled }} disabled={disabled} onPress={() => { void photos.retry(item.ref); }} style={s.text}>
        <T variant="meta" style={disabled ? s.toolOff : s.toolOn}>Proveri i ponovi</T>
      </Press> : null}
    </View>}
  </View>);
  return <View style={s.tray}>
    <View style={s.tools}>
      <Press accessibilityRole="button" accessibilityLabel="Galerija · dodaj fotografiju" accessibilityHint={why ?? undefined}
        accessibilityState={{ disabled: tools }} disabled={tools}
        onPress={() => { void photos.pick('LIBRARY'); }} haptic={tools ? 'none' : 'select'} style={s.tool}>
        <ImageIcon size={22} color={tools ? sys.color.muted : sys.color.green} />
        <T variant="action" style={tools ? s.toolOff : s.toolOn}>Galerija</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Kamera · fotografiši za poruku" accessibilityHint={why ?? undefined}
        accessibilityState={{ disabled: tools }} disabled={tools}
        onPress={() => { void photos.pick('CAMERA'); }} haptic={tools ? 'none' : 'select'} style={s.tool}>
        <Camera size={22} color={tools ? sys.color.muted : sys.color.green} />
        <T variant="action" style={tools ? s.toolOff : s.toolOn}>Kamera</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Osveži fotografije poruke" accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => { void photos.refresh(); }} style={s.text}>
        <T variant="meta" style={disabled ? s.toolOff : s.toolOn}>Osveži fotografije</T>
      </Press>
    </View>
    {/* The reason is the tools' spoken hint already; drawn for the eye, it is not read a second time. */}
    {why ? <T variant="meta" tone="muted" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{why}</T> : null}
    <T variant="meta" tone="muted">Do 6 fotografija uz poruku · do 10 MB po slici. Fotografije su privatne za ovaj Dogovor; uklanjamo metapodatke.</T>
    {photos.message === PHOTO_PERMISSION_MESSAGE ? <PermissionRecovery compact message={photos.message} alternative="Dodaj fotografiju iz galerije" onAlternative={() => { void photos.pick('LIBRARY'); }} />
      : photos.message ? <T variant="meta" accessibilityLiveRegion="polite">{photos.message}</T> : null}
    {photos.versionConflict ? <T variant="meta" accessibilityLiveRegion="polite">Uslovi Dogovora su promenjeni. Ukloni fotografije pripremljene za raniju verziju i ponovo ih izaberi uz važeće uslove.</T> : null}
    {photos.items.length ? roomy ? <View testID="agreement-photo-recovery-list" style={s.recoveryList}>{prepared}</View>
      : <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={s.row}>{prepared}</ScrollView> : null}
    {photos.saved.length ? <>
      <Press accessibilityRole="button" accessibilityLabel="Prikaži ranije pripremljene fotografije" accessibilityState={{ disabled, expanded: showSaved }}
        disabled={disabled} onPress={() => setShowSaved(old => !old)} style={s.disclosure}>
        <T variant="meta" tone="muted" style={s.flex}>Ranije pripremljene fotografije ({photos.saved.length})</T>
        <TurningCaret open={showSaved} />
      </Press>
      {/* Said once: when the line under the tools already says the row is full, the saved list does not repeat it. */}
      {showSaved && photos.items.length >= 6 && why !== SIX ? <T variant="meta" tone="muted">{SIX}</T> : null}
      {showSaved ? <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
        {photos.saved.map((item, index) => <Press key={item.clientRequestId} accessibilityRole="button"
          accessibilityLabel={`Vrati sačuvanu fotografiju ${index + 1}`} disabled={disabled || photos.items.length >= 6}
          accessibilityHint={photos.items.length >= 6 ? SIX : undefined}
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
  toolOn: { color: sys.color.green }, toolOff: { color: sys.color.muted },
  text: { minHeight: COMMAND, justifyContent: 'center', paddingHorizontal: sys.space.xs },
  row: { gap: sys.space.md },
  item: { width: THUMB + sys.space.base, gap: 2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: sys.radius.control, overflow: 'hidden' },
  recoveryList: { gap: sys.space.base },
  recoveryItem: { alignSelf: 'stretch', gap: sys.space.sm, paddingTop: sys.space.base, borderTopWidth: 1, borderColor: sys.color.line },
  recoveryHeading: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  recoveryArt: { width: 48, height: 48, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.lineStrong,
    alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  recoveryThumb: { width: 64, height: 64, borderRadius: sys.radius.control, overflow: 'hidden' },
  recoveryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.base },
  disclosure: { minHeight: COMMAND, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  flex: { flex: 1 },
});
