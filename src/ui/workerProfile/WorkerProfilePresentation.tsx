import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CaretRight } from 'phosphor-react-native';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StanjeProfila } from '../../contracts/projections';
import { T } from '../Text';
import { Press } from '../Press';
import { DetailTopBar } from '../system/DetailTopBar';
import { card, sys, field } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import type { WorkerDraft } from './workerProfileDraft';
import { plural } from '../system/plural';

/** Frame of the worker profile: back, intent eyebrow, title, keyboard-safe body, sticky footer. */
export function WorkerProfileFrame({ back, children, footer }: { back: () => void; children: ReactNode; footer?: ReactNode }) {
  return <SafeAreaView edges={['top']} style={s.screen}>
    <DetailTopBar backLabel="Nazad na profil" eyebrow="Kako mogu da uskočim" title="Veštine, alat i tim" onBack={back} />
    <KeyboardAvoidingView style={s.grow} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{children}</ScrollView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function WorkerProfileStatus({ loading, error, retry }: { loading: boolean; error?: string | null; retry: () => void }) {
  return <View style={s.card}>{loading ? <><ActivityIndicator accessibilityLabel="Učitavanje radnog profila" color={sys.color.green} /><T variant="meta" tone="muted" style={s.center}>Učitavamo radni profil…</T></> : <>
    <T accessibilityRole="alert" variant="body" style={s.ink}>{error ?? 'Radni profil nije dostupan.'}</T>
    <V2Action label="Ponovo učitaj profil" onPress={retry} />
  </>}</View>;
}
function Field({ label, value, change, disabled, multiline = false, numeric = false, hint, inputRef }: {
  label: string; value: string; change: (text: string) => void; disabled: boolean; multiline?: boolean; numeric?: boolean; hint?: string;
  inputRef?: RefObject<TextInput | null>;
}) {
  return <View style={s.field}><T variant="meta" tone="muted">{label}</T><TextInput ref={inputRef} accessibilityLabel={label} value={value}
    editable={!disabled} onChangeText={text => { if (!disabled) change(text); }} multiline={multiline}
    keyboardType={numeric ? 'number-pad' : 'default'} maxLength={numeric ? 3 : multiline ? 4000 : 160}
    style={[s.input, multiline && s.multiline, disabled && s.inputLocked]} />{hint ? <T variant="meta" tone="muted">{hint}</T> : null}</View>;
}
function Terms({ label, values, pending, setPending, change, disabled, inputRef }: { label: string; values: string[]; pending: string;
  setPending: (text: string) => void; change: (terms: string[], clearPending?: boolean) => void; disabled: boolean; inputRef?: RefObject<TextInput | null> }) {
  const add = () => { const term = pending.replace(/^ +| +$/g, '');
    if (disabled || !term || Array.from(term).length > 500 || values.length >= 50) return;
    change([...values, term], true); };
  return <View style={s.field}><T variant="meta" tone="muted">{label}</T>
    {values.length ? <View style={s.chips}>
      {values.map((value, index) => <Press key={index} accessibilityRole="button" accessibilityLabel={`Ukloni ${label.toLowerCase()}: ${value}`}
        disabled={disabled} haptic="select" onPress={() => { if (!disabled) change(values.filter((_, i) => i !== index)); }} style={s.chip}>
        <T variant="meta" style={s.chipText}>{value}</T><T variant="meta" style={s.chipRemove}>×</T></Press>)}
    </View> : null}
    <View style={s.addRow}>
      <TextInput ref={inputRef} accessibilityLabel={`Nova stavka: ${label}`} placeholder="Dodaj jednu stavku" placeholderTextColor={sys.color.muted}
        value={pending} editable={!disabled && values.length < 50} onChangeText={text => { if (!disabled) setPending(text); }}
        onSubmitEditing={add} maxLength={500} style={[s.input, s.grow]} />
      <Press accessibilityRole="button" accessibilityLabel={`Dodaj: ${label}`} onPress={add} haptic="select"
        disabled={disabled || !pending.trim() || values.length >= 50}
        style={[s.addButton, (disabled || !pending.trim() || values.length >= 50) && s.addButtonOff]}><T variant="action" style={{ color: sys.color.green }}>Dodaj</T></Press>
    </View><T variant="meta" tone="muted">Dodaj svaku stavku zasebno. {values.length}/50</T></View>;
}
function Row({ label, hint, expanded, onPress }: { label: string; hint: string; expanded: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} haptic="select" scaleTo={0.99} onPress={onPress} style={s.row}>
    <View style={s.grow}><T variant="bodyStrong" style={s.ink}>{label}</T><T variant="meta" tone="muted">{hint}</T></View>
    <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}><CaretRight size={18} color={sys.color.muted}  /></View>
  </Press>;
}
export type WorkerProfileFocusRequest = { target: 'name' | 'skill' | 'capacity'; token: number };
/**
 * The worker's profile as cards: who you are and what you take on → skills → tools
 * and vehicles behind a row → work area → introduction behind a row → availability.
 * Every field keeps its label as the input's spoken name; the route owns saving.
 */
export function WorkerProfileForm({ draft, change, disabled, status, navigate, focusRequest, unmet }: { draft: WorkerDraft; change: (value: WorkerDraft) => void;
  disabled: boolean; status: StanjeProfila | null; navigate: (path: '/profil/lokacija' | '/profil/dostupnost' | '/raspored') => void;
  focusRequest?: WorkerProfileFocusRequest | null;
  /** What activation is actually waiting for, named by the same checks that gate it. */
  unmet?: readonly string[] }) {
  const [resourcesOpen, setResourcesOpen] = useState(false), [bioOpen, setBioOpen] = useState(!!draft.biografija);
  const nameRef = useRef<TextInput>(null), skillRef = useRef<TextInput>(null), capacityRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!focusRequest || disabled) return;
    const selected = focusRequest.target === 'name' ? nameRef.current : focusRequest.target === 'skill' ? skillRef.current : capacityRef.current;
    (selected as { focus?: () => void } | null)?.focus?.();
  }, [focusRequest, disabled]);
  const patch = (value: Partial<WorkerDraft>) => { if (!disabled) change({ ...draft, ...value }); };
  const initials = draft.ime.trim().split(/\s+/).slice(0, 2).map(part => part.slice(0, 1)).join('').toUpperCase();
  const statusText = status === 'ACTIVE' ? 'Profil je aktivan' : status === 'SUSPENDED' ? 'Profil je trenutno suspendovan' : 'Radni profil je još nacrt';
  const statusTone = status === 'ACTIVE' ? sys.color.green : status === 'SUSPENDED' ? sys.color.danger : sys.color.warn;
  return <>
    <View style={[s.card, s.hero]}>
      {/* The initials are the avatar drawn as text. The name right below says the same thing, so
          announcing both makes a screen reader repeat itself. */}
      <View style={s.avatar}><T accessible={false} variant="title" style={s.initials}>{initials || 'JA'}</T></View>
      <T accessibilityRole="header" variant="title" style={[s.ink, s.center]}>{draft.ime.trim() || 'Šta možeš da preuzmeš?'}</T>
      <View style={[s.statusChip, { backgroundColor: status === 'ACTIVE' ? sys.color.greenSoft : status === 'SUSPENDED' ? sys.color.dangerSoft : sys.color.warnSoft }]}>
        <T variant="meta" style={{ color: statusTone, fontWeight: '600' }}>{statusText}</T></View>
      {/* The old sentence sent people to Dostupnost and then to skills, and activation gates on
          neither of those two alone: it gates on the name and one skill, on the work area, and on
          the team capacity — and never on availability at all. Doing what the screen said left the
          profile a draft with nothing saying why. It now names the checks that are actually open. */}
      {status !== 'ACTIVE' ? <T variant="meta" tone="muted" style={s.center}>{status === 'SUSPENDED'
        ? 'Dok traje suspenzija, zadaci ti se ne nude.'
        : unmet?.length ? `Dok je nacrt, zadaci ti se ne nude. Za aktivaciju još treba: ${unmet.join(' · ')}.`
          : 'Dok je nacrt, zadaci ti se ne nude. Sačuvaj i aktiviraj profil.'}</T> : null}
      {status === 'DRAFT' && unmet?.length ? <T variant="meta" tone="muted" style={s.center}>Dostupnost nije uslov za aktivaciju.</T> : null}
    </View>
    <View style={s.card}>
      <T variant="heading" style={s.ink}>Ko si i šta preuzimaš</T>
      <Field label="Ime na radnom profilu" value={draft.ime} change={ime => patch({ ime })} disabled={disabled} inputRef={nameRef} />
      <Field label="Koliko ljudi možeš da obezbediš" value={draft.capacity} change={capacity => patch({ capacity })}
        disabled={disabled || draft.capacityRevision === null} numeric inputRef={capacityRef}
        hint={draft.capacityRevision === null ? 'Sačuvaj profil da bi se broj ljudi potvrdio.' : 'Ukupan broj ljudi, uključujući tebe. Od 1 do 50; nije kapacitet vozila.'} />
      <Terms label="Veštine i usluge" values={draft.vestine} pending={draft.newSkill} setPending={newSkill => patch({ newSkill })}
        change={(vestine, clear) => patch({ vestine, ...(clear ? { newSkill: '' } : {}) })} disabled={disabled} inputRef={skillRef} />
    </View>
    <View style={s.rows}>
      <Row label="Alat i vozila" expanded={resourcesOpen} onPress={() => setResourcesOpen(value => !value)}
        hint={draft.alati.length + draft.vozila.length ? `${plural(draft.alati.length, 'stavka alata', 'stavke alata', 'stavki alata')} · ${plural(draft.vozila.length, 'vozilo', 'vozila', 'vozila')}` : 'Dodaj kada je relevantno · opciono'} />
      {resourcesOpen ? <View style={s.rowBody}><Terms label="Alat i oprema" values={draft.alati} pending={draft.newTool} setPending={newTool => patch({ newTool })}
        change={(alati, clear) => patch({ alati, ...(clear ? { newTool: '' } : {}) })} disabled={disabled} />
        <Terms label="Vozila" values={draft.vozila} pending={draft.newVehicle} setPending={newVehicle => patch({ newVehicle })}
          change={(vozila, clear) => patch({ vozila, ...(clear ? { newVehicle: '' } : {}) })} disabled={disabled} /></View> : null}
      <View style={s.rowDivider}>
        <Row label="Kratko predstavljanje" expanded={bioOpen} onPress={() => setBioOpen(value => !value)} hint="Iskustvo koje želiš da navedeš · opciono" />
        {bioOpen ? <View style={s.rowBody}><Field label="O tvom iskustvu" value={draft.biografija} change={biografija => patch({ biografija })} disabled={disabled} multiline /></View> : null}
      </View>
    </View>
    <View style={s.card}><T variant="heading" style={s.ink}>Područje rada</T>
      <Field label="Grad ili mesto rada" value={draft.grad} change={() => {}} disabled={true} hint="Menja se kroz područje rada na mapi." />
      <Field label="Radijus rada (km)" value={draft.radius} change={() => {}} disabled={true} numeric hint="Ceo broj od 1 do 200 km oko područja rada." />
      <V2Action label="Država i područje na mapi" kind="quiet" disabled={disabled} onPress={() => navigate('/profil/lokacija')} style={s.quietLeft} />
    </View>
    <View style={s.card}>
      <View style={s.switchRow}><View style={s.grow}><T variant="bodyStrong" style={s.ink}>Dostupan sam</T>
        <T variant="meta" tone="muted">{draft.dostupanOdmah ? 'Uključeno · sačuvano stanje' : 'Isključeno · sačuvano stanje'}</T></View>
        <Switch accessibilityLabel="Dostupan sam" value={draft.dostupanOdmah} disabled={true}
          trackColor={{ true: sys.color.green, false: sys.color.lineStrong }} onValueChange={() => {}} /></View>
      <T variant="meta" tone="muted">Ovu dostupnost menjaš kroz „Redovna dostupnost“, jednim zajedničkim načinom čuvanja. Nije oznaka HITNO niti dozvola za push obaveštenja.</T>
      <V2Action label="Redovna dostupnost" kind="quiet" disabled={disabled} onPress={() => navigate('/profil/dostupnost')} style={s.quietLeft} />
      <V2Action label="Pogledaj raspored" kind="quiet" disabled={disabled} onPress={() => navigate('/raspored')} style={s.quietLeft} />
    </View>
    <T variant="meta" tone="muted" style={s.center}>Veštine, alat i vozila su podaci koje sam navodiš. Izmena profila ne prepisuje već poslate Prijave.</T>
  </>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, ink: { color: sys.color.ink }, center: { textAlign: 'center' },
eyebrow: { ...sys.type.label, color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  content: { padding: 20, paddingTop: 6, gap: 16, paddingBottom: 28 },
  footer: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  card: { ...card, gap: 12 },
  hero: { alignItems: 'center', gap: 8, borderWidth: 0, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0, paddingVertical: 8 },
  avatar: { width: 96, height: 96, borderRadius: sys.radius.sheet, backgroundColor: sys.color.greenSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  initials: { ...sys.type.monogram, color: sys.color.green },
  statusChip: { borderRadius: sys.radius.badge, paddingHorizontal: 12, paddingVertical: 7 },
  field: { gap: 6 },
  input: { ...field },
  multiline: { minHeight: 96, textAlignVertical: 'top' }, inputLocked: { backgroundColor: sys.color.wash, color: sys.color.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft },
  chipText: { color: sys.color.ink, fontWeight: '600', flexShrink: 1 }, chipRemove: { color: sys.color.green, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addButton: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.green, paddingHorizontal: 12 },
  addButtonOff: { opacity: 0.45 },
  rows: { ...card, padding: 0, overflow: 'hidden' },
  row: { minHeight: 62, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowDivider: { borderTopWidth: 1, borderColor: sys.color.line }, rowBody: { paddingHorizontal: 18, paddingBottom: 18, gap: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
