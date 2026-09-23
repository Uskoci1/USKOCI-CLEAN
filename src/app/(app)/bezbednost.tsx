import { router, useLocalSearchParams } from 'expo-router';
import { uuid } from '../../data/serverReceipt';
import { useSesija } from '../../store/sesija';

import { SafetyScreen } from '../../ui/safety/SafetyScreen';
import { SettingsScreen, SettingsText as T } from '../../ui/settings/SettingsPresentation';

export default function SafetyRoute() {
  const p = useLocalSearchParams<{ targetAccountId?: string; needId?: string; agreementId?: string }>();
  const { user, accountRevision } = useSesija();
  if (!uuid(p.targetAccountId) || p.targetAccountId === user?.id || (p.needId !== undefined && !uuid(p.needId)) ||
      (p.agreementId !== undefined && !uuid(p.agreementId))) return <SettingsScreen title="Bezbednost"
        onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
        {/* Reached with no usable target (a stale link, a hand-typed route): say what opens it and where. */}
        <T tone="muted">Prijavu ili blokiranje pokrećeš sa javnog profila osobe, iz Zadatka ili iz Dogovora.</T></SettingsScreen>;
  return <SafetyScreen key={`${user?.id}:${accountRevision}:${p.targetAccountId}:${p.needId ?? ''}:${p.agreementId ?? ''}`}
    targetAccountId={p.targetAccountId} needId={p.needId ?? null} agreementId={p.agreementId ?? null} />;
}
