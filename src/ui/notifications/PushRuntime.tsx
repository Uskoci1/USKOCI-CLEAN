import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSesija, sesijaSada } from '../../store/sesija';
import { nativePushDevice } from '../../data/nativePushDevice';
import { pushDeviceClientService, revokePushBeforeLogout } from '../../data/pushDeviceClientService';

/** Fixed owned Inbox navigation + rotation of an already explicit registration.
 * Mount once under the existing router/Auth runtime. Never asks OS permission,
 * enables a preference, accepts a payload URL or interprets push as delivery.
 */
export function PushRuntime({ ready = false }: { ready?: boolean }) {
 const { user, accountRevision, sessionEpoch } = useSesija(); const accountId = user?.id;
 const seen = useRef(new Set<string>()), coldStarted = useRef(false), blocked = useRef(new Set<string>());
 useEffect(() => {
  if (!ready || !accountId || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
  let alive = true, pending = false, generation = 0;
  let activeTimer: ReturnType<typeof setTimeout> | undefined;
  const scope = { accountId, accountRevision };
  const owned = () => alive && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && sesijaSada().sessionEpoch === sessionEpoch;
  const remember = (set: Set<string>, value: string, max: number) => { set.add(value); if (set.size > max) set.delete(set.values().next().value!); };
  function tap(response: Notifications.NotificationResponse | null) {
   const request = response?.notification?.request, data = request?.content?.data;
   if (!request || typeof request.identifier !== 'string' || request.identifier.length < 1 || request.identifier.length > 256
    || !data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 1 || data.kind !== 'INBOX') return;
   if (seen.current.has(request.identifier)) return;
   // A late old-account event is consumed, so a new account cannot replay it.
   remember(seen.current, request.identifier, 128);
   if (!owned()) return;
   router.push('/obavestenja');
   void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }
  function reconcile() {
   if (!owned() || pending) return;
   pending = true; const operation = ++generation;
   const current = () => owned() && operation === generation;
   const timer = setTimeout(() => { if (operation === generation) { generation++; pending = false; } }, 20000);
   activeTimer = timer;
   void (async () => {
    const existing = await pushDeviceClientService.sessionDevice(scope);
    if (!current() || !existing.ok || existing.podatak.kind !== 'DEVICE') return;
    const previous = existing.podatak;
    const native = await nativePushDevice(false, current);
    if (!current()) return;
    if (native.kind === 'DENIED' || native.kind === 'PERMISSION_REQUIRED') { await revokePushBeforeLogout(scope); return; }
    if (native.kind !== 'READY' || previous.platform !== native.platform || previous.token === native.token) return;
    const key = `${accountId}:${accountRevision}:${previous.id}:${previous.revision}:${native.token}`;
    if (blocked.current.has(key)) return;
    // Persist an immutable uncertainty fence before the write. Readback can
    // discover the new registration; an unchanged old row isn't a retry receipt.
    remember(blocked.current, key, 32);
    const result = await pushDeviceClientService.rotate(scope, previous, native.token, native.platform);
    if (!current()) return;
    if (result.ok) blocked.current.delete(key);
    else await pushDeviceClientService.sessionDevice(scope); // read only; no replay
   })().catch(() => undefined).finally(() => { clearTimeout(timer); if (activeTimer === timer) activeTimer = undefined; if (operation === generation) pending = false; });
  }
  const responseListener = Notifications.addNotificationResponseReceivedListener(tap);
  const tokenListener = Notifications.addPushTokenListener(reconcile);
  const appListener = AppState.addEventListener('change', state => { if (state === 'active') reconcile(); });
  if (!coldStarted.current) { coldStarted.current = true; void Notifications.getLastNotificationResponseAsync().then(tap).catch(() => undefined); }
  reconcile();
  return () => { alive = false; generation++; if (activeTimer !== undefined) clearTimeout(activeTimer); responseListener.remove(); tokenListener.remove(); appListener.remove(); };
 }, [ready, accountId, accountRevision, sessionEpoch]);
 return null;
}
