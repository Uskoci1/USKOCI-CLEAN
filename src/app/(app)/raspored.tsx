import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { agreementClientService } from '../../data/agreementClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { AgendaScreen, type AgendaList, type AgendaSchedule } from '../../ui/calendar/AgendaScreen';
import { deviceDate, localDayRange, weekDates } from '../../ui/calendar/calendarPresentation';

/**
 * Kalendar obaveza. Two reads: the worker schedule for the week (the one authority for the work I confirmed, one read
 * per week, over the phone's days) and my Dogovori (my own tasks, and finished or waiting Dogovori with an exact
 * window). The screen draws them together; nothing here decides what a Dogovor is.
 */
export default function Raspored() {
  const [selected, setSelected] = useState(() => deviceDate(new Date()));
  const days = useMemo(() => weekDates(selected), [selected]);
  const from = localDayRange(days[0]).from, to = localDayRange(days[6]).to;
  const calendar = useFocusedResource(useCallback(() => workerCalendarClientService.readRange(from, to), [from, to]));
  const agreements = useFocusedResource(useCallback(() => agreementClientService.mojiDogovori(), []));
  const schedule: AgendaSchedule = calendar.error ? { state: 'error', message: null }
    : calendar.data ? calendar.data.ok ? { state: 'ready', events: calendar.data.podatak.events } : { state: 'error', message: calendar.data.poruka }
      : { state: 'loading' };
  const list: AgendaList = agreements.error ? { state: 'error' } : agreements.data ? { state: 'ready', agreements: agreements.data }
    : { state: 'loading' };
  // A pull keeps what is on screen under the spinner; a retry after an error reads the schedule from the start.
  const refresh = () => { void calendar.refresh('keep'); void agreements.refresh('keep'); };
  const retry = () => { void calendar.refresh(); void agreements.refresh('keep'); };
  return <AgendaScreen selected={selected} today={deviceDate(new Date())} schedule={schedule} list={list}
    refreshing={!!calendar.refreshing || !!agreements.refreshing} retrying={calendar.loading}
    onSelect={setSelected} onRefresh={refresh} onRetry={retry} onRetryList={() => void agreements.refresh('keep')}
    onBack={() => router.canGoBack() ? router.back() : router.replace('/dogovori')}
    onOpen={id => router.navigate({ pathname: '/dogovor/[id]', params: { id } })}
    onWithoutTerm={() => router.navigate('/dogovori')} onAvailability={() => router.navigate('/profil/dostupnost')} />;
}
