import { useLocalSearchParams } from 'expo-router';
import { GroupConversationScreen } from '../../../ui/groups/GroupConversationScreen';
import { useSesija } from '../../../store/sesija';
import { useUloga } from '../../../store/uloga';
export default function GroupConversationRoute(){
 const params=useLocalSearchParams<{id?:string|string[]}>(),session=useSesija(),intent=useUloga();
 const id=typeof params.id==='string'?params.id:'';
 return <GroupConversationScreen key={`${session.user?.id??''}:${session.accountRevision}:${intent}:${id}`} agreementId={id}/>;
}
