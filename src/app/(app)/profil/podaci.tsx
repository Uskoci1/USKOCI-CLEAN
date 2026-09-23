import { useCallback, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { requesterProfileClientService, type RequesterIdentity } from '../../../data/requesterProfileClientService';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { useSesija } from '../../../store/sesija';
import { SettingsText as T, SettingsScreen, SettingsPanel, SettingsAction } from '../../../ui/settings/SettingsPresentation';
import { sys } from '../../../ui/system/tokens';

export default function PersonalProfile() {
  const { user, accountRevision } = useSesija();
  return <OwnedPersonalProfile key={`${user?.id}:${accountRevision}`} />;
}
function OwnedPersonalProfile() {
  const read = useCallback(() => requesterProfileClientService.read(), []);
  const editor = useOwnedEditor(read);
  return <SettingsScreen title="Ime na profilu" onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
    <T tone="muted">Ovo ime vide ljudi sa kojima dogovaraš pomoć za svoje zadatke.</T>
    {editor.loading ? <T tone="muted">Učitavamo podatke…</T> : null}
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
  // A grey button says why it is grey (owner rule, 2026-09-23). Busy and unconfirmed states are
  // already named by the label and by the screen's check action, so only the two input reasons remain.
  const reason = p.busy || p.uncertain ? null : !name.trim() ? 'Ime ne može da ostane prazno.'
    : name.trim() === p.value.displayName ? 'Ovo ime je već sačuvano.' : null;
  return <SettingsPanel><View style={{ gap: 12 }}><T variant="bodyStrong">Ime za prikaz</T>
    <TextInput accessibilityLabel="Ime za prikaz" autoComplete="name" textContentType="name" value={name} maxLength={200}
      editable={!p.busy && !p.uncertain} onChangeText={value => { request.current = null; setName(value); }}
      style={{ color: sys.color.ink, borderColor: sys.color.lineStrong, borderWidth: 1, borderRadius: sys.radius.control, minHeight: 54, padding: 14, fontSize: sys.type.body.fontSize }} />
    <SettingsAction label={p.busy ? 'Čuvamo ime…' : 'Sačuvaj ime'} disabled={p.busy || p.uncertain || !name.trim() || name.trim() === p.value.displayName}
      onPress={() => { const command = request.current ?? { name: name.trim(), id: noviUuidZahtevId() }; request.current = command; void p.save(command.name, command.id); }} />
    {reason ? <T variant="note" tone="muted">{reason}</T> : null}
  </View></SettingsPanel>;
}
