import { memo, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { FlatList, Platform, ScrollView, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, CalendarBlank, Check } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Appear, useAppear } from '../system/Appear';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { useReducedMotion } from '../system/motion';
import { ChromeIconButton } from '../system/ScreenChrome';
import { ScreenHeader } from '../system/ScreenHeader';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { sys, cardCompact } from '../system/tokens';
import { T } from '../Text';
import { BEZ_IZNOSA } from '../../lib/novac';
import { agreementPeople, agreementRole, agreementStateText, agreementTerm } from './AgreementPresentation';
import { CARD_PRESS_SCALE } from './TaskCard';
import { CardFact, WaitingDot, faceStyles } from './TaskFace';

/** Aktivni and Istorija (round-1 critique A11): "Svi" repeated both, and the count line repeated the tabs' own counts. */
export type AgreementCollectionSection = 'active' | 'history';
type Props = {
  items: readonly DogovorProjekcija[]; loading: boolean; refreshing?: boolean; error: boolean;
  section: AgreementCollectionSection; confirmationOnly: boolean;
  onSection: (value: AgreementCollectionSection) => void; onConfirmationOnly: (value: boolean) => void;
  onRefresh: () => void; onOpen: (agreement: DogovorProjekcija) => void;
  /**
   * Opens the rating of a finished Dogovor straight from its card (round-1 critique A2). The route owns the guard and
   * the navigation. Without it the card still says the rating waits, as words inside the card's own press.
   */
  onRate?: (agreement: DogovorProjekcija) => void;
  onCalendar: () => void; onProfile: () => void; onHome: () => void;
  /** The root bar. The screen draws `ScreenHeader` (profile · mark · bell); the design gallery hands in a still one. */
  header?: ReactNode;
};
const SECTIONS = [{ key: 'active', label: 'Aktivni' }, { key: 'history', label: 'Istorija' }] as const;
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
/** The other person's face on a card: the list-row step of the one Avatar scale, the photo at the same size. */
const AVATAR = 40;
const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

type Attention = { kind: 'change' | 'confirm' | 'rate'; title: string; line: string };
/**
 * What this Dogovor is waiting for from ME, if anything, in the order the Dogovor itself leads with: a change
 * the other side proposed blocks both completions, so answering it comes first. A change I proposed, or a
 * completion the other side has to confirm, waits for someone else and is not drawn as my task.
 */
function attentionOf(item: DogovorProjekcija): Attention | null {
  if (item.izmenaCeka && !item.izmenaCeka.mojPredlog) return { kind: 'change', title: 'Odgovori na predlog izmene', line: 'Prihvaćeni uslovi važe dok ne odgovoriš.' };
  if (!item.izmenaCeka && awaitsMyConfirmation(item)) return { kind: 'confirm', title: 'Potvrdi završetak', line: 'Druga strana je označila da je posao završen.' };
  // The only route to rating a finished collaboration was: open the agreement, find the action. The card
  // that is already in front of the person says it, and with `onRate` goes there in one tap.
  if (awaitsMyRating(item)) return { kind: 'rate', title: 'Oceni saradnju', line: 'Čeka tvoju ocenu' };
  return null;
}

/**
 * The foot of a card that waits for me (round-1 critique B1): the card system's waiting foot, the quiet wash under the
 * card's hairline, an 8 dp orange dot and the words in `warn`, with the one arrow of the card. No orange edge and no
 * orange fill: the screen's one orange fill is not spent once per waiting card.
 */
function AttentionFoot({ attention }: { attention: Attention }) {
  return <>
    <WaitingDot />
    <View style={s.footCopy}>
      <T style={s.footTitle} numberOfLines={2}>{attention.title}</T>
      <T style={s.footLine} numberOfLines={2}>{attention.line}</T>
    </View>
    <ArrowRight size={18} color={sys.color.warn} />
  </>;
}

/**
 * One Dogovor, person first (owner step 8): the other person and what they are to me, the state when it says
 * something, the task, then the accepted facts one per line — the term as one full line with its zone under it, the
 * agreed amount with what it covers, the place and, beyond one person, how many. The body is one press that opens the
 * Dogovor, with no caret: the whole card is the target (B16). When the Dogovor waits for me, its foot says what for;
 * the rating is a press of its own, beside the body and never inside it, that goes straight to the rating (A2).
 * Nothing is drawn that the list does not carry: no last message, no rating, no date heading built from the task.
 *
 * The frame gives under the finger as one object, as a task card does, and holds still under reduced motion.
 */
function AgreementCard({ item, onOpen, onRate }: { item: DogovorProjekcija; onOpen: () => void; onRate?: () => void }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const give = () => { if (!reduced) scale.set(withTiming(CARD_PRESS_SCALE, { duration: sys.motion.press, easing: EASE_OUT })); };
  const settle = () => { scale.set(reduced ? 1 : withSpring(1, { ...sys.motion.spring, reduceMotion: ReduceMotion.System })); };

  const other = item.ucesnici.find(person => !person.viSte);
  const attention = attentionOf(item);
  const title = readableTitle(item.naslov);
  // Every Dogovor on the list is agreed, so "Dogovoreno" is never said; any other state is, including a finished one
  // that stays among the active ones until it is rated.
  const status = item.stanje !== 'CONFIRMED' ? agreementStateText(item.stanje) : null;
  const tone = item.stanje === 'CANCELLED' ? sys.color.muted : item.stanje === 'AWAITING_REQUESTER' ? sys.color.warn : sys.color.green;
  const dot = item.stanje === 'CANCELLED' ? sys.color.lineStrong : item.stanje === 'AWAITING_REQUESTER' ? sys.color.orange : sys.color.green;
  const role = agreementRole(other);
  const name = other?.ime ?? 'Druga strana';
  const term = agreementTerm(item), remote = item.rezim === 'DALJINSKI';
  const place = remote ? 'Na daljinu' : item.putanjaTekst || 'Mesto nije navedeno';
  const amount = item.cena.prikaz, people = agreementPeople(item);
  const ownProposal = !!item.izmenaCeka?.mojPredlog;
  // The rating foot is its own press only when the route hands over where it goes; otherwise it stays inside the body.
  const rateAside = attention?.kind === 'rate' && onRate ? attention : null;
  const footInside = attention && !rateAside ? attention : null;
  const statusSpoken = status ? `${status}${item.verzija > 1 ? `, verzija ${item.verzija}` : ''}` : null;
  const spoken = [name, role, statusSpoken, term.line, term.zone, amount ? `${amount} ukupno` : BEZ_IZNOSA, place, people,
    ownProposal ? 'Tvoja izmena čeka odgovor' : null, item.problemOtvoren ? 'Prijavljen je problem' : null]
    .filter((part): part is string => !!part).join(', ');
  // The one Avatar: a missing name (an empty string since 2026-09-24) draws the person, never an empty disc or a dash.
  const initials = <Avatar initials={other?.inicijali} size={AVATAR} />;
  return <Animated.View style={[s.card, lift]}>
    <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${title}`} accessibilityValue={{ text: spoken }}
      accessibilityHint={footInside ? `${footInside.title}. ${footInside.line}` : undefined} onPress={onOpen}
      onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} style={s.body}>
      <View style={s.main}>
        <View style={s.person}>
          {other?.profilId ? <ProfilePhoto profileId={other.profilId} size={AVATAR} fallback={initials} /> : initials}
          <View style={s.personCopy}>
            <T style={s.personName} numberOfLines={1}>{name}</T>
            {role ? <T variant="meta" tone="muted" numberOfLines={1}>{role}</T> : null}
          </View>
        </View>
        {status ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: dot }]} />
          <T variant="label" style={[s.status, { color: tone }]}>{status}{item.verzija > 1 ? ` · verzija ${item.verzija}` : ''}</T></View> : null}
        <T style={s.title} numberOfLines={3}>{title}</T>
        <View style={s.facts}>
          {/* The term is the Dogovor's own fact: one full line, the zone note on its own quiet line (B15). */}
          <View style={s.fact}>
            <View style={s.art}><FactArt kind="calendar" size={16} /></View>
            <View style={s.factCopy}>
              <T style={s.term} numberOfLines={2}>{term.line}</T>
              {term.zone ? <T style={s.zone}>{term.zone}</T> : null}
            </View>
          </View>
          {/* A missing amount is said in words and never wears the amount's green or its "ukupno". */}
          <View style={s.fact}>
            <View style={s.art}><FactArt kind="money" size={16} /></View>
            {amount ? <T style={s.factCopy}><T style={s.amount}>{amount}</T><T style={s.basis}> ukupno</T></T>
              : <T style={[s.factCopy, s.noAmount]}>{BEZ_IZNOSA}</T>}
          </View>
          <CardFact art={<FactArt kind={remote ? 'remote' : 'pin'} size={16} />} text={place} />
          {people ? <CardFact art={<FactArt kind="users" size={16} />} text={people} /> : null}
        </View>
        {/* My own proposal waits for the other side: a quiet line, not a task of mine. */}
        {ownProposal ? <View style={s.note}><FactArt kind="clock" size={16} muted />
          <T variant="meta" tone="muted" style={s.noteText}>Tvoja izmena čeka odgovor</T></View> : null}
        {item.problemOtvoren ? <View style={s.problem}><T variant="meta" style={s.problemText}>Prijavljen je problem · pogledaj Dogovor</T></View> : null}
      </View>
      {footInside ? <View style={s.foot}><AttentionFoot attention={footInside} /></View> : null}
    </Press>
    {/* No hit slop: the hairline is the border between the two targets, and a touch just above it opens the Dogovor. */}
    {rateAside ? <Press accessibilityRole="button" accessibilityLabel={`${rateAside.title}, ${title}`} accessibilityHint="Otvara ocenu saradnje."
      onPress={onRate} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} hitSlop={0} style={s.foot}>
      <AttentionFoot attention={rateAside} />
    </Press> : null}
  </Animated.View>;
}
/**
 * One row of the list: the arrival animation and the card. Memoised on the row's own object and
 * primitives, so changing the segment or pulling to refresh re-renders the screen and only the rows
 * whose Dogovor actually changed. The closures over `item` are made here, from the list's stable callbacks.
 */
const AgreementRow = memo(function AgreementRow({ item, index, animate, onOpen, onRate }: {
  item: DogovorProjekcija; index: number; animate: boolean; onOpen: (item: DogovorProjekcija) => void;
  onRate?: (item: DogovorProjekcija) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  const rate = useCallback(() => onRate?.(item), [onRate, item]);
  return <Appear index={index} animate={animate}><AgreementCard item={item} onOpen={open} onRate={onRate ? rate : undefined} /></Appear>;
});

/** D01 shares the accepted Agreement projection in both account roles. Presentation only. */
export function AgreementCollectionPresentation(props: Props) {
  const { items, section, confirmationOnly, loading, error, onOpen, onRate } = props;
  // "Čeka moju potvrdu" narrows the active Dogovori only: nothing in history waits for a confirmation.
  const filtering = section === 'active' && confirmationOnly;
  const visible = useMemo(() => {
    const rows = items.filter(item => (section === 'active' ? isActive(item) : !isActive(item)) && (!filtering || awaitsMyConfirmation(item)));
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
  }, [items, section, filtering]);
  const waiting = useMemo(() => items.filter(awaitsMyConfirmation).length, [items]);
  const settledRead = !loading && !error;
  // Each set says how many Dogovori it holds, as a quiet count on its tab, and only once the read has settled. An empty
  // set shows no number: a zero on a badge reads as news. What waits for me is on the cards and the chip.
  const activeCount = useMemo(() => items.filter(isActive).length, [items]);
  const sections = useMemo(() => {
    if (!settledRead) return SECTIONS;
    const counts: Record<AgreementCollectionSection, number> = { active: activeCount, history: items.length - activeCount };
    return SECTIONS.map(option => counts[option.key] ? { ...option, badge: counts[option.key] } : option);
  }, [items.length, activeCount, settledRead]);
  const appear = useAppear();
  appear.settle(visible.map(keyOf));
  // `useAppear` returns a new object each render over the same two refs, and the route's `onOpen`
  // is a fresh closure each render; both are read through refs so `renderItem` keeps its identity.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const rateRef = useRef(onRate); rateRef.current = onRate;
  const openItem = useCallback((item: DogovorProjekcija) => openRef.current(item), []);
  const rateItem = useCallback((item: DogovorProjekcija) => rateRef.current?.(item), []);
  const rates = !!onRate;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<DogovorProjekcija>) =>
    <AgreementRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} onOpen={openItem}
      onRate={rates ? rateItem : undefined} />, [openItem, rateItem, rates]);
  // A set that is empty while the other one is not leads to the one that has Dogovori, with the filter off, so the
  // way forward never lands on another empty view (review r3 item 7).
  const target: AgreementCollectionSection = (section === 'active' && !filtering) || !activeCount ? 'history' : 'active';
  const showOther = () => { props.onSection(target); props.onConfirmationOnly(false); };
  // The one state view (2026-09-24): reading, not read, nothing in this set, nothing yet — each in the same look.
  const empty = <View style={s.empty}>
    {loading ? <StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 3, rows: 2 }} />
      : error ? <StateView kind="error" art="agreements" title="Dogovore trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: props.onRefresh }} />
        : items.length ? <StateView art="agreements"
          title={filtering ? 'Nijedan Dogovor ne čeka tvoju potvrdu' : section === 'active' ? 'Nema aktivnih Dogovora' : 'Još nema završenih Dogovora'}
          primary={{ label: target === 'history' ? 'Pogledaj istoriju' : 'Pogledaj aktivne Dogovore', onPress: showOther }} />
          : <StateView art="agreements" title="Još nemaš Dogovor"
            body="Kada izabereš nekoga za svoj zadatak, ili kada tvoja prijava bude izabrana, Dogovor se pojavljuje ovde."
            primary={{ label: 'Idi na Početnu', onPress: props.onHome }} />}
  </View>;
  const chip = section === 'active' && (waiting || confirmationOnly) ? <Press accessibilityRole="checkbox" accessibilityLabel="Čeka moju potvrdu"
    accessibilityState={{ checked: confirmationOnly }} onPress={() => props.onConfirmationOnly(!confirmationOnly)} haptic="select"
    style={[s.chip, confirmationOnly && s.chipOn]}>
    {confirmationOnly ? <Check size={14} weight="bold" color={sys.color.green} /> : null}
    <T variant="meta" style={[s.chipText, confirmationOnly && s.chipTextOn]}>Čeka moju potvrdu</T>
  </Press> : null;
  return <SafeAreaView edges={['top']} style={s.screen}>
    {/* The root bar is the same on all three tabs: profile · mark · bell (round-1 critique A12). */}
    {props.header ?? <ScreenHeader title="Dogovori" onProfile={props.onProfile} />}
    {/* An underlined tab bar that spans the screen, each tab with its quiet count. No line under it counts again what
        the tab already counts (A11). The calendar is a view of these same Dogovori, so it ends the tab row as a quiet
        icon, not a fourth control in the header; the one filter follows only when something waits for me. */}
    <View style={s.controls}>
      <View style={s.tabRow}>
        {/* The tabs keep their spacing and slide sideways only where they do not fit beside the calendar (320 dp,
            large text), fading at the edge instead of running under it. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} fadingEdgeLength={24} style={s.tabs}>
          <Segmented options={sections} value={section} onChange={props.onSection} appearance="underline" style={s.tabTrack} />
        </ScrollView>
        <ChromeIconButton quiet label="Kalendar obaveza" icon={CalendarBlank} onPress={props.onCalendar} />
      </View>
      {chip ? <View style={s.toolbar}>{chip}</View> : null}
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
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  chipOn: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  chipText: { color: sys.color.ink, fontWeight: '600' }, chipTextOn: { color: sys.color.green },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, flexGrow: 1 },
  empty: { paddingVertical: 8, flex: 1 },
  // The shared card: white, the card corner, one hairline and no shadow. The body carries the padding, so the whole
  // card stays one target up to its edge; the foot is the wash under one hairline (`ownerFoot`).
  card: { ...cardCompact, padding: 0 },
  body: { borderRadius: sys.radius.cardCompact },
  main: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personCopy: { flex: 1, minWidth: 0 },
  personName: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: sys.color.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 6, height: 6, borderRadius: sys.radius.pill }, status: { flexShrink: 1, letterSpacing: 0.3 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3, color: sys.color.ink },
  facts: { gap: 4 },
  // The same fact column as a task card: a 16 px drawing in a 16 × 19 box, 8 px to the words.
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  art: { width: 16, height: 19, alignItems: 'center', justifyContent: 'center' },
  factCopy: { flex: 1, minWidth: 0 },
  // The term is what a Dogovor is about beside the person, so it reads a step stronger than the other facts.
  term: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: sys.color.ink, fontVariant: ['tabular-nums'] },
  zone: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: sys.color.muted },
  amount: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.money, fontVariant: ['tabular-nums'] },
  basis: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: sys.color.muted },
  noAmount: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: sys.color.muted },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 }, noteText: { flexShrink: 1 },
  problem: { alignSelf: 'flex-start', backgroundColor: sys.color.dangerSoft, borderRadius: sys.radius.badge, paddingHorizontal: 10, paddingVertical: 6 },
  problemText: { color: sys.color.danger, fontWeight: '600' },
  // Every foot here is a foot that waits for me, so it is the card system's waiting foot (`faceStyles.ownerFoot`: the
  // quiet wash under one hairline, as Moje prijave and Moji zadaci draw it; verify r4b rd item 7 — it was the white
  // quiet-link foot, so the same waiting looked different per list), a step taller for its two lines.
  foot: { ...faceStyles.ownerFoot, minHeight: 52 },
  footCopy: { flex: 1, minWidth: 0, gap: 1 },
  footTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.warn },
  footLine: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: sys.color.muted },
});
