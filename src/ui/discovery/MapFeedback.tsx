import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function MapFeedback({ failed, onRetry, onList }: { failed: boolean; onRetry: () => void; onList: () => void }) {
  return <View style={styles.cover} accessibilityLiveRegion="polite">
    {failed ? <>
      <Text style={styles.title}>Mapa trenutno nije dostupna.</Text>
      <Text style={styles.copy}>Zadatke možete nastaviti da pregledate u listi.</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ponovo učitajte mapu" onPress={onRetry} style={styles.button}><Text style={styles.label}>Pokušajte ponovo</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onList} style={styles.button}><Text style={styles.label}>Otvorite listu</Text></Pressable>
      </View>
    </> : <><ActivityIndicator color="#142F30" /><Text style={styles.copy}>Učitavamo mapu…</Text>
      <Pressable accessibilityRole="button" onPress={onList} style={styles.button}><Text style={styles.label}>Otvorite listu</Text></Pressable></>}
  </View>;
}
const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20, backgroundColor: '#F7F8F5' },
  title: { color: '#142F30', fontSize: 18, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
  copy: { color: '#5D6E6D', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  button: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  label: { color: '#142F30', fontSize: 14, lineHeight: 22, fontWeight: '600' },
});
