import {useLocalSearchParams,useRouter} from 'expo-router';
import {useSesija} from '../../store/sesija';
import {TaskQaScreen} from '../../ui/qa/TaskQaScreen';
import {uuid} from '../../data/serverReceipt';

export default function TaskQuestionsRoute() {
  const {needId}=useLocalSearchParams<{needId:string|string[]}>();
  const router=useRouter(),s=useSesija();
  return <TaskQaScreen key={`${s.user?.id}:${s.accountRevision}:${String(needId)}`}
    needId={uuid(needId)?needId:null}
    // Questions belong to one task; leaving them used to land on the map. With no stack to go back
    // to, the task they are about is the place to be.
    onBack={()=>router.canGoBack()?router.back()
      :uuid(needId)?router.replace({pathname:'/prilike/[id]',params:{id:String(needId)}}):router.replace('/prilike')}/>;
}
