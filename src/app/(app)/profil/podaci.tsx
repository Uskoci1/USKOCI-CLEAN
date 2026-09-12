import { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { requesterProfileClientService, type RequesterIdentity } from '../../../data/requesterProfileClientService';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { useSesija } from '../../../store/sesija';
import { SettingsText as T, SettingsScreen, SettingsPanel, SettingsAction } from '../../../ui/settings/SettingsPresentation';
import { aiFirst as a } from '../../../ui/aiFirst/tokens';

export default function PersonalProfile() {
  const { user, accountRevision } = useSesija();
  return <OwnedPersonalProfile key={`${user?.id}:${accountRevision}`} />;
}
function OwnedPersonalProfile() {
  const read = useCallback(() => requesterProfileClientService.read(), []);
  const editor = useOwnedEditor(read);
  return <SettingsScreen title="Ime na profilu" onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
    <T tone="muted">Ovo ime vide ljudi sa kojima dogovaraš pomoć kroz MENI TREBA.</T>
    {editor.loading ? <T>Učitavam podatke…</T> : null}
    {editor.error ? <T accessibilityRole="alert" tone="danger">{editor.error}</T> : null}
    {editor.data ? <IdentityForm key={editor.data.revision} value={editor.data} busy={editor.busy} uncertain={editor.uncertain}
      save={(name, requestId) => editor.save(async () => {
        const result = await requesterProfileClientService.save({ displayName: name, clientRequestId: requestId, expectedRevision: editor.data!.revision });
        return result.ok ? { ok: true, podatak: result.podatak.identity } : result;
      })} /> : null}
    {editor.saved ? <T accessibilityLiveRegion="polite">Ime je sačuvano.</T> : null}
    {editor.uncertain || editor.error ? <SettingsAction label="Proveri sačuvane podatke" disabled={editor.busy || editor.loading} onPress={() => { void editor.refresh(); }} /> : null}
  </SettingsScreen>;
}
function IdentityForm(p: { value: RequesterIdentity; busy: boolean; uncertain: boolean; save: (name: string, key: string) => Promise<void> }) {
  const [name, setName] = useState(p.value.displayName), request = useRef<{ name: string; id: string } | null>(null);
  return <SettingsPanel><View style={{ gap: 12 }}><T>Ime za prikaz</T>
    <TextInput accessibilityLabel="Ime za prikaz" autoComplete="name" textContentType="name" value={name} maxLength={200}
      editable={!p.busy && !p.uncertain} onChangeText={value => { request.current = null; setName(value); }}
      style={{ color: a.color.ink, borderColor: a.color.line, borderWidth: 1, borderRadius: 14, minHeight: 54, padding: 14, fontSize: 16 }} />
    <SettingsAction label={p.busy ? 'Čuvam ime…' : 'Sačuvaj ime'} disabled={p.busy || p.uncertain || !name.trim() || name.trim() === p.value.displayName}
      onPress={() => { const command = request.current ?? { name: name.trim(), id: noviUuidZahtevId() }; request.current = command; void p.save(command.name, command.id); }} />
  </View></SettingsPanel>;
}
