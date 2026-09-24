import { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { GearSix } from 'phosphor-react-native';
import type { InboxItem, InboxRole } from '../contracts/inbox';
import { useInbox } from '../hooks/useInbox';
import { InboxList } from '../ui/notifications/InboxPresentation';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { ChromeIconButton } from '../ui/system/ScreenChrome';
import { sys } from '../ui/system/tokens';

/**
 * The inbox. The list is drawn by `InboxList` (day groups, rows on a hairline, a dot for unread); this route owns what
 * a row does: the model marks it read and resolves it, and the landing below goes exactly where the event points. The
 * route literals stay in this file: the control table (scripts/control/osvezi.mjs) checks them here.
 */
export default function Obavestenja() {
  const [role,setRole] = useState<InboxRole|null>(null);
  const {state,model} = useInbox(role);
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => { navigating.current=false; return () => { navigating.current=true; }; },[model]));
  const navigate = (action: () => void) => { if (!model.canNavigate() || navigating.current) return; navigating.current=true; action(); };
  const settings = () => navigate(() => router.push('/profil/obavestenja'));
  async function open(item: InboxItem) {
    const target = await model.open(item);
    if (!target || target.kind==='UNAVAILABLE' || !model.canNavigate()) return;
    // A question resolves to the Zadatak it belongs to, because the Need id is the only one the
    // server hands out for a CLARIFICATION. "Neko je postavio pitanje" then opened the task and left
    // the question to be found inside it. The event type says what it was about, so the landing does
    // too — for both sides, since answering and being answered are the same screen.
    const questions = item.eventType.startsWith('CLARIFICATION_');
    // A cancelled Zadatak is not a place to stand: the person who applied to it came to see what
    // happened to their own offer, so they land on it rather than on a task that no longer takes any.
    const cancelledTask = item.eventType === 'NEED_CANCELLED';
    const needTarget = (id: string, own: boolean) => questions ? {pathname:'/pitanja-zadatka' as const,params:{needId:id,own:own?'1':'0'}}
      : own ? {pathname:'/potrebe/[id]/pregled' as const,params:{id}}
      : cancelledTask ? {pathname:'/moje-prijave' as const,params:{}} : {pathname:'/prilike/[id]' as const,params:{id}};
    // Inside a Dogovor the event says which part of it the person came for. Everything else keeps the
    // overview, which is where the next step is stated.
    const agreementTarget = (id: string) => item.eventType === 'AGREEMENT_CHANGE_PROPOSED'
      ? {pathname:'/dogovor/[id]/izmene' as const,params:{id}}
      : item.eventType === 'MESSAGE_RECEIVED' ? {pathname:'/dogovor/[id]' as const,params:{id,tab:'poruke'}}
      : {pathname:'/dogovor/[id]' as const,params:{id}};
    const go = () => { switch (target.kind) {
      case 'AGREEMENT': router.push(agreementTarget(target.id)); break;
      case 'APPLICATIONS': router.push({pathname:'/moje-prijave',params:{prijavaId:target.id}}); break;
      case 'CANDIDATES': router.push({pathname:'/potrebe/[id]/kandidati',params:{id:target.id}}); break;
      case 'OWN_NEED': router.push(needTarget(target.id,true)); break;
      case 'OPPORTUNITY': router.push(needTarget(target.id,false)); break;
    } };
    // The destination is the thing the event is about, and what the person is to that thing is said
    // on its own screen (owner decision 1, 2026-09-19). There used to be a sheet here asking to
    // switch the whole app into the other mode before an item of "the other intent" could open.
    navigate(go);
  }
  // The rows are memoised, so they get one stable handler that always runs the latest `open`.
  const latestOpen = useRef(open); latestOpen.current = open;
  const onOpen = useCallback((item: InboxItem) => { void latestOpen.current(item); }, []);
  return <SafeAreaView style={styles.screen}>
    <Stack.Screen options={{headerShown:false}}/>
    <DetailTopBar title="Obaveštenja"
      onBack={()=>navigate(()=>router.canGoBack()?router.back():router.replace('/'))}
      right={<ChromeIconButton label="Podesi obaveštenja" icon={GearSix} onPress={settings} />} />
    {/* One list per filter: switching the filter draws that filter's first page as what was there, not as arrivals. */}
    <InboxList key={role ?? 'ALL'} state={state} role={role} onRole={setRole} onOpen={onOpen}
      onReadAll={()=>void model.readAll()} onRefresh={()=>void model.refresh()} onMore={()=>void model.more()} onSettings={settings} />
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:sys.color.ground},
});
