import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { PushPreferences } from '../../../ui/notifications/PushPreferences';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { Press } from '../../../ui/Press';
import { T } from '../../../ui/Text';
import { DetailTopBar } from '../../../ui/system/DetailTopBar';
import { Segmented } from '../../../ui/system/Segmented';
import { sys } from '../../../ui/system/tokens';
const SETS = [{ key: 'REQUESTER', label: 'Moji zadaci' }, { key: 'WORKER', label: 'Moje prijave' }] as const;
export default function PushSettings() {
 const { user, accountRevision } = useSesija(); const accountId = user?.id;
 // The server keeps two sets of notification settings for one account: one for the tasks it
 // publishes and one for the work it applies to. Which set this screen edits used to follow the
 // mode the whole app was in; it is now chosen here, on the screen that edits it.
 const [role, setRole] = useState<'REQUESTER' | 'WORKER'>('REQUESTER');
 const owner = useRef<{ accountId: string; revision: number } | null>(null);
 useFocusEffect(useCallback(() => {
  const scope = accountId ? { accountId, revision: accountRevision } : null; owner.current = scope;
  return () => { if (owner.current === scope) owner.current = null; };
 }, [accountId, accountRevision]));
 function back() {
  const scope = owner.current;
  if (!scope || scope.accountId !== accountId || scope.revision !== accountRevision
   || sesijaSada().user?.id !== scope.accountId || sesijaSada().accountRevision !== scope.revision) return;
  if (router.canGoBack()) router.back(); else router.replace('/profil');
 }
 return <SafeAreaView style={s.screen} edges={['top']}>
  <Stack.Screen options={{ headerShown: false }} />
  <DetailTopBar backLabel="Nazad na profil" eyebrow="Profil" title="Podešavanja obaveštenja" onBack={back} />
  <View style={s.sets}><Segmented options={SETS} value={role} onChange={setRole} /></View>
  <ScrollView contentContainerStyle={s.content}><PushPreferences key={role} role={role} /></ScrollView>
  <View style={s.footer}><T style={s.caption}>{role === 'REQUESTER' ? 'Obaveštenja o zadacima koje objavljuješ.' : 'Obaveštenja o poslovima na koje se prijavljuješ.'}</T></View>
 </SafeAreaView>;
}
const s = StyleSheet.create({
 screen: { flex: 1, backgroundColor: sys.color.ground }, sets: { paddingHorizontal: 24, paddingTop: 8 },
 header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, backgroundColor: sys.color.surface, borderBottomWidth: 1, borderBottomColor: sys.color.line },
 back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.control, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line },
 title: { ...sys.type.title, color: sys.color.ink }, content: { padding: 24, paddingBottom: 32 },
 footer: { padding: 18, borderTopWidth: 1, borderTopColor: sys.color.line, backgroundColor: sys.color.surface }, caption: { ...sys.type.meta, color: sys.color.muted },
});
