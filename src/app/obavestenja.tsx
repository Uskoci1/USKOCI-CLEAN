import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Bell, Check, CaretRight } from 'phosphor-react-native';
import type { InboxItem, InboxRole } from '../contracts/inbox';
import { useInbox } from '../hooks/useInbox';
import { postaviUlogu } from '../store/uloga';
import { palette, radius, space } from '../theme/tokens';
import { Press } from '../ui/Press';
import { T } from '../ui/Text';

const filters: {label:string;role:InboxRole|null}[] = [
  {label:'Sve',role:null},{label:'Meni treba',role:'REQUESTER'},{label:'Ja mogu',role:'WORKER'},
];
const timestamp = (value: string) => new Date(value).toLocaleString('sr-Latn-RS',
  {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

export default function Obavestenja() {
  const [role,setRole] = useState<InboxRole|null>(null);
  const {state,model} = useInbox(role);
  const busy = state.loading || state.paging || !!state.acting;
  async function open(item: InboxItem) {
    const target = await model.open(item);
    if (!target || target.kind==='UNAVAILABLE') return;
    postaviUlogu(target.role==='WORKER'?'uskocer':'narucilac');
    switch (target.kind) {
      case 'AGREEMENT': router.push({pathname:'/dogovor/[id]',params:{id:target.id}}); break;
      case 'APPLICATIONS': router.push('/moje-prijave'); break;
      case 'CANDIDATES': router.push({pathname:'/potrebe/[id]/kandidati',params:{id:target.id}}); break;
      case 'OWN_NEED': router.push({pathname:'/potrebe/[id]/pregled',params:{id:target.id}}); break;
      case 'OPPORTUNITY': router.push({pathname:'/prilike/[id]',params:{id:target.id}}); break;
    }
  }
  return <SafeAreaView style={styles.screen}>
    <Stack.Screen options={{headerShown:false}}/>
    <View style={styles.top}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" style={styles.iconButton}
        onPress={()=>router.canGoBack()?router.back():router.replace('/')}>
        <ArrowLeft size={24} color={palette.ink}/>
      </Press>
      <T variant="heading" style={{flex:1}}>Obaveštenja</T>
      <Bell size={24} color={palette.ink}/>
    </View>
    <FlatList data={state.page?.items??[]} keyExtractor={item=>item.id}
      contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      refreshing={state.loading && !!state.page} onRefresh={()=>void model.refresh()}
      ListHeaderComponent={<View style={{gap:space.base}}>
        <View style={{gap:space.sm}}>
          <T variant="display">Sve važno, na jednom mestu.</T>
          <T tone="muted">Prijave, zadaci i Dogovori — pratite šta se dešava.</T>
        </View>
        <View style={styles.filters} accessibilityRole="tablist">
          {filters.map(filter=><Press key={filter.label} accessibilityRole="tab"
            accessibilityState={{selected:role===filter.role}} haptic="select"
            onPress={()=>setRole(filter.role)} style={[styles.filter,role===filter.role && styles.selected]}>
            <T variant="action" style={{color:role===filter.role?palette.onDark:palette.ink}}>{filter.label}</T>
          </Press>)}
        </View>
        {state.page && <View style={styles.summary}>
          <T variant="meta" tone="muted" accessibilityLiveRegion="polite">
            {state.page.unreadCount>0?`${state.page.unreadCount} nepročitanih`:'Sve je pročitano'}
          </T>
          {state.page.unreadCount>0 && <Press accessibilityRole="button" disabled={busy}
            accessibilityState={{disabled:busy,busy:state.acting==='all'}}
            onPress={()=>void model.readAll()} style={styles.readAll}>
            <Check size={18} color={palette.orangeInk}/>
            <T variant="action" tone="orange">Pročitaj sve</T>
          </Press>}
        </View>}
        {state.error && <View style={styles.notice} accessibilityLiveRegion="polite">
          <T variant="bodyStrong">{state.error==='action'?'Radnja nije završena.':'Obaveštenja nisu osvežena.'}</T>
          <T tone="muted">Proverite vezu i pokušajte ponovo. Sačuvano stanje nije izgubljeno.</T>
          <Press accessibilityRole="button" disabled={busy} style={styles.retry}
            onPress={()=>state.error==='page'?void model.more():void model.refresh()}>
            <T variant="action" tone="orange">Pokušaj ponovo</T>
          </Press>
        </View>}
        {state.unavailable && <View style={styles.notice} accessibilityLiveRegion="polite">
          <T variant="bodyStrong">Sadržaj više nije dostupan.</T>
          <T tone="muted">Možda je uklonjen ili mu više nemate pristup.</T>
        </View>}
      </View>}
      ListEmptyComponent={state.loading || !state.page && !state.error
        ? <View accessibilityLabel="Učitavanje obaveštenja" accessibilityState={{busy:true}} style={styles.empty}>
            <ActivityIndicator color={palette.forest800}/><T tone="muted">Učitavamo obaveštenja…</T>
          </View>
        : state.page && !state.error ? <View style={styles.empty}>
            <View style={styles.emptyIcon}><Bell size={32} color={palette.orangeInk}/></View>
            <T variant="title">Još nema obaveštenja</T>
            <T tone="muted" style={{textAlign:'center'}}>Kada se nešto novo desi sa vašim zadacima, prijavama ili Dogovorima, videćete to ovde.</T>
          </View> : null}
      renderItem={({item})=><Press accessibilityRole="button" disabled={busy}
        accessibilityState={{disabled:busy,busy:state.acting===item.id}}
        accessibilityLabel={`${item.readAt?'Pročitano':'Nepročitano'}. ${item.title}. ${item.body}`}
        onPress={()=>void open(item)} style={[styles.item,!item.readAt && styles.unread]}>
        <View style={styles.itemIcon}>{state.acting===item.id?<ActivityIndicator color={palette.orangeInk}/>:
          <Bell size={22} weight={item.readAt?'regular':'fill'} color={item.readAt?palette.inkMuted:palette.orangeInk}/>}</View>
        <View style={{flex:1,gap:space.xs}}>
          <T variant={item.readAt?'body':'bodyStrong'}>{item.title}</T>
          <T variant="meta" tone="muted">{item.body}</T>
          <T variant="label" tone="muted" style={{marginTop:space.sm,letterSpacing:0}}>
            {item.role==='WORKER'?'Ja mogu':'Meni treba'} · {timestamp(item.occurredAt)}{!item.readAt?' · Novo':''}
          </T>
        </View>
        <CaretRight size={18} color={palette.inkMuted}/>
      </Press>}
      ListFooterComponent={state.page?.hasMore?<Press accessibilityRole="button" disabled={busy}
        onPress={()=>void model.more()} style={styles.loadMore}>
        {state.paging?<ActivityIndicator color={palette.ink}/>:<T variant="action">Učitaj starija obaveštenja</T>}
      </Press>:null}/>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:palette.ground},
  top:{flexDirection:'row',alignItems:'center',paddingHorizontal:space.base,gap:space.sm},
  iconButton:{width:48,height:48,alignItems:'center',justifyContent:'center',borderRadius:radius.md},
  content:{padding:space.base,paddingBottom:space.xxl,gap:space.md,flexGrow:1},
  filters:{flexDirection:'row',flexWrap:'wrap',gap:space.sm},
  filter:{minHeight:48,paddingHorizontal:space.base,paddingVertical:space.md,borderRadius:radius.pill,backgroundColor:palette.surface,justifyContent:'center'},
  selected:{backgroundColor:palette.forest800},
  summary:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:space.sm},
  readAll:{minHeight:48,flexDirection:'row',alignItems:'center',gap:space.xs,paddingHorizontal:space.sm},
  item:{minHeight:96,flexDirection:'row',alignItems:'center',gap:space.md,padding:space.base,borderRadius:radius.xl,backgroundColor:palette.surface},
  unread:{backgroundColor:palette.raised,borderLeftWidth:3,borderLeftColor:palette.orange},
  itemIcon:{width:40,height:40,borderRadius:radius.md,backgroundColor:palette.orangeSoft,alignItems:'center',justifyContent:'center'},
  notice:{backgroundColor:palette.warnBg,padding:space.base,borderRadius:radius.lg,gap:space.sm},
  retry:{minHeight:48,justifyContent:'center',alignSelf:'flex-start'},
  empty:{alignItems:'center',justifyContent:'center',paddingVertical:space.huge,paddingHorizontal:space.base,gap:space.base},
  emptyIcon:{width:72,height:72,borderRadius:radius.xl,backgroundColor:palette.orangeSoft,alignItems:'center',justifyContent:'center'},
  loadMore:{minHeight:48,alignItems:'center',justifyContent:'center',padding:space.base,borderRadius:radius.lg,backgroundColor:palette.surface},
});
