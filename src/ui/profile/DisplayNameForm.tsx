import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { SettingsText as T, SettingsAction } from '../settings/SettingsPresentation';
import { field } from '../system/tokens';

/**
 * The display name, one field and its one action (2026-09-24), with no card around them: the label above the field (not
 * a second title under the bar), the note on who sees the name, then the save. After an unknown outcome or a refusal the
 * one action reads the saved name instead, because nothing else can be done until that read.
 *
 * The request id belongs to the typed name: the same name retried reuses it, and any edit retires it.
 */
export function DisplayNameForm(p: { savedName: string; busy: boolean; uncertain: boolean; saved: boolean; error: string | null;
  /** A read is in flight or a write is. */ checking: boolean; check: () => void; save: (name: string, key: string) => Promise<void> }) {
  const [name, setName] = useState(p.savedName), request = useRef<{ name: string; id: string } | null>(null);
  const unchanged = name.trim() === p.savedName;
  // A grey button says why it is grey (owner rule, 2026-09-23). Busy and unconfirmed states are named by the action
  // itself; right after a save "Ime je sačuvano." already says the rest.
  const reason = p.busy || p.uncertain || (p.saved && unchanged) ? null : !name.trim() ? 'Ime ne može da ostane prazno.'
    : unchanged ? 'Ovo ime je već sačuvano.' : null;
  const reconcile = p.uncertain || !!p.error;
  return <View style={{ gap: 12 }}>
    <T variant="meta" tone="muted">Ime za prikaz</T>
    <TextInput accessibilityLabel="Ime za prikaz" autoComplete="name" textContentType="name" value={name} maxLength={200}
      editable={!p.busy && !p.uncertain} onChangeText={value => { request.current = null; setName(value); }} style={field} />
    <T variant="note" tone="muted">Ovo ime vide ljudi sa kojima dogovaraš pomoć za svoje zadatke.</T>
    {reconcile ? <SettingsAction label="Proveri sačuvane podatke" disabled={p.checking} onPress={p.check} />
      : <SettingsAction label="Sačuvaj ime" loading={p.busy} disabled={p.busy || p.uncertain || !name.trim() || unchanged} reason={reason}
        onPress={() => { const command = request.current ?? { name: name.trim(), id: noviUuidZahtevId() }; request.current = command; void p.save(command.name, command.id); }} />}
    {p.saved ? <T accessibilityLiveRegion="polite">Ime je sačuvano.</T> : null}
    {p.error ? <T accessibilityRole="alert" tone="danger">{p.error}</T> : null}
  </View>;
}
