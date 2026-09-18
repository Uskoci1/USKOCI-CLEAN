import {useLocalSearchParams,useRouter} from 'expo-router';
import {useSesija} from '../../store/sesija';
import {useUloga} from '../../store/uloga';
import {TaskQaScreen} from '../../ui/qa/TaskQaScreen';
import {uuid} from '../../data/serverReceipt';

export default function TaskQuestionsRoute() {
  const {needId}=useLocalSearchParams<{needId:string|string[]}>();
  const router=useRouter(),s=useSesija(),intent=useUloga();
  const own=intent==='narucilac';
  return <TaskQaScreen key={`${s.user?.id}:${s.accountRevision}:${String(needId)}`}
    needId={uuid(needId)?needId:null}
    // Questions belong to one task; leaving them used to land on the map. With no stack to go back
    // to — a notification opened from a cold start — the task they are about is the place to be, and
    // which screen that is depends on whose task it is.
    onBack={()=>router.canGoBack()?router.back()
      :uuid(needId)?router.replace(own?{pathname:'/potrebe/[id]/pregled',params:{id:String(needId)}}
        :{pathname:'/prilike/[id]',params:{id:String(needId)}})
      :router.replace(own?'/potrebe':'/prilike')}/>;
}
