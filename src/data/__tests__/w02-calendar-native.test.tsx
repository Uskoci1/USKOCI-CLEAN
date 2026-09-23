import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAvailability } from '../../contracts/workerAvailability';
import { civilDay, civilInstant, deviceDate, displayDate, displayTime, localDayRange, overlapsInterval, weekDates } from '../../ui/calendar/calendarPresentation';

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
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => true }));
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
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

it('says that being available now means nothing while the work profile is still a draft', async () => {
  // The two screens contradicted each other: the work profile said it was a draft and so nothing
  // would be offered, and this one showed "Dostupan sada" as if it decided something.
  await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false}
    onSave={jest.fn()} profileDraft />); });
  expect(text()).toContain('Radni profil je nacrt');
  expect(text()).not.toContain('Ručni status');

  await act(async () => tree.unmount());
  await render();
  expect(text()).toContain('Ručni status');
  expect(text()).not.toContain('Radni profil je nacrt');
});

describe('actual availability editor interactions', () => {
  it('saves Available Now only with explicit Save and preserves existing owned data', async () => {
    const loaded = { ...availability(), rules: [{ id: ruleId, weekdays: [1, 3], startTime: '09:00:00', endTime: '12:00:00', startsOn: '2026-09-01', endsOn: null, label: 'Redovno', active: true }] };
    const onSave = await render(jest.fn(), loaded);
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
    expect(onSave).not.toHaveBeenCalled();
    await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledWith({ timezone: loaded.timezone, availableNow: true, rules: loaded.rules, windows: [] });
    expect(text()).not.toContain('Ne uključuje HITNO');
    await press('O statusu Mogu odmah');
    expect(text()).toContain('Ne uključuje HITNO');
  });

  it('reveals one day at a time without changing a shared weekly rule or saving', async () => {
    const shared = { id: ruleId, weekdays: [1, 3], startTime: '09:00:00.123456', endTime: '12:00:00.654321', startsOn: '2026-09-01', endsOn: null, label: 'Isti termin', active: true };
    const loaded = { ...availability(), rules: [shared] }, onSave = await render(jest.fn(), loaded);
    // The labels speak minutes since 2026-09-23 ("Uredi Ponedeljak 09:00", not "09:00:00.123456"); the saved rule below
    // still carries its exact stored times.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi Ponedeljak 09:00' })).toHaveLength(0);
    await press('Prikaži termine — Ponedeljak');
    expect(button('Prikaži termine — Ponedeljak').props.accessibilityState.expanded).toBe(true);
    expect(button('Uredi Ponedeljak 09:00')).toBeTruthy();
    await press('Prikaži termine — Sreda');
    expect(button('Prikaži termine — Ponedeljak').props.accessibilityState.expanded).toBe(false);
    expect(button('Prikaži termine — Sreda').props.accessibilityState.expanded).toBe(true);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi Ponedeljak 09:00' })).toHaveLength(0);
    expect(button('Uredi Sreda 09:00')).toBeTruthy();
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
    await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledWith({ timezone: loaded.timezone, availableNow: true, rules: [shared], windows: [] });
  });

  it('keeps save, discard and the open editor action outside scrolling fields', async () => {
    const onSave = await render();
    const insideScroll = (node: ReturnType<typeof button>) => {
      for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'ScrollView' as React.ElementType) return true;
      return false;
    };
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
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
    await press('Prikaži posebne datume'); await press(`Uredi izuzetak ${civilDay('2026-10-25')}`); await edit('Naziv izuzetka (opciono)', 'Novo'); await press('Primeni izuzetak'); await press('Sačuvaj dostupnost');
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
    await press('Prikaži posebne datume'); await press(`Uredi izuzetak ${civilDay(item.date)}`);
    await edit(item.field, item.time);
    await press('Primeni izuzetak'); await press('Sačuvaj dostupnost');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ windows: [{ ...loaded.windows[0],
      startsAt: item.expectedStart, endsAt: item.expectedEnd }] }));
  });

  it.each(['busy', 'uncertain'] as const)('blocks an already edited command while %s', async state => {
    const loaded = availability(), onSave = await render(jest.fn(), loaded);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
    await act(async () => tree.update(<AvailabilityForm availability={loaded} busy={state === 'busy'} uncertain={state === 'uncertain'} onSave={onSave} />));
    const label = state === 'busy' ? 'Čuvamo unos…' : 'Sačuvaj dostupnost';
    expect(button(label).props.disabled).toBe(true);
    await press(label); expect(onSave).not.toHaveBeenCalled();
  });

  it('discard restores the server value without any save', async () => {
    const onSave = await render();
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
    await press('Odustani od izmena');
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.value).toBe(false);
    expect(button('Sačuvaj dostupnost').props.disabled).toBe(true); expect(onSave).not.toHaveBeenCalled();
  });
  it('accepted idempotent receipt clears dirty edits even if revision is unchanged', async () => {
    const loaded = availability(), onSave = await render(jest.fn(), loaded);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(false));
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
  it('reads the calendar with a real local week, invents no bookings from empty data, and always offers the availability editor', async () => {
    await act(async () => { tree = create(<Raspored />); });
    const [from, to] = (workerCalendarClientService.readRange as jest.Mock).mock.calls[0];
    expect(Date.parse(to)).toBeGreaterThan(Date.parse(from));
    expect(text()).toContain('Nema potvrđenih tačnih termina');
    // Updated deliberately (review of plan step 0, 2026-09-24): the empty day says its scope, since this screen lists
    // only the work I do, and still points to Dogovori for my own tasks and for flexible terms.
    expect(text()).toContain('Dogovori za tvoje zadatke i fleksibilni termini su u Dogovorima.');
    // Owner decision 1 (2026-09-19): when I can work is mine to set whenever I like. The editor used to
    // be withheld from a person standing in the other app mode.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi dostupnost za rad' })).toHaveLength(1);
  });
  it('does not show empty success or fabricated dates when the calendar receipt fails', async () => {
    (workerCalendarClientService.readRange as jest.Mock).mockReturnValue({ ok: false, poruka: 'Kalendar nije učitan.' });
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Kalendar nije učitan.');
    expect(text()).not.toContain('Nema potvrđenih tačnih termina');
    expect(button('Pokušaj ponovo')).toBeTruthy();
  });
  it.each([{ scale: 2, fraction: '.000', layout: 'column' }, { scale: 1, fraction: '.123456', layout: 'row' }])('writes the window to the minute, with the rail only at a normal font (scale $scale, precision $fraction)', async ({ scale, fraction, layout }) => {
    mockFontScale = scale;
    const day = deviceDate(new Date());
    const startsAt = new Date(`${day}T09:15:00`).toISOString().replace('.000', fraction);
    const endsAt = new Date(`${day}T10:45:00`).toISOString().replace('.000', fraction);
    (workerCalendarClientService.readRange as jest.Mock).mockImplementation((from, to) => ({ ok: true, podatak: { from, to, authoritative: true, events: [{
      eventId: 'event-1', agreementId: 'agreement-1', agreementVersion: 2, startsAt, endsAt, agreementStatus: 'CONFIRMED', source: 'AGREEMENT',
    }] } }));
    await act(async () => { tree = create(<Raspored />); });
    expect(text().replace(/\s+/g, ' ')).toContain(`${displayDate(day)} · ${displayTime(startsAt)}–${displayTime(endsAt)}`);
    expect(text()).not.toContain('.123456');
    expect(button('Otvori Dogovor sa potvrđenim terminom').parent?.props.style.flexDirection).toBe(layout);
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
    // "Potvrđena satnica" under every row is gone (2026-09-23): every row on this screen is a confirmed term.
    expect(text()).not.toContain('Potvrđena satnica'); expect(text()).toContain('Potvrđen Dogovor');
    expect(text()).not.toContain('999'); expect(text()).not.toContain('Stari naslov');
  });

  // The seventh day was cut off on the phone (2026-09-23): the strip scrolled sideways. Seven equal columns now always
  // fit, and at a very large font the weekday shrinks to its letter while the spoken label keeps the whole name.
  it.each([[1, ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']], [1.5, ['P', 'U', 'S', 'Č', 'P', 'S', 'N']]])(
    'lays the week out as seven equal columns that always fit (font scale %s)', async (scale, letters) => {
      mockFontScale = scale;
      await act(async () => { tree = create(<Raspored />); });
      const days = tree.root.findAll(node => node.type === 'Press' as React.ElementType
        && /^(Ponedeljak|Utorak|Sreda|Četvrtak|Petak|Subota|Nedelja), /.test(String(node.props.accessibilityLabel)));
      expect(days).toHaveLength(7);
      for (const day of days) expect(day.props.style).toEqual(expect.objectContaining({ flex: 1, minWidth: 0 }));
      expect(tree.root.findAll(node => node.type === 'ScrollView' as React.ElementType && node.props.horizontal)).toHaveLength(0);
      expect(days.map(day => day.findAllByType('T' as React.ElementType)[0].props.children)).toEqual(letters);
      expect(days[0].props.accessibilityLabel).toMatch(/^Ponedeljak, /);
    });

  it('shows a Dogovor without a saved amount in words, never as an amount', async () => {
    const day = deviceDate(new Date());
    (workerCalendarClientService.readRange as jest.Mock).mockImplementation((from, to) => ({ ok: true, podatak: { from, to, authoritative: true, events: [{
      eventId: 'event-1', agreementId: 'agreement-1', agreementVersion: 1, startsAt: new Date(`${day}T09:15:00`).toISOString(),
      endsAt: new Date(`${day}T10:45:00`).toISOString(), agreementStatus: 'CONFIRMED', source: 'AGREEMENT',
    }] } }));
    (agreementClientService.mojiDogovori as jest.Mock).mockReturnValue([{ id: 'agreement-1', verzija: 1, stanje: 'CONFIRMED', naslov: 'Selidba',
      cena: { iznos: 0, valuta: 'RSD', prikaz: '' }, putanjaTekst: 'Novi Sad' }]);
    await act(async () => { tree = create(<Raspored />); });
    expect(text()).toContain('Selidba'); expect(text()).toContain('Iznos nije sačuvan'); expect(text()).not.toContain('0 RSD');
  });
});

// Dostupnost on the phone (2026-09-23) read "16:00:00", "2026-09-23" and "Europe/Belgrade". The stored values stay exact;
// the screen writes minutes, the app's day ("23. sep") and Serbian time by name, and no line explains a button.
describe('availability reads the way the rest of the app writes time', () => {
  const loaded = () => ({ ...availability(),
    rules: [{ id: ruleId, weekdays: [1], startTime: '16:00:00', endTime: '20:30:00.000001', startsOn: '2026-09-23', endsOn: '2027-01-05', label: '', active: true }],
    windows: [{ id: windowId, startsAt: '2026-10-02T07:30:00Z', endsAt: '2026-10-02T10:00:00Z', state: 'UNAVAILABLE' as const, label: '' }] });

  it('writes the weekly rule to the minute, its dates as days and the zone in words', async () => {
    await render(jest.fn(), loaded());
    expect(text()).toContain('16:00–20:30'); expect(text()).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(text()).toContain('Po vremenu u Srbiji.'); expect(text()).not.toContain('Europe/Belgrade');
    await press('Prikaži termine — Ponedeljak');
    expect(text()).toContain(`Od ${civilDay('2026-09-23')} do ${civilDay('2027-01-05')}`); expect(text()).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(button('Uredi Ponedeljak 16:00')).toBeTruthy();
  });

  it('writes a special date as one moment, in the schedule zone', async () => {
    await render(jest.fn(), loaded());
    expect(text()).toContain('1 poseban datum');
    await press('Prikaži posebne datume');
    expect(text()).toMatch(/2\. okt( 2026)? · 09:30–12:00/); expect(text()).not.toContain('2026-10-02');
    expect(button(`Uredi izuzetak ${civilDay('2026-10-02')}`)).toBeTruthy();
  });

  it('drops the eyebrow over the special-date sheet, the zone name and the line that explained the save button', async () => {
    await render();
    expect(text()).not.toContain('Dugme se uključuje');
    await press('Dodaj — Ponedeljak');
    expect(text()).toContain('Po vremenu u Srbiji.'); expect(text()).not.toContain('Vremenska zona');
    await press('Odustani od termina');
    await press('Dodaj izuzetak');
    expect(text()).not.toContain('Izuzetak od nedelje'); expect(text()).not.toContain('Promeni dostupnost za poseban termin.');
    expect(text()).toContain('Redovni termini ostaju sačuvani. Po vremenu u Srbiji.');
  });

  it('refreshes by pulling the list, and holds every edit while the saved state is read again', async () => {
    const onRefresh = jest.fn(), onSave = jest.fn(), value = availability();
    await act(async () => { tree = create(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} onRefresh={onRefresh} />); });
    const control = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl;
    expect(control.props.refreshing).toBe(false);
    await act(async () => control.props.onRefresh());
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await act(async () => tree.update(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} onRefresh={onRefresh} refreshing />));
    expect(tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.refreshing).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.disabled).toBe(true);
    expect(button('Dodaj — Ponedeljak').props.disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  // A pull while there were unsaved edits threw them away without asking (review of plan step 0, 2026-09-24): the read
  // returns a new value and the form resets to it. The pull now does nothing until the edits are saved or discarded.
  it('refuses a pull while there are unsaved edits, and keeps them', async () => {
    const onRefresh = jest.fn(), onSave = jest.fn();
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={onSave} onRefresh={onRefresh} />); });
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
    const control = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl;
    expect(control.props.enabled).toBe(false);
    await act(async () => control.props.onRefresh());
    expect(onRefresh).not.toHaveBeenCalled();
    expect(text()).toContain('Imaš nesačuvane izmene.');
    expect(tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.value).toBe(true);
    // Once the edits are discarded, the same pull reads again.
    await press('Odustani od izmena');
    const clean = tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl;
    expect(clean.props.enabled).toBe(true);
    await act(async () => clean.props.onRefresh());
    expect(onRefresh).toHaveBeenCalledTimes(1); expect(onSave).not.toHaveBeenCalled();
  });

  // The standing "Osveži dostupnost" button was the only way a screen reader could read the saved state again.
  it('lets a screen reader reach the same read as an action on the list, never over unsaved edits', async () => {
    const onRefresh = jest.fn();
    await act(async () => { tree = create(<AvailabilityForm availability={availability()} busy={false} uncertain={false} onSave={jest.fn()} onRefresh={onRefresh} />); });
    const list = () => tree.root.findByType('ScrollView' as React.ElementType);
    expect(list().props.accessibilityActions).toEqual([{ name: 'activate', label: 'Učitaj sačuvano stanje' }]);
    await act(async () => list().props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true));
    expect(list().props.accessibilityActions).toBeUndefined();
    await act(async () => list().props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Imaš nesačuvane izmene.');
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
  it('retains microsecond boundary overlap and shows the clock to the minute', () => {
    expect(overlapsInterval('2026-09-10T23:59:59Z', '2026-09-11T00:00:00.000001Z', '2026-09-11T00:00:00Z', '2026-09-12T00:00:00Z')).toBe(true);
    expect(overlapsInterval('2026-09-10T23:59:59Z', '2026-09-11T00:00:00Z', '2026-09-11T00:00:00Z', '2026-09-12T00:00:00Z')).toBe(false);
    expect(displayTime('2026-09-11T09:00:01.123456Z')).toBe('09:00');
  });
});
