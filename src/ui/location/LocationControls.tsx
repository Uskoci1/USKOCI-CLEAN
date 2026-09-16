import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, Check, LockKey } from 'phosphor-react-native';
import { sys } from '../system/tokens';
import { V2Action as Button } from '../v2/V2Action';
import { V2Icon } from '../v2/icons';
import { Press } from '../Press';
import { T } from '../Text';

/** Location form geometry on the shared system; the existing native typography and action owners stay. */
export const locationStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { padding: 20, gap: 16, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  section: { gap: 12 },
  card: { backgroundColor: sys.color.surface, borderColor: sys.color.line, borderWidth: 1, borderRadius: sys.radius.card, padding: 18, gap: 12 },
  input: { minHeight: 50, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control, paddingHorizontal: 12,
    paddingVertical: 12, backgroundColor: sys.color.surface, color: sys.color.ink, ...sys.type.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notice: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.card, padding: 16, gap: 10 },
});

/** Keep secondary fields available without competing with the current place or pin. */
export function LocationDetails({ label, summary, children, disabled = false }: {
  label: string; summary?: string; children: ReactNode; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <View style={locationStyles.section}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }}
      disabled={disabled} haptic="select" scaleTo={0.99} onPress={() => { if (!disabled) setOpen(value => !value); }}
      style={[locationStyles.row, { minHeight: sys.touch.min, paddingVertical: 8 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" style={{ color: sys.color.ink }}>{label}</T>
        {!open && summary ? <T variant="meta" tone="muted">{summary}</T> : null}
      </View>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} color={sys.color.muted} /></View>
    </Press>
    {open ? children : null}
  </View>;
}

export function LocationField({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={{ gap: 6 }}>
    <T variant="meta" tone="muted">{label}</T>
    <TextInput accessibilityLabel={label} placeholderTextColor={sys.color.muted} {...props}
      style={[locationStyles.input, props.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null, props.style]} />
    {hint ? <T variant="meta" tone="muted">{hint}</T> : null}
  </View>;
}

export function LocationChoice({ label, value, options, disabled, onChange }: {
  label: string; value: string | null; options: readonly { value: string; label: string; disabled?: boolean }[];
  disabled: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return <View style={{ gap: 6 }}>
    <T variant="meta" tone="muted">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected?.label ?? 'Nije izabrano' }}
      accessibilityState={{ disabled, expanded: open }} disabled={disabled} haptic="select" scaleTo={0.99} onPress={() => setOpen(true)}
      style={[locationStyles.input, locationStyles.row, disabled && { backgroundColor: sys.color.ground }]}>
      <T variant="body" style={{ flex: 1, color: selected ? sys.color.ink : sys.color.muted }}>{selected?.label ?? 'Izaberi'}</T><CaretDown size={18} color={sys.color.green} />
    </Press>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: sys.color.scrim }}>
        <Press accessibilityRole="button" accessibilityLabel="Zatvori izbor" onPress={() => setOpen(false)}
          style={{ flex: 1, minHeight: 44 }} />
        <SafeAreaView edges={['bottom']} accessibilityViewIsModal
          style={{ maxHeight: '80%', borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet, backgroundColor: sys.color.surface, padding: 20, paddingTop: 12, gap: 14 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: sys.color.lineStrong }} />
          <T variant="heading" style={{ color: sys.color.ink }}>{label}</T>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
            {options.map(option => <Press key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
              accessibilityState={{ selected: option.value === value, disabled: !!option.disabled }} disabled={option.disabled} haptic="select"
              onPress={() => { onChange(option.value); setOpen(false); }}
              style={[locationStyles.row, { minHeight: 50, paddingHorizontal: 14, borderRadius: sys.radius.control, borderWidth: 1, opacity: option.disabled ? 0.5 : 1,
                borderColor: value === option.value ? sys.color.green : sys.color.line, backgroundColor: value === option.value ? sys.color.greenSoft : sys.color.surface }]}>
              <T variant={value === option.value ? 'bodyStrong' : 'body'} style={{ flex: 1, color: sys.color.ink }}>{option.label}</T>
              {value === option.value ? <Check size={18} color={sys.color.green} /> : null}
            </Press>)}
          </ScrollView>
          <Button kind="quiet" label="Odustani" onPress={() => setOpen(false)} />
        </SafeAreaView>
      </View>
    </Modal>
  </View>;
}

export function LocationConfirmation({ checked, disabled, onChange, children }: {
  checked: boolean; disabled: boolean; onChange: (next: boolean) => void; children: ReactNode;
}) {
  return <Press accessibilityRole="checkbox" accessibilityLabel="Potvrđujem unetu lokaciju"
    accessibilityState={{ checked, disabled }} disabled={disabled} haptic="select" onPress={() => onChange(!checked)}
    style={[locationStyles.notice, locationStyles.row, { minHeight: 50 }]}>
    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: sys.color.green,
      alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? sys.color.green : sys.color.surface }}>
      {checked ? <Check size={16} color={sys.color.surface} weight="bold" /> : null}
    </View>
    <T variant="body" style={{ flex: 1, color: sys.color.ink }}>{children}</T>
  </Press>;
}

export function PrivateLocationNote() {
  return <View style={[locationStyles.notice, locationStyles.row]}>
    <LockKey size={22} color={sys.color.green} />
    <T variant="meta" style={{ flex: 1, color: sys.color.ink }}>Tačna adresa i napomene su privatne. Dostupne su učesnicima tek kada Dogovor i dozvola za deljenje to omogućavaju.</T>
  </View>;
}

export function LocationScreen({ title, onBack, loading, error, onRetry, children }: {
  title: string; onBack: () => void; loading: boolean; error?: string | null; onRetry: () => void; children?: ReactNode;
}) {
  return <SafeAreaView style={locationStyles.screen} edges={['top', 'bottom']}>
    <View style={locationStyles.header}>
      <Press accessibilityLabel="Nazad" accessibilityRole="button" haptic="select" onPress={onBack} style={locationStyles.back}>
        <V2Icon name="back" />
      </Press>
      <T accessibilityRole="header" variant="title" style={{ flex: 1, color: sys.color.ink }}>{title}</T>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={locationStyles.content}>
        {loading ? <View style={locationStyles.notice} accessibilityRole="progressbar" accessibilityLabel="Učitavanje lokacije">
          <ActivityIndicator color={sys.color.green} /><T variant="body" style={{ color: sys.color.ink }}>Učitavamo sačuvanu lokaciju…</T>
        </View> : children}
        {error ? <View style={[locationStyles.notice, { backgroundColor: sys.color.dangerSoft }]}>
          <T accessibilityRole="alert" tone="danger">{error}</T>
          <Button label="Učitaj sačuvano stanje" kind="secondary" onPress={onRetry} />
        </View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
