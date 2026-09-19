import { useLocalSearchParams } from 'expo-router';
import { AgreementLocationScreen } from '../../../ui/agreements/AgreementLocationScreen';
import { useSesija } from '../../../store/sesija';

export default function AgreementLocationRoute(){
  const p=useLocalSearchParams<{id?:string|string[]}>(),s=useSesija(),id=typeof p.id==='string'?p.id:'';
  return <AgreementLocationScreen key={`${s.user?.id??''}:${s.accountRevision}:${id}`} agreementId={id}/>;
}
