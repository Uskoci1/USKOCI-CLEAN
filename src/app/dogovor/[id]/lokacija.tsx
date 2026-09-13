import { useLocalSearchParams } from 'expo-router';
import { AgreementLocationScreen } from '../../../ui/agreements/AgreementLocationScreen';
import { useSesija } from '../../../store/sesija';
import { useUloga } from '../../../store/uloga';
export default function AgreementLocationRoute(){
  const p=useLocalSearchParams<{id?:string|string[]}>(),s=useSesija(),intent=useUloga(),id=typeof p.id==='string'?p.id:'';
  return <AgreementLocationScreen key={`${s.user?.id??''}:${s.accountRevision}:${intent}:${id}`} agreementId={id}/>;
}
