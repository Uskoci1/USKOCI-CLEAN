import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerAvailability } from '../../contracts/workerAvailability';

/**
 * Owner step 10 (2026-09-24): Dostupnost za rad. The week is filled by copying a day (critique A18), the editors are the
 * one sheet engine and ask before dropping input, the zone is said only outside Serbian time (A19), and leaving the
 * screen with unsaved changes asks first (A17).
 */
const mockBack: { handlers: (() => boolean)[] } = { handlers: [] };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    if (key === 'BackHandler') return { addEventListener: (_: string, handler: () => boolean) => {
      mockBack.handlers.push(handler);
      return { remove: () => { mockBack.handlers = mockBack.handlers.filter(item => item !== handler); } };
    } };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, []) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: 'owned-account' }, accountRevision: 0 }) }));
jest.mock('../workerAvailabilityClientService', () => ({ workerAvailabilityClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../ownProfileClientService', () => ({ ownProfileClientService: { read: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => ({ data: null, loading: false, error: false, refresh: jest.fn() }) }));
let mockEditor: Record<string, unknown> = {};
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: () => mockEditor }));

import { router } from 'expo-router';
import Dostupnost from '../../app/(app)/profil/dostupnost';
import { AvailabilityForm } from '../../ui/calendar/AvailabilityForm';
import { ConfirmSheet } from '../../ui/system/ConfirmSheet';

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
const rule = (id: string, weekdays: number[], startTime: string, endTime: string) =>
  ({ id, weekdays, startTime, endTime, startsOn: '2026-09-01', endsOn: null, label: '', active: true });
const availability = (patch: Partial<WorkerAvailability> = {}): WorkerAvailability => ({ accountId: 'owned-account', profileId: 'owned-profile',
  revision: 'a'.repeat(64), timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [], ...patch });
let tree: ReactTestRenderer;
const all = (label: string) => tree.root.findAll(node => node.props.label === label || node.props.accessibilityLabel === label);
const host = (label: string) => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === label)[0];
const press = async (label: string) => { await act(async () => all(label)[0].props.onPress()); };
const edit = async (label: string, value: string) => { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(value)); };
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const form = async (value = availability(), extra: Partial<React.ComponentProps<typeof AvailabilityForm>> = {}) => {
  const onSave = jest.fn();
  await act(async () => { tree = create(<AvailabilityForm availability={value} busy={false} uncertain={false} onSave={onSave} {...extra} />); });
  return onSave;
};
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.clearAllMocks(); mockBack.handlers = []; });

describe('the Termin sheet', () => {
  it('explains work over midnight only when the end is before the start', async () => {
    await form();
    await press('Dodaj — Ponedeljak');
    expect(text()).toContain('Novi termin');
    expect(text()).not.toContain('Kraj pre početka');
    await edit('Početak termina', '22:00'); await edit('Kraj termina', '02:00');
    expect(text()).toContain('Kraj pre početka znači rad preko ponoći.');
    await edit('Kraj termina', '23:00');
    expect(text()).not.toContain('Kraj pre početka');
  });

  it('draws the days as two rows of 48 px checkboxes', async () => {
    await form();
    await press('Dodaj — Sreda');
    const days = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityRole === 'checkbox');
    expect(days.map(day => day.props.accessibilityLabel)).toEqual(['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja']);
    expect(days.find(day => day.props.accessibilityLabel === 'Sreda')!.props.accessibilityState).toEqual({ checked: true });
  });

  it('asks before throwing away what was typed when the sheet is closed by Back', async () => {
    await form();
    await press('Dodaj — Ponedeljak');
    await edit('Početak termina', '09:00');
    await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose());
    expect(text()).toContain('Odbaciti izmene?');
    expect(all('Nastavi uređivanje')).not.toHaveLength(0);
  });

  it('keeps the day just filled open, so the whole week is one more tap', async () => {
    await form();
    await press('Dodaj — Utorak');
    await edit('Početak termina', '09:00'); await edit('Kraj termina', '17:00');
    await press('Primeni termin');
    expect(host('Prikaži termine — Utorak').props.accessibilityState.expanded).toBe(true);
    expect(all('Isto za sve radne dane kao Utorak')).not.toHaveLength(0);
  });
});

describe('the zone line', () => {
  it('is quiet for a Serbian schedule on a phone in Serbian time, in the form and in both sheets', async () => {
    await form(availability(), { phoneZone: 'Europe/Belgrade' });
    expect(text()).not.toContain('Po vremenu u Srbiji');
    await press('Dodaj — Ponedeljak');
    expect(text()).not.toContain('Po vremenu u Srbiji');
    await press('Odustani od termina');
    await press('Dodaj izuzetak');
    expect(text()).toContain('Redovni termini ostaju sačuvani.'); expect(text()).not.toContain('Po vremenu u Srbiji');
  });
  it('says Serbian time on a phone set elsewhere', async () => {
    await form(availability(), { phoneZone: 'Europe/Vienna' });
    expect(text()).toContain('Po vremenu u Srbiji.');
  });
});

describe('the Poseban datum sheet', () => {
  it('lets a new special date end on the day it starts, and never moves the end of a saved one', async () => {
    await form();
    await press('Dodaj izuzetak');
    await edit('Početni datum izuzetka', '2026-10-02');
    expect(tree.root.findByProps({ accessibilityLabel: 'Završni datum izuzetka' }).props.value).toBe('2026-10-02');
    expect(text()).toContain('Poseban datum ima prednost nad redovnom nedeljom i ne otkazuje postojeće Dogovore. Potvrđen termin ostaje obaveza.');
    await press('Odustani od izuzetka');
    await act(async () => tree.unmount());
    await form(availability({ windows: [{ id: ids[1], startsAt: '2026-10-02T07:30:00Z', endsAt: '2026-10-03T10:00:00Z', state: 'UNAVAILABLE', label: '' }] }));
    await press('Uredi izuzetak 2. okt');
    await edit('Početni datum izuzetka', '2026-10-01');
    expect(tree.root.findByProps({ accessibilityLabel: 'Završni datum izuzetka' }).props.value).toBe('2026-10-03');
  });

  it('lists a past special date quietly, after the coming ones, marked "Prošlo"', async () => {
    await form(availability({ windows: [
      { id: ids[0], startsAt: '2020-01-10T08:00:00Z', endsAt: '2020-01-10T10:00:00Z', state: 'UNAVAILABLE', label: 'Staro' },
      { id: ids[1], startsAt: '2099-01-10T08:00:00Z', endsAt: '2099-01-10T10:00:00Z', state: 'AVAILABLE', label: '' },
    ] }));
    expect(text()).toContain('Prošlo · Zauzeto · Staro'); expect(text()).toContain('Slobodno za rad');
    const rows = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^Uredi izuzetak /.test(String(node.props.accessibilityLabel)));
    expect(rows.map(row => row.props.accessibilityLabel)).toEqual(['Uredi izuzetak 10. jan 2099', 'Uredi izuzetak 10. jan 2020']);
  });

  it('says there are none in one line, and still offers to add one', async () => {
    await form();
    expect(text()).toContain('Nema posebnih datuma.');
    expect(all('Dodaj izuzetak')).not.toHaveLength(0);
    expect(all('Prikaži posebne datume')).toHaveLength(0);
  });
});

describe('copying a day', () => {
  const week = () => availability({ rules: [rule(ids[0], [1], '09:00:00', '12:00:00'), rule(ids[1], [3], '13:00:00', '15:00:00')] });

  it('asks before "Isto za sve radne dane" replaces a day\'s own slots, and replaces them only on yes', async () => {
    const onSave = await form(week());
    await press('Prikaži termine — Ponedeljak');
    await press('Isto za sve radne dane kao Ponedeljak');
    const ask = tree.root.findByType(ConfirmSheet);
    expect(ask.props).toMatchObject({ title: 'Zameniti termine?', confirmLabel: 'Zameni', cancelLabel: 'Odustani',
      message: 'Utorak, Sreda, Četvrtak i Petak dobijaju termine kao Ponedeljak. Promena će se sačuvati tek kada sačuvaš dostupnost.' });
    await act(async () => ask.findByProps({ testID: 'confirm-sheet-cancel' }).props.onPress());
    expect(text()).toContain('13:00–15:00'); expect(text()).not.toContain('Imaš nesačuvane izmene.');
    await press('Isto za sve radne dane kao Ponedeljak');
    await act(async () => tree.root.findByType(ConfirmSheet).findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
    expect(text()).not.toContain('13:00–15:00');
    for (const day of ['Utorak', 'Sreda', 'Četvrtak', 'Petak']) expect(host(`Prikaži termine — ${day}`)).toBeTruthy();
    expect(host('Dodaj — Subota')).toBeTruthy();
    await press('Sačuvaj dostupnost');
    expect(onSave.mock.calls[0][0].rules).toEqual([rule(ids[0], [1, 2, 3, 4, 5], '09:00:00', '12:00:00')]);
  });

  it('copies at once when no chosen day loses a slot of its own', async () => {
    await form(availability({ rules: [rule(ids[0], [1], '09:00:00', '12:00:00')] }));
    await press('Prikaži termine — Ponedeljak');
    await press('Isto za sve radne dane kao Ponedeljak');
    expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    expect(host('Prikaži termine — Petak')).toBeTruthy();
  });

  it('holds "Kopiraj" until a day is chosen, says why, and copies onto the chosen days', async () => {
    await form(week());
    await press('Prikaži termine — Ponedeljak');
    await press('Kopiraj Ponedeljak na druge dane');
    expect(text()).toContain('Ponedeljak: 09:00–12:00');
    const copy = () => all('Kopiraj')[0];
    expect(copy().props).toMatchObject({ disabled: true, reason: 'Izaberi bar jedan dan.' });
    await act(async () => copy().props.onPress());
    expect(tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === 'Subota')).toHaveLength(1);
    await press('Subota');
    expect(copy().props.disabled).toBe(false);
    expect(text()).not.toContain('Postojeći termini izabranih dana se zamenjuju.');
    await press('Sreda');
    expect(text()).toContain('Postojeći termini izabranih dana se zamenjuju.');
    await press('Kopiraj');
    expect(host('Prikaži termine — Subota')).toBeTruthy(); expect(text()).not.toContain('13:00–15:00');
    expect(text()).toContain('Imaš nesačuvane izmene.');
  });
});

describe('leaving Dostupnost', () => {
  const data = availability();
  const editor = (patch: Record<string, unknown> = {}) => ({ data, loading: false, busy: false, error: null, uncertain: false, saved: false,
    refresh: jest.fn().mockResolvedValue(undefined), save: jest.fn(), ...patch });
  const screen = async () => { await act(async () => { tree = create(<Dostupnost />); }); };
  const back = async () => { await act(async () => host('Nazad').props.onPress()); };
  const toggle = async () => { await act(async () => tree.root.findByProps({ accessibilityLabel: 'Mogu odmah' }).props.onValueChange(true)); };

  it('goes back at once when nothing has changed', async () => {
    mockEditor = editor(); await screen();
    await back();
    expect(router.back).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
    expect(mockBack.handlers[0]()).toBe(false);
  });

  it('asks before dropping unsaved changes, and leaves only on "Odbaci izmene"', async () => {
    mockEditor = editor(); await screen();
    await toggle();
    await back();
    expect(router.back).not.toHaveBeenCalled();
    const ask = tree.root.findByType(ConfirmSheet);
    expect(ask.props).toMatchObject({ title: 'Odbaciti izmene?', message: 'Unete izmene neće biti sačuvane.', confirmLabel: 'Odbaci izmene',
      cancelLabel: 'Nastavi uređivanje', tone: 'danger' });
    await act(async () => ask.findByProps({ testID: 'confirm-sheet-confirm' }).props.onPress());
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('hears the hardware Back only while there is something to lose', async () => {
    mockEditor = editor(); await screen();
    expect(mockBack.handlers).toHaveLength(1);
    await toggle();
    let handled = false;
    await act(async () => { handled = mockBack.handlers[0](); });
    expect(handled).toBe(true); expect(tree.root.findByType(ConfirmSheet).props.title).toBe('Odbaciti izmene?');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('does not ask while a save runs: the editor settles the write either way', async () => {
    mockEditor = editor(); await screen();
    await toggle();
    mockEditor = editor({ busy: true });
    await act(async () => tree.update(<Dostupnost />));
    expect(mockBack.handlers[0]()).toBe(false);
    await back();
    expect(router.back).toHaveBeenCalledTimes(1); expect(tree.root.findAllByType(ConfirmSheet)).toHaveLength(0);
  });

  it('shows a first read that failed as the shared error state, with the read again as its one action', async () => {
    mockEditor = editor({ data: null, error: 'Podaci nisu učitani. Proveri vezu i pokušaj ponovo.' }); await screen();
    expect(text()).toContain('Dostupnost nije učitana.'); expect(text()).toContain('Podaci nisu učitani.');
    await press('Učitaj sačuvano stanje');
    expect(mockEditor.refresh).toHaveBeenCalledTimes(1);
  });
});
