import { useLocalSearchParams } from 'expo-router';
import { useSesija } from '../../../store/sesija';

import { SupportNewScreen, supportRouteReference } from '../../../ui/support/SupportNewScreen';

export default function NewSupportRoute() {
  const params = useLocalSearchParams(), session = useSesija();
  const reference = supportRouteReference(params);
  const contextKey = reference === 'INVALID' ? 'INVALID' : reference ? `${reference.kind}:${reference.id}:${reference.revision}` : 'NONE';
  return <SupportNewScreen key={`${session.user?.id}:${session.accountRevision}:${contextKey}`} reference={reference} />;
}
