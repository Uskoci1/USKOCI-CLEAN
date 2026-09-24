import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { needLocationClientService } from '../../data/locationClientService';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { LocationScreen } from '../../ui/location/LocationControls';
import { StateView } from '../../ui/system/StateView';
import { SuccessMark } from '../../ui/system/SuccessMark';
import { brandAction, inset, sys } from '../../ui/system/tokens';
import { T } from '../../ui/Text';
import { V2Action as Button } from '../../ui/v2/V2Action';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';

export default function MestoZadatka() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const id = typeof params.conversationId === 'string' ? params.conversationId : '';
  const read = useCallback(() => needLocationClientService.read(id), [id]);
  const editor = useOwnedEditor(read);
  const resolver = useMemo(() => createProductionLocationResolver(), [id, editor.data?.accountId, editor.data?.revision]);
  // A direct/deep entry must return to the current complete review, never the
  // retired per-fact draft review. A real back stack is still preserved.
  const back = () => router.canGoBack() ? router.back() : router.replace({ pathname: '/pregled-zadatka', params: { conversationId: id } });
  const retry = () => { void editor.refresh(); };
  // A failed first read is the app's one error state; a failed save keeps the form and says so above it.
  const unread = !editor.data && !editor.loading && !!editor.error;
  return <LocationScreen title="Mesto zadatka" onBack={back} loading={editor.loading} error={unread ? null : editor.error} onRetry={retry}
    scroll={unread}>
    {unread ? <StateView kind="error" art="pin" title="Mesto nije učitano" body={editor.error ?? undefined}
      primary={{ label: 'Učitaj sačuvano stanje', onPress: retry }} /> : null}
    {/* Saved: one green way back, and the form under it waits grey for a new change (one green per screen). */}
    {editor.saved ? <View style={s.saved}>
      <View style={s.savedRow}><SuccessMark fresh size={32} />
        <T accessibilityRole="alert" variant="body" style={s.grow}>Lokacija je sačuvana u pregledu Zadatka.</T></View>
      <Button label="Nazad na pregled" style={brandAction} onPress={back} />
    </View> : null}
    {editor.data ? <NeedLocationForm key={editor.data.revision} layout="screen" review={editor.data} busy={editor.busy} uncertain={editor.uncertain}
      resolver={resolver}
      onSave={value => { const review = editor.data; if (!review) return;
        void editor.save(async () => { const result = await needLocationClientService.save({ conversationId: id,
          expectedRevision: review.revision, confirmed: true, value });
        return result.ok ? { ok: true, podatak: result.podatak.review } : result; });
      }} /> : null}
  </LocationScreen>;
}

const s = StyleSheet.create({
  saved: { ...inset, backgroundColor: sys.color.greenSoft, gap: sys.space.md, marginHorizontal: sys.space.lg, marginTop: sys.space.base },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  grow: { flex: 1 },
});
