import { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { PushPreferences } from '../../../ui/notifications/PushPreferences';
import { useUloga, ulogaSada } from '../../../store/uloga';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { Press } from '../../../ui/Press';
import { T } from '../../../ui/Text';
import { V2Icon } from '../../../ui/v2/icons';
import { v2 } from '../../../ui/v2/tokens';
export default function PushSettings() {
 const intent = useUloga(), { user, accountRevision } = useSesija(); const accountId = user?.id;
 const role = intent === 'narucilac' ? 'REQUESTER' : 'WORKER';
 const owner = useRef<{ accountId: string; revision: number; intent: typeof intent } | null>(null);
 useFocusEffect(useCallback(() => {
  const scope = accountId ? { accountId, revision: accountRevision, intent } : null; owner.current = scope;
  return () => { if (owner.current === scope) owner.current = null; };
 }, [accountId, accountRevision, intent]));
 function back() {
  const scope = owner.current;
  if (!scope || scope.accountId !== accountId || scope.revision !== accountRevision || scope.intent !== intent
   || sesijaSada().user?.id !== scope.accountId || sesijaSada().accountRevision !== scope.revision || ulogaSada() !== scope.intent) return;
  if (router.canGoBack()) router.back(); else router.replace('/profil');
 }
 return <SafeAreaView style={s.screen} edges={['top']}>
  <Stack.Screen options={{ headerShown: false }} />
  <View style={s.header}><Press accessibilityRole="button" accessibilityLabel="Nazad na profil" onPress={back} style={s.back}><V2Icon name="back" size={20} /></Press>
   <T accessibilityRole="header" style={s.title}>Obaveštenja</T></View>
  <ScrollView contentContainerStyle={s.content}><PushPreferences role={role} /></ScrollView>
  <View style={s.footer}><T style={s.caption}>Podešavanja za: {intent === 'narucilac' ? 'Meni treba' : 'Ja mogu'}</T></View>
 </SafeAreaView>;
}
const s = StyleSheet.create({
 screen: { flex: 1, backgroundColor: v2.color.canvas },
 header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, backgroundColor: v2.color.header, borderBottomWidth: 1, borderBottomColor: v2.color.line },
 back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: v2.radius.button, backgroundColor: v2.color.surface, borderWidth: 1, borderColor: v2.color.line },
 title: { ...v2.text.title, color: v2.color.ink }, content: { padding: v2.space.xl, paddingBottom: 32 },
 footer: { padding: 18, borderTopWidth: 1, borderTopColor: v2.color.line, backgroundColor: v2.color.surface }, caption: { ...v2.text.label, color: v2.color.muted },
});
