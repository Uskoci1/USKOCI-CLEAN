import { useCallback, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { workerAvailabilityClientService } from '../../../data/workerAvailabilityClientService';
import { ownProfileClientService } from '../../../data/ownProfileClientService';
import { useSesija } from '../../../store/sesija';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { CalendarScreen } from '../../../ui/calendar/CalendarControls';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { StateView } from '../../../ui/system/StateView';

const back = () => router.canGoBack() ? router.back() : router.replace('/profil');
function OwnedAvailability() {
  const editor = useOwnedEditor(useCallback(() => workerAvailabilityClientService.read(), []));
  // "Dostupan sada" is the loudest thing on this screen and it can be on while the work profile is
  // still a draft, which is when nothing is offered to you at all. Two screens saying opposite
  // things about the same person. This read is for that one sentence: if it does not arrive, the
  // screen says nothing rather than guessing either way.
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const profile = useFocusedResource(useCallback(() => ownProfileClientService.read(accountId ?? '', 'uskocer'),
    [accountId, accountRevision]));
  const profileDraft = profile.data?.stanje === 'DRAFT';
  // A refresh keeps the loaded week on screen under the pull spinner instead of swapping the whole form for a
  // loading card; only the first read, with nothing yet to show, is a loading screen.
  const refreshing = editor.loading && !!editor.data;
  // Unsaved changes are asked about before they are dropped (critique A17): Back used to throw every edit away. While a
  // save runs there is nothing to ask; the editor settles the write whether the screen stays or not.
  const [dirty, setDirty] = useState(false);
  const confirm = useConfirmSheet();
  const leave = () => {
    if (dirty && !editor.busy) confirm.ask({ title: 'Odbaciti izmene?', message: 'Unete izmene neće biti sačuvane.',
      confirmLabel: 'Odbaci izmene', cancelLabel: 'Nastavi uređivanje', tone: 'danger', onConfirm: back });
    else back();
  };
  // The (app) navigator is Tabs with a history back behaviour, so a screen being removed is never announced there: the
  // hardware Back is heard directly while this screen has focus. An open sheet's own Modal takes Back before this does.
  const latest = useRef({ dirty, busy: editor.busy, leave }); latest.current = { dirty, busy: editor.busy, leave };
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!latest.current.dirty || latest.current.busy) return false;
      latest.current.leave();
      return true;
    });
    return () => subscription.remove();
  }, []));
  return <CalendarScreen title="Dostupnost za rad" back={leave} loading={editor.loading && !editor.data} scroll={false}>
    {editor.data ? <AvailabilityForm key={`${editor.data.accountId}:${editor.data.revision}`} availability={editor.data}
      profileDraft={profileDraft} busy={editor.busy} uncertain={editor.uncertain} problem={editor.error} saved={editor.saved}
      onDirtyChange={setDirty} onReconcile={() => void editor.refresh()}
      // Pull to refresh replaced a standing "Osveži dostupnost" button under the form (plan step 0, 2026-09-23); it calls
      // the same read.
      refreshing={refreshing} onRefresh={() => { if (!editor.busy) void editor.refresh(); }} onSave={value => void editor.save(async () => {
        const result = await workerAvailabilityClientService.save({ expectedRevision: editor.data!.revision, value });
        return result.ok ? { ok: true, podatak: result.podatak.availability } : result;
      })} />
      : editor.error ? <View style={{ paddingHorizontal: 20 }}>
        <StateView kind="error" art="clock" title="Dostupnost nije učitana." body={editor.error}
          primary={{ label: 'Učitaj sačuvano stanje', onPress: () => void editor.refresh(), disabled: editor.loading }} />
      </View> : null}
    {confirm.sheet}
  </CalendarScreen>;
}
/** When a person can work is theirs to set whenever they like; it used to be reachable in one mode only. */
export default function Dostupnost() {
  return <OwnedAvailability />;
}
