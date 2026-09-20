import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { AgreementPhotosController } from '../../hooks/useAgreementPhotos';
import { PHOTO_PERMISSION_MESSAGE } from '../../features/media/nativePhotoPicker';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { Press } from '../Press';
import { T } from '../Text';
import { v2 } from '../v2/tokens';

export function AgreementPhotoComposer({ photos, capturing }: { photos: AgreementPhotosController; capturing: boolean }) {
  const [showSaved, setShowSaved] = useState(false);
  const disabled = photos.busy || capturing;
  return <View style={{ gap: 8 }}>
    <T variant="meta" tone="muted">Do 6 fotografija uz poruku · do 10 MB po slici. Fotografije su privatne za ovaj Dogovor; uklanjamo metapodatke.</T>
    {photos.message === PHOTO_PERMISSION_MESSAGE ? <PermissionRecovery compact message={photos.message} alternative="Dodaj fotografiju iz galerije" onAlternative={() => { void photos.pick('LIBRARY'); }} />
      : photos.message ? <T variant="meta" accessibilityLiveRegion="polite">{photos.message}</T> : null}
    {photos.versionConflict ? <T variant="meta" accessibilityLiveRegion="polite">Uslovi Dogovora su promenjeni. Ukloni fotografije pripremljene za raniju verziju i ponovo ih izaberi uz važeće uslove.</T> : null}
    {photos.items.length ? <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 8 }}>
      {photos.items.map((item, index) => <View key={item.ref.clientRequestId} style={{ gap: 4 }}>
      {item.receipt?.photo ? <AuthorizedPhoto assetId={item.receipt.photo.assetId} agreementId={photos.agreementId}
        label={`Pripremljena fotografija ${index + 1}`} style={{ width: 160, maxWidth: '100%' }} />
        : <T variant="meta">{item.receipt?.state === 'ABSENT' ? 'Slanje fotografije nije započeto.' : 'Ishod slanja fotografije još nije potvrđen.'}</T>}
      {photos.reserved(item) ? <T variant="meta" tone="muted">Fotografija je vezana za poslatu poruku. Proveri njen ishod.</T> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Press accessibilityRole="button" accessibilityLabel={`Ukloni pripremljenu fotografiju ${index + 1}`} disabled={disabled}
          onPress={() => { void photos.remove(item.ref); }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T variant="action" style={{ color: v2.color.ink }}>Ukloni</T>
        </Press>
        {photos.canRetry(item.ref.clientRequestId) && item.receipt?.state !== 'READY' ? <Press accessibilityRole="button"
          accessibilityLabel={`Ponovi istu fotografiju ${index + 1}`} disabled={disabled}
          onPress={() => { void photos.retry(item.ref); }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T variant="action" style={{ color: v2.color.ink }}>Proveri i ponovi</T>
        </Press> : null}
      </View>}
    </View>)}
    </ScrollView> : null}
    {photos.saved.length ? <>
      <Press accessibilityRole="button" accessibilityLabel="Prikaži ranije pripremljene fotografije" disabled={disabled}
        onPress={() => setShowSaved(old => !old)} style={{ minHeight: 44, justifyContent: 'center' }}>
        <T variant="action" tone="muted">Ranije pripremljene fotografije ({photos.saved.length})</T>
      </Press>
      {showSaved ? <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 160 }}>
        {photos.saved.map((item, index) => <Press key={item.clientRequestId} accessibilityRole="button"
          accessibilityLabel={`Vrati sačuvanu fotografiju ${index + 1}`} disabled={disabled || photos.items.length >= 6}
          onPress={() => { void photos.restore(item.clientRequestId); }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T>Fotografija {index + 1} · {item.photo ? `${item.photo.width} × ${item.photo.height}` : 'obrada nije potvrđena'} · Vrati u izbor</T>
        </Press>)}
      </ScrollView> : null}
    </> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      <Press accessibilityRole="button" accessibilityLabel="Dodaj fotografiju iz galerije" disabled={disabled || !photos.available}
        onPress={() => { void photos.pick('LIBRARY'); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <T variant="action" tone="muted">Galerija</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Fotografiši za poruku" disabled={disabled || !photos.available}
        onPress={() => { void photos.pick('CAMERA'); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <T variant="action" tone="muted">Kamera</T>
      </Press>
      <Press accessibilityRole="button" accessibilityLabel="Proveri fotografije poruke" disabled={disabled}
        onPress={() => { void photos.refresh(); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <T variant="action" tone="muted">Proveri ishod</T>
      </Press>
    </View>
  </View>;
}
