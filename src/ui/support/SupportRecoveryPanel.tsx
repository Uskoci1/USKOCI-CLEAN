import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { InlineNote } from '../privacy/InlineNote';
import { SettingsAction, SettingsText as T } from '../settings/SettingsPresentation';
import { SupportRecovery, supportTime } from './SupportPresentation';
import type { useSupportController } from './useSupportController';

/**
 * An unconfirmed send (read it, stop it, or replay the same one once the read finds it absent) and, where the screen
 * has no receipt view of its own, the receipt of a request that has just been confirmed. The logic is unchanged; the
 * unconfirmed send is a warn note, because it waits for the person, not a green panel.
 */
export function SupportRecoveryPanel({ model, caseId, receipt = true }: {
  model: ReturnType<typeof useSupportController>; caseId?: string;
  /** False where the screen draws the receipt itself (the new request). */ receipt?: boolean;
}) {
  const { state, controller, current, navigate } = model;
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING';
  return <>
    {state.pending ? <SupportRecovery busy={busy} absent={state.absent}
      onRead={() => { if (current()) void controller?.load(); }}
      onCancel={() => { if (current()) void controller?.cancel(state); }}
      onReplay={state.canReplay && state.absent ? () => { if (current()) void controller?.replay(state); } : undefined} /> : null}
    {receipt && state.receipt && state.receipt.caseId !== caseId ? <View style={s.receipt}>
      <InlineNote tone="neutral" art="check">
        <T variant="bodyStrong">{`Potvrđen zahtev #${state.receipt.caseNumber}`}</T>
        <T variant="note" tone="muted">{`Primljeno: ${supportTime(state.receipt.createdAt)}`}</T>
      </InlineNote>
      <SettingsAction label="Otvori potvrđeni predmet" kind="quiet" disabled={busy}
        onPress={() => navigate(() => router.push({ pathname: '/podrska/[id]', params: { id: state.receipt!.caseId } }))} />
    </View> : null}
  </>;
}

const s = StyleSheet.create({ receipt: { gap: 4 } });
