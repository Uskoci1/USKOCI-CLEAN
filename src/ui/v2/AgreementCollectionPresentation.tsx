import { useMemo } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarBlank, Check, User } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { InboxBell } from '../InboxBell';
import { Press } from '../Press';
import { T } from '../Text';
import { AgreementHero } from './AgreementPresentation';
import { V2Action } from './V2Action';
import { v2 } from './tokens';

export type AgreementCollectionSection = 'active' | 'history' | 'all';
type Props = {
  items: readonly DogovorProjekcija[]; loading: boolean; error: boolean; requester: boolean;
  section: AgreementCollectionSection; confirmationOnly: boolean;
  onSection: (value: AgreementCollectionSection) => void; onConfirmationOnly: (value: boolean) => void;
  onRefresh: () => void; onOpen: (agreement: DogovorProjekcija) => void;
  onCalendar: () => void; onProfile: () => void; onTasks: () => void;
};
const isActive = (item: DogovorProjekcija) => item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER';
const awaitsMyConfirmation = (item: DogovorProjekcija) => item.stanje === 'AWAITING_REQUESTER'
  && item.ucesnici.some(person => person.viSte && person.uloga === 'narucilac');

/** D01 shares the accepted Agreement projection and V2 hero, in both account roles. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error } = props;
  const visible = useMemo(() => items.filter(item => (section === 'all' || (section === 'active' ? isActive(item) : !isActive(item)))
    && (!confirmationOnly || awaitsMyConfirmation(item))), [items, section, confirmationOnly]);
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><ActivityIndicator color={v2.color.teal} accessibilityLabel="Učitavamo Dogovore" /><T style={s.body}>Učitavamo Dogovore…</T></>
      : error ? <><T style={s.title}>Dogovore trenutno nije moguće učitati</T><T style={s.body}>Proverite internet vezu i pokušajte ponovo.</T>
        <V2Action label="Pokušajte ponovo" onPress={props.onRefresh} /></>
        : items.length ? <><T style={s.title}>Nema Dogovora u ovom prikazu</T><T style={s.body}>Pogledajte sve saradnje iz obe uloge.</T>
          <V2Action label="Prikaži sve Dogovore" onPress={() => { props.onSection('all'); props.onConfirmationOnly(false); }} /></>
          : <><T style={s.title}>Još nemate Dogovor</T><T style={s.body}>{props.requester
            ? 'Kada izaberete nekoga iz Prijava, Dogovor se pojavljuje ovde.'
            : 'Kada Vaša Prijava bude izabrana, Dogovor se pojavljuje ovde.'}</T>
            <V2Action label="Pogledajte Zadatke" onPress={props.onTasks} /></>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <View style={s.header}><View style={s.grow}><T style={s.caption}>Tvoje saradnje · obe uloge</T><T accessibilityRole="header" style={s.heading}>Dogovori</T></View>
      <InboxBell /><Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={props.onProfile} haptic="select" style={s.icon}><User size={21} color={v2.color.ink} /></Press>
    </View>
    <View style={s.toolbar}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
      {([['active', 'Aktivni'], ['history', 'Istorija'], ['all', 'Svi']] as const).map(([value, label]) => <Press key={value}
        accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: value === section }} onPress={() => props.onSection(value)}
        haptic="select" style={[s.choice, section === value && s.selected]}><T style={[s.choiceText, section === value && s.selectedText]}>{label}</T></Press>)}
    </ScrollView><Press accessibilityRole="button" accessibilityLabel="Kalendar Dogovora" onPress={props.onCalendar} haptic="select" style={s.icon}><CalendarBlank size={22} color={v2.color.ink} /></Press></View>
    <Press accessibilityRole="checkbox" accessibilityLabel="Čeka moju potvrdu" accessibilityState={{ checked: confirmationOnly }}
      onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select" style={s.attention}>
      <View style={[s.check, confirmationOnly && s.checked]}>{confirmationOnly ? <Check size={14} color={v2.color.surface} weight="bold" /> : null}</View>
      <T style={s.body}>Čeka moju potvrdu</T>
    </Press>
    <FlatList<DogovorProjekcija> data={loading || error ? [] : visible} keyExtractor={item => item.id} refreshing={loading}
      onRefresh={props.onRefresh} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />} renderItem={({ item }) => {
        const other = item.ucesnici.find(person => !person.viSte), mine = item.ucesnici.find(person => person.viSte);
        return <Press accessibilityRole="button" accessibilityLabel={`Otvorite Dogovor ${item.naslov}`} onPress={() => props.onOpen(item)}
          haptic="select" scaleTo={0.986} style={s.card}>
          <AgreementHero agreement={item} />
          <View style={s.person}><View style={s.avatar}><T style={s.initials}>{other?.inicijali ?? '—'}</T></View>
            <View style={s.grow}><T style={s.personName}>{other?.ime ?? 'Druga strana'}</T>
              <T style={s.caption}>{mine?.uloga === 'narucilac' ? 'Ti naručuješ' : mine?.uloga === 'uskocer' ? 'Ti radiš' : 'Tvoja saradnja'}</T></View></View>
          {item.problemOtvoren ? <T style={s.warning}>Prijavljen je problem · pogledajte Dogovor</T> : null}
        </Press>;
      }} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2.color.canvas }, grow: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  caption: { ...v2.text.label, color: v2.color.muted }, heading: { ...v2.text.title, color: v2.color.ink },
  title: { ...v2.text.hero, color: v2.color.ink }, body: { ...v2.text.body, color: v2.color.ink },
  icon: { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: v2.color.soft, alignItems: 'center', justifyContent: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 }, tabs: { flexDirection: 'row', gap: 4, flexGrow: 1 },
  choice: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: v2.color.soft }, choiceText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: v2.color.muted }, selectedText: { color: v2.color.ink },
  attention: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44, marginHorizontal: 20, marginVertical: 8 },
  check: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: v2.color.teal, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: v2.color.teal },
  list: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 28, flexGrow: 1 }, empty: { paddingVertical: 32, gap: 18, flex: 1, justifyContent: 'center' },
  card: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: v2.radius.card, borderWidth: 1, borderColor: v2.color.line, backgroundColor: v2.color.surface },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 14, paddingBottom: 4, borderTopWidth: 1, borderColor: v2.color.line },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: v2.color.soft, alignItems: 'center', justifyContent: 'center' },
  initials: { ...v2.text.label, color: v2.color.ink, fontWeight: '700' }, personName: { ...v2.text.body, color: v2.color.ink, fontWeight: '600' },
  warning: { ...v2.text.label, color: v2.color.danger, marginTop: 10, marginBottom: 4 },
});
