import { memo, useCallback, useMemo, useRef } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { FlatList, Platform, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarBlank, Check, Clock, MapPin } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Appear, useAppear } from '../system/Appear';
import { dogovora, osoba } from '../system/plural';
import { HeaderIconButton, ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { SkeletonList } from '../system/Skeleton';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { agreementStateText } from './AgreementPresentation';
import { V2Action } from './V2Action';

export type AgreementCollectionSection = 'active' | 'history' | 'all';
type Props = {
  items: readonly DogovorProjekcija[]; loading: boolean; refreshing?: boolean; error: boolean;
  section: AgreementCollectionSection; confirmationOnly: boolean;
  onSection: (value: AgreementCollectionSection) => void; onConfirmationOnly: (value: boolean) => void;
  onRefresh: () => void; onOpen: (agreement: DogovorProjekcija) => void;
  onCalendar: () => void; onProfile: () => void; onHome: () => void;
};
const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'history', label: 'Istorija' }, { key: 'all', label: 'Svi' }] as const;
// A finished Dogovor that still waits for my rating is not history yet (owner, 2026-09-23: it was invisible
// on the default tab right after completion). It stays among the active ones until the rating is given.
const awaitsMyRating = (item: DogovorProjekcija) => item.stanje === 'COMPLETED' && item.ocenaMoguca;
const isActive = (item: DogovorProjekcija) => item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER' || awaitsMyRating(item);
const awaitsMyConfirmation = (item: DogovorProjekcija) => item.stanje === 'AWAITING_REQUESTER'
  && item.ucesnici.some(person => person.viSte && person.uloga === 'narucilac');
const Separator = () => <View style={{ height: 12 }} />;
const keyOf = (item: DogovorProjekcija) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. No row holds a text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';

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
  // What I am to this Dogovor is read from this Dogovor's own participants (owner's wording,
  // 2026-09-19). One list holds both sides of one account; nothing about the app says which.
  //
  // On a phone this row read "Milos SLJIVIC   Uskočio si": the other person's name, and then a
  // sentence about me, with nothing between them to say the subject had changed. Početna avoids it
  // by putting the relation first — "Uskočio si · Milos" — but here the avatar and the name come
  // first and cannot move. So the row says what the OTHER side did, third person, exactly as the
  // Dogovor itself already does in AgreementPeople. First person for my own acts, third for theirs.
  const relation = other?.uloga === 'narucilac' ? 'Objavio zadatak' : other?.uloga === 'uskocer' ? 'Uskočio' : '';
  return <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${readableTitle(item.naslov)}`} onPress={onOpen}
    haptic="select" scaleTo={0.986} style={[card, attention && s.attentionCard, settled && s.settledCard]}>
    {status ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: dot }]} />
      <T variant="label" style={[s.status, { color: tone }]}>{status}{item.verzija > 1 ? ` · verzija ${item.verzija}` : ''}</T></View> : null}
    <T style={s.title}>{readableTitle(item.naslov)}</T>
    <View style={s.facts}>
      <View style={s.fact}><MapPin size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{item.rezim === 'DALJINSKI' ? 'Na daljinu' : item.putanjaTekst}</T></View>
      <View style={s.fact}><Clock size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{item.vremeTekst}</T></View>
    </View>
    <View style={s.foot}>
      <T style={s.price}>{item.cena.prikaz}</T>
      <T variant="meta" style={s.people}>{osoba(item.pokrivenost.popunjeno)}</T>
    </View>
    {/* The only route to rating a finished collaboration was: open the agreement, find the action.
        Nothing anywhere asked for it, and the person who confirmed the completion is not even sent
        an event. The card that is already in front of them says it instead. */}
    {awaitsMyRating(item) ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: sys.color.orange }]} />
      <T variant="label" style={[s.status, { color: sys.color.warn }]}>Čeka tvoju ocenu</T></View> : null}
    {/* Name over relation, not beside it: "Objavio zadatak" is longer than the "Uskočio si" it
        replaced, and on a real phone it pushed "Milos SLJIVIC" onto two lines. This is also the
        shape every other person row in the app already uses. */}
    <View style={s.person}>
      {other?.profilId
        ? <ProfilePhoto profileId={other.profilId} size={32} fallback={<View style={s.avatar}><T variant="label" style={s.initials}>{other.inicijali}</T></View>} />
        : <View style={s.avatar}><T variant="label" style={s.initials}>{other?.inicijali ?? '—'}</T></View>}
      <View style={s.personCopy}>
        <T variant="bodyStrong" style={s.personName} numberOfLines={1}>{other?.ime ?? 'Druga strana'}</T>
        {relation ? <T variant="meta" tone="muted">{relation}</T> : null}
      </View>
    </View>
    {item.problemOtvoren ? <View style={s.problem}><T variant="meta" style={s.problemText}>Prijavljen je problem · pogledaj Dogovor</T></View> : null}
    {/* Until PKG-023a the list could not know that a change was waiting: a person saw it only after
        opening the Dogovor. The one who proposed it is waiting for an answer, not for themselves. */}
    {item.izmenaCeka ? <View style={s.pending}><T variant="meta" style={s.pendingText}>
      {item.izmenaCeka.mojPredlog ? 'Tvoja izmena čeka odgovor' : 'Izmena čeka tvoj odgovor'}</T></View> : null}
  </Press>;
}
/**
 * One row of the list: the arrival animation and the card. Memoised on the row's own object and
 * primitives, so changing the segment or pulling to refresh re-renders the screen and only the rows
 * whose Dogovor actually changed. The closure over `item` is made here, from the list's one stable `onOpen`.
 */
const AgreementRow = memo(function AgreementRow({ item, index, animate, onOpen }: {
  item: DogovorProjekcija; index: number; animate: boolean; onOpen: (item: DogovorProjekcija) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <Appear index={index} animate={animate}><AgreementCard item={item} onOpen={open} /></Appear>;
});

/** D01 shares the accepted Agreement projection in both account roles. Presentation only. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error, onOpen } = props;
  const visible = useMemo(() => {
    const rows = items.filter(item => (section === 'all' || (section === 'active' ? isActive(item) : !isActive(item)))
      && (!confirmationOnly || awaitsMyConfirmation(item)));
    // What is next comes first, and a Dogovor with no term yet is not "next" - it goes after the ones
    // that have one, in the order the server gave. History keeps the newest-first order it always had.
    if (section === 'history') return rows;
    return rows.map((item, index) => ({ item, index })).sort((a, b) => {
      const left = a.item.pocinje, right = b.item.pocinje;
      if (left && right && left !== right) return left < right ? -1 : 1;
      if (left && !right) return -1;
      if (!left && right) return 1;
      return a.index - b.index;
    }).map(row => row.item);
  }, [items, section, confirmationOnly]);
  const waiting = useMemo(() => items.filter(awaitsMyConfirmation).length, [items]);
  const sections = useMemo(() => SECTIONS.map(option => option.key === 'active' && waiting ? { ...option, badge: waiting } : option), [waiting]);
  const count = loading || error ? null : visible.length;
  const appear = useAppear();
  appear.settle(visible.map(keyOf));
  // `useAppear` returns a new object each render over the same two refs, and the route's `onOpen`
  // is a fresh closure each render; both are read through refs so `renderItem` keeps its identity.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const openItem = useCallback((item: DogovorProjekcija) => openRef.current(item), []);
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<DogovorProjekcija>) =>
    <AgreementRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} onOpen={openItem} />, [openItem]);
  const empty = <View style={s.empty} accessibilityLiveRegion="polite">
    {loading ? <><SkeletonList count={3} rows={2} /><T variant="meta" tone="muted" style={s.center}>Učitavamo Dogovore…</T></>
      : error ? <View style={s.state}><T style={s.stateTitle}>Dogovore trenutno nije moguće učitati</T><T style={s.stateBody}>Proveri internet vezu i pokušaj ponovo.</T>
        <V2Action label="Pokušaj ponovo" onPress={props.onRefresh} style={brandAction} /></View>
        : items.length ? <View style={s.state}><T style={s.stateTitle}>Nema Dogovora u ovom prikazu</T><T style={s.stateBody}>Pogledaj sve svoje saradnje, i one koje si objavio i one u koje si uskočio.</T>
          <V2Action label="Prikaži sve Dogovore" onPress={() => { props.onSection('all'); props.onConfirmationOnly(false); }} /></View>
          : <View style={s.state}><T style={s.stateTitle}>Još nemaš Dogovor</T><T style={s.stateBody}>Kada izabereš nekoga za svoj zadatak, ili kada tvoja prijava bude izabrana, Dogovor se pojavljuje ovde.</T>
            <V2Action label="Idi na Početnu" onPress={props.onHome} style={brandAction} /></View>}
  </View>;
  return <SafeAreaView edges={['top']} style={s.screen}>
    {/* The heading that used to sit here said "Aktivni dogovori" beside a segment already reading
        "Aktivni", over an empty state that says it better still. The count belongs with what it
        counts. The segment keeps this row to itself so no section is ever cut through the middle. */}
    <ScreenHeader eyebrow="Tvoje saradnje" title="Dogovori" onProfile={props.onProfile}
      right={<HeaderIconButton label="Kalendar obaveza" icon={CalendarBlank} onPress={props.onCalendar} />} />
    <View style={s.controls}>
      <Segmented options={sections} value={section} onChange={props.onSection} />
      {waiting || confirmationOnly ? <Press accessibilityRole="checkbox" accessibilityLabel="Čeka moju potvrdu" accessibilityState={{ checked: confirmationOnly }}
        onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select" style={[s.chip, confirmationOnly && s.chipOn]}>
        {confirmationOnly ? <Check size={14} weight="bold" color={sys.color.green} /> : null}
        <T variant="meta" style={[s.chipText, confirmationOnly && s.chipTextOn]}>Čeka moju potvrdu</T>
      </Press> : null}
    </View>
    <FlatList<DogovorProjekcija> data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={props.refreshing ?? loading}
      onRefresh={props.onRefresh} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      // Six of these cards are more than one phone screen; a modest window fills a fast scroll quickly.
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
      ItemSeparatorComponent={Separator} renderItem={renderItem}
      ListHeaderComponent={count ? <View style={s.countRow}><T variant="note" tone="muted">{dogovora(count)}</T></View> : null} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 },
  controls: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6, gap: 8, alignItems: 'flex-start' },
  countRow: { paddingBottom: 8 },
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
  initials: { color: sys.color.green, letterSpacing: 0 },
  personCopy: { flex: 1, minWidth: 0, gap: 1 }, personName: { color: sys.color.ink },
  problem: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: sys.color.dangerSoft, borderRadius: sys.radius.badge, paddingHorizontal: 10, paddingVertical: 6 },
  problemText: { color: sys.color.danger, fontWeight: '600' },
  // A change waiting for an answer is a task, not a fault: the warm tone, not the red one.
  pending: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.badge, paddingHorizontal: 10, paddingVertical: 6 },
  pendingText: { color: sys.color.warn, fontWeight: '600' },
});
