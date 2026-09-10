import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { ArrowLeft, CalendarBlank } from 'phosphor-react-native';
import { palette, radius, space } from '../../theme/tokens';
import { Button } from '../Button';
import { Press } from '../Press';
import { T } from '../Text';
import { deviceDate, deviceTime } from './calendarPresentation';

export const calendarStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ground },
  header: { padding: space.base, gap: space.md, flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.lg },
  card: { padding: space.base, gap: space.md, borderWidth: 1, borderColor: palette.line100,
    borderRadius: radius.xl, backgroundColor: palette.surface },
  note: { padding: space.base, gap: space.sm, borderRadius: radius.lg, backgroundColor: palette.successBg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  input: { minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.md, borderWidth: 1,
    borderColor: palette.sage300, borderRadius: radius.md, fontSize: 16, color: palette.ink, backgroundColor: palette.surface },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
});

export function CalendarScreen({ title, back, children, loading = false }: {
  title: string; back: () => void; children: ReactNode; loading?: boolean;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={calendarStyles.screen}>
    <View style={calendarStyles.header}>
      <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={back} style={calendarStyles.icon}>
        <ArrowLeft size={22} color={palette.ink} />
      </Press><T variant="title" style={{ flex: 1 }}>{title}</T>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={calendarStyles.content}>
        {loading ? <View style={calendarStyles.note} accessibilityLabel="Učitavanje dostupnosti" accessibilityRole="progressbar">
          <ActivityIndicator color={palette.teal500} /><T>Učitavamo sačuvanu dostupnost…</T>
        </View> : children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function CalendarField({ label, value, onChange, disabled, placeholder, maxLength = 256 }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string; maxLength?: number;
}) {
  return <View style={{ gap: space.sm }}><T variant="bodyStrong">{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} placeholder={placeholder} placeholderTextColor={palette.inkMuted}
      style={calendarStyles.input} maxLength={maxLength} />
  </View>;
}

/** Picker edits civil fields, deliberately separate from the account's named timezone. */
export function CivilField({ label, mode, value, onChange, disabled }: {
  label: string; mode: 'date' | 'time'; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
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
  return <View style={{ gap: space.sm }}><T variant="bodyStrong">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={openPicker} style={[calendarStyles.input, calendarStyles.row]}>
      <T style={{ flex: 1 }}>{value || (mode === 'date' ? 'Izaberite datum' : 'Izaberite vreme')}</T>
      <CalendarBlank size={20} color={palette.teal500} />
    </Press>
    {open && Platform.OS === 'android' ? <DateTimePicker mode={mode} value={selection} is24Hour
      onDismiss={() => setOpen(false)} onValueChange={(_, date) => accept(date)}
      positiveButton={{ label: 'Izaberi' }} negativeButton={{ label: 'Odustani' }} accentColor={palette.teal500} /> : null}
    {open && Platform.OS === 'ios' ? <Modal visible transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}>
        <SafeAreaView style={calendarStyles.card}><T variant="heading">{label}</T>
          <DateTimePicker mode={mode} display="spinner" value={selection} locale="sr_Latn_RS"
            onValueChange={(_, date) => setSelection(date)} accentColor={palette.teal500} />
          <Button label="Izaberi" onPress={() => accept(selection)} full />
          <Button label="Odustani" kind="quiet" onPress={() => setOpen(false)} full />
        </SafeAreaView>
      </View>
    </Modal> : null}
  </View>;
}

export function EditorSheet({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <Modal visible animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
    <CalendarScreen title={title} back={close}>{children}</CalendarScreen>
  </Modal>;
}
