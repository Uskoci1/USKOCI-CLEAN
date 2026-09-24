import { useCallback, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { PushPreferences } from '../../../ui/notifications/PushPreferences';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { T } from '../../../ui/Text';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { DetailTopBar } from '../../../ui/system/DetailTopBar';
import { Segmented } from '../../../ui/system/Segmented';
import { sys } from '../../../ui/system/tokens';
const SETS = [{ key: 'REQUESTER', label: 'Moji zadaci' }, { key: 'WORKER', label: 'Moje prijave' }] as const;
type SetKey = typeof SETS[number]['key'];
const CAPTION: Record<SetKey, string> = {
 REQUESTER: 'Obaveštenja o zadacima koje objavljuješ.',
 WORKER: 'Obaveštenja o poslovima na koje se prijavljuješ.',
};
export default function PushSettings() {
 const { user, accountRevision } = useSesija(); const accountId = user?.id;
 // The server keeps two sets of notification settings for one account: one for the tasks it
 // publishes and one for the work it applies to. Which set this screen edits used to follow the
 // mode the whole app was in; it is now chosen here, on the screen that edits it.
 const [role, setRole] = useState<SetKey>('REQUESTER');
 // Unsaved changes of the shown set. Switching the set or going back used to throw them away without a word.
 const [dirty, setDirty] = useState(false);
 // A save, or the phone switched on or off, is running for the shown set: the set stays until its outcome is read back.
 const [writing, setWriting] = useState(false);
 const confirm = useConfirmSheet();
 const owner = useRef<{ accountId: string; revision: number } | null>(null);
 const closeConfirm = confirm.close;
 useFocusEffect(useCallback(() => {
  const scope = accountId ? { accountId, revision: accountRevision } : null; owner.current = scope;
  // A question left open when the screen loses focus is retired, never answered later.
  return () => { if (owner.current === scope) owner.current = null; closeConfirm(); };
 }, [accountId, accountRevision, closeConfirm]));
 function back() {
  const scope = owner.current;
  if (!scope || scope.accountId !== accountId || scope.revision !== accountRevision
   || sesijaSada().user?.id !== scope.accountId || sesijaSada().accountRevision !== scope.revision) return;
  if (router.canGoBack()) router.back(); else router.replace('/profil');
 }
 /** Asks before unsaved changes are thrown away; the step itself runs its own checks when it is confirmed. */
 function discardThen(proceed: () => void) {
  if (!dirty) { proceed(); return; }
  // "Odustani" could be read as giving up the changes; the way out of this question keeps them (as on Dostupnost).
  confirm.ask({ title: 'Odbaci izmene?', message: 'Izmene kategorija i tihih sati nisu sačuvane.', confirmLabel: 'Odbaci izmene',
   cancelLabel: 'Nastavi uređivanje', tone: 'danger', onConfirm: proceed });
 }
 const requestBack = () => discardThen(back);
 const requestRole = (next: SetKey) => { if (next !== role && !writing) discardThen(() => { setDirty(false); setWriting(false); setRole(next); }); };
 // Android's own Back asks the same question while something is unsaved; with nothing unsaved it leaves as always.
 const latestBack = useRef({ dirty, requestBack }); latestBack.current = { dirty, requestBack };
 useFocusEffect(useCallback(() => {
  const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
   if (!latestBack.current.dirty) return false;
   latestBack.current.requestBack(); return true;
  });
  return () => subscription?.remove();
 }, []));
 return <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
  <Stack.Screen options={{ headerShown: false }} />
  {/* The arrow says only "Nazad": this screen is opened from Profil and from the gear in Obaveštenja, so naming one of
      them would be wrong for the other. */}
  <DetailTopBar title="Podešavanja obaveštenja" onBack={requestBack} />
  {/* While a write of the shown set runs, its tabs wait with every other control (the Save spinner says why). */}
  <View style={s.sets} pointerEvents={writing ? 'none' : 'auto'}>
   <Segmented appearance="underline" options={SETS} value={role} onChange={requestRole} />
   <T variant="note" tone="muted">{CAPTION[role]}</T>
  </View>
  <PushPreferences key={role} role={role} onDirtyChange={setDirty} onWritingChange={setWriting} />
  {confirm.sheet}
 </SafeAreaView>;
}
const s = StyleSheet.create({
 screen: { flex: 1, backgroundColor: sys.color.ground },
 sets: { paddingHorizontal: 20, paddingTop: 4, gap: 8 },
});
