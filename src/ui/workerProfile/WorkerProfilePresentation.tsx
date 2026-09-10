import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StanjeProfila } from '../../contracts/projections';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from '../v2/V2Action';
import { V2Icon } from '../v2/icons';
import { v2 } from '../v2/tokens';
import type { WorkerDraft } from './workerProfileDraft';

const body = { ...v2.text.body, color: v2.color.ink }, caption = { ...v2.text.label, color: v2.color.muted };
const input = { ...body, borderWidth: 1, borderColor: v2.color.controlLine, borderRadius: v2.radius.input,
  padding: 12, minHeight: 48, backgroundColor: v2.color.surface };
export function WorkerProfileFrame({ back, children, footer }: { back: () => void; children: ReactNode; footer?: ReactNode }) {
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: v2.color.canvas }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad na profil" onPress={back}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><V2Icon name="back" /></Press>
      <View><T style={caption}>Veštine, alat i način rada</T><T accessibilityRole="header" style={{ ...v2.text.title, color: v2.color.ink }}>Radni profil</T></View>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 24 }}>{children}</ScrollView>
      {footer ? <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderColor: v2.color.line, backgroundColor: v2.color.surface }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function WorkerProfileStatus({ loading, error, retry }: { loading: boolean; error?: string | null; retry: () => void }) {
  return <View style={{ paddingVertical: 24, gap: 16 }}>{loading ? <ActivityIndicator accessibilityLabel="Učitavanje radnog profila" color={v2.color.teal} /> : <>
    <T accessibilityRole="alert" style={body}>{error ?? 'Radni profil nije dostupan.'}</T>
    <V2Action label="Ponovo učitaj profil" onPress={retry} />
  </>}</View>;
}
function Field({ label, value, change, disabled, multiline = false, numeric = false, hint }: {
  label: string; value: string; change: (text: string) => void; disabled: boolean; multiline?: boolean; numeric?: boolean; hint?: string;
}) {
  return <View style={{ gap: 8 }}><T style={body}>{label}</T><TextInput accessibilityLabel={label} value={value}
    editable={!disabled} onChangeText={text => { if (!disabled) change(text); }} multiline={multiline}
    keyboardType={numeric ? 'number-pad' : 'default'} maxLength={numeric ? 3 : multiline ? 4000 : 160}
    style={[input, multiline ? { minHeight: 96, textAlignVertical: 'top' } : undefined]} />{hint ? <T style={caption}>{hint}</T> : null}</View>;
}
function Terms({ label, values, pending, setPending, change, disabled }: { label: string; values: string[]; pending: string;
  setPending: (text: string) => void; change: (terms: string[], clearPending?: boolean) => void; disabled: boolean }) {
  const add = () => { const term = pending.replace(/^ +| +$/g, '');
    if (disabled || !term || Array.from(term).length > 500 || values.length >= 50) return;
    change([...values, term], true); };
  return <View style={{ gap: 8 }}><T style={body}>{label}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {values.map((value, index) => <Press key={index} accessibilityRole="button" accessibilityLabel={`Ukloni ${label.toLowerCase()}: ${value}`}
      disabled={disabled} onPress={() => { if (!disabled) change(values.filter((_, i) => i !== index)); }}
      style={{ minHeight: 44, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: v2.color.soft }}>
      <T style={body}>{value} ×</T></Press>)}
    </View><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <TextInput accessibilityLabel={`Nova stavka: ${label}`} placeholder="Dodajte jednu stavku" placeholderTextColor={v2.color.muted}
        value={pending} editable={!disabled && values.length < 50} onChangeText={text => { if (!disabled) setPending(text); }}
        onSubmitEditing={add} maxLength={500} style={[input, { flex: 1 }]} />
      <Press accessibilityRole="button" accessibilityLabel={`Dodaj: ${label}`} onPress={add}
        disabled={disabled || !pending.trim() || values.length >= 50}
        style={{ minWidth: 60, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><T style={{ ...body, color: v2.color.teal }}>Dodaj</T></Press>
    </View><T style={caption}>Dodajte svaku stavku zasebno. {values.length}/50</T></View>;
}
export function WorkerProfileForm({ draft, change, disabled, status, navigate }: { draft: WorkerDraft; change: (value: WorkerDraft) => void;
  disabled: boolean; status: StanjeProfila | null; navigate: (path: '/profil/lokacija' | '/profil/dostupnost' | '/raspored') => void }) {
  const [resourcesOpen, setResourcesOpen] = useState(false), [bioOpen, setBioOpen] = useState(!!draft.biografija);
  const patch = (value: Partial<WorkerDraft>) => { if (!disabled) change({ ...draft, ...value }); };
  const initials = draft.ime.trim().split(/\s+/).slice(0, 2).map(part => part.slice(0, 1)).join('').toUpperCase();
  return <>
    <View style={{ alignItems: 'center', gap: 8, padding: 24, borderRadius: 24, backgroundColor: v2.color.context, borderWidth: 1, borderColor: v2.color.contextLine }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: v2.color.warm, justifyContent: 'center', alignItems: 'center' }}>
        <T style={{ ...v2.text.hero, color: v2.color.ink }}>{initials || 'JA'}</T></View>
      <T style={caption}>JA MOGU</T><T style={{ ...v2.text.hero, color: v2.color.ink }}>{draft.ime.trim() || 'Šta možete da preuzmete?'}</T>
      <T style={caption}>{status === 'ACTIVE' ? 'Profil je aktivan' : status === 'SUSPENDED' ? 'Profil je trenutno suspendovan' : 'Dopunite ključne sposobnosti pre prijave'}</T>
    </View>
    <Field label="Ime na radnom profilu" value={draft.ime} change={ime => patch({ ime })} disabled={disabled} />
    <Terms label="Veštine i usluge" values={draft.vestine} pending={draft.newSkill} setPending={newSkill => patch({ newSkill })}
      change={(vestine, clear) => patch({ vestine, ...(clear ? { newSkill: '' } : {}) })} disabled={disabled} />
    <Press accessibilityRole="button" accessibilityLabel="Alat i vozila" accessibilityState={{ expanded: resourcesOpen }}
      onPress={() => setResourcesOpen(value => !value)} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: v2.color.line }}>
      <View style={{ flex: 1 }}><T style={body}>Alat i vozila</T><T style={caption}>{draft.alati.length + draft.vozila.length ? `${draft.alati.length} stavki alata · ${draft.vozila.length} vozila` : 'Dodajte kada je relevantno · opciono'}</T></View>
      <V2Icon name="chevron" /></Press>
    {resourcesOpen ? <><Terms label="Alat i oprema" values={draft.alati} pending={draft.newTool} setPending={newTool => patch({ newTool })}
      change={(alati, clear) => patch({ alati, ...(clear ? { newTool: '' } : {}) })} disabled={disabled} />
      <Terms label="Vozila" values={draft.vozila} pending={draft.newVehicle} setPending={newVehicle => patch({ newVehicle })}
        change={(vozila, clear) => patch({ vozila, ...(clear ? { newVehicle: '' } : {}) })} disabled={disabled} /></> : null}
    <View style={{ gap: 16 }}><T style={{ ...v2.text.title, color: v2.color.ink }}>Područje rada</T>
      <Field label="Grad ili mesto rada" value={draft.grad} change={grad => patch({ grad })} disabled={disabled} />
      <Field label="Radijus rada (km)" value={draft.radius} change={radius => patch({ radius })} disabled={disabled} numeric hint="Ceo broj od 1 do 200 km oko područja rada." />
      <V2Action label="Država i područje na mapi" kind="quiet" disabled={disabled} onPress={() => navigate('/profil/lokacija')} />
    </View>
    <Press accessibilityRole="button" accessibilityLabel="Kratko predstavljanje" accessibilityState={{ expanded: bioOpen }}
      onPress={() => setBioOpen(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}><T style={body}>Kratko predstavljanje</T><T style={caption}>Iskustvo koje želite da navedete · opciono</T></View><V2Icon name="chevron" /></Press>
    {bioOpen ? <Field label="O vašem iskustvu" value={draft.biografija} change={biografija => patch({ biografija })} disabled={disabled} multiline /> : null}
    <View style={{ padding: 16, gap: 8, borderRadius: 18, backgroundColor: v2.color.context }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><T style={body}>Dostupan sam</T>
        <T style={caption}>{draft.dostupanOdmah ? 'Uključeno u ovom unosu' : 'Isključeno u ovom unosu'}</T></View>
        <Switch accessibilityLabel="Dostupan sam" value={draft.dostupanOdmah} disabled={disabled}
          trackColor={{ true: v2.color.teal, false: v2.color.controlLine }} onValueChange={dostupanOdmah => patch({ dostupanOdmah })} /></View>
      <T style={caption}>Ovu dostupnost uključujete i isključujete sami, pa čuvate profil. Nije oznaka HITNO niti dozvola za push obaveštenja.</T>
    </View>
    <V2Action label="Redovna dostupnost" kind="quiet" disabled={disabled} onPress={() => navigate('/profil/dostupnost')} />
    <V2Action label="Pogledaj raspored" kind="quiet" disabled={disabled} onPress={() => navigate('/raspored')} />
    <T style={caption}>Veštine, alat i vozila su podaci koje navodite sami. Izmena profila ne prepisuje već poslate Prijave.</T>
  </>;
}
