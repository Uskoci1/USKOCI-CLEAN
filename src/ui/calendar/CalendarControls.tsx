import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { ArrowLeft, CalendarBlank } from 'phosphor-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { brandAction, sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { Press } from '../Press';
import { T as BaseText } from '../Text';
import { deviceDate, deviceTime } from './calendarPresentation';

/** Calendar surfaces on the shared system: ground, white cards, green as orientation, orange as the one brand action. */
export const calendarStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  header: { paddingHorizontal: 12, paddingVertical: 8, gap: 10, flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, gap: 14 },
  card: { padding: 16, gap: 12, borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card, backgroundColor: sys.color.surface },
  note: { padding: 16, gap: 8, borderRadius: sys.radius.card, backgroundColor: sys.color.greenSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  input: { minHeight: 50, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1,
    borderColor: sys.color.lineStrong, borderRadius: sys.radius.control, ...sys.type.body, color: sys.color.ink, backgroundColor: sys.color.surface },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, gap: 8, backgroundColor: sys.color.surface, borderTopWidth: 1, borderColor: sys.color.line },
  divider: { height: 1, backgroundColor: sys.color.line },
});

/** Scoped to the calendar surfaces; maps its variants onto the shared type scale. */
export function CalendarText({ variant = 'body', tone = 'ink', style, ...props }: ComponentProps<typeof BaseText>) {
  const typography = variant === 'title' ? sys.type.title : variant === 'heading' ? sys.type.heading
    : variant === 'meta' || variant === 'label' ? sys.type.meta
      : variant === 'bodyStrong' || variant === 'action' ? sys.type.bodyStrong : sys.type.body;
  const color = tone === 'muted' ? sys.color.muted : tone === 'onDark' ? sys.color.surface
    : tone === 'danger' ? sys.color.danger : tone === 'success' ? sys.color.green : sys.color.ink;
  return <BaseText {...props} style={[typography, { color }, style]} />;
}
const T = CalendarText;
/** `primary` is the one brand action (orange surface, ink text); the rest map onto V2Action kinds. */
export function CalendarAction({ kind = 'primary', full: _full, style, ...props }: ComponentProps<typeof V2Action> & { full?: boolean }) {
  return <V2Action {...props} kind={kind === 'primary' ? 'secondary' : kind}
    style={[kind === 'primary' && brandAction, style]} />;
}
const Button = CalendarAction;

export function CalendarScreen({ title, back, children, loading = false, scroll = true, footer }: {
  title: string; back: () => void; children: ReactNode; loading?: boolean; scroll?: boolean; footer?: ReactNode;
}) {
  const body = loading ? <View style={calendarStyles.note} accessibilityLabel="Učitavanje dostupnosti" accessibilityRole="progressbar">
    <ActivityIndicator color={sys.color.green} /><T>Učitavamo sačuvanu dostupnost…</T></View> : children;
  return <SafeAreaView edges={['top', 'bottom']} style={calendarStyles.screen}>
    <View style={calendarStyles.header}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" haptic="select" onPress={back} style={calendarStyles.icon}>
        <ArrowLeft size={22} color={sys.color.ink} />
      </Press><T variant="title" accessibilityRole="header" style={{ flex: 1 }}>{title}</T>
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
  return <View style={{ gap: 6 }}><T variant="meta" tone="muted">{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} placeholder={placeholder} placeholderTextColor={sys.color.muted}
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
  return <View style={{ gap: 6 }}><T variant="meta" tone="muted">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} haptic="select" scaleTo={0.99} onPress={openPicker} style={[calendarStyles.input, calendarStyles.row, disabled && { backgroundColor: sys.color.ground }]}>
      <T style={{ flex: 1, color: value ? sys.color.ink : sys.color.muted }}>{value || (mode === 'date' ? 'Izaberi datum' : 'Izaberi vreme')}</T>
      <CalendarBlank size={20} color={sys.color.green} />
    </Press>
    {open && Platform.OS === 'android' ? <DateTimePicker mode={mode} value={selection} is24Hour
      onDismiss={() => setOpen(false)} onValueChange={(_, date) => accept(date)}
      positiveButton={{ label: 'Izaberi' }} negativeButton={{ label: 'Odustani' }} accentColor={sys.color.green} /> : null}
    {open && Platform.OS === 'ios' ? <Modal visible transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: sys.color.scrim }}>
        <SafeAreaView style={[calendarStyles.card, { borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet }]}><T variant="heading">{label}</T>
          <DateTimePicker mode={mode} display="spinner" value={selection} locale="sr_Latn_RS"
            onValueChange={(_, date) => setSelection(date)} accentColor={sys.color.green} />
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
