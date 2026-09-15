import { router, useLocalSearchParams } from 'expo-router';
import { uuid } from '../../../data/serverReceipt';
import { useSesija } from '../../../store/sesija';
import { useUloga } from '../../../store/uloga';
import { SupportDetailScreen } from '../../../ui/support/SupportDetailScreen';
import { SupportFrame, SupportNotice } from '../../../ui/support/SupportPresentation';

export default function SupportDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>(), session = useSesija(), intent = useUloga();
  if (!uuid(id) || id !== id.toLowerCase()) return <SupportFrame title="Podrška" onBack={() => router.canGoBack() ? router.back() : router.replace('/podrska')}>
    <SupportNotice error>Zahtev nije prepoznat. Otvori ga iz svoje liste podrške.</SupportNotice>
  </SupportFrame>;
  return <SupportDetailScreen key={`${session.user?.id}:${session.accountRevision}:${intent}:${id}`} caseId={id} />;
}
