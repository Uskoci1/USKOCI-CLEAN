import { useLocalSearchParams } from 'expo-router';
import { useSesija } from '../../../store/sesija';
import { useUloga } from '../../../store/uloga';
import { SupportNewScreen, supportRouteReference } from '../../../ui/support/SupportNewScreen';

export default function NewSupportRoute() {
  const params = useLocalSearchParams(), session = useSesija(), intent = useUloga();
  const reference = supportRouteReference(params);
  const contextKey = reference === 'INVALID' ? 'INVALID' : reference ? `${reference.kind}:${reference.id}:${reference.revision}` : 'NONE';
  return <SupportNewScreen key={`${session.user?.id}:${session.accountRevision}:${intent}:${contextKey}`} reference={reference} />;
}
