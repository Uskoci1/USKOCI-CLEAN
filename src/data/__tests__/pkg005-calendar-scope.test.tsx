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

describe('PKG-005 Worker calendar scope', () => {
  it('keeps direct access in requester intent but explicitly labels the dataset as JA MOGU / Worker-only', async () => {
    await render();
    expect(mockReadRange).toHaveBeenCalledTimes(1);
    expect(text()).toContain('JA MOGU · radni raspored');
    expect(text()).toContain('Potvrđeni termini kada radiš kao Uskočer');
    expect(text()).toContain('Ovo je raspored za JA MOGU');
    expect(text()).toContain('Dogovore koje si napravio kao naručilac vidiš u Dogovorima');
    expect(text()).not.toContain('Tvoji Dogovori, u obe namere');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Uredi dostupnost za rad' })).toHaveLength(0);
  });

  it('keeps the same Worker calendar authority in JA MOGU and exposes the availability editor only there', async () => {
    mockIntent = 'uskocer';
    await render();
    expect(mockReadRange).toHaveBeenCalledTimes(1);
    expect(text()).toContain('JA MOGU · radni raspored');
    expect(text()).toContain('Potvrđeni termini kada radiš kao Uskočer');
    expect(text()).toContain('Moja dostupnost za rad');
    expect(text()).not.toContain('Ovo je raspored za JA MOGU');
    expect(tree.root.findByProps({ accessibilityLabel: 'Uredi dostupnost za rad' })).toBeTruthy();
  });
});
