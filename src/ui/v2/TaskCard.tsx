import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Clock, MapPin, Users } from 'phosphor-react-native';
import type { MarketplaceItem } from '../../data/marketplaceView';
import { hasNeedAttention, isOwnedNeed } from '../../data/marketplaceView';
import { needPeopleText, needScheduleText } from '../../data/needDetailPresentation';
import { Press } from '../Press';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

const STATUS = { NACRT: 'Privatan nacrt', OBJAVLJENA: 'Objavljen', CEKA_PRIJAVE: 'Čeka prijave', DELIMICNO_POPUNJENA: 'Delimično popunjen', POPUNJENA: 'Popunjen', ZATVORENA: 'Zatvoren' };

/**
 * Compact Need/Opportunity card: what · where · when · price · people, in that
 * reading order (DESIGN.md "Marketplace cards"). Each caller supplies its own
 * authorized projection; nothing here invents a rating, a thumbnail or a state.
 * Owner drafts show a quiet draft status and "Nastavi uređivanje", never a zero
 * application count.
 */
function TaskCardBase({ item, onOpen, compact = false, disabled = false }: { item: MarketplaceItem; onOpen: () => void; compact?: boolean; disabled?: boolean }) {
  const own = isOwnedNeed(item), attention = own && hasNeedAttention(item), draft = own && item.stanje === 'NACRT';
  const status = own ? attention ? `${item.brojPrijava} prijava · pogledaj` : STATUS[item.stanje] : item.statusTekst;
  const schedule = item.schedule ? needScheduleText(item.schedule, item.taskTimezone) : item.vremeTekst;
  const remote = item.detalji?.rezimLokacije === 'REMOTE';
  const price = item.rezimCene === 'OFFERS' ? 'Tražim ponude' : item.ponudjenaCena?.prikaz ?? 'Cena nije navedena';
  return <Press accessibilityRole="button" accessibilityLabel={`${own ? 'Otvorite Zadatak' : 'Otvorite priliku'} ${item.naslov}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} haptic="select" scaleTo={0.986}
    style={[s.card, compact && s.compact, attention && s.attentionCard]}>
    <View style={s.top}>
      <View style={s.statusRow}>
        <View style={[s.dot, attention && s.dotAttention, draft && s.dotDraft]} />
        <T variant="meta" style={[s.status, attention && s.statusAttention, draft && s.statusDraft]}>{status}</T>
      </View>
      <NeedUrgencyBadge urgency={item.urgency} />
    </View>
    <T style={s.title}>{item.naslov}</T>
    <View style={s.facts}>
      <View style={s.fact}>
        <MapPin size={16} color={sys.color.green} />
        <T variant="meta" tone="muted" style={s.factText}>{remote ? 'Na daljinu' : item.podrucjeTekst}</T>
      </View>
      <View style={s.fact}>
        <Clock size={16} color={sys.color.green} />
        <T variant="meta" tone="muted" style={s.factText}>{schedule}</T>
      </View>
    </View>
    <View style={s.bottom}>
      <T style={[s.price, item.rezimCene === 'OFFERS' && s.offers]}>{price}</T>
      {draft ? <View style={s.pill}><T variant="meta" style={s.pillText}>Nastavi uređivanje</T></View>
        : <View accessible accessibilityLabel={`${item.pokrivenost.popunjeno} od ${needPeopleText(item.pokrivenost.ukupno)} dogovoreno`} style={s.pill}>
          <Users size={16} color={sys.color.ink} />
          <T variant="meta" style={[s.pillText, s.tabular]}>{item.pokrivenost.popunjeno} / {item.pokrivenost.ukupno}</T>
        </View>}
    </View>
    {!compact && item.uslovi.length ? <View style={s.tags}>
      {item.uslovi.slice(0, 2).map((value, index) => <View key={index} style={s.tag}><T numberOfLines={2} variant="meta" tone="muted">{value}</T></View>)}
      {item.uslovi.length > 2 ? <T variant="meta" tone="muted" style={s.more}>+{item.uslovi.length - 2} uslova</T> : null}
    </View> : null}
  </Press>;
}
export const TaskCard = memo(TaskCardBase);

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.card, backgroundColor: sys.color.surface, padding: 18, gap: 8 },
  compact: { padding: 16, borderColor: sys.color.lineStrong },
  attentionCard: { borderColor: sys.color.orange },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: sys.color.green },
  dotAttention: { backgroundColor: sys.color.orange }, dotDraft: { backgroundColor: sys.color.lineStrong },
  status: { color: sys.color.green, fontWeight: '600', flexShrink: 1 },
  statusAttention: { color: sys.color.warn }, statusDraft: { color: sys.color.muted },
  title: { ...sys.type.cardTitle, color: sys.color.ink, marginTop: 2 },
  facts: { gap: 5, marginTop: 2 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  factText: { flex: 1 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  price: { ...sys.type.price, color: sys.color.money, flex: 1, minWidth: 120 },
  offers: { color: sys.color.ink, fontSize: 18, lineHeight: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, backgroundColor: sys.color.greenSoft, paddingHorizontal: 10, paddingVertical: 7 },
  pillText: { color: sys.color.ink, fontWeight: '700' }, tabular: { fontVariant: ['tabular-nums'] },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingTop: 4 },
  tag: { backgroundColor: sys.color.ground, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '100%' },
  more: { paddingHorizontal: 2 },
});
