import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, CaretRight, Clock } from 'phosphor-react-native';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { agreementClientService } from '../../data/agreementClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useUloga } from '../../store/uloga';
import { v2 } from '../../ui/v2/tokens';
import { Press } from '../../ui/Press';
import { CalendarAction as Button, CalendarText as T, calendarStyles as s } from '../../ui/calendar/CalendarControls';
import { deviceDate, displayDate, displayTime, localDayRange, overlapsInterval, shiftDate, weekDates, weekdays } from '../../ui/calendar/calendarPresentation';

export default function Raspored() {
  const worker = useUloga() === 'uskocer';
  const { fontScale } = useWindowDimensions();
  const [selected, setSelected] = useState(() => deviceDate(new Date()));
  const days = useMemo(() => weekDates(selected), [selected]);
  const from = localDayRange(days[0]).from, to = localDayRange(days[6]).to;
  const calendar = useFocusedResource(useCallback(() => workerCalendarClientService.readRange(from, to), [from, to]));
  const agreements = useFocusedResource(useCallback(() => agreementClientService.mojiDogovori(), []));
  const error = calendar.error ? 'Raspored nije učitan. Proverite vezu i pokušajte ponovo.'
    : calendar.data && !calendar.data.ok ? calendar.data.poruka : null;
  const events = calendar.data?.ok ? calendar.data.podatak.events : [];
  const dayRange = localDayRange(selected);
  const visible = events.filter(event => overlapsInterval(event.startsAt, event.endsAt, dayRange.from, dayRange.to));
  const refresh = () => { void calendar.refresh(); void agreements.refresh(); };
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <View style={s.header}><Press accessibilityRole="button" accessibilityLabel="Nazad" style={s.icon}
      onPress={() => router.canGoBack() ? router.back() : router.replace('/dogovori')}><ArrowLeft size={22} color={v2.color.ink} /></Press>
      <View style={{ flex: 1, gap: 3 }}><T variant="meta" tone="muted">Dogovori i dostupnost</T><T variant="heading" accessibilityRole="header">Raspored</T></View>
    </View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={calendar.loading} onRefresh={refresh} tintColor={v2.color.teal} />}>
      <View style={{ gap: 14 }}>
        <View style={s.row}><View style={{ flex: 1, minWidth: 160, gap: 4 }}><T variant="bodyStrong">{displayDate(days[0])}–{displayDate(days[6])}</T>
          <T variant="meta" tone="muted">Tvoji Dogovori, u obe namere</T></View>
          <Press accessibilityRole="button" accessibilityLabel="Prethodna nedelja" style={[s.icon, { borderWidth: 1, borderColor: v2.color.line, borderRadius: 22 }]}
            onPress={() => setSelected(shiftDate(selected, -7))}><ArrowLeft size={20} color={v2.color.ink} /></Press>
          <Press accessibilityRole="button" accessibilityLabel="Sledeća nedelja" style={[s.icon, { borderWidth: 1, borderColor: v2.color.line, borderRadius: 22 }]}
            onPress={() => setSelected(shiftDate(selected, 7))}><ArrowRight size={20} color={v2.color.ink} /></Press>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, flexGrow: 1 }}>{days.map((day, index) => {
          const range = localDayRange(day), hasEvents = events.some(event => overlapsInterval(event.startsAt, event.endsAt, range.from, range.to));
          return <Press key={day} accessibilityRole="button" accessibilityLabel={`${weekdays[index].name}, ${displayDate(day)}${hasEvents ? ', ima Dogovor' : ''}`}
            accessibilityState={{ selected: selected === day }} onPress={() => setSelected(day)} style={{ flexGrow: 1, minWidth: 44, minHeight: 71,
              paddingHorizontal: 8, paddingVertical: 10, gap: 5, alignItems: 'center', borderRadius: 16, backgroundColor: selected === day ? v2.color.teal : v2.color.context }}>
            <T variant="meta" tone={selected === day ? 'onDark' : 'muted'}>{weekdays[index].short}</T>
            <T variant="heading" tone={selected === day ? 'onDark' : 'ink'}>{Number(day.slice(-2))}</T>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasEvents ? v2.color.orange : 'transparent' }} />
          </Press>;
        })}</ScrollView>
        <Button label="Danas" kind="quiet" onPress={() => setSelected(deviceDate(new Date()))} style={{ alignSelf: 'flex-start' }} />
      </View>
      {worker ? <Press accessibilityRole="button" accessibilityLabel="Uredi dostupnost za rad" onPress={() => router.navigate('/profil/dostupnost')} style={[s.note, s.row]}>
        <Clock size={22} color={v2.color.teal} /><View style={{ flex: 1, gap: 4 }}><T variant="bodyStrong">Moja dostupnost za rad</T>
          <T variant="meta" tone="muted">Redovna nedelja i posebni datumi</T></View><CaretRight size={20} color={v2.color.ink} />
      </Press> : null}
      <View style={{ gap: 16 }}><View style={{ gap: 4 }}><T variant="heading" accessibilityRole="header">Dogovoreno za {displayDate(selected)}</T>
        <T variant="meta" tone="muted">Prikaz vremena: {Intl.DateTimeFormat().resolvedOptions().timeZone}</T></View>
        {calendar.loading ? <ActivityIndicator accessibilityLabel="Učitavanje rasporeda" color={v2.color.teal} /> : null}
        {error ? <View style={s.note}><T accessibilityRole="alert" tone="danger">{error}</T><Button label="Pokušaj ponovo" onPress={refresh} /></View> : null}
        {!calendar.loading && !error && !visible.length ? <View style={[s.note, { gap: 12 }]}><Clock size={28} color={v2.color.teal} />
          <T variant="heading">Nema potvrđenih tačnih termina</T><T tone="muted">Za ovaj dan nema Dogovora sa potvrđenim početkom i krajem.</T></View> : null}
        {!error && visible.map(event => {
          const detail = agreements.data?.find(item => item.id === event.agreementId && item.verzija === event.agreementVersion && item.stanje === 'CONFIRMED');
          const fromTime = displayTime(event.startsAt), toTime = displayTime(event.endsAt);
          const rail = fontScale <= 1.3 && fromTime.length <= 8 && toTime.length <= 8;
          return <View key={event.eventId} style={{ flexDirection: rail ? 'row' : 'column', gap: 12, alignItems: 'stretch' }}>
            {rail ? <View style={{ width: 54, gap: 4, paddingTop: 12 }}><T variant="meta" style={{ fontWeight: '700' }}>{fromTime}</T>
              <T variant="meta" tone="muted">{toTime}</T><View style={{ width: 1, flex: 1, backgroundColor: v2.color.line, marginTop: 8, marginLeft: 4 }} /></View> : null}
            <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${detail?.naslov || 'sa potvrđenim terminom'}`}
              onPress={() => router.navigate({ pathname: '/dogovor/[id]', params: { id: event.agreementId } })}
              style={[s.card, { flex: 1, minWidth: 0, backgroundColor: v2.color.context }]}>
              <View style={s.row}><T variant="heading" style={{ flex: 1 }}>{detail?.naslov || 'Potvrđen Dogovor'}</T><CaretRight size={20} color={v2.color.ink} /></View>
              <T variant="meta" tone="muted">{displayDate(deviceDate(new Date(event.startsAt)))} · {fromTime} → {displayDate(deviceDate(new Date(event.endsAt)))} · {toTime}</T>
              <T variant="meta" tone="success">Potvrđena satnica</T>
              {detail ? <><View style={s.divider} /><T variant="bodyStrong">{detail.cena.prikaz}</T>
                <T variant="meta" tone="muted">{detail.putanjaTekst}</T></> : null}
            </Press>
          </View>;
        })}
      </View>
      <T variant="meta" tone="muted">Samo tačan prihvaćeni interval zauzima termin. Fleksibilni termini i datumi bez pune satnice prikazuju se u Dogovorima.</T>
      {agreements.error ? <T variant="meta" tone="muted">Detalji Dogovora nisu učitani. Tačni termini iz rasporeda ostaju dostupni.</T> : null}
      <Button label="Otvori sve Dogovore" kind="secondary" onPress={() => router.navigate('/dogovori')} full />
    </ScrollView>
  </SafeAreaView>;
}
