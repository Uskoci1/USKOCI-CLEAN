import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, Check } from 'phosphor-react-native';
import { DetailTopBar } from '../system/DetailTopBar';
import { TurningCaret } from '../system/Disclosure';
import { useReducedMotion } from '../system/motion';
import { StateView } from '../system/StateView';
import { card, sys, fieldBox } from '../system/tokens';
import { ProductSheet } from '../product/ProductSheet';
import { V2Action as Button } from '../v2/V2Action';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';

/** Location form geometry on the shared system; the existing native typography and action owners stay. */
export const locationStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { padding: 20, gap: 16, paddingBottom: 36 },
  section: { gap: 12 },
  card: { ...card, gap: 12 },
  input: { ...fieldBox, ...sys.type.body, color: sys.color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notice: { backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.card, padding: 16, gap: 10 },
  failure: { paddingHorizontal: 20, paddingTop: 16 },
});

/** Keep secondary fields available without competing with the current place or pin. */
export function LocationDetails({ label, summary, children, disabled = false, initiallyOpen = false }: {
  label: string; summary?: string; children: ReactNode; disabled?: boolean;
  /** Open from the start when what it holds still has to be chosen (a country that is not set). */
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={locationStyles.section}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }}
      disabled={disabled} haptic="select" scaleTo={0.99} onPress={() => { if (!disabled) setOpen(value => !value); }}
      style={[locationStyles.row, { minHeight: 56, paddingVertical: sys.space.sm }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" style={{ color: sys.color.ink }}>{label}</T>
        {!open && summary ? <T variant="meta" tone="muted">{summary}</T> : null}
      </View>
      {/* The app's one caret (Disclosure): down when closed, up when open, still under reduced motion. */}
      <TurningCaret open={open} />
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
  // The sheet arriving is the choice opening — feedback, like the calendar's date sheet — and it
  // stands still for a person who asked the system for less motion.
  const reduced = useReducedMotion();
  const selected = options.find(option => option.value === value);
  return <View style={{ gap: 6 }}>
    <T variant="meta" tone="muted">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected?.label ?? 'Nije izabrano' }}
      accessibilityState={{ disabled, expanded: open }} disabled={disabled} haptic="select" scaleTo={0.99} onPress={() => setOpen(true)}
      style={[locationStyles.input, locationStyles.row, disabled && { backgroundColor: sys.color.wash }]}>
      <T variant="body" style={{ flex: 1, color: selected ? sys.color.ink : sys.color.muted }}>{selected?.label ?? 'Izaberi'}</T><CaretDown size={18} color={sys.color.green} />
    </Press>
    {/* The shared sheet (master plan: the hand-made Modals become ProductSheet). A choice that is not available yet
        says so in words, and stays readable instead of fading. */}
    {open ? <ProductSheet title={label} reduced={reduced} onClose={() => setOpen(false)}>{dismiss => <View style={{ gap: sys.space.sm }}>
      {options.map(option => <Press key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
        accessibilityHint={option.disabled ? 'Još nije dostupno.' : undefined}
        accessibilityState={{ selected: option.value === value, disabled: !!option.disabled }} disabled={option.disabled} haptic="select"
        onPress={() => { onChange(option.value); dismiss(); }}
        style={[locationStyles.row, { minHeight: 56, paddingHorizontal: 14, paddingVertical: sys.space.sm, borderRadius: sys.radius.control, borderWidth: 1,
          borderColor: value === option.value ? sys.color.green : sys.color.line, backgroundColor: value === option.value ? sys.color.greenSoft : sys.color.surface }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant={value === option.value ? 'bodyStrong' : 'body'} style={{ color: option.disabled ? sys.color.muted : sys.color.ink }}>{option.label}</T>
          {option.disabled ? <T variant="note" tone="muted">Još nije dostupno</T> : null}
        </View>
        {value === option.value ? <Check size={18} color={sys.color.green} /> : null}
      </Press>)}
    </View>}</ProductSheet> : null}
  </View>;
}

export function LocationConfirmation({ checked, disabled, onChange, children }: {
  checked: boolean; disabled: boolean; onChange: (next: boolean) => void; children: ReactNode;
}) {
  return <Press accessibilityRole="checkbox" accessibilityLabel="Potvrđujem unetu lokaciju"
    accessibilityState={{ checked, disabled }} disabled={disabled} haptic="select" onPress={() => onChange(!checked)}
    style={[locationStyles.notice, locationStyles.row, { minHeight: 50 }]}>
    {/* A checkbox is a rounded square: the 12 badge corner turned this 24 px box into a circle, which reads as a radio. */}
    <View style={{ width: 24, height: 24, borderRadius: sys.radius.check, borderWidth: 1.5, borderColor: sys.color.green,
      alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? sys.color.green : sys.color.surface }}>
      {checked ? <Check size={16} color={sys.color.surface} weight="bold" /> : null}
    </View>
    <T variant="body" style={{ flex: 1, color: sys.color.ink }}>{children}</T>
  </Press>;
}

export function PrivateLocationNote() {
  return <View style={[locationStyles.notice, locationStyles.row]}>
    <FactArt kind="lock" size={24} />
    <T variant="meta" style={{ flex: 1, color: sys.color.ink }}>Tačna adresa i napomene su privatne. Dostupne su učesnicima tek kada Dogovor i dozvola za deljenje to omogućavaju.</T>
  </View>;
}

export function LocationScreen({ title, onBack, loading, error, onRetry, children, scroll = true }: {
  title: string; onBack: () => void; loading: boolean; error?: string | null; onRetry: () => void; children?: ReactNode;
  /** False when the child is a whole step that scrolls on its own and keeps its save in a footer (`layout="screen"`). */
  scroll?: boolean;
}) {
  // Loading is the app's one state view. A failure stays beside the form: under it in a scrolling screen (where the save
  // is), above it in a step that keeps its save in a footer.
  const failure = error ? <View style={[locationStyles.notice, { backgroundColor: sys.color.dangerSoft }]}>
    <T accessibilityRole="alert" tone="danger">{error}</T>
    <Button label="Učitaj sačuvano stanje" kind="secondary" onPress={onRetry} />
  </View> : null;
  return <SafeAreaView style={locationStyles.screen} edges={['top', 'bottom']}>
    <DetailTopBar title={title} onBack={onBack} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {loading ? <ScrollView contentContainerStyle={locationStyles.content}>
        <StateView kind="loading" title="Učitavamo sačuvanu lokaciju…" skeleton={{ count: 1, rows: 4 }} />
      </ScrollView> : scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={locationStyles.content}>{children}{failure}</ScrollView>
        : <View style={{ flex: 1 }}>{failure ? <View style={locationStyles.failure}>{failure}</View> : null}{children}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
