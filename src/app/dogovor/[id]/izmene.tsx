import { useLocalSearchParams } from 'expo-router';
import { AgreementActionsScreen } from '../../../ui/agreements/AgreementActionsScreen';
import { useSesija } from '../../../store/sesija';

export default function AgreementChangesRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>(), session = useSesija();
  const id = typeof params.id === 'string' ? params.id : '';
  return <AgreementActionsScreen key={`${session.user?.id ?? ''}:${session.accountRevision}:${id}`} agreementId={id} />;
}
