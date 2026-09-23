import { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { workerAvailabilityClientService } from '../../../data/workerAvailabilityClientService';
import { ownProfileClientService } from '../../../data/ownProfileClientService';
import { useSesija } from '../../../store/sesija';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { CalendarAction as Button, CalendarText as T, CalendarScreen, calendarStyles } from '../../../ui/calendar/CalendarControls';

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
  return <CalendarScreen title="Dostupnost za rad" back={back} loading={editor.loading} scroll={false}>
    {editor.error ? <View style={[calendarStyles.note, { marginHorizontal: 20, marginTop: 12 }]}><T accessibilityRole="alert" tone="danger">{editor.error}</T>
      <Button label="Učitaj sačuvano stanje" kind="secondary" disabled={editor.busy} onPress={() => void editor.refresh()} />
    </View> : null}
    {editor.saved ? <T accessibilityRole="alert" tone="success" style={{ paddingHorizontal: 20, paddingVertical: 8 }}>Dostupnost je sačuvana.</T> : null}
    {editor.data ? <AvailabilityForm key={`${editor.data.accountId}:${editor.data.revision}`} availability={editor.data}
      profileDraft={profileDraft} busy={editor.busy} uncertain={editor.uncertain} onSave={value => void editor.save(async () => {
        const result = await workerAvailabilityClientService.save({ expectedRevision: editor.data!.revision, value });
        return result.ok ? { ok: true, podatak: result.podatak.availability } : result;
      })} /> : null}
    {!editor.error ? <Button label="Osveži dostupnost" kind="quiet" disabled={editor.busy} onPress={() => void editor.refresh()} style={{ marginHorizontal: 20 }} /> : null}
  </CalendarScreen>;
}
/** When a person can work is theirs to set whenever they like; it used to be reachable in one mode only. */
export default function Dostupnost() {
  return <OwnedAvailability />;
}
