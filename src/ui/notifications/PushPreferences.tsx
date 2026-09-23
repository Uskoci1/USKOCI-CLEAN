import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AuthAccountScope } from '../../contracts/auth';
import type { NotificationPreferences, NotificationRole, NotificationSettings } from '../../contracts/notificationPreferences';
import { notificationPreferencesClientService } from '../../data/notificationPreferencesClientService';
import { nativePushDevice, type NativePushState } from '../../data/nativePushDevice';
import { pushDeviceClientService, type PushDevice } from '../../data/pushDeviceClientService';
import { pushReadinessClientService, type PushReadiness } from '../../data/pushReadinessClientService';
import { sesijaSada, useSesija } from '../../store/sesija';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action as Button } from '../v2/V2Action';
import { sys } from '../system/tokens';

type Snapshot = { preferences: NotificationPreferences; native: NativePushState; device: PushDevice | null; readiness: PushReadiness | null };
type Scope = AuthAccountScope & { role: NotificationRole; alive: boolean; busy: boolean; generation: number };
type Draft = { owner: Scope; settings: NotificationSettings };
const SETTING_KEYS: (keyof NotificationSettings)[] = [
 'in_app_enabled', 'push_enabled', 'opportunities_enabled', 'responses_enabled', 'dogovor_enabled', 'execution_enabled',
 'recovery_enabled', 'account_enabled', 'quiet_hours_enabled', 'quiet_start', 'quiet_end', 'quiet_timezone', 'urgent_overrides_quiet_hours',
];
const CATEGORY_ROWS: { key: keyof Pick<NotificationSettings, 'opportunities_enabled' | 'responses_enabled' | 'dogovor_enabled' | 'execution_enabled' | 'recovery_enabled' | 'account_enabled'>; label: string; help: string }[] = [
 { key: 'opportunities_enabled', label: 'Nove prilike', help: 'Novi zadaci koji mogu biti relevantni za ovu ulogu.' },
 { key: 'responses_enabled', label: 'Prijave i odgovori', help: 'Promene vezane za prijave i odgovore na zadatak.' },
 { key: 'dogovor_enabled', label: 'Dogovor i poruke', help: 'Dogovor, poruke, pristup i ocene.' },
 { key: 'execution_enabled', label: 'Izvršenje i završetak', help: 'Promene izvršenja i radnje potrebne za završetak.' },
 { key: 'recovery_enabled', label: 'Oporavak', help: 'Obaveštenja vezana za oporavak nedovršenog toka.' },
 { key: 'account_enabled', label: 'Nalog i ostalo', help: 'Bezbednosna, nalog i ostala sistemska obaveštenja.' },
];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;
function sameSettings(a: NotificationSettings, b: NotificationSettings) { return SETTING_KEYS.every(key => a[key] === b[key]); }
function cloneSettings(value: NotificationSettings): NotificationSettings { return { ...value }; }
function validateDraft(value: NotificationSettings): string | null {
 if (!value.quiet_timezone.trim()) return 'Unesi vremensku zonu, na primer Europe/Belgrade.';
 if (!value.quiet_hours_enabled) return null;
 if (!value.quiet_start || !value.quiet_end) return 'Za tihe sate unesi početak i kraj.';
 if (!TIME.test(value.quiet_start) || !TIME.test(value.quiet_end)) return 'Vreme unesi kao HH:MM, na primer 22:00 i 07:00.';
 return null;
}

export function PushPreferences({ role }: { role: NotificationRole }) {
 const { user, accountRevision } = useSesija(); const accountId = user?.id ?? '';
 const renderedOwner = useRef({ accountId, accountRevision, role }); renderedOwner.current = { accountId, accountRevision, role };
 const scopeRef = useRef<Scope | null>(null);
 const [view, setView] = useState<{ owner: Scope; snapshot: Snapshot } | null>(null);
 const [draft, setDraft] = useState<Draft | null>(null);
 const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [validation, setValidation] = useState<string | null>(null);
 const current = (scope: Scope, generation: number) => scopeRef.current === scope && scope.alive && scope.generation === generation
  && sesijaSada().user?.id === scope.accountId && sesijaSada().accountRevision === scope.accountRevision
  && renderedOwner.current.accountId === scope.accountId && renderedOwner.current.accountRevision === scope.accountRevision && renderedOwner.current.role === scope.role;
 async function bounded<T>(task: Promise<T>, scope: Scope): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([task, new Promise<never>((_, reject) => { timer = setTimeout(() => { scope.generation++; reject(Error('TIMEOUT')); }, 15000); })]); }
  finally { if (timer) clearTimeout(timer); }
 }
 async function read(scope: Scope, generation: number, ask: boolean): Promise<Snapshot> {
  const transport = readTransport();
  const preferences = await notificationPreferencesClientService.read(scope.accountId, scope.role);
  if (!current(scope, generation)) throw Error('STALE');
  const native = await nativePushDevice(ask, () => current(scope, generation));
  if (!current(scope, generation)) throw Error('STALE');
  const result = native.kind === 'READY' ? await pushDeviceClientService.read(scope, native.token) : null;
  if (!current(scope, generation) || result && !result.ok) throw Error('READ_UNAVAILABLE');
  const readiness = await transport;
  if (!current(scope, generation)) throw Error('STALE');
  return { preferences, native, device: result?.ok ? result.podatak : null, readiness };
 }
 async function run(scope: Scope, work: (generation: number) => Promise<Snapshot>) {
  if (scope.busy || !current(scope, scope.generation)) return;
  // setView(null) here meant that pressing "Sačuvaj podešavanja" made nine switches, three fields
  // and five buttons vanish behind a spinner, and on any failure the wipe was permanent: the error
  // panel replaced the settings instead of standing beside them. The last good state stays mounted
  // and is dimmed while the work runs; only a first read has nothing to show.
  scope.busy = true; const generation = ++scope.generation; setBusy(true); setError(false); setValidation(null);
  try {
   const snapshot = await bounded(work(generation), scope);
   if (current(scope, generation)) {
    setView({ owner: scope, snapshot });
    setDraft({ owner: scope, settings: cloneSettings(snapshot.preferences.settings) });
   }
  }
  catch { if (scopeRef.current === scope && scope.alive) setError(true); }
  finally { if (scopeRef.current === scope && scope.alive) { scope.busy = false; setBusy(false); } }
 }
 useFocusEffect(useCallback(() => {
  const scope: Scope = { accountId, accountRevision, role, alive: true, busy: false, generation: 0 };
  scopeRef.current = scope; setView(null); setDraft(null); setError(false); setValidation(null); setBusy(false);
  if (accountId) void run(scope, generation => read(scope, generation, false));
  return () => { scope.alive = false; scope.generation++; if (scopeRef.current === scope) scopeRef.current = null; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [accountId, accountRevision, role]));
 const owner = scopeRef.current;
 const renderedGeneration = owner?.generation;
 const snapshot = owner && owner.accountId === accountId && owner.accountRevision === accountRevision && owner.role === role && view?.owner === owner ? view.snapshot : null;
 const settings = owner && draft?.owner === owner ? draft.settings : null;
 function refresh() { const scope = scopeRef.current; if (scope) void run(scope, generation => read(scope, generation, false)); }
 function enable() {
  const scope = scopeRef.current; if (!scope || !snapshot || view?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  void run(scope, async generation => {
   const fresh = await read(scope, generation, true);
   if (fresh.native.kind !== 'READY' || !fresh.device) return fresh;
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
  const original = snapshot.preferences;
  void run(scope, async generation => {
   await notificationPreferencesClientService.save(scope.accountId, scope.role, { ...original.settings, push_enabled: false }, original.revision);
   if (!current(scope, generation)) throw Error('STALE');
   return read(scope, generation, false);
  });
 }
 function edit<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
  const scope = scopeRef.current;
  if (!scope || !settings || draft?.owner !== scope || scope.busy || scope.generation !== renderedGeneration || !snapshot || view?.owner !== scope) return;
  setValidation(null); setDraft({ owner: scope, settings: { ...settings, [key]: value } });
 }
 function saveSettings() {
  const scope = scopeRef.current;
  if (!scope || !snapshot || view?.owner !== scope || !settings || draft?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  const problem = validateDraft(settings); if (problem) { setValidation(problem); return; }
  const original = snapshot.preferences; const payload = cloneSettings(settings);
  void run(scope, async generation => {
   await notificationPreferencesClientService.save(scope.accountId, scope.role, payload, original.revision);
   if (!current(scope, generation)) throw Error('STALE');
   return read(scope, generation, false);
  });
 }
 const enabled = snapshot?.preferences.settings.push_enabled === true;
 const registered = snapshot?.native.kind === 'READY' && snapshot.device?.active && snapshot.device.sessionBound;
 const dirty = !!snapshot && !!settings && !sameSettings(snapshot.preferences.settings, settings);
 // An unconfirmed outcome used to remove the controls by wiping the whole body. Keeping them on
 // screen must not make them usable: until the state is read back, everything here is locked.
 const locked = busy || error;
 return <View style={styles.stack}>
  <T style={{ ...sys.type.title, color: sys.color.ink }}>Kanali obaveštenja</T>
  <T tone="muted">Podešavanja važe samo za ovu ulogu. Promena kategorije ne uključuje push dozvolu na telefonu.</T>
  {busy && <ActivityIndicator accessibilityLabel="Provera push obaveštenja" color={sys.color.green} />}
  {error && <View accessibilityLiveRegion="polite" style={styles.stack}><T>Stanje nije potvrđeno. Proveri ga pre ponovnog pokušaja.</T><Button label="Proveri stanje" kind="secondary" onPress={refresh} disabled={busy} /></View>}
  {snapshot && settings && <View style={busy ? styles.working : undefined}>
   <SettingSwitch label="Obaveštenja u aplikaciji" help="Kontroliše in-app isporuku. Istorija događaja u Inbox-u ostaje odvojena." value={settings.in_app_enabled}
    disabled={locked} onChange={value => edit('in_app_enabled', value)} />
   <View style={styles.divider} />
   <T style={{ ...sys.type.title, color: sys.color.ink }}>Kategorije</T>
   <T tone="muted">Isključena kategorija se ne isporučuje ni kao in-app ni kao push za ovu ulogu.</T>
   {CATEGORY_ROWS.map(row => <SettingSwitch key={row.key} label={row.label} help={row.help} value={settings[row.key]}
    disabled={locked} onChange={value => edit(row.key, value)} />)}
   <View style={styles.divider} />
   <T style={{ ...sys.type.title, color: sys.color.ink }}>Tihi sati</T>
   <SettingSwitch label="Uključi tihe sate" help="Push se utišava u zadatom intervalu. Interval može da prelazi preko ponoći." value={settings.quiet_hours_enabled}
    disabled={locked} onChange={value => edit('quiet_hours_enabled', value)} />
   <View style={styles.timeRow}>
    <View style={styles.timeField}><T variant="meta" tone="muted">Početak</T><TextInput accessibilityLabel="Početak tihih sati" value={settings.quiet_start ?? ''}
      editable={!locked && settings.quiet_hours_enabled} placeholder="22:00" placeholderTextColor={sys.color.muted} keyboardType="numbers-and-punctuation" autoCapitalize="none"
      style={styles.input} onChangeText={value => edit('quiet_start', value.trim() || null)} /></View>
    <View style={styles.timeField}><T variant="meta" tone="muted">Kraj</T><TextInput accessibilityLabel="Kraj tihih sati" value={settings.quiet_end ?? ''}
      editable={!locked && settings.quiet_hours_enabled} placeholder="07:00" placeholderTextColor={sys.color.muted} keyboardType="numbers-and-punctuation" autoCapitalize="none"
      style={styles.input} onChangeText={value => edit('quiet_end', value.trim() || null)} /></View>
   </View>
   {/* A text box asking a person to type an IANA identifier by hand, where one typo silently moves
       their quiet hours. The device already knows its zone, and that is the answer in every real
       case; the stored value stays exactly what the server accepts. */}
   <View style={styles.timeField}><T variant="meta" tone="muted">Vremenska zona tihih sati</T>
     <T variant="bodyStrong">{zoneLabel(settings.quiet_timezone)}</T>
     {settings.quiet_timezone !== deviceZone() && deviceZone()
       ? <Button label={`Koristi zonu telefona (${zoneLabel(deviceZone()!)})`} kind="quiet" disabled={locked}
         onPress={() => edit('quiet_timezone', deviceZone()!)} /> : null}</View>
   <SettingSwitch label="HITNO može preko tihih sati" help="Važi samo za HITNO događaj i samo kada je ovo posebno uključeno." value={settings.urgent_overrides_quiet_hours}
    disabled={locked || !settings.quiet_hours_enabled} onChange={value => edit('urgent_overrides_quiet_hours', value)} />
   {validation ? <T accessibilityRole="alert" tone="danger">{validation}</T> : null}
   <Button label="Sačuvaj podešavanja" onPress={saveSettings} disabled={locked || !dirty} />
   {!dirty && !locked ? <T variant="meta" tone="muted">Dugme se uključuje kad promeniš neko podešavanje.</T> : null}
   <View style={styles.divider} />
   <T style={{ ...sys.type.title, color: sys.color.ink }}>Push obaveštenja</T>
   <T tone="muted">Na zaključanom ekranu prikazujemo samo da imaš novo obaveštenje. Poruke i privatne lokacije ostaju u aplikaciji.</T>
   <T variant="bodyStrong">{enabled ? 'Push je uključen za ovu ulogu.' : 'Push je isključen za ovu ulogu.'}</T>
   <T tone="muted">{registered ? 'Ovaj uređaj je povezan sa trenutnom prijavom.' : snapshot.native.kind === 'DENIED' ? 'Dozvoli obaveštenja u podešavanjima telefona.'
    : snapshot.native.kind === 'UNSUPPORTED' ? 'Push obaveštenja zahtevaju podržan fizički telefon.' : snapshot.native.kind === 'UNCONFIGURED' ? 'Push još nije dostupan u ovoj verziji aplikacije.' : 'Ovaj uređaj još nije povezan za push obaveštenja.'}</T>
   <View style={styles.stack}><T variant="bodyStrong">Poslednja provera slanja</T>
    <T tone="muted">{snapshot.readiness?.state === 'OPERATIONAL' ? 'Server je pri proveri uspešno obrađivao slanje obaveštenja.'
     : snapshot.readiness?.state === 'DEGRADED' ? 'Provera je zabeležila poteškoće ili kašnjenje u slanju.'
      : snapshot.readiness?.state === 'NOT_READY' ? 'Slanje obaveštenja na serveru trenutno nije uključeno.'
       : 'Nema sveže potvrde da je slanje na serveru dostupno.'}</T>
    {snapshot.readiness ? <T variant="meta" tone="muted">Provereno: {new Date(snapshot.readiness.checkedAt).toLocaleString('sr-Latn')}</T> : null}
    <T variant="meta" tone="muted">Ovo je stanje sistema za slanje, a ne potvrda da je obaveštenje stiglo na tvoj telefon.</T>
   </View>
   {snapshot.native.kind === 'DENIED' && <Button label="Podešavanja telefona" kind="secondary" onPress={() => { void Linking.openSettings().catch(() => undefined); }} />}
   {snapshot.native.kind !== 'UNSUPPORTED' && snapshot.native.kind !== 'UNCONFIGURED' && snapshot.native.kind !== 'DENIED' && (!registered || !enabled)
    && <Button label="Uključi push za ovu ulogu" onPress={enable} disabled={locked || dirty} />}
   {enabled && <Button label="Isključi push za ovu ulogu" kind="secondary" onPress={disable} disabled={locked || dirty} />}
   <Button label="Osveži stanje" kind="secondary" onPress={refresh} disabled={locked || dirty} />
   {dirty ? <T variant="meta" tone="muted">Sačuvaj izmene kategorija i tihih sati pre promene push registracije ili osvežavanja.</T> : null}
   <T variant="meta" tone="muted">Povezan uređaj ne znači da je pojedinačno obaveštenje isporučeno.</T>
  </View>}
 </View>;
}

const deviceZone = (): string | null => {
 try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
};
/** The city, not the database identifier. */
const zoneLabel = (zone: string): string => zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;

function SettingSwitch({ label, help, value, disabled, onChange }: { label: string; help: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
 // Nine of these, each togglable only by hitting the switch itself — a 51x31 target at the right
 // edge, on rows that are already 56 tall and full width.
 return <Press accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={help} accessibilityState={{ checked: value, disabled }}
   disabled={disabled} haptic="select" scaleTo={1} onPress={() => onChange(!value)} style={styles.settingRow}>
  <View style={styles.settingCopy}><T variant="bodyStrong">{label}</T><T variant="meta" tone="muted">{help}</T></View>
  <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} /></Press>;
}
const styles = StyleSheet.create({
 stack: { gap: 16 },
 settingRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
 settingCopy: { flex: 1, gap: 3 },
 divider: { height: 1, backgroundColor: sys.color.line },
 /** Still readable, visibly not accepting input yet. */
 working: { opacity: 0.55 },
 timeRow: { flexDirection: 'row', gap: 12 },
 timeField: { flex: 1, gap: 6 },
 input: { minHeight: 48, borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.control, paddingHorizontal: 14, paddingVertical: 10, color: sys.color.ink, backgroundColor: sys.color.surface, fontSize: sys.type.body.fontSize },
});

async function readTransport(): Promise<PushReadiness | null> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([
   pushReadinessClientService.read().then(result => result.ok ? result.podatak : null).catch(() => null),
   new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 5000); }),
  ]);
 } catch { return null; }
 finally { if (timer !== undefined) clearTimeout(timer); }
}
