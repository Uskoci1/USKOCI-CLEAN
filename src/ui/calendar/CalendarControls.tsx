import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { ArrowLeft, CalendarBlank } from 'phosphor-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { v2 } from '../v2/tokens';
import { V2Action } from '../v2/V2Action';
import { Press } from '../Press';
import { T as BaseText } from '../Text';
import { deviceDate, deviceTime } from './calendarPresentation';

export const calendarStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2.color.canvas },
  header: { paddingHorizontal: 12, paddingVertical: 8, gap: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: v2.color.header },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 22 },
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: v2.color.contextLine,
    borderRadius: 18, backgroundColor: v2.color.surface },
  note: { padding: 16, gap: 8, borderRadius: 17, backgroundColor: v2.color.context },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1,
    borderColor: v2.color.controlLine, borderRadius: 11, fontSize: 16, lineHeight: 24, color: v2.color.ink, backgroundColor: v2.color.surface },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, gap: 6, backgroundColor: v2.color.surface, borderTopWidth: 1, borderColor: v2.color.line },
  divider: { height: 1, backgroundColor: v2.color.line },
});

/** Scoped to the calendar surfaces; final SPOJ V2 type without changing legacy tokens. */
export function CalendarText({ variant = 'body', tone = 'ink', style, ...props }: ComponentProps<typeof BaseText>) {
  const typography = variant === 'title' ? v2.text.hero : variant === 'heading' ? v2.text.title
    : variant === 'meta' || variant === 'label' ? v2.text.label
      : variant === 'bodyStrong' || variant === 'action' ? { ...v2.text.body, fontWeight: '600' as const } : v2.text.body;
  const color = tone === 'muted' ? v2.color.muted : tone === 'onDark' ? v2.color.surface
    : tone === 'danger' ? v2.color.danger : tone === 'success' ? v2.color.teal : v2.color.ink;
  return <BaseText {...props} style={[typography, { color }, style]} />;
}
const T = CalendarText;
export function CalendarAction({ kind = 'primary', full: _full, style, ...props }: ComponentProps<typeof V2Action> & { full?: boolean }) {
  return <V2Action {...props} kind={kind === 'primary' ? 'secondary' : kind}
    style={[kind === 'primary' && { backgroundColor: v2.color.orange, borderWidth: 0, minHeight: 52, borderRadius: 16 }, style]} />;
}
const Button = CalendarAction;

export function CalendarScreen({ title, back, children, loading = false, scroll = true, footer }: {
  title: string; back: () => void; children: ReactNode; loading?: boolean; scroll?: boolean; footer?: ReactNode;
}) {
  const body = loading ? <View style={calendarStyles.note} accessibilityLabel="Učitavanje dostupnosti" accessibilityRole="progressbar">
    <ActivityIndicator color={v2.color.teal} /><T>Učitavamo sačuvanu dostupnost…</T></View> : children;
  return <SafeAreaView edges={['top', 'bottom']} style={calendarStyles.screen}>
    <View style={calendarStyles.header}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={back} style={calendarStyles.icon}>
        <ArrowLeft size={22} color={v2.color.ink} />
      </Press><T variant="heading" accessibilityRole="header" style={{ flex: 1 }}>{title}</T>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {scroll || loading ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={calendarStyles.content}>{body}</ScrollView> : <View style={{ flex: 1 }}>{body}</View>}
      {!loading && footer ? <View style={calendarStyles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function CalendarField({ label, value, onChange, disabled, placeholder, maxLength = 256 }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string; maxLength?: number;
}) {
  return <View style={{ gap: 8 }}><T variant="bodyStrong">{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} placeholder={placeholder} placeholderTextColor={v2.color.muted}
      style={calendarStyles.input} maxLength={maxLength} />
  </View>;
}

/** Picker edits civil fields, deliberately separate from the account's named timezone. */
export function CivilField({ label, mode, value, onChange, disabled }: {
  label: string; mode: 'date' | 'time'; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(new Date());
  const openPicker = () => {
    if (disabled) return;
    const seed = mode === 'date' ? new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : deviceDate(new Date())}T12:00:00${Platform.OS === 'android' ? 'Z' : ''}`)
      : mode === 'time' && /^\d{2}:\d{2}/.test(value) && !value.startsWith('24:')
        ? new Date(`${deviceDate(new Date())}T${value.slice(0, 5)}:00`) : new Date();
    setSelection(seed); setOpen(true);
  };
  // SDK57 Material date picker returns the selected civil date at UTC midnight.
  // Its time picker returns local Calendar time; the two must not share extraction.
  const accept = (date: Date) => { onChange(mode === 'date'
    ? Platform.OS === 'android' ? date.toISOString().slice(0, 10) : deviceDate(date)
    : deviceTime(date)); setOpen(false); };
  if (Platform.OS === 'web') return <CalendarField label={label} value={value} onChange={onChange}
    disabled={disabled} placeholder={mode === 'date' ? 'GGGG-MM-DD' : 'HH:MM'} maxLength={mode === 'date' ? 10 : 15} />;
  return <View style={{ gap: 8 }}><T variant="bodyStrong">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={openPicker} style={[calendarStyles.input, calendarStyles.row]}>
      <T style={{ flex: 1 }}>{value || (mode === 'date' ? 'Izaberite datum' : 'Izaberite vreme')}</T>
      <CalendarBlank size={20} color={v2.color.teal} />
    </Press>
    {open && Platform.OS === 'android' ? <DateTimePicker mode={mode} value={selection} is24Hour
      onDismiss={() => setOpen(false)} onValueChange={(_, date) => accept(date)}
      positiveButton={{ label: 'Izaberi' }} negativeButton={{ label: 'Odustani' }} accentColor={v2.color.teal} /> : null}
    {open && Platform.OS === 'ios' ? <Modal visible transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}>
        <SafeAreaView style={calendarStyles.card}><T variant="heading">{label}</T>
          <DateTimePicker mode={mode} display="spinner" value={selection} locale="sr_Latn_RS"
            onValueChange={(_, date) => setSelection(date)} accentColor={v2.color.teal} />
          <Button label="Izaberi" onPress={() => accept(selection)} full />
          <Button label="Odustani" kind="quiet" onPress={() => setOpen(false)} full />
        </SafeAreaView>
      </View>
    </Modal> : null}
  </View>;
}

export function EditorSheet({ title, close, children, footer }: { title: string; close: () => void; children: ReactNode; footer?: ReactNode }) {
  const reduced = useReducedMotion();
  return <Modal visible animationType={reduced ? 'none' : 'slide'} onRequestClose={close} presentationStyle="pageSheet">
    <CalendarScreen title={title} back={close} footer={footer}>{children}</CalendarScreen>
  </Modal>;
}
