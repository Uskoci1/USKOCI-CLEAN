import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAvailability } from '../../contracts/workerAvailability';
import { civilInstant, deviceDate, displayDate, displayTime, localDayRange, overlapsInterval, weekDates } from '../../ui/calendar/calendarPresentation';

let mockFontScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', ArrowRight: 'Icon', CalendarBlank: 'Icon', PencilSimple: 'Icon', Plus: 'Icon', Trash: 'Icon', CaretRight: 'Icon', CaretDown: 'Icon', CaretUp: 'Icon', Clock: 'Icon' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() } }));
let mockIntent = 'uskocer';
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent }));
jest.mock('../workerCalendarClientService', () => ({ workerCalendarClientService: { readRange: jest.fn() } }));
jest.mock('../agreementClientService', () => ({ agreementClientService: { mojiDogovori: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: (read: () => unknown) => ({ data: read(), loading: false, error: false, refresh: jest.fn() }) }));

import { AvailabilityForm } from '../../ui/calendar/AvailabilityForm';
import Raspored from '../../app/(app)/raspored';
import { workerCalendarClientService } from '../workerCalendarClientService';
import { agreementClientService } from '../agreementClientService';
const ruleId = '00000000-0000-4000-8000-000000000001';
const windowId = '00000000-0000-4000-8000-000000000002';
const availability = (): WorkerAvailability => ({ accountId: 'owned-account', profileId: 'owned-profile', revision: 'a'.repeat(64),
  timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] });
let tree: ReactTestRenderer;
const button = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label)[0];
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const edit = async (label: string, value: string) => {
  await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value));
};
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async (onSave = jest.fn(), value = availability()) => {
  await act(async () => { tree = create(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} />); });
  return onSave;
};
afterEach(async () => { await act(async () => tree?.unmount()); jest.clearAllMocks(); mockFontScale = 1; });

describe('actual availability editor interactions', () => {
  it('saves Available Now only with explicit Save and preserves existing owned data', async () => {
    const loaded = { ...availability(), rules: [{ id: ruleId, weekdays: [1, 3], startTime: '09:00:00', endTime: '12:00:00', startsOn: '2026-09-01', endsOn: null, label: 'Redovno', active: true }] };
    const onSave = await render(jest.fn(), loaded);
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.onValueChange(true));
    expect(onSave).not.toHaveBeenCalled();
    await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledWith({ timezone: loaded.timezone, availableNow: true, rules: loaded.rules, windows: [] });
    expect(text()).not.toContain('Ne uključuje HITNO');
    await press('O statusu Dostupan sada');
    expect(text()).toContain('Ne uključuje HITNO');
  });

  it('reveals one day at a time without changing a shared weekly rule or saving', async () => {
    const shared = { id: ruleId, weekdays: [1, 3], startTime: '09:00:00.123456', endTime: '12:00:00.654321', startsOn: '2026-09-01', endsOn: null, label: 'Isti termin', active: true };
    const loaded = { ...availability(), rules: [shared] }, onSave = await render(jest.fn(), loaded);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi Ponedeljak 09:00:00.123456' })).toHaveLength(0);
    await press('Prikaži termine — Ponedeljak');
    expect(button('Prikaži termine — Ponedeljak').props.accessibilityState.expanded).toBe(true);
    expect(button('Uredi Ponedeljak 09:00:00.123456')).toBeTruthy();
    await press('Prikaži termine — Sreda');
    expect(button('Prikaži termine — Ponedeljak').props.accessibilityState.expanded).toBe(false);
    expect(button('Prikaži termine — Sreda').props.accessibilityState.expanded).toBe(true);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi Ponedeljak 09:00:00.123456' })).toHaveLength(0);
    expect(button('Uredi Sreda 09:00:00.123456')).toBeTruthy();
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.onValueChange(true));
    await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledWith({ timezone: loaded.timezone, availableNow: true, rules: [shared], windows: [] });
  });

  it('keeps save, discard and the open editor action outside scrolling fields', async () => {
    const onSave = await render();
    const insideScroll = (node: ReturnType<typeof button>) => {
      for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'ScrollView' as React.ElementType) return true;
      return false;
    };
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.onValueChange(true));
    expect(insideScroll(button('Sačuvaj dostupnost'))).toBe(false);
    expect(insideScroll(button('Odustani od izmena'))).toBe(false);
    await press('Dodaj — Ponedeljak');
    expect(insideScroll(button('Primeni termin'))).toBe(false);
    await press('Primeni termin');
    const alert = tree.root.findAll(node => node.type === 'T' as React.ElementType && node.props.accessibilityRole === 'alert')[0];
    expect(insideScroll(alert)).toBe(false);
    expect(text()).toContain('različito vreme početka i kraja');
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
    await press('Odustani od termina');
    await press('Dodaj izuzetak');
    expect(insideScroll(button('Primeni izuzetak'))).toBe(false);
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    await press('Odustani od izuzetka');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('splits explicit overnight input into adjacent canonical rules with shifted dates', async () => {
    const onSave = await render();
    await press('Dodaj — Ponedeljak');
    await edit('Početak termina', '22:00'); await edit('Kraj termina', '02:00'); await edit('Važi od', '2026-09-14');
    await press('Primeni termin');
    expect(onSave).not.toHaveBeenCalled();
    await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0].rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ weekdays: [1], startTime: '22:00:00', endTime: '24:00:00', startsOn: '2026-09-14' }),
      expect.objectContaining({ weekdays: [2], startTime: '00:00:00', endTime: '02:00:00', startsOn: '2026-09-15' }),
    ]));
  });

  it('does not turn equal times with different precision into a whole-day rule', async () => {
    const onSave = await render();
    await press('Dodaj — Ponedeljak'); await edit('Početak termina', '17:00:00'); await edit('Kraj termina', '17:00');
    await press('Primeni termin');
    expect(text()).toContain('različito vreme');
    await press('Odustani od termina'); await press('Sačuvaj dostupnost');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a dated exception in the stored zone and leaves recurring rules intact', async () => {
    const onSave = await render(); await press('Dodaj izuzetak');
    await edit('Početni datum izuzetka', '2026-09-11'); await edit('Početak izuzetka', '09:30');
    await edit('Završni datum izuzetka', '2026-09-11'); await edit('Kraj izuzetka', '12:00');
    await press('Primeni izuzetak'); await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0]).toMatchObject({ rules: [], windows: [expect.objectContaining({
      startsAt: '2026-09-11T07:30:00.000Z', endsAt: '2026-09-11T10:00:00.000Z', state: 'UNAVAILABLE',
    })] });
  });

  it.each([['2026-03-29', 'ne postoji'], ['2026-10-25', 'se ponavlja']])('rejects ambiguous/missing civil time on %s', async (date, message) => {
    const onSave = await render(); await press('Dodaj izuzetak');
    await edit('Početni datum izuzetka', date); await edit('Početak izuzetka', '02:30');
    await edit('Završni datum izuzetka', date); await edit('Kraj izuzetka', '04:00');
    await press('Primeni izuzetak'); expect(text()).toContain(message);
    await press('Odustani od izuzetka'); await press('Sačuvaj dostupnost'); expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps exact historical fractional instants when only an exception label changes', async () => {
    const loaded = { ...availability(), windows: [{ id: windowId, startsAt: '2026-10-25T00:30:00.123456Z', endsAt: '2026-10-25T02:30:00.654321Z', state: 'UNAVAILABLE' as const, label: 'Staro' }] };
    const onSave = await render(jest.fn(), loaded);
    await press('Prikaži posebne datume'); await press('Uredi izuzetak 2026-10-25'); await edit('Naziv izuzetka (opciono)', 'Novo'); await press('Primeni izuzetak'); await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0].windows).toEqual([{ ...loaded.windows[0], label: 'Novo' }]);
  });

  it.each([
    { name: 'fractional start', date: '2026-09-11', startsAt: '2026-09-11T07:30:00.123456Z', endsAt: '2026-09-11T10:30:00.654321Z',
      field: 'Kraj izuzetka', time: '13:00', expectedStart: '2026-09-11T07:30:00.123456Z', expectedEnd: '2026-09-11T11:00:00.000Z' },
    { name: 'fractional end', date: '2026-09-11', startsAt: '2026-09-11T07:30:00.123456Z', endsAt: '2026-09-11T10:30:00.654321Z',
      field: 'Početak izuzetka', time: '09:00', expectedStart: '2026-09-11T07:00:00.000Z', expectedEnd: '2026-09-11T10:30:00.654321Z' },
    { name: 'first DST-fold start', date: '2026-10-25', startsAt: '2026-10-25T00:30:00.123456Z', endsAt: '2026-10-25T02:30:00Z',
      field: 'Kraj izuzetka', time: '04:00', expectedStart: '2026-10-25T00:30:00.123456Z', expectedEnd: '2026-10-25T03:00:00.000Z' },
    { name: 'second DST-fold end', date: '2026-10-25', startsAt: '2026-10-24T22:00:00Z', endsAt: '2026-10-25T01:30:00.654321Z',
      field: 'Početak izuzetka', time: '01:00', expectedStart: '2026-10-24T23:00:00.000Z', expectedEnd: '2026-10-25T01:30:00.654321Z' },
  ])('preserves the unchanged $name when only the opposite endpoint is edited', async item => {
    const loaded = { ...availability(), windows: [{ id: windowId, startsAt: item.startsAt, endsAt: item.endsAt,
      state: 'UNAVAILABLE' as const, label: 'Sačuvan izuzetak' }] };
    const onSave = await render(jest.fn(), loaded);
    await press('Prikaži posebne datume'); await press(`Uredi izuzetak ${item.date}`);
    await edit(item.field, item.time);
    await press('Primeni izuzetak'); await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ windows: [{ ...loaded.windows[0],
      startsAt: item.expectedStart, endsAt: item.expectedEnd }] }));
  });

  it.each(['busy', 'uncertain'] as const)('blocks an already edited command while %s', async state => {
    const loaded = availability(), onSave = await render(jest.fn(), loaded);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.onValueChange(true));
    await act(async () => tree.update(<AvailabilityForm availability={loaded} busy={state === 'busy'} uncertain={state === 'uncertain'} onSave={onSave} />));
    await press(state === 'busy' ? 'Čuvamo dostupnost…' : 'Sačuvaj dostupnost'); expect(onSave).not.toHaveBeenCalled();
  });

  it('discard restores the server value without any save', async () => {
    const onSave = await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.onValueChange(true));
    await press('Odustani od izmena');
    expect(tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.value).toBe(false);
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true); expect(onSave).not.toHaveBeenCalled();
  });
  it('accepted idempotent receipt clears dirty edits even if revision is unchanged', async () => {
    const loaded = availability(), onSave = await render(jest.fn(), loaded);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.onValueChange(true));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Dostupan sada' }).props.onValueChange(false));
    await press('Sačuvaj dostupnost');
    await act(async () => tree.update(<AvailabilityForm availability={{ ...loaded }} busy={false} uncertain={false} onSave={onSave} />));
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    expect(text()).not.toContain('nesačuvane');
  });
});

describe('actual agenda screen', () => {
  beforeEach(() => {
    mockIntent = 'narucilac';
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([]);
    (workerCalendarClientService.readRange as jest.Mock).mockImplementation((from, to) => ({ ok: true, podatak: { from, to, authoritative: true, events: [] } }));
  });
  it('reads requester calendar with a real local week and does not invent bookings from empty data', async () => {
    await act(async () => { tree = create(<Raspored />); });
    const [from, to] = (workerCalendarClientService.readRange as jest.Mock).mock.calls[0];
    expect(Date.parse(to)).toBeGreaterThan(Date.parse(from));
    expect(text()).toContain('Nema potvrđenih tačnih termina');
    expect(text()).toContain('Fleksibilni termini');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi dostupnost za rad' })).toHaveLength(0);
  });
  it('does not show empty success or fabricated dates when the calendar receipt fails', async () => {
    (workerCalendarClientService.readRange as jest.Mock).mockReturnValue({ ok: false, poruka: 'Kalendar nije učitan.' });
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Kalendar nije učitan.');
    expect(text()).not.toContain('Nema potvrđenih tačnih termina');
    expect(button('Pokušaj ponovo')).toBeTruthy();
  });
  it.each([{ scale: 2, fraction: '.000' }, { scale: 1, fraction: '.123456' }])('keeps full endpoints in a wider agenda card at scale $scale and precision $fraction', async ({ scale, fraction }) => {
    mockFontScale = scale;
    const day = deviceDate(new Date());
    const startsAt = new Date(`${day}T09:15:00`).toISOString().replace('.000', fraction);
    const endsAt = new Date(`${day}T10:45:00`).toISOString().replace('.000', fraction);
    (workerCalendarClientService.readRange as jest.Mock).mockImplementation((from, to) => ({ ok: true, podatak: { from, to, authoritative: true, events: [{
      eventId: 'event-1', agreementId: 'agreement-1', agreementVersion: 2, startsAt, endsAt, agreementStatus: 'CONFIRMED', source: 'AGREEMENT',
    }] } }));
    await act(async () => { tree = create(<Raspored />); });
    expect(text().replace(/\s+/g, ' ')).toContain(`${displayDate(day)} · ${displayTime(startsAt)} → ${displayDate(day)} · ${displayTime(endsAt)}`);
    expect(button('Otvori Dogovor sa potvrđenim terminom').parent?.props.style.flexDirection).toBe('column');
  });

  it('renders an exact receipt and never mixes an older Agreement version into it', async () => {
    const day = deviceDate(new Date());
    (workerCalendarClientService.readRange as jest.Mock).mockImplementation((from, to) => ({ ok: true, podatak: { from, to, authoritative: true, events: [{
      eventId: 'event-1', agreementId: 'agreement-1', agreementVersion: 2, startsAt: new Date(`${day}T09:15:00`).toISOString(),
      endsAt: new Date(`${day}T10:45:00`).toISOString(), agreementStatus: 'CONFIRMED', source: 'AGREEMENT',
    }] } }));
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([{ id: 'agreement-1', verzija: 1, stanje: 'CONFIRMED', naslov: 'Stari naslov', cena: { prikaz: '999 RSD' } }]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('09:15'); expect(text()).toContain('10:45');
    expect(text()).toContain('Potvrđena satnica'); expect(text()).not.toContain('999'); expect(text()).not.toContain('Stari naslov');
  });
});

describe('calendar civil date boundaries', () => {
  it('round-trips a non-whole-hour timezone and rejects nonexistent calendar dates', () => {
    expect(civilInstant('2026-09-11', '09:30', 'Asia/Kathmandu').value).toBe('2026-09-11T03:45:00.000Z');
    expect(civilInstant('2026-02-30', '09:30', 'Europe/Belgrade').value).toBeNull();
  });
  it('moves through year boundaries without assuming a fixed week in milliseconds', () => {
    expect(weekDates('2027-01-01')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    const day = localDayRange('2026-09-11'); expect(Date.parse(day.to) - Date.parse(day.from)).toBe(86_400_000);
  });
  it('retains microsecond boundary overlap and visible precision', () => {
    expect(overlapsInterval('2026-09-10T23:59:59Z', '2026-09-11T00:00:00.000001Z', '2026-09-11T00:00:00Z', '2026-09-12T00:00:00Z')).toBe(true);
    expect(overlapsInterval('2026-09-10T23:59:59Z', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z', '2026-09-12T00:00:00Z')).toBe(false);
    expect(displayTime('2026-09-11T09:00:01.123456Z')).toContain(':01.123456');
  });
});
