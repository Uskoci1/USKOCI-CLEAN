import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, CaretRight, Clock } from 'phosphor-react-native';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { agreementClientService } from '../../data/agreementClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { sys } from '../../ui/system/tokens';
import { Press } from '../../ui/Press';
import { CalendarAction as Button, CalendarText as T, calendarStyles as s } from '../../ui/calendar/CalendarControls';
import { deviceDate, displayDate, displayTime, localDayRange, overlapsInterval, shiftDate, weekDates, weekdays } from '../../ui/calendar/calendarPresentation';
import { raspon } from '../../lib/vreme';

export default function Raspored() {
  const { fontScale } = useWindowDimensions();
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
        <View style={s.row}><View style={{ flex: 1, minWidth: sys.space.huge * 3, gap: sys.space.xs }}><T variant="bodyStrong">{displayDate(days[0])}–{displayDate(days[6])}</T>
          <T variant="meta" tone="muted">Potvrđeni termini poslova u koje si uskočio</T></View>
          {days.includes(today) ? null : <Button label="Danas" kind="quiet" compact onPress={() => setSelected(today)} />}
          <Press accessibilityRole="button" accessibilityLabel="Prethodna nedelja" haptic="select" style={[s.icon, { borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.pill }]}
            onPress={() => setSelected(shiftDate(selected, -7))}><ArrowLeft size={20} color={sys.color.ink} /></Press>
          <Press accessibilityRole="button" accessibilityLabel="Sledeća nedelja" haptic="select" style={[s.icon, { borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.pill }]}
            onPress={() => setSelected(shiftDate(selected, 7))}><ArrowRight size={20} color={sys.color.ink} /></Press>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: sys.space.xs, flexGrow: 1 }}>{days.map((day, index) => {
          const range = localDayRange(day), hasEvents = events.some(event => overlapsInterval(event.startsAt, event.endsAt, range.from, range.to));
          const chosen = selected === day;
          return <Press key={day} accessibilityRole="button" accessibilityLabel={`${weekdays[index].name}, ${displayDate(day)}${day === today ? ', danas' : ''}${hasEvents ? ', ima Dogovor' : ''}`}
            accessibilityState={{ selected: chosen }} haptic="select" onPress={() => setSelected(day)} style={{ flexGrow: 1, minWidth: sys.touch.min,
              paddingHorizontal: sys.space.sm, paddingVertical: sys.space.sm, gap: sys.space.xs, alignItems: 'center', borderRadius: sys.radius.control,
              backgroundColor: chosen ? sys.color.green : sys.color.greenSoft, borderWidth: 1, borderColor: day === today && !chosen ? sys.color.green : 'transparent' }}>
            <T variant="meta" tone={chosen ? 'onDark' : 'muted'}>{weekdays[index].short}</T>
            <T variant="heading" tone={chosen ? 'onDark' : 'ink'}>{Number(day.slice(-2))}</T>
            <View style={{ width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: hasEvents ? sys.color.orange : 'transparent' }} />
          </Press>;
        })}</ScrollView>
      </View>
      <View style={{ gap: sys.space.base }}><T variant="heading" accessibilityRole="header">Dogovoreno za {displayDate(selected)}</T>
        {calendar.loading ? <ActivityIndicator accessibilityLabel="Učitavanje rasporeda" color={sys.color.green} /> : null}
        {error ? <View style={s.note}><T accessibilityRole="alert" tone="danger">{error}</T><Button label="Pokušaj ponovo" onPress={refresh} /></View> : null}
        {!calendar.loading && !error && !visible.length ? <View style={[s.note, { gap: sys.space.md }]}><Clock size={28} color={sys.color.green} />
          <T variant="heading">Nema potvrđenih tačnih termina</T><T tone="muted">Za ovaj dan nema Dogovora sa potvrđenim početkom i krajem. Fleksibilni termini stoje u Dogovorima.</T></View> : null}
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
              style={[s.card, { flex: 1, minWidth: 0, backgroundColor: sys.color.greenSoft }]}>
              <View style={s.row}><T variant="heading" style={{ flex: 1 }}>{detail?.naslov || 'Potvrđen Dogovor'}</T><CaretRight size={20} color={sys.color.ink} /></View>
              <T variant="meta" tone="muted">{raspon(event.startsAt, event.endsAt)}</T>
              <T variant="meta" tone="success">Potvrđena satnica</T>
              {detail ? <><View style={s.divider} /><T variant="bodyStrong">{detail.cena.prikaz}</T>
                <T variant="meta" tone="muted">{detail.putanjaTekst}</T></> : null}
            </Press>
          </View>;
        })}
      </View>
      {agreements.error ? <T variant="meta" tone="muted">Detalji Dogovora nisu učitani. Tačni termini iz radnog rasporeda ostaju dostupni.</T> : null}
      <Button label="Otvori sve Dogovore" kind="secondary" onPress={() => router.navigate('/dogovori')} full />
      {/* Set once in a while, read every time: the availability editor and the note about what this
          calendar holds stand under the day, not before it. */}
      <Press accessibilityRole="button" accessibilityLabel="Uredi dostupnost za rad" haptic="select" onPress={() => router.navigate('/profil/dostupnost')} style={[s.note, s.row]}>
        <Clock size={22} color={sys.color.green} /><View style={{ flex: 1, gap: sys.space.xs }}><T variant="bodyStrong">Moja dostupnost za rad</T>
          <T variant="meta" tone="muted">Redovna nedelja i posebni datumi</T></View><CaretRight size={20} color={sys.color.ink} />
      </Press>
      {/* The engine blocks a person only by the work they agreed to do (owner decision 6). What they
          asked others to do is theirs to see in Dogovori, and is said here rather than hidden. */}
      <T variant="meta" tone="muted">Ovde su termini u kojima ti radiš. Dogovore za svoje zadatke vidiš u Dogovorima; oni te ovde ne blokiraju.</T>
    </ScrollView>
  </SafeAreaView>;
}
