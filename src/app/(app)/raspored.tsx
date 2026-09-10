import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, CaretRight, Clock } from 'phosphor-react-native';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { agreementClientService } from '../../data/agreementClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useUloga } from '../../store/uloga';
import { palette, space } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Press } from '../../ui/Press';
import { T } from '../../ui/Text';
import { calendarStyles as s } from '../../ui/calendar/CalendarControls';
import { deviceDate, displayDate, displayTime, localDayRange, overlapsInterval, shiftDate, weekDates, weekdays } from '../../ui/calendar/calendarPresentation';

export default function Raspored() {
  const worker = useUloga() === 'uskocer';
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
      onPress={() => router.canGoBack() ? router.back() : router.replace('/dogovori')}><ArrowLeft size={22} color={palette.ink} /></Press>
      <View style={{ flex: 1 }}><T variant="meta" tone="muted">Dogovori i dostupnost</T><T variant="title">Raspored</T></View>
    </View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={calendar.loading} onRefresh={refresh} tintColor={palette.teal500} />}>
      <View style={s.row}><View style={{ flex: 1 }}><T variant="heading">{displayDate(days[0])}–{displayDate(days[6])}</T>
        <T variant="meta" tone="muted">Vaši Dogovori, u obe namere</T></View>
        <Press accessibilityRole="button" accessibilityLabel="Prethodna nedelja" style={s.icon} onPress={() => setSelected(shiftDate(selected, -7))}><ArrowLeft size={22} color={palette.ink} /></Press>
        <Press accessibilityRole="button" accessibilityLabel="Sledeća nedelja" style={s.icon} onPress={() => setSelected(shiftDate(selected, 7))}><ArrowRight size={22} color={palette.ink} /></Press>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>{days.map((day, index) => {
        const range = localDayRange(day), hasEvents = events.some(event => overlapsInterval(event.startsAt, event.endsAt, range.from, range.to));
        return <Press key={day} accessibilityRole="button" accessibilityLabel={`${weekdays[index].name}, ${displayDate(day)}${hasEvents ? ', ima Dogovor' : ''}`}
          accessibilityState={{ selected: selected === day }} onPress={() => setSelected(day)} style={[s.card, { minWidth: 48, paddingHorizontal: space.sm, alignItems: 'center', borderWidth: 0, backgroundColor: selected === day ? palette.teal500 : palette.surface }]}>
          <T variant="meta" tone={selected === day ? 'onDark' : 'muted'}>{weekdays[index].short}</T><T variant="heading" tone={selected === day ? 'onDark' : 'ink'}>{Number(day.slice(-2))}</T>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hasEvents ? palette.orange : 'transparent' }} />
        </Press>;
      })}</ScrollView>
      <Button label="Danas" kind="quiet" onPress={() => setSelected(deviceDate(new Date()))} />
      {worker ? <Press accessibilityRole="button" accessibilityLabel="Uredi dostupnost za rad" onPress={() => router.navigate('/profil/dostupnost')} style={[s.note, s.row]}>
        <Clock size={22} color={palette.teal500} /><View style={{ flex: 1 }}><T variant="bodyStrong">Moja dostupnost za rad</T><T variant="meta" tone="muted">Redovni termini i posebni datumi</T></View><T variant="action">Uredi</T>
      </Press> : null}
      <T variant="heading">Dogovoreno za {displayDate(selected)}</T>
      {calendar.loading ? <ActivityIndicator accessibilityLabel="Učitavanje rasporeda" color={palette.teal500} /> : null}
      {error ? <View style={s.note}><T accessibilityRole="alert" tone="danger">{error}</T><Button label="Pokušaj ponovo" onPress={refresh} /></View> : null}
      {!calendar.loading && !error && !visible.length ? <View style={s.card}><T variant="heading">Nema potvrđenih tačnih termina</T>
        <T tone="muted">Za ovaj dan nema Dogovora sa potvrđenim početkom i krajem.</T></View> : null}
      {!error && visible.map(event => {
        const detail = agreements.data?.find(item => item.id === event.agreementId && item.verzija === event.agreementVersion && item.stanje === 'CONFIRMED');
        return <Press key={event.eventId} accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${detail?.naslov || 'sa potvrđenim terminom'}`}
          onPress={() => router.navigate({ pathname: '/dogovor/[id]', params: { id: event.agreementId } })} style={s.card}>
          <View style={s.row}><T variant="heading" style={{ flex: 1 }}>{detail?.naslov || 'Potvrđen Dogovor'}</T><CaretRight size={20} color={palette.ink} /></View>
          <T variant="bodyStrong">{displayDate(deviceDate(new Date(event.startsAt)))} · {displayTime(event.startsAt)} → {displayDate(deviceDate(new Date(event.endsAt)))} · {displayTime(event.endsAt)}</T>
          <T variant="meta" tone="success">Potvrđena satnica</T>
          {detail ? <View style={s.row}><T variant="meta" tone="muted" style={{ flex: 1 }}>{detail.putanjaTekst}</T><T variant="bodyStrong">{detail.cena.prikaz}</T></View> : null}
        </Press>;
      })}
      <T variant="meta" tone="muted">Prikaz vremena: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Samo tačan prihvaćeni interval zauzima termin. Fleksibilni termini i datumi bez pune satnice prikazuju se u Dogovorima.</T>
      {agreements.error ? <T variant="meta" tone="muted">Detalji Dogovora nisu učitani. Tačni termini iz rasporeda ostaju dostupni.</T> : null}
      <Button label="Otvori sve Dogovore" kind="secondary" onPress={() => router.navigate('/dogovori')} full />
    </ScrollView>
  </SafeAreaView>;
}
