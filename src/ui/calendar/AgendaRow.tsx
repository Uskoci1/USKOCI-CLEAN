import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BEZ_IZNOSA } from '../../lib/novac';
import { Press } from '../Press';
import { T } from '../Text';
import { useTextScale } from '../system/textScale';
import { cardCompact, sys } from '../system/tokens';
import { STATUS_WORDS, agendaClock, agendaWindow, withinDay, type AgendaItem } from './agenda';

/** The rail's width: the clock column beside a row, at a normal text size. */
const RAIL = 56;

/**
 * One Dogovor on a day of the calendar. Beside it, at a normal text size, the rail with its start and end clocks in
 * Serbian time; at a large text size the rail goes and the time is the card's first line. The card is the one press
 * that opens the Dogovor: no caret and no inner line (critique B13/B16). What it says, in fixed lines: the title with
 * the agreed amount beside it (or under it on a narrow screen), then status · role · the other person, then the place.
 * A missing amount is a word, never "0 RSD"; an amount that is not known here is not drawn at all. A finished Dogovor
 * is drawn quiet; one waiting for the completion to be confirmed says so with an orange dot.
 */
export function AgendaRow({ item, day, onOpen, zoneNote = false }: {
  item: AgendaItem; day: string; onOpen: (agreementId: string) => void;
  /** The phone is not in Serbian time: the spoken time says whose clock it is, as the heading does for the eye. */
  zoneNote?: boolean;
}) {
  const scale = useTextScale();
  const { width } = useWindowDimensions();
  const rail = scale <= 1.3;
  const beside = width >= 360 && scale < 1.3;
  const done = item.state === 'COMPLETED', waiting = item.state === 'AWAITING_REQUESTER';
  const tone = done ? 'muted' : 'ink';
  const status = STATUS_WORDS[item.state];
  const time = agendaWindow(item, day);
  // The rail's two clocks say the whole window only when it lies on this day; otherwise the card names its days too.
  const timeLine = !rail || !withinDay(item, day);
  const others = [item.role, item.person].filter((part): part is string => !!part).join(' · ');
  const value = item.amount === null ? null : item.amount
    ? <T variant="priceRow" style={{ color: done ? sys.color.muted : sys.color.money }}>{item.amount}</T>
    : <T variant="note" tone="muted">{BEZ_IZNOSA}</T>;
  const spoken = [status, item.role, zoneNote ? `${time}, po vremenu u Srbiji` : time, item.person,
    item.amount === null ? null : item.amount || BEZ_IZNOSA, item.place || null]
    .filter((part): part is string => !!part).join(', ');
  return <View style={{ flexDirection: rail ? 'row' : 'column', gap: sys.space.md, alignItems: 'stretch' }}>
    {rail ? <View style={s.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <T variant="meta" tone={tone} style={s.start}>{agendaClock(item.startsAt)}</T>
      <T variant="meta" tone="muted">{agendaClock(item.endsAt)}</T>
      <View style={s.railLine} />
    </View> : null}
    <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${item.title || 'sa potvrđenim terminom'}`}
      accessibilityValue={{ text: spoken }} haptic="select" onPress={() => onOpen(item.agreementId)} style={s.card}>
      {timeLine ? <T variant="bodyStrong" tone={tone}>{time}</T> : null}
      <View style={beside ? s.titleRow : s.titleColumn}>
        <T variant="cardTitleCompact" numberOfLines={scale >= 1.3 ? 3 : 2}
          style={[{ color: done ? sys.color.muted : sys.color.ink }, beside && s.title]}>{item.title ?? item.fallbackTitle}</T>
        {value}
      </View>
      {status || others ? <View style={s.facts}>
        {status ? <View style={[s.dot, { backgroundColor: waiting ? sys.color.orange : sys.color.lineStrong }]} /> : null}
        <T variant="note" style={[s.factText, { color: done ? sys.color.muted : sys.color.fact }]}>
          {status ? <T variant="note" style={{ color: waiting ? sys.color.warn : sys.color.muted }}>{status}</T> : null}
          {status && others ? ' · ' : null}{others || null}
        </T>
      </View> : null}
      {item.place ? <T variant="note" style={{ color: done ? sys.color.muted : sys.color.fact }}>{item.place}</T> : null}
    </Press>
  </View>;
}

const s = StyleSheet.create({
  rail: { width: RAIL, gap: sys.space.xs, paddingTop: sys.space.base },
  start: { fontWeight: '700' },
  railLine: { width: 1, flex: 1, backgroundColor: sys.color.line, marginTop: sys.space.sm, marginLeft: sys.space.xs },
  card: { ...cardCompact, flex: 1, minWidth: 0, gap: sys.space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  titleColumn: { gap: sys.space.xs },
  title: { flex: 1, minWidth: 0 },
  facts: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  factText: { flexShrink: 1 },
});
