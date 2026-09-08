import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, Clock, MapPin, Users } from 'phosphor-react-native';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { discoveryPrice } from '../../data/discoveryView';

export function TaskCard({ task, onOpen, selected = false }: { task: PrilikaProjekcija; onOpen: () => void; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Otvorite priliku ${task.naslov}`}
    accessibilityState={{ selected }} onPress={onOpen} style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}>
    <View style={styles.top}><View style={styles.chip}><Text style={styles.chipText}>{task.statusTekst}</Text></View>
      {task.executionLocationMode === 'REMOTE' ? <Text style={styles.remote}>Daljinski</Text> : null}</View>
    <Text style={styles.title}>{task.naslov}</Text>
    <View style={styles.metadata}>
      <View style={styles.row}><MapPin size={17} color="#5D6E6D" /><Text style={styles.copy}>{task.podrucjeTekst}</Text></View>
      <View style={styles.row}><Clock size={17} color="#5D6E6D" /><Text style={styles.copy}>{task.vremeTekst}</Text></View>
      <View style={styles.row}><Users size={17} color="#5D6E6D" /><Text style={styles.copy}>Popunjeno {task.pokrivenost.popunjeno} od {task.pokrivenost.ukupno} mesta</Text></View>
    </View>
    {task.uslovi.length ? <View style={styles.conditions}>{task.uslovi.map((condition, i) => <Text key={`${i}:${condition}`} style={styles.condition}>{condition}</Text>)}</View> : null}
    <View style={styles.footer}><View style={styles.footerText}>
      <Text style={styles.price}>{discoveryPrice(task)}</Text>
      <Text style={styles.person}>{task.narucilacIme || 'Naručilac'}{task.narucilacOcena ? ` · ${task.narucilacOcena}` : ''}</Text>
    </View><View style={styles.arrow}><ArrowUpRight size={22} color="#142F30" /></View></View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { padding: 22, gap: 16, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE3DE' },
  selected: { borderColor: '#FA6B32', borderWidth: 2, padding: 21 }, pressed: { opacity: 0.78 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#E9F3F9' },
  chipText: { color: '#235F87', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  remote: { fontSize: 12, lineHeight: 18, color: '#5D6E6D', fontWeight: '600' },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3, color: '#142F30' },
  metadata: { gap: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, color: '#5D6E6D', fontSize: 14, lineHeight: 21 },
  conditions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  condition: { color: '#5D6E6D', backgroundColor: '#F7F8F5', borderRadius: 7, paddingVertical: 5, paddingHorizontal: 8, fontSize: 12, lineHeight: 18 },
  footer: { borderTopWidth: 1, borderTopColor: '#DCE3DE', paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerText: { flex: 1, gap: 4 }, price: { color: '#142F30', fontSize: 19, lineHeight: 27, fontWeight: '700' },
  person: { color: '#5D6E6D', fontSize: 12, lineHeight: 18 },
  arrow: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8F5' },
});
