import { router, useLocalSearchParams } from 'expo-router';
import { uuid } from '../../data/serverReceipt';
import { useSesija } from '../../store/sesija';

import { SafetyScreen } from '../../ui/safety/SafetyScreen';
import { SettingsScreen } from '../../ui/settings/SettingsPresentation';
import { StateView } from '../../ui/system/StateView';

export default function SafetyRoute() {
  const p = useLocalSearchParams<{ targetAccountId?: string; needId?: string; agreementId?: string }>();
  const { user, accountRevision } = useSesija();
  // Your own account is a person, just not one this screen acts on: "Nije izabrana osoba" was not what happened there.
  const own = !!user?.id && p.targetAccountId === user.id;
  if (!uuid(p.targetAccountId) || own || (p.needId !== undefined && !uuid(p.needId)) ||
      (p.agreementId !== undefined && !uuid(p.agreementId))) return <SettingsScreen title="Bezbednost"
        onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
        {/* Reached with no usable target (a stale link, a hand-typed route, your own account): say what opens it and
            where, and offer the one place on this side of the app where the people you block are. */}
        <StateView kind="empty" art="shield" title={own ? 'Ovo je tvoj nalog' : 'Nije izabrana osoba'}
          body={own ? 'Prijava i blokiranje su za druge osobe. Pokrećeš ih sa javnog profila osobe, iz Zadatka ili iz Dogovora.'
            : 'Prijavu ili blokiranje pokrećeš sa javnog profila osobe, iz Zadatka ili iz Dogovora.'}
          quiet={{ label: 'Blokirani korisnici', onPress: () => router.replace('/profil/blokirani') }} />
      </SettingsScreen>;
  return <SafetyScreen key={`${user?.id}:${accountRevision}:${p.targetAccountId}:${p.needId ?? ''}:${p.agreementId ?? ''}`}
    targetAccountId={p.targetAccountId} needId={p.needId ?? null} agreementId={p.agreementId ?? null} />;
}
