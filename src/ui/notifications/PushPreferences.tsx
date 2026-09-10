import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AuthAccountScope } from '../../contracts/auth';
import type { NotificationPreferences, NotificationRole } from '../../contracts/notificationPreferences';
import { notificationPreferencesClientService } from '../../data/notificationPreferencesClientService';
import { nativePushDevice, type NativePushState } from '../../data/nativePushDevice';
import { pushDeviceClientService, type PushDevice } from '../../data/pushDeviceClientService';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { V2Action as Button } from '../v2/V2Action';
import { v2 } from '../v2/tokens';
type Snapshot = { preferences: NotificationPreferences; native: NativePushState; device: PushDevice | null };
type Scope = AuthAccountScope & { role: NotificationRole; alive: boolean; busy: boolean; generation: number };
export function PushPreferences({ role }: { role: NotificationRole }) {
 const { user, accountRevision } = useSesija(); const accountId = user?.id ?? '';
 const renderedOwner = useRef({ accountId, accountRevision, role }); renderedOwner.current = { accountId, accountRevision, role };
 const scopeRef = useRef<Scope | null>(null);
 const [view, setView] = useState<{ owner: Scope; snapshot: Snapshot } | null>(null);
 const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
 const current = (scope: Scope, generation: number) => scopeRef.current === scope && scope.alive && scope.generation === generation
  && sesijaSada().user?.id === scope.accountId && sesijaSada().accountRevision === scope.accountRevision
  && renderedOwner.current.accountId === scope.accountId && renderedOwner.current.accountRevision === scope.accountRevision && renderedOwner.current.role === scope.role;
 async function bounded<T>(task: Promise<T>, scope: Scope): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => { scope.generation++; reject(Error('TIMEOUT')); }, 15000); })]); }
  finally { if (timer) clearTimeout(timer); }
 }
 async function read(scope: Scope, generation: number, ask: boolean): Promise<Snapshot> {
  const preferences = await notificationPreferencesClientService.read(scope.accountId, scope.role);
  if (!current(scope, generation)) throw Error('STALE');
  const native = await nativePushDevice(ask, () => current(scope, generation));
  if (!current(scope, generation)) throw Error('STALE');
  const result = native.kind === 'READY' ? await pushDeviceClientService.read(scope, native.token) : null;
  if (!current(scope, generation) || result && !result.ok) throw Error('READ_UNAVAILABLE');
  return { preferences, native, device: result?.ok ? result.podatak : null };
 }
 async function run(scope: Scope, work: (generation: number) => Promise<Snapshot>) {
  if (scope.busy || !current(scope, scope.generation)) return;
  scope.busy = true; const generation = ++scope.generation; setBusy(true); setError(false); setView(null);
  try { const snapshot = await bounded(work(generation), scope); if (current(scope, generation)) setView({ owner: scope, snapshot }); }
  catch { if (scopeRef.current === scope && scope.alive) setError(true); }
  finally { if (scopeRef.current === scope && scope.alive) { scope.busy = false; setBusy(false); } }
 }
 useFocusEffect(useCallback(() => {
  const scope: Scope = { accountId, accountRevision, role, alive: true, busy: false, generation: 0 };
  scopeRef.current = scope; setView(null); setError(false); setBusy(false);
  if (accountId) void run(scope, generation => read(scope, generation, false));
  return () => { scope.alive = false; scope.generation++; if (scopeRef.current === scope) scopeRef.current = null; };
 // A fresh focus is an authoritative readback; no automatic write replay.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [accountId, accountRevision, role]));
 const owner = scopeRef.current;
 const renderedGeneration = owner?.generation;
 const snapshot = owner && owner.accountId === accountId && owner.accountRevision === accountRevision && owner.role === role && view?.owner === owner ? view.snapshot : null;
 function refresh() { const scope = scopeRef.current; if (scope) void run(scope, generation => read(scope, generation, false)); }
 function enable() {
  const scope = scopeRef.current; if (!scope || !snapshot || view?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  void run(scope, async generation => {
   const fresh = await read(scope, generation, true);
   if (fresh.native.kind !== 'READY' || !fresh.device) return fresh;
   // OS consent, explicit role opt-in and registration are separate owners.
   // No registration can silently turn an N08 preference on.
   const registered = await pushDeviceClientService.set(scope, fresh.native.token, fresh.native.platform, true, fresh.device.revision);
   if (!current(scope, generation) || !registered.ok) throw Error('REGISTRATION_UNCONFIRMED');
   if (!fresh.preferences.settings.push_enabled) await notificationPreferencesClientService.save(scope.accountId, scope.role,
    { ...fresh.preferences.settings, push_enabled: true }, fresh.preferences.revision);
   if (!current(scope, generation)) throw Error('STALE');
   return read(scope, generation, false);
  });
 }
 function disable() {
  const scope = scopeRef.current; if (!scope || !snapshot || view?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  // Immutable displayed revision. A conflicting concurrent edit requires readback.
  const original = snapshot.preferences;
  void run(scope, async generation => {
   await notificationPreferencesClientService.save(scope.accountId, scope.role, { ...original.settings, push_enabled: false }, original.revision);
   if (!current(scope, generation)) throw Error('STALE');
   return read(scope, generation, false);
  });
 }
 const enabled = snapshot?.preferences.settings.push_enabled === true;
 const registered = snapshot?.native.kind === 'READY' && snapshot.device?.active && snapshot.device.sessionBound;
 return <View style={styles.stack}>
  <T style={{ ...v2.text.title, color: v2.color.ink }}>Push obaveštenja</T>
  <T tone="muted">Na zaključanom ekranu prikazujemo samo da imate novo obaveštenje. Poruke i privatne lokacije ostaju u aplikaciji.</T>
  {busy && <ActivityIndicator accessibilityLabel="Provera push obaveštenja" color={v2.color.teal} />}
  {error && <View accessibilityLiveRegion="polite" style={styles.stack}><T>Stanje nije potvrđeno. Proverite ga pre ponovnog pokušaja.</T><Button label="Proverite stanje" kind="secondary" onPress={refresh} disabled={busy} /></View>}
  {snapshot && <>
   <T variant="bodyStrong">{enabled ? 'Push je uključen za ovu ulogu.' : 'Push je isključen za ovu ulogu.'}</T>
   <T tone="muted">{registered ? 'Ovaj uređaj je povezan sa trenutnom prijavom.' : snapshot.native.kind === 'DENIED' ? 'Dozvolite obaveštenja u podešavanjima telefona.'
    : snapshot.native.kind === 'UNSUPPORTED' ? 'Push obaveštenja zahtevaju podržan fizički telefon.' : snapshot.native.kind === 'UNCONFIGURED' ? 'Push još nije dostupan u ovoj verziji aplikacije.' : 'Ovaj uređaj još nije povezan za push obaveštenja.'}</T>
   {snapshot.native.kind === 'DENIED' && <Button label="Podešavanja telefona" kind="secondary" onPress={() => { void Linking.openSettings().catch(() => undefined); }} />}
   {snapshot.native.kind !== 'UNSUPPORTED' && snapshot.native.kind !== 'UNCONFIGURED' && snapshot.native.kind !== 'DENIED' && (!registered || !enabled)
    && <Button label="Uključi push za ovu ulogu" onPress={enable} disabled={busy} />}
   {enabled && <Button label="Isključi push za ovu ulogu" kind="secondary" onPress={disable} disabled={busy} />}
   <Button label="Osveži stanje" kind="secondary" onPress={refresh} disabled={busy} />
   <T variant="meta" tone="muted">Kategorije i tihi sati i dalje važe. HITNO ih preskače samo uz zasebno uključenu dozvolu. Povezan uređaj ne znači da je pojedinačno obaveštenje isporučeno.</T>
  </>}
 </View>;
}
const styles = StyleSheet.create({ stack: { gap: v2.space.lg } });
