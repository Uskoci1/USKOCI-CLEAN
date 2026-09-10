import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { needLocationClientService } from '../../data/locationClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { LocationScreen } from '../../ui/location/LocationControls';
import { T } from '../../ui/Text';
import { Button } from '../../ui/Button';

export default function MestoZadatka() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const id = typeof params.conversationId === 'string' ? params.conversationId : '';
  const read = useCallback(() => needLocationClientService.read(id), [id]);
  const editor = useOwnedEditor(read);
  const back = () => router.canGoBack() ? router.back() : router.replace({ pathname: '/pregled-nacrta', params: { conversationId: id } });
  return <LocationScreen title="Mesto Zadatka" onBack={back} loading={editor.loading} error={editor.error} onRetry={() => { void editor.refresh(); }}>
    {editor.saved ? <>
      <T accessibilityRole="alert" tone="success">Lokacija je sačuvana u pregledu Zadatka.</T>
      <Button label="Vrati se na pregled" onPress={back} />
    </> : null}
    {editor.data ? <NeedLocationForm key={editor.data.revision} review={editor.data} busy={editor.busy} uncertain={editor.uncertain}
      onSave={value => { const review = editor.data; if (!review) return;
        void editor.save(async () => { const result = await needLocationClientService.save({ conversationId: id,
          expectedRevision: review.revision, confirmed: true, value });
        return result.ok ? { ok: true, podatak: result.podatak.review } : result; });
      }} /> : null}
  </LocationScreen>;
}
