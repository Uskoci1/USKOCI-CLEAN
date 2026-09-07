import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'phosphor-react-native';
import { EMPTY_DISCOVERY_FILTERS, type DiscoveryFilters as Filters } from '../../contracts/discoveryView';

export function DiscoveryFilters({ value, onClose, onConfirm }: { value: Filters; onClose: () => void; onConfirm: (value: Filters) => void }) {
  const [draft, setDraft] = useState(value);
  return <Modal visible transparent animationType="none" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zatvorite filtere" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><Text accessibilityRole="header" style={s.title}>Sužite izbor</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zatvorite filtere" onPress={onClose} style={s.close}><X size={23} color="#142F30" /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <Text style={s.label}>Grad ili opština</Text>
          <TextInput accessibilityLabel="Grad ili opština" value={draft.city} onChangeText={city => setDraft(old => ({ ...old, city }))}
            placeholder="Svi gradovi" placeholderTextColor="#5D6E6D" autoCorrect={false} maxLength={100} style={s.input} />
          <Text style={s.note}>Za prevoz se ovaj izbor odnosi na polazište.</Text>
          <Text style={s.label}>Gde se radi</Text>
          <View style={s.options}>{([['ALL', 'Sve'], ['PHYSICAL', 'Na lokaciji'], ['REMOTE', 'Daljinski']] as const).map(([key, label]) =>
            <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: draft.location === key }} onPress={() => setDraft(old => ({ ...old, location: key }))}
              style={[s.option, draft.location === key && s.selected]}><Text style={[s.optionText, draft.location === key && s.onSelected]}>{label}</Text></Pressable>)}</View>
          <Text style={s.label}>Cena</Text>
          <View style={s.options}>{([['ALL', 'Sve'], ['OFFERS', 'Traže se ponude'], ['MY_PRICE', 'Naveden iznos']] as const).map(([key, label]) =>
            <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: draft.price === key }} onPress={() => setDraft(old => ({ ...old, price: key }))}
              style={[s.option, draft.price === key && s.selected]}><Text style={[s.optionText, draft.price === key && s.onSelected]}>{label}</Text></Pressable>)}</View>
        </ScrollView>
        <View style={s.footer}><Pressable accessibilityRole="button" onPress={() => setDraft({ ...EMPTY_DISCOVERY_FILTERS, query: draft.query })} style={s.reset}><Text style={s.optionText}>Poništite filtere</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onConfirm(draft)} style={s.apply}><Text style={s.applyText}>Prikažite zadatke</Text></Pressable></View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#142F3066' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF', paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  title: { flex: 1, fontSize: 26, lineHeight: 34, fontWeight: '700', color: '#142F30' }, close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingTop: 8, gap: 14 }, label: { color: '#142F30', fontSize: 15, lineHeight: 22, fontWeight: '600', marginTop: 8 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#DCE3DE', borderRadius: 14, padding: 14, color: '#142F30', fontSize: 16 },
  note: { color: '#5D6E6D', fontSize: 12, lineHeight: 19 },
  options: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  option: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#F7F8F5', borderRadius: 14, justifyContent: 'center' },
  selected: { backgroundColor: '#142F30' }, optionText: { color: '#142F30', fontSize: 14, lineHeight: 22, fontWeight: '600' }, onSelected: { color: '#FFFFFF' },
  footer: { paddingHorizontal: 24, paddingTop: 12, gap: 10 }, reset: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  apply: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FA6B32' },
  applyText: { color: '#142F30', fontSize: 16, lineHeight: 24, fontWeight: '700' },
});
