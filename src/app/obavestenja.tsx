import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Check, CaretRight, GearSix } from 'phosphor-react-native';
import { SvgXml } from 'react-native-svg';
import type { InboxItem, InboxRole } from '../contracts/inbox';
import { useInbox } from '../hooks/useInbox';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';
import { Appear, useAppear } from '../ui/system/Appear';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { sys } from '../ui/system/tokens';
import { spojInboxArt } from '../ui/v2/spojInboxArt';
import { neprocitanih } from '../ui/system/plural';
import { Segmented } from '../ui/system/Segmented';
import { vreme } from '../lib/vreme';
import { FactArt, type FactArtKind } from '../ui/system/FactArt';

const filters: {label:string;role:InboxRole|null}[] = [
  {label:'Sve',role:null},{label:'Moji zadaci',role:'REQUESTER'},{label:'Moje prijave',role:'WORKER'},
];
// One time format: the clock alone today, "22. sep · 14:05" before.
const timestamp = (value: string) => vreme(value, { danas: true });

export default function Obavestenja() {
  const [role,setRole] = useState<InboxRole|null>(null);
  const {state,model} = useInbox(role);
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => { navigating.current=false; return () => { navigating.current=true; }; },[model]));
  const busy = state.loading || state.paging || !!state.acting;
  // An event that arrives while the Inbox is open is worth a moment of motion; the ones that were
  // there when it opened, and the ones a refresh returns unchanged, are not.
  const appear = useAppear();
  appear.settle((state.page?.items ?? []).map(item => item.id));
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
  return <SafeAreaView style={styles.screen}>
    <Stack.Screen options={{headerShown:false}}/>
    <DetailTopBar eyebrow="Poruke i važne promene" title="Obaveštenja"
      onBack={()=>navigate(()=>router.canGoBack()?router.back():router.replace('/'))}
      right={<Press accessibilityRole="button" accessibilityLabel="Podesi obaveštenja" style={styles.iconButton} onPress={settings}>
        <GearSix size={22} color={sys.color.ink}/>
      </Press>} />
    <FlatList data={state.page?.items??[]} keyExtractor={item=>item.id}
      contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshing={state.loading && !!state.page} onRefresh={()=>void model.refresh()}
      ListHeaderComponent={<View style={{gap:14}}>
        {/* V41: the same underlined tabs as every other set in the app. */}
        <Segmented appearance="underline" value={role ?? 'ALL'} onChange={key => setRole(key === 'ALL' ? null : key as InboxRole)}
          options={filters.map(filter => ({ key: filter.role ?? 'ALL', label: filter.label }))} />
        {state.page && state.page.unreadCount>0 && <View style={styles.summary}>
          <T style={styles.meta} accessibilityLiveRegion="polite">{neprocitanih(state.page.unreadCount)}</T>
          {state.page.unreadCount>0 && <Press accessibilityRole="button" disabled={busy}
            accessibilityState={{disabled:busy,busy:state.acting==='all'}}
            onPress={()=>void model.readAll()} style={styles.readAll}>
            <Check size={17} color={sys.color.green}/>
            <T style={styles.filterText}>Pročitaj sve</T>
          </Press>}
        </View>}
        {state.error && <View style={styles.notice} accessibilityLiveRegion="polite">
          <T style={styles.strong}>{state.error==='action'?'Radnja nije potvrđena.':'Obaveštenja nisu osvežena.'}</T>
          <T style={styles.body}>{state.page?'Proveri vezu i pokušaj ponovo. Poslednje učitano stanje ostaje prikazano.':'Proveri vezu i pokušaj ponovo da učitaš obaveštenja.'}</T>
          <Press accessibilityRole="button" disabled={busy} style={styles.retry}
            onPress={()=>state.error==='page'?void model.more():void model.refresh()}>
            <T style={styles.filterText}>Pokušaj ponovo</T>
          </Press>
        </View>}
        {state.unavailable && <View style={styles.notice} accessibilityLiveRegion="polite">
          <T style={styles.strong}>Sadržaj više nije dostupan.</T>
          <T style={styles.body}>Možda je uklonjen ili mu više nemaš pristup.</T>
        </View>}
      </View>}
      ListEmptyComponent={state.loading || !state.page && !state.error
        ? <View accessibilityLabel="Učitavanje obaveštenja" accessibilityState={{busy:true}} style={styles.empty}>
            <ActivityIndicator color={sys.color.green}/><T style={styles.body}>Učitavamo obaveštenja…</T>
          </View>
        : state.page && !state.error ? <View style={styles.empty}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><SvgXml xml={spojInboxArt} width={180} height={128} color={sys.color.ink}/></View>
            <T style={styles.kicker}>Na jednom mestu</T>
            <T style={[styles.title,{textAlign:'center'}]}>Još nema obaveštenja</T>
            <T style={[styles.body,{textAlign:'center',maxWidth:280}]}>Nove Prijave, poruke i važne promene stižu ovde — uz Zadatak ili Dogovor na koji se odnose.</T>
            <View style={styles.emptyAction}><V2Action label="Podesi obaveštenja" kind="quiet" onPress={settings}/></View>
          </View> : null}
      renderItem={({item,index})=><Appear index={index} animate={appear.isNew(item.id)}><Press accessibilityRole="button" disabled={busy}
        accessibilityState={{disabled:busy,busy:state.acting===item.id}}
        accessibilityLabel={`${item.readAt?'Pročitano':'Nepročitano'}. ${item.title}. ${item.body}`}
        onPress={()=>void open(item)} style={[styles.item,!item.readAt && styles.unread]}>
        <View style={[styles.itemIcon,!item.readAt && {backgroundColor:sys.color.orangeSoft}]}>{state.acting===item.id?<ActivityIndicator color={sys.color.green}/>:
          <EventIcon family={item.family} eventType={item.eventType} unread={!item.readAt}/>}</View>
        <View style={{flex:1,gap:5}}>
          <T style={[styles.body,{color:sys.color.ink,fontWeight:item.readAt?'400':'700'}]}>{item.title}</T>
          <T style={styles.meta}>{item.body}</T>
          <T style={[styles.meta,{fontSize:12,marginTop:3}]}>
            {/* The tab names the family and the tint says unread (a screen reader hears "Nepročitano" in the label); the row keeps only the time. */}
            {timestamp(item.occurredAt)}
          </T>
        </View>
        <CaretRight size={17} color={sys.color.muted}/>
      </Press></Appear>}
      ListFooterComponent={state.page?.hasMore?<Press accessibilityRole="button" disabled={busy}
        onPress={()=>void model.more()} style={styles.loadMore}>
        {state.paging?<ActivityIndicator color={sys.color.green}/>:<T style={styles.filterText}>Učitaj starija obaveštenja</T>}
      </Press>:null}/>
  </SafeAreaView>;
}

/**
 * The server sends six families — opportunities, responses, dogovor, execution, recovery, account
 * (20260911183000_clean_pre_v3_inbox_delivery_visibility.sql). This map was keyed to three names it
 * never sends ('agreements', 'messages', 'needs'), so five of the six drew the generic bell and the
 * icon column said nothing. The same six names are already spelled correctly in PushPreferences.
 *
 * Two families hide more than one thing. 'dogovor' carries a new message and a received review next
 * to the Agreement itself, and 'execution' is completion — seen on a device on 2026-09-23 drawing a
 * speech bubble over "Dogovor je završen" while "Nova poruka" wore a handshake. The event type
 * decides first, the family after it.
 */
function EventIcon({family,eventType}:{family:string;eventType:string;unread:boolean}) {
  const kind: FactArtKind = eventType==='MESSAGE_RECEIVED'?'chat':eventType==='REVIEW_RECEIVED'?'star'
    :family==='opportunities'?'tasks':family==='responses'?'offers'
    :family==='dogovor'?'agreements':family==='execution'?'check':family==='recovery'?'shield':'bell';
  return <FactArt kind={kind} size={26}/>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:sys.color.ground},
  title:{...sys.type.title,color:sys.color.ink}, body:{fontSize:15,lineHeight:22.5,color:sys.color.muted},
  strong:{fontSize:15,lineHeight:22.5,fontWeight:'700',color:sys.color.ink}, meta:{...sys.type.meta,color:sys.color.muted},
  filterText:{fontSize:13,lineHeight:19,fontWeight:'600',color:sys.color.ink},
  iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:13},
  content:{paddingHorizontal:20,paddingTop:6,paddingBottom:28,gap:12,flexGrow:1,width:'100%',maxWidth:640,alignSelf:'center'},
  summary:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  readAll:{minHeight:44,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:4},
  item:{minHeight:96,flexDirection:'row',alignItems:'flex-start',gap:12,padding:16,borderRadius:18,backgroundColor:sys.color.surface,borderWidth:1,borderColor:sys.color.line},
  unread:{borderColor:sys.color.lineStrong,backgroundColor:sys.color.greenSoft},
  itemIcon:{width:38,height:38,borderRadius:12,backgroundColor:sys.color.greenSoft,alignItems:'center',justifyContent:'center'},
  notice:{backgroundColor:sys.color.orangeSoft,padding:16,borderRadius:18,gap:8},
  retry:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},
  empty:{alignItems:'center',justifyContent:'center',paddingTop:44,paddingHorizontal:12,gap:12},
  kicker:{...sys.type.meta,fontWeight:'600',color:sys.color.green,marginTop:8},
  emptyAction:{width:'100%',marginTop:24,paddingTop:12,borderTopWidth:1,borderTopColor:sys.color.line},
  loadMore:{minHeight:44,alignItems:'center',justifyContent:'center',padding:12,borderRadius:13,backgroundColor:sys.color.surface},
});
