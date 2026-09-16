import { StyleSheet, View } from 'react-native';
import { CaretRight, ChatsCircle } from 'phosphor-react-native';
import { Press } from '../Press';
import { card, sys } from '../system/tokens';
import { T } from '../Text';

/** Entry to the Task's public Q&A: one row, the visible action text stays the spoken label. The Q&A screen owns the flow. */
export function TaskQaEntry({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return <Press accessibilityRole="button" accessibilityLabel="Otvori pitanja i odgovore" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} haptic="select" scaleTo={0.99} style={[card, s.row, disabled && s.disabled]}>
    <View style={s.icon}><ChatsCircle size={20} color={sys.color.green} /></View>
    <View style={s.copy}>
      <T variant="bodyStrong" style={s.ink}>Pitanja o zadatku</T>
      <T variant="note" tone="muted">Otvori pitanja i odgovore</T>
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 18 },
  icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 }, ink: { color: sys.color.ink }, disabled: { opacity: 0.5 },
});
