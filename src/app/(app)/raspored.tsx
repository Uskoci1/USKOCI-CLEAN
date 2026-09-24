import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, CaretRight } from 'phosphor-react-native';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { agreementClientService } from '../../data/agreementClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { ChromeIconButton } from '../../ui/system/ScreenChrome';
import { useTextScale } from '../../ui/system/textScale';
import { sys } from '../../ui/system/tokens';
import { Press } from '../../ui/Press';
import { CalendarAction as Button, CalendarText as T, calendarStyles as s } from '../../ui/calendar/CalendarControls';
import { deviceDate, displayDate, displayTime, localDayRange, overlapsInterval, shiftDate, weekDates, weekdays } from '../../ui/calendar/calendarPresentation';
import { raspon } from '../../lib/vreme';
import { BEZ_IZNOSA } from '../../lib/novac';
import { FactArt } from '../../ui/system/FactArt';

export default function Raspored() {
  // Rounded, so Android's "Large" (1.2999999523) is the 1.3 the layout steps below are written against.
  const fontScale = useTextScale();
  const [selected, setSelected] = useState(() => deviceDate(new Date()));
  const days = useMemo(() => weekDates(selected), [selected]);
  const from = localDayRange(days[0]).from, to = localDayRange(days[6]).to;
  const calendar = useFocusedResource(useCallback(() => workerCalendarClientService.readRange(from, to), [from, to]));
  const agreements = useFocusedResource(useCallback(() => agreementClientService.mojiDogovori(), []));
  const error = calendar.error ? 'Raspored nije učitan. Proveri vezu pa probaj ponovo.'
    : calendar.data && !calendar.data.ok ? calendar.data.poruka : null;
  const events = calendar.data?.ok ? calendar.data.podatak.events : [];
  const dayRange = localDayRange(selected);
  const visible = events.filter(event => overlapsInterval(event.startsAt, event.endsAt, dayRange.from, dayRange.to));
  const refresh = () => { void calendar.refresh(); void agreements.refresh(); };
  const today = deviceDate(new Date());
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Kalendar obaveza"
      onBack={() => router.canGoBack() ? router.back() : router.replace('/dogovori')} />
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={calendar.loading} onRefresh={refresh} tintColor={sys.color.green} />}>
      {/* Two rows of controls, then the day (owner rule, 2026-09-23): the week with its arrows and
          "Danas" in one row, the seven days in the next. What used to stand between them and the
          agenda — a third control row, the availability entry and a paragraph — now follows the agenda. */}
      <View style={{ gap: sys.space.md }}>
        {/* The week names itself; the subtitle that explained the screen under it is gone (owner rule, 2026-09-23). */}
        <View style={s.row}><View style={{ flex: 1, minWidth: sys.space.huge * 3, gap: sys.space.xs }}><T variant="bodyStrong">{displayDate(days[0])}–{displayDate(days[6])}</T></View>
          {days.includes(today) ? null : <Button label="Danas" kind="quiet" compact onPress={() => setSelected(today)} />}
          {/* The week's arrows are the chrome's one icon button (round-1 critique B2), the same circle as Back. */}
          <ChromeIconButton label="Prethodna nedelja" icon={ArrowLeft} onPress={() => setSelected(shiftDate(selected, -7))} />
          <ChromeIconButton label="Sledeća nedelja" icon={ArrowRight} onPress={() => setSelected(shiftDate(selected, 7))} />
        </View>
        {/* Seven equal columns that always fit (the seventh day was cut off on the phone, 2026-09-23): no sideways
            scroll, each day one seventh of the row. At a very large font the weekday shrinks to its letter; the
            spoken label still names it in full. The gap is 2 so each column is as wide as it can be. A column is
            (screen width − 40 padding − 6 gaps × 2) / 7 wide: 38.3 dp at 320, 44.0 dp at 360 (sys.touch.min; 42.3
            with the former gap of 4), 48.3 dp at 390 and 54.0 dp at 430. Every column is sys.touch.min tall or more. */}
        <View style={{ flexDirection: 'row', gap: sys.space.xs / 2 }}>{days.map((day, index) => {
          const range = localDayRange(day), hasEvents = events.some(event => overlapsInterval(event.startsAt, event.endsAt, range.from, range.to));
          const chosen = selected === day;
          return <Press key={day} accessibilityRole="button" accessibilityLabel={`${weekdays[index].name}, ${displayDate(day)}${day === today ? ', danas' : ''}${hasEvents ? ', ima Dogovor' : ''}`}
            accessibilityState={{ selected: chosen }} haptic="select" onPress={() => setSelected(day)} style={{ flex: 1, minWidth: 0, minHeight: sys.touch.min,
              paddingVertical: sys.space.sm, gap: sys.space.xs, alignItems: 'center', borderRadius: sys.radius.control,
              backgroundColor: chosen ? sys.color.green : sys.color.greenSoft, borderWidth: 1, borderColor: day === today && !chosen ? sys.color.green : 'transparent' }}>
            <T variant="meta" tone={chosen ? 'onDark' : 'muted'} numberOfLines={1}>{fontScale >= 1.5 ? weekdays[index].short.charAt(0) : weekdays[index].short}</T>
            <T variant="heading" tone={chosen ? 'onDark' : 'ink'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{Number(day.slice(-2))}</T>
            <View style={{ width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: hasEvents ? sys.color.orange : 'transparent' }} />
          </Press>;
        })}</View>
      </View>
      <View style={{ gap: sys.space.base }}><T variant="heading" accessibilityRole="header">Dogovoreno za {displayDate(selected)}</T>
        {calendar.loading ? <ActivityIndicator accessibilityLabel="Učitavanje rasporeda" color={sys.color.green} /> : null}
        {error ? <View style={s.note}><T accessibilityRole="alert" tone="danger">{error}</T><Button label="Pokušaj ponovo" onPress={refresh} /></View> : null}
        {!calendar.loading && !error && !visible.length ? <View style={[s.note, { gap: sys.space.md }]}><FactArt kind="calendar" size={40} />
          <T variant="heading">Nema potvrđenih tačnih termina</T>
          {/* This screen lists only the work the viewer does. Without the standing disclaimer, "no Dogovor this day" was
              untrue for someone whose own task has a confirmed Dogovor that day, so the empty day says its scope. */}
          <T tone="muted">Ovog dana ne radiš ni na jednom Dogovoru sa tačnim terminom. Dogovori za tvoje zadatke i fleksibilni termini su u Dogovorima.</T></View> : null}
        {!error && visible.map(event => {
          const detail = agreements.data?.find(item => item.id === event.agreementId && item.verzija === event.agreementVersion && item.stanje === 'CONFIRMED');
          const fromTime = displayTime(event.startsAt), toTime = displayTime(event.endsAt);
          // Minutes only, so the clock always fits the rail; a large font moves it into the card.
          const rail = fontScale <= 1.3;
          return <View key={event.eventId} style={{ flexDirection: rail ? 'row' : 'column', gap: sys.space.md, alignItems: 'stretch' }}>
            {rail ? <View style={{ width: sys.space.huge + sys.space.sm, gap: sys.space.xs, paddingTop: sys.space.md }}><T variant="meta" style={{ fontWeight: '700' }}>{fromTime}</T>
              <T variant="meta" tone="muted">{toTime}</T><View style={{ width: 1, flex: 1, backgroundColor: sys.color.line, marginTop: sys.space.sm, marginLeft: sys.space.xs }} /></View> : null}
            <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${detail?.naslov || 'sa potvrđenim terminom'}`}
              onPress={() => router.navigate({ pathname: '/dogovor/[id]', params: { id: event.agreementId } })}
              style={[s.item, { flex: 1, minWidth: 0 }]}>
              <View style={s.row}><T variant="heading" style={{ flex: 1 }}>{detail?.naslov || 'Potvrđen Dogovor'}</T><CaretRight size={20} color={sys.color.ink} /></View>
              <T variant="meta" tone="muted">{raspon(event.startsAt, event.endsAt)}</T>
              {/* Every row here is a confirmed term, so a "Potvrđena satnica" line under each one said nothing. A missing
                  amount is a word, never "0 RSD". */}
              {detail ? <><View style={s.divider} />{detail.cena.prikaz ? <T variant="bodyStrong">{detail.cena.prikaz}</T>
                : <T variant="meta" tone="muted">{BEZ_IZNOSA}</T>}
                <T variant="meta" tone="muted">{detail.putanjaTekst}</T></> : null}
            </Press>
          </View>;
        })}
      </View>
      {agreements.error ? <T variant="meta" tone="muted">Detalji Dogovora nisu učitani. Tačni termini iz radnog rasporeda ostaju dostupni.</T> : null}
      <Button label="Otvori sve Dogovore" kind="secondary" onPress={() => router.navigate('/dogovori')} full />
      {/* Set once in a while, read every time: the availability editor stands under the day, not before it. */}
      <Press accessibilityRole="button" accessibilityLabel="Uredi dostupnost za rad" haptic="select" onPress={() => router.navigate('/profil/dostupnost')} style={[s.note, s.row]}>
        <FactArt kind="clock" size={26} /><View style={{ flex: 1, gap: sys.space.xs }}><T variant="bodyStrong">Moja dostupnost za rad</T>
          <T variant="meta" tone="muted">Redovna nedelja i posebni datumi</T></View><CaretRight size={20} color={sys.color.ink} />
      </Press>
      {/* The engine still blocks a person only by the work they agreed to do (owner decision 6). The standing
          disclaimer that said so under the calendar is dropped with the other copy that explained the screen (plan
          step 0, 2026-09-23); the empty day above says the scope where it matters and points to Dogovori. */}
    </ScrollView>
  </SafeAreaView>;
}
