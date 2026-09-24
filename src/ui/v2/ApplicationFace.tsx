import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { MojaPrijavaProjekcija, StanjeMojePrijave } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { FactArt } from '../system/FactArt';
import { useReducedMotion } from '../system/motion';
import { dolaziOsoba, osoba } from '../system/plural';
import { useTextScale } from '../system/textScale';
import { cardCompact, sys } from '../system/tokens';
import { Press } from '../Press';
import { T } from '../Text';
import { CARD_PRESS_SCALE } from './TaskCard';
import { CardFact, CardFootLine, CardStatusLine, CardTitle, VALUE_WORDS, faceStyles, valueStyles, type FootTone, type StatusTone } from './TaskFace';

/**
 * The face of MY application in a list (owner's step 5c, 2026-09-24). It belongs to the task card's system (the same
 * frame, the same fixed lines, the same fact drawings, the same foot) and has its own purpose: my offer. Every card is
 * the same lines in the same order, and a line either says something or is not drawn:
 *
 *   1. the status, with a dot: Poslata, Pregledana, U užem izboru, Izabrana, Potrebna nova provera, Povučena, Zatvorena.
 *      The state is said by the dot and the word, never by a coloured card edge;
 *   2. the title of the task;
 *   3. where (one line); 4. when (up to two lines);
 *   5. my offer: "Tvoja ponuda", and the amount in the money colour with "ukupno" under it (the task card's value slot),
 *      or the word when there is no amount;
 *   6. the people the offer brings ("Dolaze 2 osobe", the owner's words for a price read with its people; only "2 osobe"
 *      once the application is over, since nobody comes);
 *   7. my message to the requester, when I wrote one, in two lines at most;
 *   8. the foot: at most ONE action, the one this state allows, as a quiet row link (never a button inside the card):
 *      Izabrana → "Otvori Dogovor", Poslata (and every open state the server lets me withdraw) → "Povuci prijavu" (a
 *      quiet ink link; the danger colour is kept for the question it opens), Potrebna nova provera → "Pregledaj izmene
 *      zadatka" (the one orange dot of the card); nothing for a state that is over.
 *
 * The body opens the task the application belongs to, as it always did. The foot is its own press, a sibling of the body.
 *
 * "Odbijena" is not a word the card can say: the read has no such state. Its CLOSED merges an application that was not
 * chosen, one that expired and one whose task closed (private.my_application_state), so it says what is true of all
 * three, "Zatvorena", and never names a reason it does not know.
 */

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/* ------------------------------------------------------------------------------------------------ what it says */

const STATUS: Record<StanjeMojePrijave, { text: string; tone: StatusTone }> = {
  SUBMITTED: { text: 'Poslata', tone: 'ink' },
  VIEWED: { text: 'Pregledana', tone: 'ink' },
  SHORTLISTED: { text: 'U užem izboru', tone: 'green' },
  SELECTED: { text: 'Izabrana', tone: 'green' },
  // Said once, in ink: the foot under it carries the one orange dot of a waiting card (review r4 item 6; R1 A13, B1).
  STALE_REVIEW_REQUIRED: { text: 'Potrebna nova provera', tone: 'ink' },
  WITHDRAWN: { text: 'Povučena', tone: 'muted' },
  CLOSED: { text: 'Zatvorena', tone: 'muted' },
};
/** The status line of an application: the word and the tone its dot is drawn in. */
export const applicationStatus = (state: StanjeMojePrijave) => STATUS[state];

/**
 * My offer. The stored price of an application is its own total: a task priced per person is multiplied by the places
 * this application covers when it is sent (pkg025b), and the edit form asks for "Cena prijave ukupno". So the card says
 * "ukupno"; "po osobi" is drawn only for a value that is one, and the read hands none over today. An amount that is not a
 * positive number with its written form is not an amount, and the card says so in words.
 */
export type ApplicationValue = { kind: 'amount'; amount: string; basis: 'ukupno' | 'po osobi' } | { kind: 'unpriced' };
export function applicationValue(row: Pick<MojaPrijavaProjekcija, 'cena'>): ApplicationValue {
  const amount = row.cena?.prikaz?.trim();
  const number = row.cena?.iznos;
  if (!amount || typeof number !== 'number' || !Number.isFinite(number) || number <= 0) return { kind: 'unpriced' };
  return { kind: 'amount', amount, basis: 'ukupno' };
}
/** The words before the value. What the amount buys ("ukupno") stands under the amount, as on the task card. */
export const OFFER_WORDS = 'Tvoja ponuda';
/** The value as it is heard: "Tvoja ponuda 4.500 RSD ukupno", or the word. */
export const offerSpoken = (value: ApplicationValue) => value.kind === 'amount'
  ? `${OFFER_WORDS} ${value.amount} ${value.basis}` : `${OFFER_WORDS}: ${VALUE_WORDS.unpriced}`;
/**
 * The people the offer brings, in the owner's words for a price read with its people (decision 2, 2026-09-19). An
 * application that is over (withdrawn or closed) brings nobody, so it says only how many it offered ("2 osobe"), never
 * "Dolaze 2 osobe" (review r4 item 2).
 */
export const offerPeople = (places: number, over = false) => {
  const words = over ? osoba(places) : dolaziOsoba(places);
  return words.charAt(0).toUpperCase() + words.slice(1);
};
/** An application nobody comes for any more: withdrawn, or closed for any of the reasons CLOSED merges. */
export const applicationOver = (state: StanjeMojePrijave) => state === 'WITHDRAWN' || state === 'CLOSED';

/** The one action the foot holds, from the state alone. `null`: the state allows none, or it is already open. */
export type ApplicationFootAction = 'agreement' | 'withdraw' | 'review';
export function applicationFoot(row: Pick<MojaPrijavaProjekcija, 'stanje' | 'dogovorId' | 'mozePovuci'>, expanded = false): ApplicationFootAction | null {
  // The review of the changed task is the one step of a stale application; while it is open under the card, it has its
  // own close and its own decisions, so the foot is not drawn twice.
  if (row.stanje === 'STALE_REVIEW_REQUIRED') return expanded ? null : 'review';
  if (row.stanje === 'SELECTED') return row.dogovorId ? 'agreement' : null;
  // The server's own flag, the one the screen's withdrawal guard reads; it is only ever set on an open application.
  return row.mozePovuci ? 'withdraw' : null;
}
const FOOT: Record<ApplicationFootAction, { label: string; spoken: string; tone: FootTone; caret: 'right' | 'down' | 'none'; hint?: string }> = {
  agreement: { label: 'Otvori Dogovor', spoken: 'Otvori Dogovor', tone: 'green', caret: 'right' },
  // Withdrawing is rare ("retko"): a quiet ink link on every open card, and the danger colour only in the question it
  // opens (review r4 item 7).
  withdraw: { label: 'Povuci prijavu', spoken: 'Povuci prijavu', tone: 'ink', caret: 'none', hint: 'Pre povlačenja te pitamo da potvrdiš.' },
  // The spoken name starts with the visible words, so voice control and a screen reader name it the same (WCAG 2.5.3).
  review: { label: 'Pregledaj izmene zadatka', spoken: 'Pregledaj izmene zadatka', tone: 'waiting', caret: 'down', hint: 'Otvara aktuelne uslove ispod kartice.' },
};
/** What the foot says, and what a screen reader hears ("Povuci prijavu: <naslov>"), per action. */
export const applicationFootWords = (action: ApplicationFootAction) => FOOT[action];

/** Everything the body shows, as one sentence after its command name, in the order it is drawn. Empty parts are left out. */
export function applicationSpoken(row: MojaPrijavaProjekcija): string {
  const value = applicationValue(row);
  const note = row.napomena?.trim();
  return [applicationStatus(row.stanje).text, row.podrucjeTekst, row.vremeTekst, offerSpoken(value),
    offerPeople(row.pokrivaMesta, applicationOver(row.stanje)), note ? `tvoja poruka: ${note}` : null]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', ');
}

/* ------------------------------------------------------------------------------------------------ the parts */

/**
 * Lines 5 and 6: my offer. "Tvoja ponuda" is a fact line with the money drawing, so every line of the card starts on one
 * text column (the first web look had the offer's words out on the card's edge, under drawings). The value is the task
 * card's value slot: the amount at the right, never cut, with what it buys ("ukupno") small under it. One label "Tvoja
 * ponuda · ukupno" beside the amount broke at 320 dp after its "·" (seen in the web check); the basis under the amount is
 * how the task card already says it. A word instead of an amount is a quiet label, never the money colour or weight. At
 * large text the value moves under its words, as a whole line on that same column.
 */
export function OfferRow({ value, places, large, over = false }: { value: ApplicationValue; places: number; large: boolean;
  /** The application is withdrawn or closed: nobody comes, so the people are a count, not "Dolaze". */ over?: boolean }) {
  return <View style={s.offer}>
    <View style={large ? s.valueStacked : s.valueRow}>
      <View style={!large && s.offerWords}><CardFact art={<FactArt kind="money" size={16} />} text={OFFER_WORDS} lines={2} /></View>
      {value.kind === 'amount' ? <View style={large ? s.amountStacked : valueStyles.amountSide}>
        <T style={[valueStyles.amount, large && valueStyles.alignStart]}>{value.amount}</T>
        <T style={[valueStyles.basis, large && valueStyles.alignStart]} numberOfLines={1}>{value.basis}</T>
      </View>
        : <T style={[valueStyles.valueWord, large ? s.onTextColumn : s.valueWordSide]} numberOfLines={2}>{VALUE_WORDS.unpriced}</T>}
    </View>
    <CardFact art={<FactArt kind="users" size={16} />} text={offerPeople(places, over)} lines={large ? 2 : 1} />
  </View>;
}

/**
 * What a person reads to recognise the application. Data to pixels only, memoised on the row and the text size alone, so
 * the screen's fresh per-render handlers (which the card must keep: a handle captured under one account revision must not
 * act under the next) re-render the thin interactive shell and not this text.
 */
export const ApplicationSummary = memo(function ApplicationSummary({ row, large }: { row: MojaPrijavaProjekcija; large: boolean }) {
  const status = applicationStatus(row.stanje);
  const note = row.napomena?.trim();
  return <>
    <CardStatusLine text={status.text} tone={status.tone} />
    <CardTitle title={readableTitle(row.naslov)} lines={large ? 3 : 2} />
    <View style={s.facts}>
      <CardFact art={<FactArt kind="pin" size={16} />} text={row.podrucjeTekst} />
      <CardFact art={<FactArt kind="calendar" size={16} />} text={row.vremeTekst} lines={2} />
    </View>
    <OfferRow value={applicationValue(row)} places={row.pokrivaMesta} large={large} over={applicationOver(row.stanje)} />
    {/* The only place my message to the requester can be read again; my words, so in quotes. */}
    {note ? <CardFact art={<FactArt kind="chat" size={16} />} text={`„${note}“`} lines={2} /> : null}
  </>;
});

/**
 * One application: the shared hairline card with no shadow. The body is ONE press that opens the task; the foot, when the
 * state allows an action, is its own press beside it; `children` is what opens under the card (the review of a changed
 * task). The frame gives under the finger as one object, as the task card's does, and nothing moves under reduced motion.
 * The handlers are the screen's own guarded commands, handed in fresh on every render on purpose.
 */
function ApplicationCardBase({ row, onTask, onAgreement, onWithdraw, onReview, expanded = false, disabled = false, large: forced, children }: {
  row: MojaPrijavaProjekcija; onTask: () => void; onAgreement: () => void; onWithdraw: () => void; onReview: () => void;
  /** The review of the changed task is open under this card. */ expanded?: boolean;
  /** A command is in flight or waits for its readback: nothing on the card can be pressed. */ disabled?: boolean;
  /** The internal gallery shows the large-text layout without changing the phone's setting. */ large?: boolean;
  children?: ReactNode;
}) {
  const scaled = useTextScale() >= 1.3;
  const large = forced ?? scaled;
  const reduced = useReducedMotion();
  const title = readableTitle(row.naslov);
  const action = applicationFoot(row, expanded);
  const foot = action ? FOOT[action] : null;
  const onFoot = action === 'agreement' ? onAgreement : action === 'withdraw' ? onWithdraw : onReview;

  const scale = useSharedValue(1);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const give = () => { if (!reduced) scale.set(withTiming(CARD_PRESS_SCALE, { duration: sys.motion.press, easing: EASE_OUT })); };
  const settle = () => { scale.set(reduced ? 1 : withSpring(1, { ...sys.motion.spring, reduceMotion: ReduceMotion.System })); };

  return <Animated.View style={[s.card, lift]}>
    <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${title}`} accessibilityValue={{ text: applicationSpoken(row) }}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onTask} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1}
      style={s.body}>
      <ApplicationSummary row={row} large={large} />
    </Press>
    {/* No hit slop: the hairline is the border between the two targets, and a touch just above it opens the task. */}
    {foot ? <Press accessibilityRole="button" accessibilityLabel={`${foot.spoken}: ${title}`} accessibilityHint={foot.hint}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onFoot} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1}
      hitSlop={0} style={foot.tone === 'waiting' ? faceStyles.ownerFoot : faceStyles.footLink}>
      <CardFootLine label={foot.label} tone={foot.tone} caret={foot.caret} disabled={disabled} />
    </Press> : null}
    {children}
  </Animated.View>;
}
export const ApplicationCard = memo(ApplicationCardBase);

const s = StyleSheet.create({
  // The task card's frame and body geometry: white, the card corner, one hairline, no shadow; the body carries the padding
  // so the whole card stays one target up to its edge.
  card: { ...cardCompact, padding: 0 },
  body: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14, gap: 8, borderRadius: sys.radius.cardCompact },
  facts: { gap: 4 },
  // My offer sits a step apart from the task's facts: it is the part of the card that is mine.
  offer: { gap: 4, marginTop: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  valueStacked: { gap: 2 },
  offerWords: { flex: 1, minWidth: 0 },
  // The text column of a fact line: its 16 px drawing and the 8 px after it.
  onTextColumn: { textAlign: 'left', marginLeft: 24 },
  // The task card's value slot (`valueStyles`): the amount keeps its whole width, what it buys under it; at large text,
  // beside it on the text column.
  amountStacked: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginLeft: 24 },
  // The task card's cap for a word in the value slot, so the two faces give the word the same room.
  valueWordSide: { maxWidth: '42%' },
});
