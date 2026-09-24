import { memo, useCallback, useMemo, useRef } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { FlatList, Platform, ScrollView, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, CalendarBlank, CaretRight, Check } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Appear, useAppear } from '../system/Appear';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { dogovora, osoba } from '../system/plural';
import { ChromeIconButton } from '../system/ScreenChrome';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { sys, cardCompact } from '../system/tokens';
import { T } from '../Text';
import { BEZ_IZNOSA } from '../../lib/novac';
import { agreementStateText } from './AgreementPresentation';

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

type Attention = { art: FactArtKind; title: string; line: string };
/**
 * What this Dogovor is waiting for from ME, if anything, in the order the Dogovor itself leads with: a change
 * the other side proposed blocks both completions, so answering it comes first. A change I proposed, or a
 * completion the other side has to confirm, waits for someone else and is not drawn as my task.
 */
function attentionOf(item: DogovorProjekcija): Attention | null {
  if (item.izmenaCeka && !item.izmenaCeka.mojPredlog) return { art: 'clock', title: 'Odgovori na predlog izmene', line: 'Prihvaćeni uslovi važe dok ne odgovoriš.' };
  if (!item.izmenaCeka && awaitsMyConfirmation(item)) return { art: 'clock', title: 'Potvrdi završetak', line: 'Druga strana je označila da je posao završen.' };
  // The only route to rating a finished collaboration was: open the agreement, find the action. The card
  // that is already in front of the person says it instead.
  if (awaitsMyRating(item)) return { art: 'agreements', title: 'Oceni saradnju', line: 'Čeka tvoju ocenu' };
  return null;
}

/**
 * "21. sep 2026 · 17:00 – 19:00" is the day, with the time under it (V41 splits its term the same way). The
 * text is the accepted term exactly as the Dogovor states it, in Serbian time; a term that is missing is a
 * sentence with no " · " and stays one line, so it reads as missing rather than as a date.
 */
function termParts(text: string): { day: string; time: string | null } {
  const at = text.indexOf(' · ');
  return at > 0 ? { day: text.slice(0, at), time: text.slice(at + 3) } : { day: text, time: null };
}

/**
 * One Dogovor, in the V41 anatomy (owner, 2026-09-23): the other person first, then the task, then the
 * accepted term beside the agreed price, then where and how many. When the Dogovor waits for me, a warm strip
 * across the bottom says what it waits for; otherwise the card ends with its facts. The whole card is one press
 * that opens the Dogovor, where that action lives. Nothing is drawn that the list does not carry: no last
 * message, no rating, no date heading built from the task's own start.
 */
function AgreementCard({ item, onOpen }: { item: DogovorProjekcija; onOpen: () => void }) {
  const other = item.ucesnici.find(person => !person.viSte);
  const settled = !isActive(item), attention = attentionOf(item);
  const status = settled || item.stanje === 'AWAITING_REQUESTER' ? agreementStateText(item.stanje) : null;
  const tone = item.stanje === 'CANCELLED' ? sys.color.muted : item.stanje === 'AWAITING_REQUESTER' ? sys.color.warn : sys.color.green;
  const dot = item.stanje === 'CANCELLED' ? sys.color.lineStrong : item.stanje === 'AWAITING_REQUESTER' ? sys.color.orange : sys.color.green;
  // What the OTHER person is to me, third person, from this Dogovor's own participants (owner, 2026-09-19):
  // their name comes first, so a sentence about me beside it ("Uskočio si") read as if it were about them.
  // The same words the Dogovor itself uses in AgreementPeople, with V41's "na tvoj zadatak" saying whose task.
  const relation = other?.uloga === 'narucilac' ? 'Traži pomoć' : other?.uloga === 'uskocer' ? 'Uskače na tvoj zadatak' : '';
  const term = termParts(item.vremeTekst), remote = item.rezim === 'DALJINSKI';
  const initials = <View style={s.avatar}><T variant="label" style={s.initials}>{other?.inicijali ?? '—'}</T></View>;
  return <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${readableTitle(item.naslov)}`}
    accessibilityHint={attention ? `${attention.title}. ${attention.line}` : undefined} onPress={onOpen}
    haptic="select" scaleTo={0.986} style={[s.card, attention && s.cardAttention]}>
    <View style={s.main}>
      <View style={s.person}>
        {other?.profilId ? <ProfilePhoto profileId={other.profilId} size={44} fallback={initials} /> : initials}
        <View style={s.personCopy}>
          <T variant="bodyStrong" style={s.personName} numberOfLines={1}>{other?.ime ?? 'Druga strana'}</T>
          {relation ? <T variant="meta" tone="muted" numberOfLines={1}>{relation}</T> : null}
        </View>
        <CaretRight size={18} color={sys.color.muted} />
      </View>
      {status ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: dot }]} />
        <T variant="label" style={[s.status, { color: tone }]}>{status}{item.verzija > 1 ? ` · verzija ${item.verzija}` : ''}</T></View> : null}
      <T style={s.title}>{readableTitle(item.naslov)}</T>
      <View style={s.accepted}>
        <View style={s.when}>
          <FactArt kind="calendar" size={22} />
          <View style={s.whenCopy}>
            <T style={s.day}>{term.day}</T>
            {term.time ? <T style={s.time}>{term.time}</T> : null}
          </View>
        </View>
        {/* A missing amount is said in words and never wears the amount's green. */}
        <View style={s.money}>
          {item.cena.prikaz ? <><T style={s.price}>{item.cena.prikaz}</T><T style={s.priceNote}>dogovoreno ukupno</T></>
            : <T style={s.noPrice}>{BEZ_IZNOSA}</T>}
        </View>
      </View>
      <View style={s.minor}>
        <View style={s.place}>
          <FactArt kind={remote ? 'remote' : 'pin'} size={18} />
          <T style={s.minorText}>{remote ? 'Na daljinu' : item.putanjaTekst || 'Mesto nije navedeno'}</T>
        </View>
        <View style={s.people}><FactArt kind="users" size={18} /><T style={s.minorText}>{osoba(item.pokrivenost.popunjeno)}</T></View>
      </View>
      {/* My own proposal waits for the other side: a quiet line, not a task of mine. */}
      {item.izmenaCeka?.mojPredlog ? <View style={s.note}><FactArt kind="clock" size={18} muted />
        <T variant="meta" tone="muted" style={s.noteText}>Tvoja izmena čeka odgovor</T></View> : null}
      {item.problemOtvoren ? <View style={s.problem}><T variant="meta" style={s.problemText}>Prijavljen je problem · pogledaj Dogovor</T></View> : null}
    </View>
    {attention ? <View style={s.strip}>
      <FactArt kind={attention.art} size={22} />
      <View style={s.stripCopy}>
        <T style={s.stripTitle}>{attention.title}</T>
        <T style={s.stripLine}>{attention.line}</T>
      </View>
      <ArrowRight size={18} color={sys.color.warn} />
    </View> : null}
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
  const settledRead = !loading && !error;
  // Each set says how many Dogovori it holds, as the V41 tab bar does, and only once the read has settled.
  // An empty set shows no number: a zero on a badge reads as news. What waits for me is on the cards and the chip.
  const sections = useMemo(() => {
    if (!settledRead) return SECTIONS;
    const active = items.filter(isActive).length;
    const counts: Record<AgreementCollectionSection, number> = { active, history: items.length - active, all: items.length };
    return SECTIONS.map(option => counts[option.key] ? { ...option, badge: counts[option.key] } : option);
  }, [items, settledRead]);
  const count = settledRead ? visible.length : null;
  const appear = useAppear();
  appear.settle(visible.map(keyOf));
  // `useAppear` returns a new object each render over the same two refs, and the route's `onOpen`
  // is a fresh closure each render; both are read through refs so `renderItem` keeps its identity.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const openItem = useCallback((item: DogovorProjekcija) => openRef.current(item), []);
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<DogovorProjekcija>) =>
    <AgreementRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} onOpen={openItem} />, [openItem]);
  // The one state view (2026-09-24): reading, not read, nothing in this set, nothing yet — each in the same look.
  const empty = <View style={s.empty}>
    {loading ? <StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 3, rows: 2 }} />
      : error ? <StateView kind="error" art="agreements" title="Dogovore trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        : items.length ? <StateView art="agreements" title="Nema Dogovora u ovom prikazu"
          body="Pogledaj sve svoje saradnje: i za tvoje zadatke i za one u koje uskačeš."
          primary={{ label: 'Prikaži sve Dogovore', onPress: () => { props.onSection('all'); props.onConfirmationOnly(false); } }} />
          : <StateView art="agreements" title="Još nemaš Dogovor"
            body="Kada izabereš nekoga za svoj zadatak, ili kada tvoja prijava bude izabrana, Dogovor se pojavljuje ovde."
            primary={{ label: 'Idi na Početnu', onPress: props.onHome }} />}
  </View>;
  const chip = waiting || confirmationOnly ? <Press accessibilityRole="checkbox" accessibilityLabel="Čeka moju potvrdu" accessibilityState={{ checked: confirmationOnly }}
    onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select" style={[s.chip, confirmationOnly && s.chipOn]}>
    {confirmationOnly ? <Check size={14} weight="bold" color={sys.color.green} /> : null}
    <T variant="meta" style={[s.chipText, confirmationOnly && s.chipTextOn]}>Čeka moju potvrdu</T>
  </Press> : null;
  return <SafeAreaView edges={['top']} style={s.screen}>
    {/* The root bar is the same on all three tabs: profile · mark · bell (round-1 critique A12). */}
    <ScreenHeader title="Dogovori" onProfile={props.onProfile} />
    {/* V41: an underlined tab bar that spans the screen, then one quiet row with what is counted on the left
        and the one filter on the right. The count belongs with what it counts; no heading repeats the tab.
        The calendar is a view of these same Dogovori, so it ends the tab row as a quiet icon, not a fourth
        control in the header. */}
    <View style={s.controls}>
      <View style={s.tabRow}>
        {/* The tabs keep their spacing and slide sideways only where they do not fit beside the calendar (320 dp,
            large text), fading at the edge instead of running under it. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} fadingEdgeLength={24} style={s.tabs}>
          <Segmented options={sections} value={section} onChange={props.onSection} appearance="underline" style={s.tabTrack} />
        </ScrollView>
        <ChromeIconButton quiet label="Kalendar obaveza" icon={CalendarBlank} onPress={props.onCalendar} />
      </View>
      {count || chip ? <View style={s.toolbar}>
        {count ? <T variant="note" tone="muted" style={s.count}>{dogovora(count)}</T> : <View />}
        {chip}
      </View> : null}
    </View>
    <FlatList<DogovorProjekcija> data={loading || error ? [] : visible} keyExtractor={keyOf} refreshing={props.refreshing ?? loading}
      onRefresh={props.onRefresh} showsVerticalScrollIndicator={false} contentContainerStyle={s.list} ListEmptyComponent={empty}
      // Six of these cards are more than one phone screen; a modest window fills a fast scroll quickly.
      initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
      ItemSeparatorComponent={Separator} renderItem={renderItem} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  controls: { paddingHorizontal: 20, paddingTop: 4 },
  // The hairline under the tabs runs on under the calendar, so the row stays one line.
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  tabs: { flex: 1, minWidth: 0 },
  tabTrack: { borderBottomWidth: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, paddingTop: 8, paddingBottom: 4 },
  count: { fontVariant: ['tabular-nums'] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, flexGrow: 1 },
  empty: { paddingVertical: 8, flex: 1 },
  // V41 card: white, a hairline edge, a 20px corner and no shadow to speak of. The strip below the facts is
  // clipped to the corner, so the card stays one shape.
  card: { ...cardCompact, padding: 0, overflow: 'hidden' },
  cardAttention: { borderColor: sys.color.orangeHalo },
  main: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, borderWidth: 1, borderColor: sys.color.line,
    alignItems: 'center', justifyContent: 'center' },
  initials: { color: sys.color.green, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  personCopy: { flex: 1, minWidth: 0 }, personName: { color: sys.color.ink, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }, dot: { width: 6, height: 6, borderRadius: sys.radius.pill }, status: { flexShrink: 1, letterSpacing: 0.3 },
  title: { ...sys.type.cardTitle, color: sys.color.ink },
  accepted: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginTop: 14 },
  when: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  whenCopy: { flex: 1, minWidth: 0 },
  day: { ...sys.type.note, fontWeight: '600', color: sys.color.ink },
  time: { ...sys.type.note, fontWeight: '600', color: sys.color.ink, fontVariant: ['tabular-nums'] },
  money: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '55%' },
  price: { ...sys.type.priceSmall, color: sys.color.money, textAlign: 'right' },
  priceNote: { fontSize: 12, lineHeight: 16, color: sys.color.muted, textAlign: 'right' },
  noPrice: { ...sys.type.note, fontWeight: '600', color: sys.color.muted, textAlign: 'right' },
  minor: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 14 },
  place: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  minorText: { fontSize: 13, lineHeight: 18, color: sys.color.muted, flexShrink: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }, noteText: { flexShrink: 1 },
  problem: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: sys.color.dangerSoft, borderRadius: sys.radius.badge, paddingHorizontal: 10, paddingVertical: 6 },
  problemText: { color: sys.color.danger, fontWeight: '600' },
  // A Dogovor that waits for me is a task, not a fault: the warm tone across the card's foot, not the red one.
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: sys.color.orangeSoft },
  stripCopy: { flex: 1, minWidth: 0, gap: 1 },
  stripTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: sys.color.warn },
  stripLine: { fontSize: 12, lineHeight: 17, color: sys.color.muted },
});
