import { router } from 'expo-router';
import { SettingsAction, SettingsPanel, SettingsText as T } from '../settings/SettingsPresentation';
import { SupportRecovery, supportTime } from './SupportPresentation';
import type { useSupportController } from './useSupportController';

export function SupportRecoveryPanel({ model, caseId }: { model: ReturnType<typeof useSupportController>; caseId?: string }) {
  const { state, controller, current, navigate } = model;
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING';
  return <>
    {state.pending ? <>
      <SupportRecovery busy={busy} absent={state.absent}
        onRead={() => { if (current()) void controller?.load(); }}
        onCancel={() => { if (current()) void controller?.cancel(state); }} />
      {state.canReplay && state.absent ? <SettingsAction label="Ponovi isto slanje" kind="quiet" disabled={busy}
        onPress={() => { if (current()) void controller?.replay(state); }} /> : null}
    </> : null}
    {state.receipt ? <SettingsPanel soft><T variant="bodyStrong">Potvrđen zahtev #{state.receipt.caseNumber}</T>
      <T variant="meta" tone="muted">Primljeno: {supportTime(state.receipt.createdAt)}</T>
      {state.receipt.caseId !== caseId ? <SettingsAction label="Otvori potvrđeni predmet" kind="quiet" disabled={busy}
        onPress={() => navigate(() => router.push({ pathname: '/podrska/[id]', params: { id: state.receipt!.caseId } }))} /> : null}
    </SettingsPanel> : null}
  </>;
}
