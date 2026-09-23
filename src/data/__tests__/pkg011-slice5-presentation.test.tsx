import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { WorkerDraft } from '../../ui/workerProfile/workerProfileDraft';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { WorkerProfileForm, WorkerProfileFrame, WorkerProfileStatus } from '../../ui/workerProfile/WorkerProfilePresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const inputs = () => tree.root.findAllByType('TextInput' as React.ElementType).map(node => node.props.accessibilityLabel);
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const draft = (patch: Partial<WorkerDraft> = {}): WorkerDraft => ({ ime: 'Marko Marić', capacity: '2', capacityRevision: 3, vestine: ['Selidbe', 'Montaža'], newSkill: '', alati: ['Kolica'], newTool: '',
  vozila: [], newVehicle: '', grad: 'Novi Sad', radius: '25', biografija: '', dostupanOdmah: false, ...patch } as WorkerDraft);
const change = jest.fn(), navigate = jest.fn();
beforeEach(() => { change.mockClear(); navigate.mockClear(); });
function Screen({ value, status = 'DRAFT', disabled = false }: { value: WorkerDraft; status?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | null; disabled?: boolean }) {
  return <WorkerProfileFrame back={() => {}}><WorkerProfileForm draft={value} change={change} disabled={disabled} status={status} navigate={navigate} /></WorkerProfileFrame>;
}
test('the frame says what the screen is for and names no app mode; the form leads with who you are, keeps every field label as its spoken name and puts tools behind a row', async () => {
  await act(async () => { tree = create(<Screen value={draft()} />); });
  const copy = texts();
  expect(copy).toContain('Veštine, alat i tim'); expect(copy).not.toMatch(/Ja mogu|Meni treba/); expect(copy).toContain('MM'); expect(copy).toContain('Marko Marić');
  expect(copy).toContain('Radni profil je još nacrt'); expect(copy).toContain('zadaci ti se ne nude'); expect(copy).toContain('Selidbe'); expect(copy).toContain('Montaža');
  expect(inputs()).toEqual(expect.arrayContaining(['Ime na radnom profilu', 'Koliko ljudi možeš da obezbediš', 'Nova stavka: Veštine i usluge', 'Grad ili mesto rada', 'Radijus rada (km)']));
  expect(inputs()).not.toContain('Nova stavka: Alat i oprema');
  expect(byLabel('Alat i vozila').props.accessibilityState).toEqual({ expanded: false }); expect(copy).toContain('1 stavki alata · 0 vozila');
  await act(async () => byLabel('Alat i vozila').props.onPress());
  expect(inputs()).toContain('Nova stavka: Alat i oprema'); expect(labels()).toContain('Ukloni alat i oprema: Kolica');
  await act(async () => byLabel('Ukloni veštine i usluge: Selidbe').props.onPress()); expect(change).toHaveBeenCalledWith(expect.objectContaining({ vestine: ['Montaža'] }));
  await act(async () => byLabel('Redovna dostupnost').props.onPress()); expect(navigate).toHaveBeenCalledWith('/profil/dostupnost');
});
test('status tone follows the server state and the availability switch stays read-only', async () => {
  await act(async () => { tree = create(<Screen value={draft({ dostupanOdmah: true })} status="ACTIVE" />); });
  expect(texts()).toContain('Profil je aktivan'); expect(texts()).toContain('Uključeno · sačuvano stanje');
  const toggle = tree.root.findAllByType('Switch' as React.ElementType)[0]; expect(toggle.props.disabled).toBe(true); expect(toggle.props.accessibilityLabel).toBe('Dostupan sam');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={draft()} status="SUSPENDED" />); });
  expect(texts()).toContain('Profil je trenutno suspendovan');
});
test('status block: loading is spoken, an error keeps the one reload action', async () => {
  const retry = jest.fn();
  await act(async () => { tree = create(<WorkerProfileFrame back={() => {}}><WorkerProfileStatus loading error={null} retry={retry} /></WorkerProfileFrame>); });
  expect(texts()).toContain('Učitavamo radni profil…');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<WorkerProfileFrame back={() => {}}><WorkerProfileStatus loading={false} error="Profil nije učitan." retry={retry} /></WorkerProfileFrame>); });
  expect(texts()).toContain('Profil nije učitan.'); await act(async () => byLabel('Ponovo učitaj profil').props.onPress()); expect(retry).toHaveBeenCalledTimes(1);
});
