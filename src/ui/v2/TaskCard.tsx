import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { hasNeedAttention, isOwnedNeed } from '../../data/marketplaceView';
import { needPriceBasisNote, needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { prijava as prijave } from '../system/plural';
import { FactArt } from '../system/FactArt';
import { Press } from '../Press';
import { sys, cardCompact } from '../system/tokens';
import { T } from '../Text';
import { displaysUrgent } from '../../lib/needUrgency';
import { NeedUrgencyBadge, useUrgencyClock } from './NeedUrgencyBadge';

const STATUS = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljen', CEKA_PRIJAVE: 'Čeka prijave', DELIMICNO_POPUNJENA: 'Delimično popunjen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' } as const;

/**
 * A task in a list, recomposed from zero (owner, 2026-09-23: the prototypes document what a card says,
 * not its layout). A list is scanned, so the card answers the scanning questions in the order the eye
 * moves: what it is and what it pays on one line (the name on the left, the money on the right, the
 * marketplace convention), where and when on the next, then how many places are left, one condition
 * or the applications that wait, and who posted it. No hairlines inside the card and no big coloured
 * price block: at the owner's text size the old card showed one and a half tasks per screen.
 * Nothing here invents a rating, a count or a state: a zero, a missing rating and an unnamed price
 * basis are simply not drawn, and a word about money never wears the money colour.
 */
function TaskCardBase({ item, onOpen, compact = false, disabled = false, relation }: { item: MarketplaceItem; onOpen: () => void; compact?: boolean; disabled?: boolean;
  /** What this account is to a task found in discovery, from its own tasks and applications. Absent = nothing known. */
  relation?: 'OWNED' | 'APPLIED' }) {
  const own = isOwnedNeed(item), attention = own && hasNeedAttention(item), draft = own && item.stanje === 'NACRT';
  const settled = own && (item.stanje === 'DELIMICNO_POPUNJENA' || item.stanje === 'POPUNJENA' || item.stanje === 'ZATVORENA');
  // A sent application is a paper plane in words, never the tick of something finished.
  const status = draft ? STATUS.NACRT : settled ? STATUS[item.stanje]
    : relation === 'OWNED' ? 'Tvoj zadatak' : relation === 'APPLIED' ? 'Prijava poslata' : null;
  const quiet = draft || (own && item.stanje === 'ZATVORENA');
  const tone = quiet ? sys.color.muted : sys.color.green;
  // HITNO counts only until the server's expiry, on the one clock the badge is given below: an expired HITNO on a task
  // with no status drew an empty top row, the badge having already gone.
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const remote = item.detalji?.rezimLokacije === 'REMOTE';
  const offers = item.rezimCene === 'OFFERS';
  const amount = offers ? null : item.ponudjenaCena?.prikaz ?? null;
  // The number leads and what it buys goes quietly under it, so a per-person price never reads as the total.
  const basis = amount ? needPriceBasisNote(item) : null;
  const waiting = attention ? item.brojPrijavaZaIzbor ?? 0 : 0;
  const [condition, ...moreConditions] = item.uslovi;
  const publisher = 'narucilacIme' in item && item.narucilacIme ? item.narucilacIme : null;
  const rating = 'narucilacOcena' in item ? item.narucilacOcena : null;
  const { popunjeno, ukupno } = item.pokrivenost;
  return <Press accessibilityRole="button" accessibilityLabel={`${own ? 'Otvori Zadatak' : 'Otvori priliku'} ${readableTitle(item.naslov)}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} haptic="select" scaleTo={0.986}
    style={[s.card, compact && s.compact, disabled && s.disabled]}>
    {status || urgent ? <View style={s.top}>
      {status ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: tone }]} /><T variant="label" style={[s.status, { color: tone }]}>{status}</T></View> : <View style={s.grow} />}
      <NeedUrgencyBadge urgency={item.urgency} now={urgencyNow} />
    </View> : null}
    {/* Only an amount stands beside the name: it is short and it is what the eye compares down the list.
        A word about money ("Tražim ponude") squeezed the name into three lines on the phone, so it is a fact below. */}
    <View style={s.head}>
      <T style={s.title} numberOfLines={3}>{readableTitle(item.naslov)}</T>
      {amount ? <View style={s.priceSide}>
        <T style={s.price}>{amount}</T>
        {basis ? <T style={s.basis}>{basis}</T> : null}
      </View> : null}
    </View>
    <View style={s.facts}>
      <View style={s.fact}><FactArt kind={remote ? 'remote' : 'pin'} size={16} /><T style={s.factText} numberOfLines={1}>{remote ? 'Na daljinu' : item.podrucjeTekst}</T></View>
      <View style={s.fact}><FactArt kind="calendar" size={16} /><T style={s.factText}>{schedule}</T></View>
      {!amount ? <View style={s.fact}><FactArt kind={offers ? 'offers' : 'money'} size={16} muted={!offers} />
        <T style={offers ? s.priceWord : s.noPrice}>{offers ? 'Tražim ponude' : 'Cena nije navedena'}</T></View> : null}
    </View>
    <View style={s.bottom}>
      {draft ? <T style={s.next}>Nastavi uređivanje</T>
        : <View accessible accessibilityLabel={`${popunjeno} od ${ukupno} popunjeno`} style={s.fact}>
          <FactArt kind="users" size={16} muted={quiet} />
          <T style={[s.factText, s.places, attention && s.placesAttention]}>{`${popunjeno}/${ukupno} popunjeno`}</T>
        </View>}
      {waiting > 0 ? <View style={s.waiting}><T style={s.waitingText}>{prijave(waiting)} za pregled</T></View>
        : condition ? <T style={s.condition} numberOfLines={1}>{`${condition}${moreConditions.length ? ` +${moreConditions.length}` : ''}`}</T> : null}
      {publisher ? <View style={s.publisher}>
        <View style={s.avatar}><T style={s.avatarText}>{publisher.trim().charAt(0).toLocaleUpperCase('sr-Latn-RS')}</T></View>
        <T style={s.publisherName} numberOfLines={1}>{publisher}</T>
        {rating ? <><FactArt kind="star" size={14} /><T style={s.ratingText}>{rating}</T></> : null}
      </View> : null}
    </View>
  </Press>;
}
export const TaskCard = memo(TaskCardBase);

const s = StyleSheet.create({
  card: { ...cardCompact, paddingHorizontal: 16, paddingTop: 15, paddingBottom: 14, gap: 8 },
  compact: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  disabled: { opacity: 0.55 },
  grow: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  status: { flexShrink: 1, letterSpacing: 0.3 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, minWidth: 0, fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3, color: sys.color.ink },
  // The amount keeps its width and the name wraps beside it.
  priceSide: { alignItems: 'flex-end', maxWidth: '42%' },
  price: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2, color: sys.color.money, fontVariant: ['tabular-nums'], textAlign: 'right' },
  priceWord: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: sys.color.ink, flexShrink: 1 },
  noPrice: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: sys.color.muted, flexShrink: 1 },
  basis: { fontSize: 12, lineHeight: 16, color: sys.color.muted, textAlign: 'right' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  factText: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: '#4F6157', flexShrink: 1 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6, marginTop: 2 },
  places: { fontVariant: ['tabular-nums'] },
  placesAttention: { color: '#985223', fontWeight: '700' },
  next: { fontSize: 14, lineHeight: 19, color: sys.color.green, fontWeight: '600' },
  condition: { flexShrink: 1, maxWidth: 200, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#596960',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: sys.radius.badge, backgroundColor: sys.color.iconWell, overflow: 'hidden' },
  waiting: { borderRadius: sys.radius.badge, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: sys.color.orangeSoft },
  waitingText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#874515' },
  // Beside the places when there is room; under them, from the same left edge, when there is not.
  publisher: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, maxWidth: '100%' },
  avatar: { width: 22, height: 22, borderRadius: sys.radius.pill, backgroundColor: '#EEF3EF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, lineHeight: 15, fontWeight: '700', color: sys.color.ink },
  publisherName: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: sys.color.ink, flexShrink: 1 },
  ratingText: { fontSize: 13, lineHeight: 17, color: sys.color.muted },
});
