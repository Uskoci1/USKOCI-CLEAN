import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarBlank, Check, Clock, MapPin } from 'phosphor-react-native';
import type { DogovorProjekcija, Uloga } from '../../contracts/projections';
import { Press } from '../Press';
import { HeaderIconButton, ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, card, intentLabel, sys } from '../system/tokens';
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
const SECTION_TITLES: Record<AgreementCollectionSection, string> = { active: 'Aktivni dogovori', history: 'Istorija', all: 'Svi dogovori' };
const isActive = (item: DogovorProjekcija) => item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER';
const awaitsMyConfirmation = (item: DogovorProjekcija) => item.stanje === 'AWAITING_REQUESTER'
  && item.ucesnici.some(person => person.viSte && person.uloga === 'narucilac');
const Separator = () => <View style={{ height: 12 }} />;
const keyOf = (item: DogovorProjekcija) => item.id;

/**
 * One Agreement as a scan block: a status line only when it asks for something or
 * closes the story, the title, where and when, then the agreed price and people,
 * and the other person in the foot.
 */
function AgreementCard({ item, onOpen }: { item: DogovorProjekcija; onOpen: () => void }) {
  const other = item.ucesnici.find(person => !person.viSte), mine = item.ucesnici.find(person => person.viSte);
  const attention = awaitsMyConfirmation(item), settled = !isActive(item);
  const status = settled || item.stanje === 'AWAITING_REQUESTER' ? agreementStateText(item.stanje) : null;
  const tone = item.stanje === 'CANCELLED' ? sys.color.muted : item.stanje === 'AWAITING_REQUESTER' ? sys.color.warn : sys.color.green;
  const dot = item.stanje === 'CANCELLED' ? sys.color.lineStrong : item.stanje === 'AWAITING_REQUESTER' ? sys.color.orange : sys.color.green;
  const relation = mine?.uloga === 'narucilac' ? 'radi za tebe' : mine?.uloga === 'uskocer' ? 'naručuje' : '';
  return <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${item.naslov}`} onPress={onOpen}
    haptic="select" scaleTo={0.986} style={[card, attention && s.attentionCard, settled && s.settledCard]}>
    {status ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: dot }]} />
      <T variant="label" style={[s.status, { color: tone }]}>{status}{item.verzija > 1 ? ` · verzija ${item.verzija}` : ''}</T></View> : null}
    <T style={s.title}>{item.naslov}</T>
    <View style={s.facts}>
      <View style={s.fact}><MapPin size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{item.rezim === 'DALJINSKI' ? 'Na daljinu' : item.putanjaTekst}</T></View>
      <View style={s.fact}><Clock size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{item.vremeTekst}</T></View>
    </View>
    <View style={s.foot}>
      <T style={s.price}>{item.cena.prikaz}</T>
      <T variant="meta" style={s.people}>{peopleText(item.pokrivenost.popunjeno)}</T>
    </View>
    <View style={s.person}>
      <View style={s.avatar}><T variant="label" style={s.initials}>{other?.inicijali ?? '—'}</T></View>
      <T variant="bodyStrong" style={s.personName}>{other?.ime ?? 'Druga strana'}</T>
      {relation ? <T variant="meta" tone="muted">{relation}</T> : null}
    </View>
    {item.problemOtvoren ? <View style={s.problem}><T variant="meta" style={s.problemText}>Prijavljen je problem · pogledaj Dogovor</T></View> : null}
  </Press>;
}

/** D01 shares the accepted Agreement projection in both account roles. Presentation only. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error, onOpen } = props;
  const visible = useMemo(() => items.filter(item => (section === 'all' || (section === 'active' ? isActive(item) : !isActive(item)))
    && (!confirmationOnly || awaitsMyConfirmation(item))), [items, section, confirmationOnly]);
  const waiting = useMemo(() => items.filter(awaitsMyConfirmation).length, [items]);
  const sections = useMemo(() => SECTIONS.map(option => option.key === 'active' && waiting ? { ...option, badge: waiting } : option), [waiting]);
  const count = loading || error ? null : visible.length;
  const renderItem = useCallback(({ item }: { item: DogovorProjekcija }) => <AgreementCard item={item} onOpen={() => onOpen(item)} />, [onOpen]);
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><SkeletonList count={3} rows={2} /><T variant="meta" tone="muted" style={s.center}>Učitavamo Dogovore…</T></>
      : error ? <View style={s.state}><T style={s.stateTitle}>Dogovore trenutno nije moguće učitati</T><T style={s.stateBody}>Proveri internet vezu i pokušaj ponovo.</T>
        <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} style={brandAction} /></View>
        : items.length ? <View style={s.state}><T style={s.stateTitle}>Nema Dogovora u ovom prikazu</T><T style={s.stateBody}>Pogledaj sve saradnje iz obe uloge.</T>
          <V2Action label="Prikaži sve Dogovore" onPress={() => { props.onSection('all'); props.onConfirmationOnly(false); }} /></View>
          : <View style={s.state}><T style={s.stateTitle}>Još nemaš Dogovor</T><T style={s.stateBody}>{props.requester
            ? 'Kada izaberete nekoga iz Prijava, Dogovor se pojavljuje ovde.'
            : 'Kada tvoja Prijava bude izabrana, Dogovor se pojavljuje ovde.'}</T>
            <V2Action label="Pogledaj Zadatke" onPress={props.onTasks} style={brandAction} /></View>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    <ScreenHeader eyebrow={props.intent ? intentLabel(props.intent) : 'Obe uloge'} title="Dogovori" onProfile={props.onProfile} />
    <View style={s.segmentRow}><Segmented options={sections} value={section} onChange={props.onSection} /></View>
    <View style={s.sectionRow}>
      <View style={s.sectionCopy}>
        <T variant="heading" style={s.sectionTitle}>{SECTION_TITLES[section]}</T>
        {count !== null ? <T variant="heading" style={s.count}>{count}</T> : null}
      </View>
      {waiting || confirmationOnly ? <Press accessibilityRole="checkbox" accessibilityLabel="Čeka moju potvrdu" accessibilityState={{ checked: confirmationOnly }}
        onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select" style={[s.chip, confirmationOnly && s.chipOn]}>
        {confirmationOnly ? <Check size={14} weight="bold" color={sys.color.green} /> : null}
        <T variant="meta" style={[s.chipText, confirmationOnly && s.chipTextOn]}>Čeka moju potvrdu</T>
      </Press> : null}
      {!props.requester ? <HeaderIconButton label="Radni raspored (JA MOGU)" icon={CalendarBlank} onPress={props.onCalendar} /> : null}
    </View>
    <FlatList<DogovorProjekcija> data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={loading}
      onRefresh={props.onRefresh} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      ItemSeparatorComponent={Separator} renderItem={renderItem} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 },
  segmentRow: { paddingHorizontal: 20, paddingTop: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionTitle: { color: sys.color.ink, flexShrink: 1 },
  count: { color: sys.color.muted, fontWeight: '500', fontVariant: ['tabular-nums'] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: sys.radius.chip, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  empty: { paddingVertical: 8, gap: 16, flex: 1 }, center: { textAlign: 'center' },
  state: { paddingVertical: 28, paddingHorizontal: 4, gap: 12, alignItems: 'flex-start' },
  stateTitle: { ...sys.type.title, color: sys.color.ink }, stateBody: { ...sys.type.copy, color: sys.color.muted, marginBottom: 6 },
  attentionCard: { borderColor: sys.color.orange }, settledCard: { backgroundColor: sys.color.wash },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }, dot: { width: 6, height: 6, borderRadius: sys.radius.pill }, status: { flexShrink: 1, letterSpacing: 0.3 },
  title: { ...sys.type.cardTitle, color: sys.color.ink },
  facts: { gap: 6, marginTop: 9 }, fact: { flexDirection: 'row', alignItems: 'center', gap: 8 }, factText: { flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: sys.color.line },
  price: { ...sys.type.price, color: sys.color.money, flexShrink: 1 },
  people: { color: sys.color.ink, fontWeight: '600' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  avatar: { width: 32, height: 32, borderRadius: sys.radius.chip, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { color: sys.color.green, letterSpacing: 0 }, personName: { color: sys.color.ink, flexShrink: 1 },
  problem: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: sys.color.dangerSoft, borderRadius: sys.radius.badge, paddingHorizontal: 10, paddingVertical: 6 },
  problemText: { color: sys.color.danger, fontWeight: '600' },
});
