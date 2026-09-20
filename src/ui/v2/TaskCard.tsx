import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Clock, MapPin, Users } from 'phosphor-react-native';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { hasNeedAttention, isOwnedNeed } from '../../data/marketplaceView';
import { needPeopleText, needPriceText, needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { card, cardCompact, sys } from '../system/tokens';
import { T } from '../Text';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

const STATUS = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljen', CEKA_PRIJAVE: 'Čeka prijave', DELIMICNO_POPUNJENA: 'Delimično popunjen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' } as const;
const prijave = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'prijava' : n % 10 >= 2 && n % 10 <= 4 ? 'prijave' : 'prijava'}`;

/**
 * Need/Opportunity card with the V5 live-card anatomy: title, where, when, then a
 * hairline foot with the price and the people. A status line appears only when it
 * says something the list section does not: new applications to look at, a private
 * draft, a filled or closed Task. Each caller supplies its own authorized
 * projection; nothing here invents a rating, a thumbnail or a state.
 */
function TaskCardBase({ item, onOpen, compact = false, disabled = false, relation }: { item: MarketplaceItem; onOpen: () => void; compact?: boolean; disabled?: boolean;
  /** What this account is to a task found in discovery, from its own tasks and applications. Absent = nothing known. */
  relation?: 'OWNED' | 'APPLIED' }) {
  const own = isOwnedNeed(item), attention = own && hasNeedAttention(item), draft = own && item.stanje === 'NACRT';
  const settled = own && (item.stanje === 'DELIMICNO_POPUNJENA' || item.stanje === 'POPUNJENA' || item.stanje === 'ZATVORENA');
  // A sent application is a paper plane in words, never the tick of something finished.
  const status = attention ? `${prijave(item.brojPrijava)} · pogledaj` : draft ? STATUS.NACRT : settled ? STATUS[item.stanje]
    : relation === 'OWNED' ? 'Tvoj zadatak' : relation === 'APPLIED' ? 'Prijava poslata' : null;
  const quiet = draft || (own && item.stanje === 'ZATVORENA');
  const tone = attention ? sys.color.warn : quiet ? sys.color.muted : sys.color.green;
  const dot = attention ? sys.color.orange : quiet ? sys.color.lineStrong : sys.color.green;
  const urgent = item.urgency?.level === 'HITNO';
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const remote = item.detalji?.rezimLokacije === 'REMOTE';
  const offers = item.rezimCene === 'OFFERS';
  // A card has no room for the arithmetic, so it names the unit and leaves the total to the detail.
  const price = needPriceText(item);
  return <Press accessibilityRole="button" accessibilityLabel={`${own ? 'Otvori Zadatak' : 'Otvori priliku'} ${readableTitle(item.naslov)}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} haptic="select" scaleTo={0.986}
    style={[compact ? cardCompact : card, attention && s.attentionCard, disabled && s.disabled]}>
    {status || urgent ? <View style={s.top}>
      {status ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: dot }]} /><T variant="label" style={[s.status, { color: tone }]}>{status}</T></View> : <View style={s.grow} />}
      <NeedUrgencyBadge urgency={item.urgency} />
    </View> : null}
    <T style={s.title}>{readableTitle(item.naslov)}</T>
    <View style={s.facts}>
      <View style={s.fact}><MapPin size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{remote ? 'Na daljinu' : item.podrucjeTekst}</T></View>
      <View style={s.fact}><Clock size={17} color={sys.color.green} /><T variant="note" tone="muted" style={s.factText}>{schedule}</T></View>
    </View>
    <View style={s.foot}>
      <T style={[s.price, offers && s.offers]}>{price}</T>
      {draft ? <T variant="meta" style={s.next}>Nastavi uređivanje</T>
        : <View accessible accessibilityLabel={`${item.pokrivenost.popunjeno} od ${needPeopleText(item.pokrivenost.ukupno)} dogovoreno`} style={s.people}>
          <Users size={18} color={sys.color.ink} />
          <T variant="meta" style={s.peopleText}>{own ? `${item.pokrivenost.popunjeno} / ${item.pokrivenost.ukupno}` : needPeopleText(item.pokrivenost.ukupno)}</T>
        </View>}
    </View>
  </Press>;
}
export const TaskCard = memo(TaskCardBase);

const s = StyleSheet.create({
  attentionCard: { borderColor: sys.color.orange },
  disabled: { opacity: 0.55 },
  grow: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  status: { flexShrink: 1, letterSpacing: 0.3 },
  title: { ...sys.type.cardTitle, color: sys.color.ink },
  facts: { gap: 6, marginTop: 9 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factText: { flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: sys.color.line },
  price: { ...sys.type.price, color: sys.color.money, flexShrink: 1 },
  offers: { ...sys.type.bodyStrong, color: sys.color.ink },
  people: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  peopleText: { color: sys.color.ink, fontWeight: '600', fontVariant: ['tabular-nums'] },
  next: { color: sys.color.green, fontWeight: '600' },
});
