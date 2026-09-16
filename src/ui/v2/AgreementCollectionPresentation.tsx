import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarBlank, Check } from 'phosphor-react-native';
import type { DogovorProjekcija, Uloga } from '../../contracts/projections';
import { Press } from '../Press';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, intentLabel, sys } from '../system/tokens';
import { T } from '../Text';
import { agreementStateText, peopleText } from './AgreementPresentation';
import { V2Action } from './V2Action';

export type AgreementCollectionSection = 'active' | 'history' | 'all';
type Props = {
  items: readonly DogovorProjekcija[]; loading: boolean; error: boolean; requester: boolean;
  section: AgreementCollectionSection; confirmationOnly: boolean;
  onSection: (value: AgreementCollectionSection) => void; onConfirmationOnly: (value: boolean) => void;
  onRefresh: () => void; onOpen: (agreement: DogovorProjekcija) => void;
  onCalendar: () => void; onProfile: () => void; onTasks: () => void;
  /** Which intent the user is in; shown in the header. The collection itself always holds both roles. */
  intent?: Uloga;
};
const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'history', label: 'Istorija' }, { key: 'all', label: 'Svi' }] as const;
const isActive = (item: DogovorProjekcija) => item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER';
const awaitsMyConfirmation = (item: DogovorProjekcija) => item.stanje === 'AWAITING_REQUESTER'
  && item.ucesnici.some(person => person.viSte && person.uloga === 'narucilac');
const Separator = () => <View style={{ height: 14 }} />;
const keyOf = (item: DogovorProjekcija) => item.id;

/** One Agreement as a scan block: status → title → where/when → agreed price and people → the other party. */
function AgreementCard({ item, onOpen }: { item: DogovorProjekcija; onOpen: () => void }) {
  const other = item.ucesnici.find(person => !person.viSte), mine = item.ucesnici.find(person => person.viSte);
  const attention = awaitsMyConfirmation(item), muted = !isActive(item);
  const tone = item.stanje === 'CANCELLED' ? sys.color.muted : item.stanje === 'AWAITING_REQUESTER' ? sys.color.warn : sys.color.green;
  return <Press accessibilityRole="button" accessibilityLabel={`Otvorite Dogovor ${item.naslov}`} onPress={onOpen}
    haptic="select" scaleTo={0.986} style={[s.card, attention && s.attentionCard, muted && s.mutedCard]}>
    <View style={s.statusRow}><View style={[s.dot, { backgroundColor: tone }]} />
      <T variant="meta" style={[s.status, { color: tone }]}>{agreementStateText(item.stanje)}{item.verzija > 1 ? ` · verzija ${item.verzija}` : ''}</T></View>
    <T style={s.title}>{item.naslov}</T>
    <T variant="meta" tone="muted">{item.rezim === 'DALJINSKI' ? 'Na daljinu' : item.putanjaTekst}</T>
    <T variant="meta" tone="muted">{item.vremeTekst}</T>
    <View style={s.bottom}>
      <T style={s.price}>{item.cena.prikaz}</T>
      <View style={s.pill}><T variant="meta" style={s.pillText}>{peopleText(item.pokrivenost.popunjeno)}</T></View>
    </View>
    <View style={s.person}>
      <View style={s.avatar}><T variant="label" style={s.initials}>{other?.inicijali ?? '—'}</T></View>
      <View style={s.grow}><T variant="bodyStrong" style={s.personName}>{other?.ime ?? 'Druga strana'}</T>
        <T variant="meta" tone="muted">{mine?.uloga === 'narucilac' ? 'Ti naručuješ' : mine?.uloga === 'uskocer' ? 'Ti radiš' : 'Tvoja saradnja'}</T></View>
    </View>
    {item.problemOtvoren ? <View style={s.problem}><T variant="meta" style={s.problemText}>Prijavljen je problem · pogledajte Dogovor</T></View> : null}
  </Press>;
}

/** D01 shares the accepted Agreement projection in both account roles. Presentation only. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error, onOpen } = props;
  const visible = useMemo(() => items.filter(item => (section === 'all' || (section === 'active' ? isActive(item) : !isActive(item)))
    && (!confirmationOnly || awaitsMyConfirmation(item))), [items, section, confirmationOnly]);
  const renderItem = useCallback(({ item }: { item: DogovorProjekcija }) => <AgreementCard item={item} onOpen={() => onOpen(item)} />, [onOpen]);
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><SkeletonList count={3} rows={2} /><T variant="meta" tone="muted" style={s.center}>Učitavamo Dogovore…</T></>
      : error ? <View style={s.state}><T style={s.stateTitle}>Dogovore trenutno nije moguće učitati</T><T style={s.stateBody}>Proverite internet vezu i pokušajte ponovo.</T>
        <V2Action label="Pokušajte ponovo" onPress={props.onRefresh} style={brandAction} /></View>
        : items.length ? <View style={s.state}><T style={s.stateTitle}>Nema Dogovora u ovom prikazu</T><T style={s.stateBody}>Pogledajte sve saradnje iz obe uloge.</T>
          <V2Action label="Prikaži sve Dogovore" onPress={() => { props.onSection('all'); props.onConfirmationOnly(false); }} /></View>
          : <View style={s.state}><T style={s.stateTitle}>Još nemate Dogovor</T><T style={s.stateBody}>{props.requester
            ? 'Kada izaberete nekoga iz Prijava, Dogovor se pojavljuje ovde.'
            : 'Kada Vaša Prijava bude izabrana, Dogovor se pojavljuje ovde.'}</T>
            <V2Action label="Pogledajte Zadatke" onPress={props.onTasks} style={brandAction} /></View>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <ScreenHeader eyebrow={props.intent ? intentLabel(props.intent) : 'Obe uloge'} title="Dogovori" onProfile={props.onProfile} />
    <View style={s.toolbar}>
      <Segmented options={SECTIONS} value={section} onChange={props.onSection} style={s.grow} />
      {!props.requester ? <Press accessibilityRole="button" accessibilityLabel="Radni raspored (JA MOGU)" onPress={props.onCalendar} haptic="select" style={s.tool}>
        <CalendarBlank size={22} color={sys.color.ink} /></Press> : null}
    </View>
    <Press accessibilityRole="checkbox" accessibilityLabel="Čeka moju potvrdu" accessibilityState={{ checked: confirmationOnly }}
      onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select" style={s.attention}>
      <View style={[s.check, confirmationOnly && s.checked]}>{confirmationOnly ? <Check size={14} color={sys.color.surface} weight="bold" /> : null}</View>
      <T variant="bodyStrong" style={s.attentionText}>Čeka moju potvrdu</T>
    </Press>
    <FlatList<DogovorProjekcija> data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={loading}
      onRefresh={props.onRefresh} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      ItemSeparatorComponent={Separator} renderItem={renderItem} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  tool: { minWidth: 46, minHeight: 46, borderRadius: sys.radius.control, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line, alignItems: 'center', justifyContent: 'center' },
  attention: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginHorizontal: 20, marginVertical: 6 },
  attentionText: { color: sys.color.ink },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: sys.color.green, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  checked: { backgroundColor: sys.color.green },
  list: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 28, flexGrow: 1 },
  empty: { paddingVertical: 8, gap: 16, flex: 1 }, center: { textAlign: 'center' },
  state: { paddingVertical: 32, paddingHorizontal: 4, gap: 12, alignItems: 'flex-start' },
  stateTitle: { ...sys.type.title, color: sys.color.ink }, stateBody: { ...sys.type.body, color: sys.color.muted, marginBottom: 6 },
  card: { padding: 18, gap: 6, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  attentionCard: { borderColor: sys.color.orange }, mutedCard: { backgroundColor: sys.color.ground },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 8, height: 8, borderRadius: 4 }, status: { fontWeight: '600', flexShrink: 1 },
  title: { ...sys.type.cardTitle, color: sys.color.ink, marginTop: 2, marginBottom: 2 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  price: { ...sys.type.price, color: sys.color.money, flex: 1, minWidth: 120 },
  pill: { borderRadius: 10, backgroundColor: sys.color.greenSoft, paddingHorizontal: 10, paddingVertical: 7 }, pillText: { color: sys.color.ink, fontWeight: '700' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 14, borderTopWidth: 1, borderColor: sys.color.line },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { color: sys.color.green }, personName: { color: sys.color.ink },
  problem: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: sys.color.dangerSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  problemText: { color: sys.color.danger, fontWeight: '600' },
});
