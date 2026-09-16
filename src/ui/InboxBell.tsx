import { View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import { useInbox } from '../hooks/useInbox';
import { Press } from './Press';
import { sys } from './system/tokens';
import { T } from './Text';

export function InboxBell() {
  const {state} = useInbox(null);
  const count = state.error ? null : state.page?.unreadCount;
  return <Press accessibilityRole="button" haptic="select"
    accessibilityLabel={`Obaveštenja${count==null?', broj nepročitanih nije dostupan':`, ${count} nepročitanih`}`}
    onPress={() => router.push('/obavestenja')}
    style={{width:46,height:46,borderRadius:23,alignItems:'center',justifyContent:'center'}}>
    <Bell size={23} color={sys.color.ink}/>
    {count!=null && count>0 && <View style={{position:'absolute',top:2,right:2,minWidth:20,height:20,
      paddingHorizontal:5,borderRadius:sys.radius.pill,backgroundColor:sys.color.orange,alignItems:'center',justifyContent:'center'}}>
      <T variant="label" style={{color:sys.color.onOrange,lineHeight:14}}>{count>99?'99+':count}</T>
    </View>}
  </Press>;
}
