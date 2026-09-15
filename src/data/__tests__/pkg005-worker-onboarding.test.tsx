import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let accountId = '10000000-0000-4000-8000-000000000001';
let accountRevision = 1;
let intent = 'uskocer';
const readProfile = jest.fn();
const writeProfile = jest.fn();
const navigate = jest.fn();
const back = jest.fn();
const replace = jest.fn();
const push = jest.fn();
const source = { mojRadnikProfil: readProfile, azurirajRadnikProfil: writeProfile };

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('expo-router', () => ({
  router: { navigate: (...args: unknown[]) => navigate(...args), back: (...args: unknown[]) => back(...args),
    replace: (...args: unknown[]) => replace(...args), push: (...args: unknown[]) => push(...args), canGoBack: () => true },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]),
}));
jest.mock('../../store/sesija', () => ({
  useSesija: () => ({ user: { id: accountId }, accountRevision }),
  sesijaSada: () => ({ user: { id: accountId }, accountRevision }),
}));
jest.mock('../../store/uloga', () => ({
  useIzvor: () => source,
  useUloga: () => intent,
  ulogaSada: () => intent,
}));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/v2/tokens', () => ({ v2: { text: { body: {}, label: {} }, color: { teal: '#0a0', muted: '#777', danger: '#a00', orange: '#f80' } } }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'V2Action' }));
jest.mock('../../ui/workerProfile/WorkerProfilePresentation', () => ({
  WorkerProfileFrame: ({ children, footer }: { children: unknown; footer?: unknown }) => require('react').createElement('Frame', null, children, footer),
  WorkerProfileStatus: (props: Record<string, unknown>) => require('react').createElement('Status', props),
  WorkerProfileForm: (props: Record<string, unknown>) => require('react').createElement('WorkerProfileForm', props),
}));

import Profile from '../../app/(app)/profil/radnik';

const REV = 'a'.repeat(64);
const readyDraft = (change: Record<string, unknown> = {}) => ({
  id: '20000000-0000-4000-8000-000000000001',
  ime: 'Ana', grad: 'Novi Sad', biografija: '', vestine: ['Selidbe'], alati: [], vozila: [],
  stanje: 'DRAFT', dostupanOdmah: false, radijusKm: 15, kapacitetTima: 1, capacityRevision: REV,
  ...change,
});

let tree: ReactTestRenderer | undefined;
const action = (label: string) => tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === label)[0];
const form = () => tree!.root.findByType('WorkerProfileForm' as React.ElementType);
async function render() { await act(async () => { tree = create(<Profile />); }); await act(async () => {}); }

beforeEach(() => {
  jest.clearAllMocks();
  accountId = '10000000-0000-4000-8000-000000000001'; accountRevision = 1; intent = 'uskocer';
  readProfile.mockReset(); writeProfile.mockReset().mockResolvedValue({ ok: true, podatak: null });
});
afterEach(async () => { if (tree) await act(async () => tree?.unmount()); tree = undefined; });

describe('PKG-005 progressive Worker onboarding', () => {
  it('saves the first canonical draft before exposing any activation attempt, then routes the missing area prerequisite', async () => {
    readProfile.mockResolvedValueOnce(null).mockResolvedValue(readyDraft({ grad: '' }));
    await render();

    expect(action('Sačuvaj profil')).toBeTruthy();
    expect(tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === 'Proveri i aktiviraj profil')).toHaveLength(0);

    await act(async () => form().props.change({ ...form().props.draft, ime: 'Ana', vestine: ['Selidbe'] }));
    await act(async () => { action('Sačuvaj profil').props.onPress(); });
    await act(async () => {});

    expect(writeProfile).toHaveBeenCalledWith({ ime: 'Ana', vestine: ['Selidbe'], zavrsi: false });
    expect(action('Podesi područje rada')).toBeTruthy();
    expect(tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === 'Proveri i aktiviraj profil')).toHaveLength(0);

    await act(async () => action('Podesi područje rada').props.onPress());
    expect(navigate).toHaveBeenCalledWith('/profil/lokacija');
  });

  it('refreshes a DRAFT that has no capacityRevision instead of constructing a predictable failed activation', async () => {
    readProfile.mockResolvedValue(readyDraft({ capacityRevision: null }));
    await render();

    expect(action('Učitaj kapacitet profila')).toBeTruthy();
    expect(tree!.root.findAll(node => String(node.type) === 'V2Action' && node.props.label === 'Proveri i aktiviraj profil')).toHaveLength(0);
    await act(async () => action('Učitaj kapacitet profila').props.onPress());
    expect(writeProfile).not.toHaveBeenCalled();
    expect(readProfile.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('exposes activation only when canonical draft, capacity, area and minimum profile facts are all present', async () => {
    readProfile.mockResolvedValue(readyDraft());
    await render();

    expect(action('Proveri i aktiviraj profil')).toBeTruthy();
    await act(async () => { action('Proveri i aktiviraj profil').props.onPress(); });
    await act(async () => {});
    expect(writeProfile).toHaveBeenCalledWith({ zavrsi: true });
  });

  it('guides an incomplete pristine DRAFT to the missing visible field without calling activation', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: '', vestine: [] }));
    await render();

    expect(action('Dopuni osnovne podatke')).toBeTruthy();
    await act(async () => action('Dopuni osnovne podatke').props.onPress());
    expect(writeProfile).not.toHaveBeenCalled();
    expect(form().props.focusRequest).toMatchObject({ target: 'name' });
  });

  it('focuses the invalid one-character name before a skill that is already present', async () => {
    readProfile.mockResolvedValue(readyDraft({ ime: 'A', vestine: ['Selidbe'] }));
    await render();

    expect(action('Dopuni osnovne podatke')).toBeTruthy();
    await act(async () => action('Dopuni osnovne podatke').props.onPress());
    expect(writeProfile).not.toHaveBeenCalled();
    expect(form().props.focusRequest).toMatchObject({ target: 'name' });
  });
});
