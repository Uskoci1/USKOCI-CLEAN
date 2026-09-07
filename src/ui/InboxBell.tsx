import { View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import { useInbox } from '../hooks/useInbox';
import { palette, radius } from '../theme/tokens';
import { Press } from './Press';
import { T } from './Text';

export function InboxBell() {
  const {state} = useInbox(null);
  const count = state.error ? null : state.page?.unreadCount;
  return <Press accessibilityRole="button" haptic="select"
    accessibilityLabel={`Obaveštenja${count==null?', broj nepročitanih nije dostupan':`, ${count} nepročitanih`}`}
    onPress={() => router.push('/obavestenja')}
    style={{width:48,height:48,borderRadius:radius.md,alignItems:'center',justifyContent:'center'}}>
    <Bell size={24} color={palette.ink}/>
    {count!=null && count>0 && <View style={{position:'absolute',top:0,right:0,minWidth:20,
      paddingHorizontal:4,borderRadius:radius.pill,backgroundColor:palette.orange,alignItems:'center'}}>
      <T variant="label" style={{color:palette.onOrange}}>{count>99?'99+':count}</T>
    </View>}
  </Press>;
}
