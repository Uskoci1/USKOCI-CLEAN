import { StyleSheet, View } from 'react-native';
import { Clock, MapPin, Users } from 'phosphor-react-native';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { hasNeedAttention, isOwnedNeed } from '../../data/marketplaceView';
import { needPeopleText, needScheduleText } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { v2 } from './tokens';
const STATUS = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljen', CEKA_PRIJAVE: 'Čeka prijave', DELIMICNO_POPUNJENA: 'Delimično popunjen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' };
/** Shared V2 cCard anatomy; each caller supplies its existing authorized projection. */
export function TaskCard({ item, onOpen, compact = false, disabled = false }: { item: MarketplaceItem; onOpen: () => void; compact?: boolean; disabled?: boolean }) {
  const own = isOwnedNeed(item), attention = own && hasNeedAttention(item);
  const status = own ? attention ? `${item.brojPrijava} prijava · pogledaj` : STATUS[item.stanje] : item.statusTekst;
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  return <Press accessibilityRole="button" accessibilityLabel={`${own ? 'Otvorite Zadatak' : 'Otvorite priliku'} ${item.naslov}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} haptic="select" scaleTo={0.986} style={[s.card, compact && s.compact]}>
    <T style={s.status}>{status}</T><T style={s.title}>{item.naslov}</T>
    <View style={s.meta}>{item.detalji?.rezimLokacije !== 'REMOTE' ? <MapPin size={15} color={v2.color.teal} /> : null}<T style={s.metaText}>{item.detalji?.rezimLokacije === 'REMOTE' ? 'Na daljinu' : item.podrucjeTekst}</T></View>
    <View style={s.meta}><Clock size={15} color={v2.color.teal} /><T style={s.metaText}>{schedule}</T></View>
    <View style={s.bottom}><T style={s.price}>{item.rezimCene === 'OFFERS' ? 'Tražim ponude' : item.ponudjenaCena?.prikaz ?? 'Cena nije navedena'}</T>
      <View accessible accessibilityLabel={`${item.pokrivenost.popunjeno} od ${needPeopleText(item.pokrivenost.ukupno)} dogovoreno`} style={s.coverage}>
        <Users size={17} color={v2.color.ink} /><T style={s.small}>{item.pokrivenost.popunjeno} / {item.pokrivenost.ukupno}</T>
      </View>
    </View>
    {!compact && item.uslovi.length ? <View style={s.tags}>{item.uslovi.slice(0, 2).map((value, index) => <View key={index} style={s.tag}>
      <T numberOfLines={2} style={s.small}>{value}</T></View>)}{item.uslovi.length > 2 ? <T style={s.small}>+{item.uslovi.length - 2} uslova</T> : null}</View> : null}
  </Press>;
}
const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#E6ECE8', borderRadius: 18, backgroundColor: v2.color.surface, padding: 18, gap: 9 },
  compact: { backgroundColor: v2.color.context, padding: 16 }, status: { ...v2.text.label, color: v2.color.teal, fontWeight: '700' },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '700', letterSpacing: -0.45, color: v2.color.ink, marginTop: 3, marginBottom: 3 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, metaText: { ...v2.text.label, color: v2.color.muted, flex: 1 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 9 },
  price: { fontSize: 23, lineHeight: 29, color: v2.color.ink, fontWeight: '700', letterSpacing: -0.45, flex: 1 },
  coverage: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, backgroundColor: v2.color.soft, padding: 7 },
  small: { ...v2.text.label, color: v2.color.muted }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 },
  tag: { backgroundColor: '#F2F5F2', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, maxWidth: '100%' },
});
