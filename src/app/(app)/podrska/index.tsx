import { useSesija } from '../../../store/sesija';
import { useUloga } from '../../../store/uloga';
import { SupportInboxScreen } from '../../../ui/support/SupportInboxScreen';

export default function SupportRoute() {
  const session = useSesija(), intent = useUloga();
  return <SupportInboxScreen key={`${session.user?.id}:${session.accountRevision}:${intent}`} />;
}
