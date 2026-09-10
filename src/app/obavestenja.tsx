import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { ArrowLeft, Bell, Check, CaretRight, GearSix, Handshake, ChatCircle, PaperPlaneTilt, ClipboardText } from 'phosphor-react-native';
import { SvgXml } from 'react-native-svg';
import type { InboxItem, InboxRole } from '../contracts/inbox';
import { useInbox } from '../hooks/useInbox';
import { postaviUlogu } from '../store/uloga';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';
import { v2 } from '../ui/v2/tokens';
import { spojInboxArt } from '../ui/v2/spojInboxArt';

const filters: {label:string;role:InboxRole|null}[] = [
  {label:'Sve',role:null},{label:'Meni treba',role:'REQUESTER'},{label:'Ja mogu',role:'WORKER'},
];
const timestamp = (value: string) => new Date(value).toLocaleString('sr-Latn-RS',
  {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

export default function Obavestenja() {
  const [role,setRole] = useState<InboxRole|null>(null);
  const {state,model} = useInbox(role);
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => { navigating.current=false; return () => { navigating.current=true; }; },[model]));
  const busy = state.loading || state.paging || !!state.acting;
  const navigate = (action: () => void) => { if (!model.canNavigate() || navigating.current) return; navigating.current=true; action(); };
  const settings = () => navigate(() => router.push('/profil/obavestenja'));
  async function open(item: InboxItem) {
    const target = await model.open(item);
    if (!target || target.kind==='UNAVAILABLE' || !model.canNavigate()) return;
    navigate(() => { postaviUlogu(target.role==='WORKER'?'uskocer':'narucilac');
    switch (target.kind) {
      case 'AGREEMENT': router.push({pathname:'/dogovor/[id]',params:{id:target.id}}); break;
      case 'APPLICATIONS': router.push('/moje-prijave'); break;
      case 'CANDIDATES': router.push({pathname:'/potrebe/[id]/kandidati',params:{id:target.id}}); break;
      case 'OWN_NEED': router.push({pathname:'/potrebe/[id]/pregled',params:{id:target.id}}); break;
      case 'OPPORTUNITY': router.push({pathname:'/prilike/[id]',params:{id:target.id}}); break;
    } });
  }
  return <SafeAreaView style={styles.screen}>
    <Stack.Screen options={{headerShown:false}}/>
    <View style={styles.top}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" style={styles.iconButton}
        onPress={()=>navigate(()=>router.canGoBack()?router.back():router.replace('/'))}>
        <ArrowLeft size={22} color={v2.color.ink}/>
      </Press>
      <View style={{flex:1,gap:3}}><T style={styles.meta}>Poruke i važne promene</T>
        <T accessibilityRole="header" style={styles.title}>Obaveštenja</T></View>
      <Press accessibilityRole="button" accessibilityLabel="Podesi obaveštenja" style={styles.iconButton} onPress={settings}>
        <GearSix size={22} color={v2.color.ink}/>
      </Press>
    </View>
    <FlatList data={state.page?.items??[]} keyExtractor={item=>item.id}
      contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshing={state.loading && !!state.page} onRefresh={()=>void model.refresh()}
      ListHeaderComponent={<View style={{gap:14}}>
        <View style={styles.filters} accessibilityRole="tablist">
          {filters.map(filter=><Press key={filter.label} accessibilityRole="tab"
            accessibilityState={{selected:role===filter.role}} haptic="select"
            onPress={()=>setRole(filter.role)} style={[styles.filter,role===filter.role && styles.selected]}>
            <T style={[styles.filterText, {color:role===filter.role?v2.color.ink:v2.color.muted}]}>{filter.label}</T>
          </Press>)}
        </View>
        {state.page && <View style={styles.summary}>
          <T style={styles.meta} accessibilityLiveRegion="polite">
            {state.page.unreadCount>0?`${state.page.unreadCount} nepročitanih`:'Sve je pročitano'}
          </T>
          {state.page.unreadCount>0 && <Press accessibilityRole="button" disabled={busy}
            accessibilityState={{disabled:busy,busy:state.acting==='all'}}
            onPress={()=>void model.readAll()} style={styles.readAll}>
            <Check size={17} color={v2.color.teal}/>
            <T style={styles.filterText}>Pročitaj sve</T>
          </Press>}
        </View>}
        {state.error && <View style={styles.notice} accessibilityLiveRegion="polite">
          <T style={styles.strong}>{state.error==='action'?'Radnja nije potvrđena.':'Obaveštenja nisu osvežena.'}</T>
          <T style={styles.body}>{state.page?'Proverite vezu i pokušajte ponovo. Poslednje učitano stanje ostaje prikazano.':'Proverite vezu i pokušajte ponovo da učitate obaveštenja.'}</T>
          <Press accessibilityRole="button" disabled={busy} style={styles.retry}
            onPress={()=>state.error==='page'?void model.more():void model.refresh()}>
            <T style={styles.filterText}>Pokušaj ponovo</T>
          </Press>
        </View>}
        {state.unavailable && <View style={styles.notice} accessibilityLiveRegion="polite">
          <T style={styles.strong}>Sadržaj više nije dostupan.</T>
          <T style={styles.body}>Možda je uklonjen ili mu više nemate pristup.</T>
        </View>}
      </View>}
      ListEmptyComponent={state.loading || !state.page && !state.error
        ? <View accessibilityLabel="Učitavanje obaveštenja" accessibilityState={{busy:true}} style={styles.empty}>
            <ActivityIndicator color={v2.color.teal}/><T style={styles.body}>Učitavamo obaveštenja…</T>
          </View>
        : state.page && !state.error ? <View style={styles.empty}>
            <View accessible={false} importantForAccessibility="no-hide-descendants"><SvgXml xml={spojInboxArt} width={180} height={128} color={v2.color.ink}/></View>
            <T style={styles.kicker}>NA JEDNOM MESTU</T>
            <T style={[styles.title,{textAlign:'center'}]}>Još nema obaveštenja</T>
            <T style={[styles.body,{textAlign:'center',maxWidth:280}]}>Nove Prijave, poruke i važne promene stižu ovde — uz Zadatak ili Dogovor na koji se odnose.</T>
            <View style={styles.emptyAction}><V2Action label="Podesi obaveštenja" kind="quiet" onPress={settings}/></View>
          </View> : null}
      renderItem={({item})=><Press accessibilityRole="button" disabled={busy}
        accessibilityState={{disabled:busy,busy:state.acting===item.id}}
        accessibilityLabel={`${item.readAt?'Pročitano':'Nepročitano'}. ${item.title}. ${item.body}`}
        onPress={()=>void open(item)} style={[styles.item,!item.readAt && styles.unread]}>
        <View style={[styles.itemIcon,!item.readAt && {backgroundColor:v2.color.warm}]}>{state.acting===item.id?<ActivityIndicator color={v2.color.teal}/>:
          <EventIcon family={item.family} unread={!item.readAt}/>}</View>
        <View style={{flex:1,gap:5}}>
          <T style={[styles.body,{color:v2.color.ink,fontWeight:item.readAt?'400':'700'}]}>{item.title}</T>
          <T style={styles.meta}>{item.body}</T>
          <T style={[styles.meta,{fontSize:11,marginTop:3}]}>
            {item.role==='WORKER'?'Ja mogu':'Meni treba'} · {timestamp(item.occurredAt)}{!item.readAt?' · Novo':''}
          </T>
        </View>
        <CaretRight size={17} color={v2.color.muted}/>
      </Press>}
      ListFooterComponent={state.page?.hasMore?<Press accessibilityRole="button" disabled={busy}
        onPress={()=>void model.more()} style={styles.loadMore}>
        {state.paging?<ActivityIndicator color={v2.color.teal}/>:<T style={styles.filterText}>Učitaj starija obaveštenja</T>}
      </Press>:null}/>
  </SafeAreaView>;
}

function EventIcon({family,unread}:{family:string;unread:boolean}) {
  const Icon = family==='agreements'?Handshake:family==='messages'?ChatCircle:family==='responses'?PaperPlaneTilt:family==='needs'?ClipboardText:Bell;
  return <Icon size={21} color={unread?v2.color.ink:v2.color.muted}/>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:v2.color.canvas},
  top:{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:9,gap:2,backgroundColor:v2.color.header},
  title:{...v2.text.title,color:v2.color.ink}, body:{fontSize:15,lineHeight:22.5,color:v2.color.muted},
  strong:{fontSize:15,lineHeight:22.5,fontWeight:'700',color:v2.color.ink}, meta:{...v2.text.label,color:v2.color.muted},
  filterText:{fontSize:13,lineHeight:19,fontWeight:'600',color:v2.color.ink},
  iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:13},
  content:{paddingHorizontal:20,paddingTop:6,paddingBottom:28,gap:12,flexGrow:1,width:'100%',maxWidth:640,alignSelf:'center'},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:4,backgroundColor:v2.color.line,padding:4,borderRadius:14},
  filter:{flexGrow:1,minHeight:44,paddingHorizontal:12,paddingVertical:10,borderRadius:11,alignItems:'center',justifyContent:'center'},
  selected:{backgroundColor:v2.color.surface},
  summary:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  readAll:{minHeight:44,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:4},
  item:{minHeight:96,flexDirection:'row',alignItems:'flex-start',gap:12,padding:16,borderRadius:18,backgroundColor:v2.color.surface,borderWidth:1,borderColor:v2.color.line},
  unread:{borderColor:v2.color.controlLine,backgroundColor:v2.color.context},
  itemIcon:{width:38,height:38,borderRadius:12,backgroundColor:v2.color.soft,alignItems:'center',justifyContent:'center'},
  notice:{backgroundColor:v2.color.warm,padding:16,borderRadius:18,gap:8},
  retry:{minHeight:44,justifyContent:'center',alignSelf:'flex-start'},
  empty:{alignItems:'center',justifyContent:'center',paddingTop:44,paddingHorizontal:12,gap:12},
  kicker:{fontSize:10,lineHeight:15,letterSpacing:1,fontWeight:'700',color:v2.color.teal,marginTop:8},
  emptyAction:{width:'100%',marginTop:24,paddingTop:12,borderTopWidth:1,borderTopColor:v2.color.line},
  loadMore:{minHeight:44,alignItems:'center',justifyContent:'center',padding:12,borderRadius:13,backgroundColor:v2.color.surface},
});
