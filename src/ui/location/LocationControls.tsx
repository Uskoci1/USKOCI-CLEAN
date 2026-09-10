import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, Check, LockKey } from 'phosphor-react-native';
import { palette } from '../../theme/tokens';
import { V2Action as Button } from '../v2/V2Action';
import { V2Icon } from '../v2/icons';
import { v2 } from '../v2/tokens';
import { Press } from '../Press';
import { T } from '../Text';

/** SPOJ V2 form geometry, using the existing native typography and action owners. */
export const locationStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2.color.canvas },
  content: { padding: v2.space.lg, gap: v2.space.xl, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12 },
  card: { backgroundColor: v2.color.surface, borderColor: v2.color.line, borderWidth: 1, borderRadius: v2.radius.card, padding: v2.space.lg, gap: v2.space.md },
  input: { minHeight: v2.target.primary, borderWidth: 1, borderColor: v2.color.controlLine, borderRadius: v2.radius.input, paddingHorizontal: 12,
    paddingVertical: 12, backgroundColor: v2.color.surface, color: v2.color.ink, ...v2.text.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notice: { backgroundColor: v2.color.context, borderRadius: v2.radius.card, padding: v2.space.lg, gap: 10 },
});

/** Keep secondary fields available without competing with the current place or pin. */
export function LocationDetails({ label, summary, children, disabled = false }: {
  label: string; summary?: string; children: ReactNode; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <View style={locationStyles.section}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }}
      disabled={disabled} haptic="select" onPress={() => { if (!disabled) setOpen(value => !value); }}
      style={[locationStyles.row, { minHeight: v2.target.minimum, paddingVertical: v2.space.sm }]}>
      <View style={{ flex: 1, gap: v2.space.xs }}>
        <T style={[v2.text.body, { color: v2.color.ink }]}>{label}</T>
        {!open && summary ? <T style={[v2.text.label, { color: v2.color.muted }]}>{summary}</T> : null}
      </View>
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><V2Icon name="chevron" size={18} /></View>
    </Press>
    {open ? children : null}
  </View>;
}

export function LocationField({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={{ gap: 8 }}>
    <T variant="bodyStrong">{label}</T>
    <TextInput accessibilityLabel={label} placeholderTextColor={palette.inkMuted} {...props}
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
  return <View style={locationStyles.section}>
    <T variant="bodyStrong">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected?.label ?? 'Nije izabrano' }}
      accessibilityState={{ disabled, expanded: open }} disabled={disabled} onPress={() => setOpen(true)}
      style={[locationStyles.input, locationStyles.row]}>
      <T style={{ flex: 1 }}>{selected?.label ?? 'Izaberi'}</T><CaretDown size={18} color={palette.teal500} />
    </Press>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#143D3566' }}>
        <Press accessibilityRole="button" accessibilityLabel="Zatvori izbor" onPress={() => setOpen(false)}
          style={{ flex: 1, minHeight: 44 }} />
        <SafeAreaView edges={['bottom']} accessibilityViewIsModal
          style={{ maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FAFCFB', padding: 20, gap: 18 }}>
          <T variant="heading">{label}</T>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            {options.map(option => <Press key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
              accessibilityState={{ selected: option.value === value, disabled: !!option.disabled }} disabled={option.disabled}
              onPress={() => { onChange(option.value); setOpen(false); }}
              style={[locationStyles.card, locationStyles.row, { minHeight: 50, opacity: option.disabled ? 0.5 : 1,
                borderColor: value === option.value ? palette.teal500 : '#E4EBE7' }]}>
              <T style={{ flex: 1 }}>{option.label}</T>
              {value === option.value ? <Check size={18} color={palette.teal500} /> : null}
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
    accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)}
    style={[locationStyles.notice, locationStyles.row, { minHeight: 50 }]}>
    <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: palette.teal500,
      alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? palette.teal500 : '#FFFFFF' }}>
      {checked ? <Check size={18} color="#FFFFFF" weight="bold" /> : null}
    </View>
    <T style={{ flex: 1 }}>{children}</T>
  </Press>;
}

export function PrivateLocationNote() {
  return <View style={[locationStyles.notice, locationStyles.row]}>
    <LockKey size={22} color={palette.teal500} />
    <T variant="meta" style={{ flex: 1 }}>Tačna adresa i napomene su privatne. Dostupne su učesnicima tek kada Dogovor i dozvola za deljenje to omogućavaju.</T>
  </View>;
}

export function LocationScreen({ title, onBack, loading, error, onRetry, children }: {
  title: string; onBack: () => void; loading: boolean; error?: string | null; onRetry: () => void; children?: ReactNode;
}) {
  return <SafeAreaView style={locationStyles.screen} edges={['top', 'bottom']}>
    <View style={locationStyles.header}>
      <Press accessibilityLabel="Nazad" accessibilityRole="button" onPress={onBack} style={locationStyles.back}>
        <V2Icon name="back" />
      </Press>
      <T accessibilityRole="header" style={{ flex: 1, ...v2.text.title, color: v2.color.ink }}>{title}</T>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={locationStyles.content}>
        {loading ? <View style={locationStyles.notice} accessibilityRole="progressbar" accessibilityLabel="Učitavanje lokacije">
          <ActivityIndicator color={palette.teal500} /><T>Učitavamo sačuvanu lokaciju…</T>
        </View> : children}
        {error ? <View style={locationStyles.notice}>
          <T accessibilityRole="alert" tone="danger">{error}</T>
          <Button label="Učitaj sačuvano stanje" kind="secondary" onPress={onRetry} />
        </View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
