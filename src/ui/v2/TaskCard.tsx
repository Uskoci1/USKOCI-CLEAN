import { memo, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { StanjePotrebe } from '../../contracts/projections';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { isOwnedNeed } from '../../data/marketplaceView';
import { needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { displaysUrgent } from '../../lib/needUrgency';
import { FactArt } from '../system/FactArt';
import { useReducedMotion } from '../system/motion';
import { useTextScale } from '../system/textScale';
import { cardCompact, sys } from '../system/tokens';
import { Press } from '../Press';
import { useUrgencyClock } from './NeedUrgencyBadge';
import { CardBriefFoot, CardHead, CardFact, CardFootLine, CardNext, CardNote, CardPerson, CardPlaces, CardRequirement, CardStatus, CardWaitingLine,
  faceStyles, ownerNext, personSpoken, placesText, taskPlace, taskRequirement, taskSpoken, taskStatus, taskValue } from './TaskFace';

/** How far the whole card gives under the finger: a large surface gives less than a button (`sys.motion.pressScale`). */
export const CARD_PRESS_SCALE = 0.986;
const EASE_OUT = Easing.bezier(...sys.motion.easeOut);
const DRAFT_NEXT = 'Nastavi uređivanje';
const NOTHING_TO_CHOOSE = 'Još nema prijava za izbor';

/**
 * A task in a list: one face (`TaskFace`) for discovery, the map preview and my own tasks (owner's step 5a, 2026-09-24).
 *
 * The body is ONE press that opens the task. On my own task the next step is its own press, a sibling of the body and
 * never inside it: when applications wait for my choice, the foot at the bottom of the card goes straight to them
 * (`onApplications`), a screen shorter than through the task. The work title and terms lead one compact brief,
 * followed by grouped logistics and a human/capacity row. Agreements remain accepted appointments.
 *
 * The frame is what gives under the finger (card review r3 item 9): the border, the ground and everything on it scale
 * together, as one object, instead of the content shrinking inside a frame that stood still. Under reduced motion
 * nothing moves. The card is heard once: its command name, then everything it shows (`taskSpoken`), with no stop per
 * fact (item 4).
 */
function TaskCardBase({ item, onOpen, onApplications, compact = false, bare = false, disabled = false, relation, sectionSays, portrait }: {
  item: MarketplaceItem; onOpen: () => void;
  /** My own task only: opens the applications that wait for my choice. Without it the count is still said, as words. */
  onApplications?: () => void;
  compact?: boolean;
  /**
   * The face without the card's own frame: no hairline, no corner and no padding across, for a face that already sits
   * inside a card (a pin's card on the map, whose sheet is the card and gives the padding). A card is never drawn inside
   * a card. The one press, its words and everything it says stay exactly as on the card.
   */
  bare?: boolean;
  disabled?: boolean;
  /** What this account is to a task found in discovery, from its own tasks and applications. Absent = nothing known. */
  relation?: 'OWNED' | 'APPLIED';
  /** Authorized public portrait supplied by the collection; no per-card reads are started here. */
  portrait?: ReactNode;
  /** The state the list's own section is named for (Nacrti, Istorija), which the card then does not repeat. */
  sectionSays?: StanjePotrebe }) {
  const { width } = useWindowDimensions();
  const large = useTextScale() >= 1.3 || width < 380;
  const reduced = useReducedMotion();
  const own = isOwnedNeed(item);
  const title = readableTitle(item.naslov);
  const status = taskStatus(item, relation, sectionSays);
  // HITNO counts only until the server's expiry, on the one clock the badge is given below: an expired HITNO on a task
  // with no status drew an empty top row, the badge having already gone.
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const requirement = taskRequirement(item);
  // The owner reads the progress of their task; so does a task of mine met in discovery. Everyone else reads the places left.
  const ownerView = own || relation === 'OWNED';
  const audience = ownerView ? 'owner' : 'worker';
  const next = own ? ownerNext(item) : null;
  const publisher = !ownerView && 'narucilacIme' in item && typeof item.narucilacIme === 'string' ? item.narucilacIme.trim() : '';
  const person = 'narucilacIme' in item && publisher
    ? <CardPerson name={publisher} rating={item.narucilacOcena} count={item.narucilacBrojOcena} size={40} portrait={portrait} /> : null;
  const waitingFoot = next?.kind === 'waiting' && onApplications ? next : null;
  const spoken = taskSpoken({ status: status?.text, urgent, value, place: place.text, schedule, requirement,
    places: next?.kind === 'draft' ? null : placesText(item.pokrivenost, audience).spoken,
    person: 'narucilacIme' in item && publisher ? personSpoken(publisher, item.narucilacOcena, item.narucilacBrojOcena) : null,
    next: next?.kind === 'draft' ? DRAFT_NEXT : next?.kind === 'none' ? NOTHING_TO_CHOOSE : next?.kind === 'waiting' && !waitingFoot ? next.text : null });

  const scale = useSharedValue(1);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const give = () => { if (!reduced) scale.set(withTiming(CARD_PRESS_SCALE, { duration: sys.motion.press, easing: EASE_OUT })); };
  // Put back at once under reduced motion, even if the setting changed mid-press.
  const settle = () => { scale.set(reduced ? 1 : withSpring(1, { ...sys.motion.spring, reduceMotion: ReduceMotion.System })); };

  return <Animated.View style={[s.card, bare && s.bare, disabled && s.disabled, lift]}>
    <Press accessibilityRole="button" accessibilityLabel={`${own ? 'Otvori Zadatak' : 'Otvori priliku'} ${title}`} accessibilityValue={{ text: spoken }}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1}
      style={[s.body, compact && s.bodyCompact, bare && s.bodyBare]}>
      {status || urgent ? <CardStatus status={status} urgency={item.urgency} now={urgencyNow} /> : null}
      <CardHead title={title} value={value} large={large} />
      <View style={s.facts}>
        <CardFact art={<FactArt kind={place.remote ? 'remote' : 'pin'} size={20} />} text={place.text} lines={0} />
        {/* The complete range remains readable, including its end date on narrow or enlarged-text cards. */}
        <CardFact art={<FactArt kind="calendar" size={20} />} text={schedule} lines={0} />
        {requirement ? <CardRequirement requirement={requirement} /> : null}
      </View>
      {person || next?.kind !== 'draft' ? <CardBriefFoot person={person} large={large}
        places={next?.kind === 'draft' ? null : <CardPlaces places={item.pokrivenost} audience={audience} large />} /> : null}
      {next?.kind === 'draft' ? <CardNext label={DRAFT_NEXT} /> : null}
      {next?.kind === 'none' ? <CardNote text={NOTHING_TO_CHOOSE} /> : null}
      {next?.kind === 'waiting' && !waitingFoot ? <CardWaitingLine text={next.text} /> : null}
    </Press>
    {/* No hit slop: the hairline is the border between the two targets, and a touch just above it opens the task. */}
    {waitingFoot ? <Press accessibilityRole="button" accessibilityLabel={`${waitingFoot.text}, ${title}`} accessibilityHint="Otvara prijave za izbor."
      accessibilityState={{ disabled }} disabled={disabled} onPress={onApplications} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1}
      hitSlop={0} style={[faceStyles.ownerFoot, compact && s.footCompact, bare && s.footBare]}>
      {/* The one foot line of the card system (review r4 item 8): the orange dot, the warn words, the caret. */}
      <CardFootLine label={waitingFoot.text} tone="waiting" caret="right" />
    </Press> : null}
  </Animated.View>;
}
export const TaskCard = memo(TaskCardBase);

const s = StyleSheet.create({
  // The task's contained work brief contrasts with an open Agreement agenda; one soft edge, not border plus shadow.
  card: { ...cardCompact, ...sys.elevation.card, borderWidth: 0, padding: 0 },
  disabled: { opacity: 0.55 },
  body: { padding: sys.space.lg, gap: sys.space.base, borderRadius: sys.radius.cardCompact },
  bodyCompact: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  facts: { gap: sys.space.sm },
  footCompact: { paddingHorizontal: 14 },
  // Bare: the card that holds the face draws the edge, the corner and the padding across; the face adds none of them.
  bare: { borderWidth: 0, borderRadius: 0, elevation: 0, shadowOpacity: 0 },
  bodyBare: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, borderRadius: 0, gap: 16 },
  // Inside another card the waiting foot is a flat tint at the control corner, never a card's bottom strip.
  // (Its own lower corners are named, so they are named again here: a named corner wins over `borderRadius`.)
  footBare: { borderTopWidth: 0, borderRadius: sys.radius.control, borderBottomLeftRadius: sys.radius.control,
    borderBottomRightRadius: sys.radius.control },
});
