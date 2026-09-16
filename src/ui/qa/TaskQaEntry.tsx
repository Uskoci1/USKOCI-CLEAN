import { StyleSheet, View } from 'react-native';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/** Entry to the Task's public Q&A: one card, one secondary action. The Q&A screen owns the flow. */
export function TaskQaEntry({onPress,disabled=false}:{onPress:()=>void;disabled?:boolean}) {
  return <View style={s.card}>
    <T variant="heading" style={s.ink}>Pitanja o zadatku</T>
    <T variant="meta" tone="muted">Pitanja i odgovori koji razjašnjavaju ovaj zadatak pre dogovora.</T>
    <V2Action label="Otvori pitanja i odgovore" onPress={onPress} disabled={disabled}/>
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, padding: 18, gap: 10 },
  ink: { color: sys.color.ink },
});
