import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CaretRight, Star } from 'phosphor-react-native';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { hasNeedAttention, isOwnedNeed } from '../../data/marketplaceView';
import { needPriceBasisNote, needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { osoba, prijava as prijave } from '../system/plural';
import { FactArt } from '../system/FactArt';
import { Press } from '../Press';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

const STATUS = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljen', CEKA_PRIJAVE: 'Čeka prijave', DELIMICNO_POPUNJENA: 'Delimično popunjen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' } as const;

/**
 * Need/Opportunity card, V28 anatomy at V31 size (owner decision 2026-09-22): title; where and when
 * on one wrapping line; a hairline; the price large with what it covers underneath, and how many
 * places are filled; then only the chips that say something — a condition, applications waiting.
 * A card found in discovery ends with who published it. Nothing here invents a rating, a thumbnail,
 * a count or a state: a zero, a missing rating and an unnamed price basis are simply not drawn.
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
  const urgent = item.urgency?.level === 'HITNO';
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const remote = item.detalji?.rezimLokacije === 'REMOTE';
  const offers = item.rezimCene === 'OFFERS';
  const amount = offers ? null : item.ponudjenaCena?.prikaz ?? null;
  // The number stays large and what it buys goes quietly underneath, so a per-person price never reads as the total.
  const basis = amount ? needPriceBasisNote(item) : null;
  const waiting = attention ? item.brojPrijavaZaIzbor ?? 0 : 0;
  const [condition, ...moreConditions] = item.uslovi;
  const publisher = 'narucilacIme' in item && item.narucilacIme ? item.narucilacIme : null;
  const rating = 'narucilacOcena' in item ? item.narucilacOcena : null;
  return <Press accessibilityRole="button" accessibilityLabel={`${own ? 'Otvori Zadatak' : 'Otvori priliku'} ${readableTitle(item.naslov)}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} haptic="select" scaleTo={0.986}
    style={[s.card, compact && s.compact, disabled && s.disabled]}>
    {status || urgent ? <View style={s.top}>
      {status ? <View style={s.statusRow}><View style={[s.dot, { backgroundColor: tone }]} /><T variant="label" style={[s.status, { color: tone }]}>{status}</T></View> : <View style={s.grow} />}
      <NeedUrgencyBadge urgency={item.urgency} />
    </View> : null}
    <T style={s.title}>{readableTitle(item.naslov)}</T>
    <View style={s.facts}>
      <View style={s.fact}><FactArt kind={remote ? 'remote' : 'pin'} size={18} /><T style={s.factText}>{remote ? 'Na daljinu' : item.podrucjeTekst}</T></View>
      <View style={s.fact}><FactArt kind="calendar" size={18} /><T style={s.factText}>{schedule}</T></View>
    </View>
    <View style={s.divider} />
    <View style={s.money}>
      <View style={s.priceSide}>
        <FactArt kind={offers ? 'offers' : 'money'} size={24} muted={!offers && !amount} />
        <View style={s.priceCopy}>
          {offers ? <T style={s.price}>Tražim ponude</T>
            : amount ? <T style={s.price}>{amount}</T>
            : <T style={s.noPrice}>Cena nije navedena</T>}
          {basis ? <T style={s.basis}>{basis}</T> : null}
        </View>
      </View>
      {draft ? <T variant="meta" style={s.next}>Nastavi uređivanje</T>
        : <View accessible accessibilityLabel={`${item.pokrivenost.popunjeno} od ${osoba(item.pokrivenost.ukupno)} dogovoreno`} style={s.places}>
          <View style={s.placesRow}><FactArt kind="users" size={22} muted={quiet} />
            <T style={[s.placesCount, attention && s.placesAttention]}>{item.pokrivenost.popunjeno}/{item.pokrivenost.ukupno}</T></View>
          <T style={s.placesNote}>popunjeno</T>
        </View>}
    </View>
    {condition || waiting > 0 ? <View style={s.chips}>
      {condition ? <View style={s.condition}><T style={s.conditionText} numberOfLines={1}>{condition}</T>
        {moreConditions.length ? <T style={s.conditionMore}>+{moreConditions.length}</T> : null}</View> : null}
      {waiting > 0 ? <View style={s.waiting}><T style={s.waitingText}>{prijave(waiting)} za pregled</T></View> : null}
    </View> : null}
    {publisher ? <View style={s.footer}>
      <View style={s.avatar}><T style={s.avatarText}>{publisher.trim().charAt(0).toLocaleUpperCase('sr-Latn-RS')}</T></View>
      <T style={s.publisher} numberOfLines={1}>{publisher}</T>
      {rating ? <View style={s.rating}><Star size={14} weight="fill" color="#ED9914" /><T style={s.ratingText}>{rating}</T></View> : null}
      <View style={s.grow} />
      <CaretRight size={16} color={sys.color.lineStrong} />
    </View> : null}
  </Press>;
}
export const TaskCard = memo(TaskCardBase);

const s = StyleSheet.create({
  // V28 card surface: 21 px corner, #D8DED7 edge and its two-layer green-tinted shadow.
  card: { backgroundColor: sys.color.surface, borderRadius: 21, borderWidth: 1, borderColor: sys.color.cardLine,
    paddingHorizontal: 15, paddingTop: 14, paddingBottom: 13,
    boxShadow: '0px 5px 18px rgba(23, 59, 39, 0.063), 0px 1px 2px rgba(23, 59, 39, 0.027)' },
  compact: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 11 },
  disabled: { opacity: 0.55 },
  grow: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  status: { flexShrink: 1, letterSpacing: 0.3 },
  title: { fontSize: 19.5, lineHeight: 24, fontWeight: '700', letterSpacing: -0.45, color: sys.color.ink },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  factText: { fontSize: 13.5, lineHeight: 18, fontWeight: '500', color: '#53665C', flexShrink: 1 },
  divider: { height: 1, backgroundColor: sys.color.line, marginTop: 11, marginBottom: 10 },
  money: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priceSide: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  priceCopy: { flexShrink: 1 },
  price: { fontSize: 20, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4, color: sys.color.money, fontVariant: ['tabular-nums'] },
  noPrice: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: sys.color.muted },
  basis: { fontSize: 12, lineHeight: 16, color: sys.color.muted, marginTop: 1 },
  places: { alignItems: 'flex-end' },
  placesRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placesCount: { fontSize: 17, lineHeight: 21, fontWeight: '700', color: sys.color.ink, fontVariant: ['tabular-nums'] },
  placesAttention: { color: '#985223' },
  placesNote: { fontSize: 12, lineHeight: 15, color: sys.color.muted, marginTop: 1 },
  next: { color: sys.color.green, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  condition: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 26, maxWidth: 220, borderRadius: sys.radius.badge, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: sys.color.iconWell },
  conditionText: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', color: '#596960', flexShrink: 1 },
  conditionMore: { fontSize: 12.5, lineHeight: 16, fontWeight: '700', color: '#596960' },
  waiting: { minHeight: 26, borderRadius: sys.radius.badge, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: sys.color.orangeSoft, justifyContent: 'center' },
  waitingText: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', color: '#874515' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: sys.color.line },
  avatar: { width: 26, height: 26, borderRadius: sys.radius.pill, backgroundColor: '#EEF3EF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, lineHeight: 15, fontWeight: '700', color: sys.color.ink },
  publisher: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: sys.color.ink, flexShrink: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12.5, lineHeight: 16, color: sys.color.muted },
});
