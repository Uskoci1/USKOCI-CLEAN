import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockIntent = 'narucilac';
const mockReadRange = jest.fn((from: string, to: string) => ({ ok: true, podatak: { from, to, events: [], authoritative: true } }));
const mockAgreements = jest.fn(() => []);
const mockNavigate = jest.fn();

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', ArrowRight: 'Icon', CaretRight: 'Icon', Clock: 'Icon' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: (...args: unknown[]) => mockNavigate(...args) } }));
jest.mock('../../store/uloga', () => ({ useUloga: () => mockIntent }));
jest.mock('../workerCalendarClientService', () => ({ workerCalendarClientService: { readRange: (...args: [string, string]) => mockReadRange(...args) } }));
jest.mock('../agreementClientService', () => ({ agreementClientService: { mojiDogovori: () => mockAgreements() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: (read: () => unknown) => ({ data: read(), loading: false, error: false, refresh: jest.fn() }) }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
// The top bar is the shared one and draws with the real T; render it as the same host node the
// rest of this screen uses, so the scope label it carries is inside what these tests read.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/calendar/CalendarControls', () => ({
  CalendarAction: (props: Record<string, unknown>) => require('react').createElement('Button', { ...props, accessibilityLabel: props.label }),
  CalendarText: 'T',
  calendarStyles: { screen: {}, header: {}, icon: {}, content: {}, row: {}, note: {}, card: {}, divider: {} },
}));

import Raspored from '../../app/(app)/raspored';

let tree: ReactTestRenderer;
const text = () => tree.root.findAll(node => node.type === 'T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');

beforeEach(() => {
  jest.clearAllMocks();
  mockIntent = 'narucilac';
});
afterEach(async () => { await act(async () => tree?.unmount()); });

async function render() {
  await act(async () => { tree = create(<Raspored />); });
}

// Owner decisions 1 and 6 (2026-09-19). The calendar holds the work I agreed to do; it is mine to open
// and its availability editor is mine to use whenever I like. It used to explain itself as "the JA
// MOGU schedule" and hide the editor from a person standing in the other app mode.
describe('PKG-005 calendar scope', () => {
  it.each(['narucilac', 'uskocer'])('reads the same calendar, offers the availability editor and names no app mode, whatever the app last was (%s)', async last => {
    mockIntent = last;
    await render();
    expect(mockReadRange).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Kalendar obaveza');
    expect(text()).toContain('Potvrđeni termini poslova u koje si uskočio');
    expect(text()).toContain('Moja dostupnost za rad');
    expect(text()).toContain('Dogovore za svoje zadatke vidiš u Dogovorima; oni te ovde ne blokiraju.');
    expect(text()).not.toMatch(/JA MOGU|MENI TREBA/);
    expect(tree.root.findByProps({ accessibilityLabel: 'Uredi dostupnost za rad' })).toBeTruthy();
  });
});
