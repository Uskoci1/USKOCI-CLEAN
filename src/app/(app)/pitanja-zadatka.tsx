import {useLocalSearchParams,useRouter} from 'expo-router';
import {useSesija} from '../../store/sesija';
import {TaskQaScreen} from '../../ui/qa/TaskQaScreen';
import {uuid} from '../../data/serverReceipt';

export default function TaskQuestionsRoute() {
  const {needId}=useLocalSearchParams<{needId:string|string[]}>();
  const router=useRouter(),s=useSesija();
  return <TaskQaScreen key={`${s.user?.id}:${s.accountRevision}:${String(needId)}`}
    needId={uuid(needId)?needId:null}
    onBack={()=>router.canGoBack()?router.back():router.replace('/mapa')}/>;
}
