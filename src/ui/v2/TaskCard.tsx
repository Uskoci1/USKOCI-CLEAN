import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { isOwnedNeed } from '../../data/marketplaceView';
import { needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { displaysUrgent } from '../../lib/needUrgency';
import { FactArt } from '../system/FactArt';
import { useTextScale } from '../system/textScale';
import { cardCompact, sys } from '../system/tokens';
import { Press } from '../Press';
import { T } from '../Text';
import { useUrgencyClock } from './NeedUrgencyBadge';
import { CardFact, CardFoot, CardHead, CardNext, CardNote, CardPerson, CardPlaces, CardRequirement, CardStatus, CardWaitingLine,
  faceStyles, ownerNext, taskPlace, taskRequirement, taskStatus, taskValue } from './TaskFace';

/**
 * A task in a list: one face (`TaskFace`) for discovery, the map preview and my own tasks (owner's step 5a, 2026-09-24).
 *
 * The body is ONE press that opens the task. On my own task the next step is its own press, a sibling of the body and
 * never inside it: when applications wait for my choice, the warm foot goes straight to them (`onApplications`), a
 * screen shorter than through the task. The card is the shared hairline card with no shadow; a shadow means "this
 * floats", and a card in a list does not.
 */
function TaskCardBase({ item, onOpen, onApplications, compact = false, disabled = false, relation }: {
  item: MarketplaceItem; onOpen: () => void;
  /** My own task only: opens the applications that wait for my choice. Without it the count is still said, as words. */
  onApplications?: () => void;
  compact?: boolean; disabled?: boolean;
  /** What this account is to a task found in discovery, from its own tasks and applications. Absent = nothing known. */
  relation?: 'OWNED' | 'APPLIED' }) {
  const large = useTextScale() >= 1.3;
  const own = isOwnedNeed(item);
  const title = readableTitle(item.naslov);
  const status = taskStatus(item, relation);
  // HITNO counts only until the server's expiry, on the one clock the badge is given below: an expired HITNO on a task
  // with no status drew an empty top row, the badge having already gone.
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const place = taskPlace(item);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const requirement = taskRequirement(item);
  // The owner reads the progress of their task; so does a task of mine met in discovery. Everyone else reads the places left.
  const ownerView = own || relation === 'OWNED';
  const next = own ? ownerNext(item) : null;
  const publisher = !ownerView && 'narucilacIme' in item && typeof item.narucilacIme === 'string' ? item.narucilacIme.trim() : '';
  const person = 'narucilacIme' in item && publisher
    ? <CardPerson name={publisher} rating={item.narucilacOcena} count={item.narucilacBrojOcena} /> : null;
  const waitingFoot = next?.kind === 'waiting' && onApplications ? next : null;
  return <View style={[s.card, disabled && s.disabled]}>
    <Press accessibilityRole="button" accessibilityLabel={`${own ? 'Otvori Zadatak' : 'Otvori priliku'} ${title}`}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} haptic="select" scaleTo={0.986}
      style={[s.body, compact && s.bodyCompact, waitingFoot && s.bodyOverFoot]}>
      {status || urgent ? <CardStatus status={status} urgency={item.urgency} now={urgencyNow} /> : null}
      <CardHead title={title} value={taskValue(item)} large={large} />
      <View style={s.facts}>
        <CardFact art={<FactArt kind={place.remote ? 'remote' : 'pin'} size={16} />} text={place.text} />
        <CardFact art={<FactArt kind="calendar" size={16} />} text={schedule} lines={large ? 2 : 1} />
        {requirement ? <CardRequirement requirement={requirement} /> : null}
      </View>
      {next?.kind === 'draft' ? <CardNext label="Nastavi uređivanje" />
        : <CardFoot large={large} places={<CardPlaces places={item.pokrivenost} audience={ownerView ? 'owner' : 'worker'} />} person={person} />}
      {next?.kind === 'none' ? <CardNote text="Još nema prijava za izbor" /> : null}
      {next?.kind === 'waiting' && !onApplications ? <CardWaitingLine text={next.text} /> : null}
    </Press>
    {waitingFoot ? <Press accessibilityRole="button" accessibilityLabel={`${waitingFoot.text}, ${title}`} accessibilityHint="Otvara prijave za izbor."
      accessibilityState={{ disabled }} disabled={disabled} onPress={onApplications} haptic="select"
      style={[faceStyles.ownerFoot, s.foot, compact && s.footCompact]}>
      <T style={faceStyles.ownerFootText} numberOfLines={2}>{waitingFoot.text}</T>
      <CaretRight size={18} weight="bold" color={sys.color.waitingInk} />
    </Press> : null}
  </View>;
}
export const TaskCard = memo(TaskCardBase);

const s = StyleSheet.create({
  // The shared card: white, the card corner, one hairline and no shadow. The body carries the padding, so the whole
  // card stays one target up to its edge.
  card: { ...cardCompact, padding: 0 },
  disabled: { opacity: 0.55 },
  body: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14, gap: 8, borderRadius: sys.radius.cardCompact },
  bodyCompact: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  bodyOverFoot: { paddingBottom: 10 },
  facts: { gap: 4 },
  foot: { marginHorizontal: 12, marginBottom: 12 },
  footCompact: { marginHorizontal: 10, marginBottom: 10 },
});
