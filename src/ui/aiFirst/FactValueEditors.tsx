import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { X } from 'phosphor-react-native';
import { CivilField } from '../calendar/CalendarControls';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { aiFirst as a } from './tokens';

/**
 * A moment, corrected with the pickers the app already has. The zone is said in words because the
 * review states every moment in it, and a time with no zone beside it reads as the phone's.
 */
export function FactTimestampEditor({ label, date, time, disabled, onChange }: {
  label: string; date: string; time: string; disabled: boolean; onChange: (date: string, time: string) => void;
}) {
  return <View style={s.stack}>
    <CivilField label={`${label}: datum`} mode="date" value={date} disabled={disabled} onChange={value => onChange(value, time)} />
    <CivilField label={`${label}: vreme`} mode="time" value={time} disabled={disabled} onChange={value => onChange(date, value.slice(0, 5))} />
    <T style={s.note}>Vreme u Beogradu.</T>
  </View>;
}

/**
 * A list, corrected item by item. What is typed and not yet added is reported upward as well, so
 * saving with a word still in the box keeps that word instead of dropping it without a sign.
 */
export function FactListEditor({ label, items, disabled, onChange }: {
  label: string; items: readonly string[]; disabled: boolean; onChange: (items: string[], typed: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const add = () => {
    const value = typed.trim();
    setTyped('');
    onChange(value && !items.includes(value) ? [...items, value] : [...items], '');
  };
  return <View style={s.stack}>
    {items.length ? <View style={s.items}>{items.map(item => <View key={item} style={s.item}>
      <T style={s.itemText}>{item}</T>
      <Press accessibilityRole="button" accessibilityLabel={`Ukloni: ${item}`} disabled={disabled} style={s.remove}
        onPress={() => onChange(items.filter(other => other !== item), typed)}>
        <X size={18} color={a.color.muted} />
      </Press>
    </View>)}</View> : <T style={s.note}>Još nema stavki.</T>}
    <View style={s.addRow}>
      <TextInput accessibilityLabel={`Nova stavka: ${label}`} value={typed} editable={!disabled} maxLength={500}
        placeholder="Dodaj stavku" placeholderTextColor={a.color.muted} returnKeyType="done" onSubmitEditing={add}
        onChangeText={value => { setTyped(value); onChange([...items], value); }} style={s.input} />
      <Press accessibilityRole="button" accessibilityLabel={`Dodaj stavku: ${label}`} disabled={disabled || !typed.trim()}
        style={[s.add, (disabled || !typed.trim()) && s.addOff]} onPress={add}>
        <T style={s.addLabel}>Dodaj</T>
      </Press>
    </View>
  </View>;
}

const s = StyleSheet.create({
  stack: { gap: 10 },
  note: { ...a.text.meta, color: a.color.muted },
  items: { gap: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: sys.radius.control,
    backgroundColor: a.color.wash },
  itemText: { ...a.text.body, color: a.color.ink, flex: 1, minWidth: 0, paddingVertical: 10 },
  remove: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { ...a.text.body, flex: 1, minWidth: 0, padding: 12, borderWidth: 1, borderColor: a.color.green,
    borderRadius: sys.radius.control, minHeight: 56, color: a.color.ink },
  add: { minHeight: 56, minWidth: 72, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
    borderRadius: sys.radius.control, backgroundColor: sys.color.greenSoft },
  addOff: { opacity: 0.5 },
  addLabel: { ...a.text.meta, fontWeight: '600', color: a.color.green },
});
