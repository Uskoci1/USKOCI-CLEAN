import { useCallback } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { workerAvailabilityClientService } from '../../../data/workerAvailabilityClientService';
import { useUloga } from '../../../store/uloga';
import { Button } from '../../../ui/Button';
import { T } from '../../../ui/Text';
import { AvailabilityForm } from '../../../ui/calendar/AvailabilityForm';
import { CalendarScreen, calendarStyles } from '../../../ui/calendar/CalendarControls';

const back = () => router.canGoBack() ? router.back() : router.replace('/profil');
function OwnedAvailability() {
  const editor = useOwnedEditor(useCallback(() => workerAvailabilityClientService.read(), []));
  return <CalendarScreen title="Redovna dostupnost" back={back} loading={editor.loading}>
    {editor.error ? <View style={calendarStyles.note}><T accessibilityRole="alert" tone="danger">{editor.error}</T>
      <Button label="Učitaj sačuvano stanje" kind="secondary" disabled={editor.busy} onPress={() => void editor.refresh()} />
    </View> : null}
    {editor.saved ? <T accessibilityRole="alert" tone="success">Dostupnost je sačuvana.</T> : null}
    {editor.data ? <AvailabilityForm key={`${editor.data.accountId}:${editor.data.revision}`} availability={editor.data}
      busy={editor.busy} uncertain={editor.uncertain} onSave={value => void editor.save(async () => {
        const result = await workerAvailabilityClientService.save({ expectedRevision: editor.data!.revision, value });
        return result.ok ? { ok: true, podatak: result.podatak.availability } : result;
      })} /> : null}
    {!editor.error ? <Button label="Osveži dostupnost" kind="quiet" disabled={editor.busy} onPress={() => void editor.refresh()} /> : null}
  </CalendarScreen>;
}
export default function Dostupnost() {
  const worker = useUloga() === 'uskocer';
  if (!worker) return <CalendarScreen title="Dostupnost za rad" back={back}>
    <T>Dostupnost se uređuje u nameri „Ja mogu“.</T><Button label="Otvori Profil" onPress={() => router.replace('/profil')} />
  </CalendarScreen>;
  return <OwnedAvailability />;
}
