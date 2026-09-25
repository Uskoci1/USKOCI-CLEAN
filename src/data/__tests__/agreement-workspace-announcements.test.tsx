import React, { StrictMode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockPlatform = 'ios';
const mockAnnounce = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: mockPlatform };
    if (key === 'AccessibilityInfo') return { announceForAccessibility: mockAnnounce };
    return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'V2Action' }));

import { NextStepCard, WorkspaceFooter } from '../../ui/agreements/AgreementWorkspace';

let tree: ReactTestRenderer | undefined;
const mockComplete = jest.fn(), mockRefresh = jest.fn();
const brand = { label: 'Potvrdi završetak', onPress: mockComplete, disabled: true };
const notice = (message: string, refreshing = false) => ({ message, refresh: mockRefresh, refreshing });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const update = async (element: React.ReactElement) => { await act(async () => tree!.update(element)); };
const spoken = () => mockAnnounce.mock.calls.map(([message]) => message);

beforeEach(() => { jest.clearAllMocks(); mockPlatform = 'ios'; });
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

test('VoiceOver hears each changed step once, never the initial title or body-only changes', async () => {
  await render(<StrictMode><NextStepCard title="Dogovoreno" body="Sledeći korak" /></StrictMode>);
  expect(spoken()).toEqual([]);
  await update(<StrictMode><NextStepCard title="Dogovoreno" body="Drugačije objašnjenje" tone="warn" /></StrictMode>);
  expect(spoken()).toEqual([]);
  await update(<StrictMode><NextStepCard title="Čeka se potvrda druge strane" /></StrictMode>);
  await update(<StrictMode><NextStepCard title="Čeka se potvrda druge strane" body="Rok potvrde" /></StrictMode>);
  await update(<StrictMode><NextStepCard title="Dogovor je završen" /></StrictMode>);
  expect(spoken()).toEqual(['Čeka se potvrda druge strane', 'Dogovor je završen']);
});

test('Android retains one persistent live title and does not also announce the step manually', async () => {
  mockPlatform = 'android';
  await render(<NextStepCard title="Dogovoreno" />);
  const title = tree!.root.findByProps({ accessibilityLiveRegion: 'polite' });
  await update(<NextStepCard title="Dogovor je završen" />);
  expect(tree!.root.findByProps({ accessibilityLiveRegion: 'polite' })).toBe(title);
  expect(title.props.children).toBe('Dogovor je završen');
  expect(spoken()).toEqual([]);
});

test.each(['android', 'ios'])('%s announces recovery once per visible message episode, without a competing live region', async platform => {
  mockPlatform = platform;
  await render(<WorkspaceFooter brand={brand} statusText="Učitavamo Dogovor…" />);
  await update(<WorkspaceFooter brand={brand} notice={notice('')} />);
  expect(spoken()).toEqual([]);

  await update(<WorkspaceFooter brand={brand} notice={notice('Radnja nije potvrđena.')} />);
  await update(<WorkspaceFooter brand={brand} notice={notice('Radnja nije potvrđena.', true)} loading />);
  expect(spoken()).toEqual(['Radnja nije potvrđena.']);
  const recovery = tree!.root.findByProps({ testID: 'agreement-action-recovery' });
  expect(recovery.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Radnja nije potvrđena.');
  expect(recovery.findAll(node => node.props.accessibilityLiveRegion !== undefined)).toHaveLength(0);

  await update(<WorkspaceFooter brand={brand} notice={notice('Dogovor nije osvežen.')} />);
  await update(<WorkspaceFooter brand={brand} notice={null} statusText="Učitavamo Dogovor…" />);
  await update(<WorkspaceFooter brand={brand} notice={notice('Dogovor nije osvežen.')} />);
  expect(spoken()).toEqual(['Radnja nije potvrđena.', 'Dogovor nije osvežen.', 'Dogovor nije osvežen.']);
});

test.each(['android', 'ios'])('%s announces an existing nonempty recovery once even when mount effects replay', async platform => {
  mockPlatform = platform;
  await render(<StrictMode><WorkspaceFooter brand={brand} notice={notice('Najpre osveži status Dogovora.')} /></StrictMode>);
  expect(spoken()).toEqual(['Najpre osveži status Dogovora.']);
});

test('announcements preserve footer recovery callbacks and the separate completion/loading status API', async () => {
  await render(<WorkspaceFooter brand={brand} loading statusText="Čuvamo promenu…" notice={notice('Radnja nije potvrđena.', true)} />);
  const actions = () => tree!.root.findAll(node => String(node.type) === 'V2Action');
  expect(actions().map(node => node.props.label)).toEqual(['Osveži status Dogovora', 'Potvrdi završetak']);
  expect(actions()[0].props).toMatchObject({ onPress: mockRefresh, disabled: true, loading: true });
  expect(actions()[1].props).toMatchObject({ onPress: mockComplete, disabled: true, loading: true });
  await update(<WorkspaceFooter brand={brand} statusText="Učitavamo Dogovor…" />);
  expect(actions()).toHaveLength(1);
  expect(actions()[0].props).toMatchObject({ onPress: mockComplete, disabled: true, loading: false });
  expect(tree!.root.findAll(node => String(node.type) === 'T').map(node => node.props.children)).toEqual(['Učitavamo Dogovor…']);
  expect(spoken()).toEqual(['Radnja nije potvrđena.']);
});
