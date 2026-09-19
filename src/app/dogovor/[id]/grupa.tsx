import { useLocalSearchParams } from 'expo-router';
import { GroupConversationScreen } from '../../../ui/groups/GroupConversationScreen';
import { useSesija } from '../../../store/sesija';

export default function GroupConversationRoute(){
 const params=useLocalSearchParams<{id?:string|string[]}>(),session=useSesija();
 const id=typeof params.id==='string'?params.id:'';
 return <GroupConversationScreen key={`${session.user?.id??''}:${session.accountRevision}:${id}`} agreementId={id}/>;
}
