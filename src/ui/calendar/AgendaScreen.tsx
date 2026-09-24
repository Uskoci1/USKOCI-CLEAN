import { useMemo, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, CaretRight } from 'phosphor-react-native';
import type { WorkerCalendarEvent } from '../../contracts/workerCalendar';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { zonaTelefona } from '../../lib/vreme';
import { Press } from '../Press';
import { T } from '../Text';
import { DetailTopBar } from '../system/DetailTopBar';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { dogovora } from '../system/plural';
import { ChromeIconButton } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { AgendaRow } from './AgendaRow';
import { agendaCoverage, agendaItems, dayMark, itemsOnDay, withoutExactTerm, type AgendaAgreement } from './agenda';
import { civilDay, dayHeading, localDayRange, shiftDate, weekDates, weekLabel, weekdayOf } from './calendarPresentation';

export type AgendaSchedule = { state: 'loading' } | { state: 'error'; message: string | null }
  | { state: 'ready'; events: readonly WorkerCalendarEvent[] };
export type AgendaList = { state: 'loading' } | { state: 'error' } | { state: 'ready'; agreements: readonly AgendaAgreement[] };

const NO_EVENTS: readonly WorkerCalendarEvent[] = [];

/**
 * Kalendar obaveza: every Dogovor with an exact agreed time, day by day, on both sides (work I do and my own tasks,
 * finished ones included), and the way into Dostupnost. A view: it has no primary command.
 *
 * The week and its arrows in one row, the seven days under it, then the day: its heading, its Dogovori, and two quiet
 * rows at the foot (the Dogovori without an exact time, and my availability). An empty day is one quiet line, never a
 * box (critique B18). Presentation only: the route owns both reads and every command.
 */
export function AgendaScreen({ selected, today, schedule, list, refreshing, retrying = false, onSelect, onBack, onRefresh,
  onRetry, onRetryList, onOpen, onWithoutTerm, onAvailability, phoneZone = zonaTelefona(), now }: {
  selected: string; today: string; schedule: AgendaSchedule; list: AgendaList;
  /** A pull re-reads both while what is on screen stays. */ refreshing: boolean;
  /** The schedule is being read again after an error. */ retrying?: boolean;
  onSelect: (day: string) => void; onBack: () => void; onRefresh: () => void;
  /** Read both again after the schedule failed. */ onRetry: () => void;
  /** Read only the Dogovori again after that read failed. */ onRetryList: () => void;
  onOpen: (agreementId: string) => void; onWithoutTerm: () => void; onAvailability: () => void;
  phoneZone?: string; now?: Date;
}) {
  const scale = useTextScale();
  const days = useMemo(() => weekDates(selected), [selected]);
  const from = localDayRange(days[0]).from, to = localDayRange(days[6]).to;
  const events = schedule.state === 'ready' ? schedule.events : NO_EVENTS;
  const agreements = list.state === 'ready' ? list.agreements : null;
  // The whole week once, over both reads; the day and the dots are cut from it (the list pages up to 2,000 rows).
  const items = useMemo(() => agendaItems({ events, agreements, from, to }), [events, agreements, from, to]);
  const ready = schedule.state === 'ready';
  const coverage = agreements ? agendaCoverage(agreements, events) : 'full';
  const withoutTerm = agreements && coverage === 'full' ? withoutExactTerm(agreements, events) : 0;
  const zoneNote = phoneZone !== DOGOVORENA_ZONA;
  const day = ready ? itemsOnDay(items, selected) : [];
  // Only the schedule's work is shown: the Dogovori did not load (it can be retried), or they came without saying
  // whether they have an exact time (retrying would not change that).
  const partial = !ready ? null : list.state === 'error' ? 'retry' : agreements && coverage === 'unknown' ? 'scope' : null;
  const partialLine = (text: string) => <View style={s.partial}>
    <T variant="note" tone="muted" style={s.partialText}>{text}</T>
    {partial === 'retry' ? <V2Action label="Pokušaj ponovo" kind="quiet" compact onPress={onRetryList} /> : null}
  </View>;
  let content: ReactNode;
  if (schedule.state === 'loading') content = <StateView kind="loading" title="Učitavamo raspored…" skeleton={{ count: 2, rows: 2 }} />;
  else if (schedule.state === 'error') content = <StateView kind="error" art="calendar" title="Raspored nije učitan."
    body={schedule.message ?? 'Proveri vezu pa probaj ponovo.'} primary={{ label: 'Pokušaj ponovo', onPress: onRetry, disabled: retrying }} />;
  // Never say a day is empty before both reads have settled.
  else if (!day.length && list.state === 'loading') content = <StateView kind="loading" title="Učitavamo raspored…" skeleton={{ count: 1, rows: 2 }} />;
  else if (!day.length) content = partial ? partialLine('Nema termina u kojima uskačeš.')
    : <T variant="note" tone="muted">Nema zakazanih Dogovora.</T>;
  else content = <View style={s.list}>
    {partial ? partialLine('Učitani su samo termini u kojima uskačeš.') : null}
    {day.map(item => <AgendaRow key={item.key} item={item} day={selected} onOpen={onOpen} zoneNote={zoneNote} />)}
  </View>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Kalendar obaveza" onBack={onBack} />
    <ScrollView contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
      {/* The week names itself; "Danas" only when today is in another week; the two arrows stay together. */}
      <View style={s.weekRow}>
        <T variant="bodyStrong" accessibilityRole="header" numberOfLines={2} style={s.weekLabel}>{weekLabel(days, now)}</T>
        {days.includes(today) ? null : <V2Action label="Danas" kind="quiet" compact onPress={() => onSelect(today)} />}
        <View style={s.arrows}>
          <ChromeIconButton label="Prethodna nedelja" icon={ArrowLeft} onPress={() => onSelect(shiftDate(selected, -7))} />
          <ChromeIconButton label="Sledeća nedelja" icon={ArrowRight} onPress={() => onSelect(shiftDate(selected, 7))} />
        </View>
      </View>
      {/* Seven equal columns that always fit (the seventh day was cut off by a sideways scroll on the phone): about 38 dp
          wide at 320 and 56 tall, an accepted exception to the 48 rule with the full name spoken. At a very large text
          the weekday shrinks to its letter. Unselected days are not filled (B18); today wears a green ring. */}
      <View style={s.strip}>{days.map(date => {
        const mark = ready ? dayMark(items, date) : null;
        const chosen = selected === date, isToday = date === today;
        const weekday = weekdayOf(date);
        return <Press key={date} accessibilityRole="button" haptic="select"
          accessibilityLabel={`${weekday.name}, ${civilDay(date, now)}${isToday ? ', danas' : ''}${mark ? ', ima Dogovor' : ''}`}
          accessibilityState={{ selected: chosen }} onPress={() => onSelect(date)} style={{ flex: 1, minWidth: 0, minHeight: 56,
            paddingVertical: sys.space.sm, gap: sys.space.xs, alignItems: 'center', borderRadius: sys.radius.control, borderWidth: 1,
            backgroundColor: chosen ? sys.color.green : 'transparent', borderColor: isToday && !chosen ? sys.color.green : 'transparent' }}>
          <T variant="meta" tone={chosen ? 'onDark' : 'muted'} numberOfLines={1}>{scale >= 1.5 ? weekday.short.charAt(0) : weekday.short}</T>
          <T variant="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
            style={{ color: chosen ? sys.color.onDark : isToday ? sys.color.green : sys.color.ink }}>{Number(date.slice(-2))}</T>
          <View testID="day-dot" style={{ width: 6, height: 6, borderRadius: sys.radius.pill,
            backgroundColor: !mark ? 'transparent' : chosen ? sys.color.onDark : mark === 'active' ? sys.color.green : sys.color.lineStrong }} />
        </Press>;
      })}</View>
      <View style={s.heading}>
        <T variant="heading" accessibilityRole="header">{dayHeading(selected, now)}</T>
        {zoneNote ? <T variant="note" tone="muted">Po vremenu u Srbiji</T> : null}
      </View>
      <View style={s.day}>{content}</View>
      {/* Set once in a while, read every time: the quiet rows stand under the day, not before it. */}
      <View style={s.foot}>
        {list.state === 'ready' && withoutTerm > 0 ? <LinkRow art="agreements" label="Bez tačnog termina" detail={dogovora(withoutTerm)}
          onPress={onWithoutTerm} /> : null}
        <LinkRow art="clock" label="Moja dostupnost za rad" spoken="Uredi dostupnost za rad" onPress={onAvailability} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

/** A quiet row that leads elsewhere: a hairline above, the picture, the words, and the arrow. */
function LinkRow({ art, label, detail, spoken, onPress }: { art: FactArtKind; label: string; detail?: string; spoken?: string; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={spoken ?? label} accessibilityValue={detail ? { text: detail } : undefined}
    haptic="select" scaleTo={0.99} onPress={onPress} style={s.link}>
    <FactArt kind={art} size={26} />
    <View style={s.linkCopy}>
      <T variant="bodyStrong">{label}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
    <CaretRight size={18} color={sys.color.muted} />
  </Press>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.xxl },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  weekLabel: { flex: 1, minWidth: 0 },
  arrows: { flexDirection: 'row', gap: sys.space.xs },
  strip: { flexDirection: 'row', gap: 2, marginTop: sys.space.md },
  heading: { marginTop: sys.space.xl, gap: 2 },
  day: { marginTop: sys.space.sm },
  list: { gap: sys.space.md },
  partial: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  partialText: { flexShrink: 1 },
  foot: { marginTop: sys.space.xxl },
  link: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.md,
    borderTopWidth: 1, borderTopColor: sys.color.line },
  linkCopy: { flex: 1, minWidth: 0, gap: 2 },
});
