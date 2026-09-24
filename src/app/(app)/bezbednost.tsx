import { router, useLocalSearchParams } from 'expo-router';
import { uuid } from '../../data/serverReceipt';
import { useSesija } from '../../store/sesija';

import { SafetyScreen } from '../../ui/safety/SafetyScreen';
import { SettingsScreen } from '../../ui/settings/SettingsPresentation';
import { StateView } from '../../ui/system/StateView';

export default function SafetyRoute() {
  const p = useLocalSearchParams<{ targetAccountId?: string; needId?: string; agreementId?: string }>();
  const { user, accountRevision } = useSesija();
  if (!uuid(p.targetAccountId) || p.targetAccountId === user?.id || (p.needId !== undefined && !uuid(p.needId)) ||
      (p.agreementId !== undefined && !uuid(p.agreementId))) return <SettingsScreen title="Bezbednost"
        onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
        {/* Reached with no usable target (a stale link, a hand-typed route): say what opens it and where, and offer the
            one place on this side of the app where the people you block are. */}
        <StateView kind="empty" art="shield" title="Nije izabrana osoba"
          body="Prijavu ili blokiranje pokrećeš sa javnog profila osobe, iz Zadatka ili iz Dogovora."
          quiet={{ label: 'Blokirani korisnici', onPress: () => router.replace('/profil/blokirani') }} />
      </SettingsScreen>;
  return <SafetyScreen key={`${user?.id}:${accountRevision}:${p.targetAccountId}:${p.needId ?? ''}:${p.agreementId ?? ''}`}
    targetAccountId={p.targetAccountId} needId={p.needId ?? null} agreementId={p.agreementId ?? null} />;
}
