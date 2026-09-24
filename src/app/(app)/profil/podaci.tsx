import { useCallback } from 'react';
import { router } from 'expo-router';
import { requesterProfileClientService } from '../../../data/requesterProfileClientService';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useSesija } from '../../../store/sesija';
import { SettingsScreen } from '../../../ui/settings/SettingsPresentation';
import { StateView } from '../../../ui/system/StateView';
import { DisplayNameForm } from '../../../ui/profile/DisplayNameForm';

export default function PersonalProfile() {
  const { user, accountRevision } = useSesija();
  return <OwnedPersonalProfile key={`${user?.id}:${accountRevision}`} />;
}
function OwnedPersonalProfile() {
  const read = useCallback(() => requesterProfileClientService.read(), []);
  const editor = useOwnedEditor(read);
  const check = () => { void editor.refresh(); };
  return <SettingsScreen title="Ime na profilu" onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
    {editor.data ? <DisplayNameForm key={editor.data.revision} savedName={editor.data.displayName} busy={editor.busy} uncertain={editor.uncertain}
      saved={editor.saved} error={editor.error} checking={editor.busy || editor.loading} check={check}
      save={(name, requestId) => editor.save(async () => {
        const result = await requesterProfileClientService.save({ displayName: name, clientRequestId: requestId, expectedRevision: editor.data!.revision });
        return result.ok ? { ok: true, podatak: result.podatak.identity } : result;
      })} />
      : editor.error && !editor.loading ? <StateView kind="error" title="Ime nije učitano" body={editor.error}
        primary={{ label: 'Proveri sačuvane podatke', onPress: check, disabled: editor.busy || editor.loading }} />
        : <StateView kind="loading" title="Učitavamo podatke…" skeleton={{ count: 1, rows: 1 }} />}
  </SettingsScreen>;
}
