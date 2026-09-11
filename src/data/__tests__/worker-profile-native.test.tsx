import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockAccount = '10000000-0000-4000-8000-000000000001', mockRevision = 1;
let mockIntent = 'uskocer', mockFocused = true, mockPlatform = 'android';
const mockListeners = new Set<(state: string) => void>();
const mockRead = jest.fn(), mockWrite = jest.fn();
const mockSource = { mojRadnikProfil: mockRead, azurirajRadnikProfil: mockWrite };
const mockRouter = { back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'Platform') return { OS: mockPlatform };
  if (key === 'AppState') return { currentState: 'active', addEventListener: (_: string, callback: (state: string) => void) => {
    mockListeners.add(callback); return { remove: () => mockListeners.delete(callback) }; } };
  return ['View', 'ScrollView', 'TextInput', 'ActivityIndicator', 'Switch', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (callback: () => void) => require('react').useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused]) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'V2Icon' }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, useUloga: () => mockIntent, ulogaSada: () => mockIntent }));
jest.mock('../../store/sesija', () => ({ useSesija: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }),
  sesijaSada: () => ({ user: { id: mockAccount }, accountRevision: mockRevision }) }));
import Profile from '../../app/(app)/profil/radnik';
const profile = { id: '20000000-0000-4000-8000-000000000001', ime: 'Ana', grad: 'Novi Sad', biografija: '',
  vestine: ['Prevoz, utovar'], alati: ['Bušilica'], vozila: ['Kombi'], stanje: 'ACTIVE', dostupanOdmah: true, radijusKm: 20, kapacitetTima: 1, capacityRevision: 'a'.repeat(64) };
let tree: ReactTestRenderer;
const control = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(value => typeof value === 'string')).join(' ');
const input = (label: string, value: string) => act(() => control(label).props.onChangeText(value));
const click = (label: string) => act(() => control(label).props.onPress());
const settle = async () => { await act(async () => {}); };
async function render() { await act(async () => { tree = create(<Profile />); }); }
beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset().mockResolvedValue(profile); mockWrite.mockReset().mockResolvedValue({ ok: true, podatak: null });
  mockAccount = '10000000-0000-4000-8000-000000000001'; mockRevision = 1; mockIntent = 'uskocer'; mockFocused = true; mockPlatform = 'android';
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

it.each(['android', 'ios'])('renders the actual V2 form and keyboard boundary on %s, retaining true availability and comma-containing terms', async platform => {
  mockPlatform = platform; await render();
  expect(control('Dostupan sam').props.value).toBe(true);
  expect(control('Radijus rada (km)').props.value).toBe('20');
  expect(texts()).toContain('Prevoz, utovar');
  expect(texts()).toContain('Nije oznaka HITNO niti dozvola za push obaveštenja.');
  expect(tree.root.findByType('KeyboardAvoidingView' as any).props.behavior).toBe(platform === 'ios' ? 'padding' : 'height');
  expect(tree.root.findByType('SafeAreaView' as any).props.edges).toEqual(['top']);
  expect(mockWrite).not.toHaveBeenCalled();
});
it('only a successfully absent profile starts with availability false and an explicit empty radius', async () => {
  mockRead.mockResolvedValue(null); await render();
  expect(control('Dostupan sam').props.value).toBe(false); expect(control('Radijus rada (km)').props.value).toBe('');
  click('Proveri i aktiviraj profil'); expect(mockWrite).not.toHaveBeenCalled(); expect(texts()).toContain('Najpre sačuvajte i učitajte profil');
});
it('read failure offers retry without constructing a false/15km draft', async () => {
  mockRead.mockRejectedValueOnce(new Error('private diagnostic')); await render();
  expect(texts()).toContain('Profil nije učitan'); expect(texts()).not.toContain('private diagnostic');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Dostupan sam' })).toHaveLength(0);
  click('Ponovo učitaj profil'); await settle(); expect(control('Dostupan sam').props.value).toBe(true);
});
it('location fields are read-only and route to the authoritative location editor', async () => {
  await render(); expect(control('Grad ili mesto rada').props.editable).toBe(false);
  expect(control('Radijus rada (km)').props.editable).toBe(false);
  input('Grad ili mesto rada','Beograd'); input('Radijus rada (km)','15');
  expect(control('Grad ili mesto rada').props.value).toBe('Novi Sad');
  expect(control('Radijus rada (km)').props.value).toBe('20');
  click('Država i područje na mapi'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/lokacija');
});
it('sends only edited fields and confirms success only after matching server readback', async () => {
  let finish!: (result: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', '  Ana Petrović  ');
  const save = control('Sačuvaj izmene').props.onPress;
  act(() => { save(); save(); }); expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledWith({ ime: 'Ana Petrović', zavrsi: false });
  expect(texts()).not.toContain('Izmene profila su sačuvane');
  mockRead.mockResolvedValue({ ...profile, ime: 'Ana Petrović', grad: 'Zemun' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(texts()).toContain('Izmene profila su sačuvane i proverene');
  expect(control('Grad ili mesto rada').props.value).toBe('Zemun');
  expect(mockRouter.back).not.toHaveBeenCalled();
});
it('activation remains unconfirmed while the server still reports DRAFT and never navigates on transport success alone', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
  click('Proveri i aktiviraj profil'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: true });
  expect(texts()).not.toContain('Profil je aktivan. Sačuvani podaci');
  expect(control('Proverite sačuvani profil')).toBeTruthy(); expect(mockRouter.back).not.toHaveBeenCalled();
  mockRead.mockResolvedValue(profile); click('Proverite sačuvani profil'); await settle();
  expect(texts()).toContain('Profil je aktivan. Sačuvani podaci su potvrđeni'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('a missing required skill prevents activation but permits an explicitly saved draft', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', vestine: [] }); await render();
  click('Proveri i aktiviraj profil'); expect(texts()).toContain('bar jednu veštinu'); expect(mockWrite).not.toHaveBeenCalled();
  click('Sačuvaj kao nacrt'); await settle(); expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false });
  expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
it('an ACTIVE readback with concurrently changed visible activation facts is not confirmed as the reviewed profile', async () => {
  mockRead.mockResolvedValueOnce({ ...profile, stanje: 'DRAFT' }).mockResolvedValue({ ...profile, vestine: ['Druga usluga'] });
  await render(); click('Proveri i aktiviraj profil'); await settle();
  expect(texts()).not.toContain('Profil je aktivan. Sačuvani podaci su potvrđeni');
  expect(control('Proverite sačuvani profil')).toBeTruthy();
  expect(texts()).toContain('Prevoz, utovar');
});
it('unknown outcome preserves the immutable command and requires readback before explicit retry', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'TIMEOUT', poruka: 'raw upstream' });
  await render(); input('Ime na radnom profilu', 'Novo ime'); const oldInput = control('Ime na radnom profilu').props.onChangeText;
  const oldSave = control('Sačuvaj izmene').props.onPress;
  click('Sačuvaj izmene'); await settle(); act(() => { oldSave(); oldInput('Kasniji tekst'); });
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(control('Ime na radnom profilu').props.value).toBe('Novo ime');
  expect(control('Ime na radnom profilu').props.editable).toBe(false); expect(texts()).not.toContain('raw upstream');
  click('Proverite sačuvani profil'); await settle(); act(() => oldSave()); expect(mockWrite).toHaveBeenCalledTimes(1);
  click('Ponovi isto čuvanje'); await settle(); expect(mockWrite).toHaveBeenCalledTimes(2);
  expect(mockWrite.mock.calls[1][0]).toEqual(mockWrite.mock.calls[0][0]);
});
it('fresh mismatching readback permits explicit editing without silently dropping the attempted draft', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'REFUSED', poruka: 'no' }); await render();
  input('Ime na radnom profilu', 'Moj nacrt'); click('Sačuvaj izmene'); await settle();
  click('Proverite sačuvani profil'); await settle(); click('Uredi unos posle provere');
  expect(control('Ime na radnom profilu').props.value).toBe('Moj nacrt'); expect(control('Ime na radnom profilu').props.editable).toBe(true);
});
it('optional resources preserve exact items and refuse to silently lose an unadded item', async () => {
  await render(); click('Alat i vozila'); input('Nova stavka: Alat i oprema', 'Merdevine');
  click('Sačuvaj izmene'); expect(mockWrite).not.toHaveBeenCalled(); expect(texts()).toContain('još nije dodata');
  click('Dodaj: Alat i oprema'); input('Nova stavka: Vozila', 'Automobil'); click('Dodaj: Vozila');
  click('Sačuvaj izmene'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, alati: ['Bušilica', 'Merdevine'], vozila: ['Kombi', 'Automobil'] });
  expect(mockWrite.mock.calls[0][0]).not.toHaveProperty('licence'); expect(mockWrite.mock.calls[0][0]).not.toHaveProperty('vestine');
});
it('availability is a truthful read-only summary and links to its revision-bound writer', async () => {
  await render(); expect(control('Dostupan sam').props.disabled).toBe(true);
  act(() => control('Dostupan sam').props.onValueChange(false));
  expect(control('Dostupan sam').props.value).toBe(true);
  click('Redovna dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  expect(mockWrite).not.toHaveBeenCalled();
});
it.each(['account', 'intent'])('retires retained callbacks and late reads across %s changes', async change => {
  await render(); input('Ime na radnom profilu', 'Unos starog naloga'); const oldSave = control('Sačuvaj izmene').props.onPress;
  let late!: (value: unknown) => void; mockRead.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
  if (change === 'account') mockRevision += 2; else mockIntent = 'narucilac';
  await act(async () => tree.update(<Profile />)); act(() => oldSave()); expect(mockWrite).not.toHaveBeenCalled();
  await act(async () => late({ ...profile, ime: 'Aktuelni nalog' }));
  expect(control('Ime na radnom profilu').props.value).toBe('Aktuelni nalog'); expect(texts()).not.toContain('Unos starog naloga');
});
it('blur retains draft and new-item input, while old callbacks cannot run after refocus', async () => {
  await render(); input('Ime na radnom profilu', 'Sačuvani lokalni unos'); input('Nova stavka: Veštine i usluge', 'Krečenje');
  const save = control('Sačuvaj izmene').props.onPress;
  mockFocused = false; await act(async () => tree.update(<Profile />)); expect(texts()).not.toContain('Sačuvani lokalni unos');
  mockFocused = true; await act(async () => tree.update(<Profile />)); act(() => save()); expect(mockWrite).not.toHaveBeenCalled();
  expect(control('Ime na radnom profilu').props.value).toBe('Sačuvani lokalni unos');
  expect(control('Nova stavka: Veštine i usluge').props.value).toBe('Krečenje');
});
it('background hides the form and foreground waits for a pending write then rereads its actual result', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', 'Potvrđeno ime'); click('Sačuvaj izmene');
  act(() => mockListeners.forEach(listener => listener('background'))); expect(texts()).not.toContain('Potvrđeno ime');
  act(() => mockListeners.forEach(listener => listener('active'))); await settle(); expect(mockRead).toHaveBeenCalledTimes(1);
  mockRead.mockResolvedValue({ ...profile, ime: 'Potvrđeno ime' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(mockRead).toHaveBeenCalledTimes(2); expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
it('a pending write across blur/refocus cannot open another write or lose its later result', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', 'Posle povratka'); click('Sačuvaj izmene');
  mockFocused = false; await act(async () => tree.update(<Profile />));
  mockFocused = true; await act(async () => tree.update(<Profile />));
  expect(control('Čuvamo profil…').props.disabled).toBe(true);
  mockRead.mockResolvedValue({ ...profile, ime: 'Posle povratka' });
  await act(async () => finish({ ok: true, podatak: null }));
  expect(texts()).toContain('Izmene profila su sačuvane i proverene'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('late write after account ABA cannot reread or announce old account success', async () => {
  let finish!: (value: unknown) => void; mockWrite.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); input('Ime na radnom profilu', 'Stari unos'); click('Sačuvaj izmene');
  mockRevision += 2; await act(async () => tree.update(<Profile />)); const reads = mockRead.mock.calls.length;
  await act(async () => finish({ ok: true, podatak: null }));
  expect(mockRead).toHaveBeenCalledTimes(reads); expect(texts()).not.toContain('Izmene profila su sačuvane');
});
it('read timeout is bounded and late response cannot overwrite a successful replacement', async () => {
  jest.useFakeTimers(); let late!: (value: unknown) => void;
  mockRead.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })); await render();
  await act(async () => jest.advanceTimersByTime(15_000)); click('Ponovo učitaj profil'); await settle();
  await act(async () => late({ ...profile, ime: 'Istekli odgovor' })); expect(control('Ime na radnom profilu').props.value).toBe('Ana');
});
it('a hanging transport becomes unknown without automatic replay or a late success announcement', async () => {
  jest.useFakeTimers(); let late!: (value: unknown) => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })); await render();
  input('Ime na radnom profilu', 'Zadržan unos'); click('Sačuvaj izmene');
  await act(async () => jest.advanceTimersByTime(65_000)); expect(control('Proverite sačuvani profil')).toBeTruthy();
  await act(async () => late({ ok: true, podatak: null })); expect(mockRead).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Izmene profila su sačuvane');
});
it('owned related settings navigation avoids losing a dirty draft and suspended profiles cannot request activation', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' }); await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
  click('Redovna dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  input('Ime na radnom profilu', 'Lokalna izmena'); click('Država i područje na mapi');
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1); expect(texts()).toContain('Sačuvajte unos pre otvaranja');
});

it.each(['0','51','1.5','2 ljudi',''])('rejects invalid capacity %s without defaulting', async capacity=>{
 await render(); input('Koliko ljudi možeš da obezbediš',capacity); click('Sačuvaj izmene');
 expect(mockWrite).not.toHaveBeenCalled(); expect(texts()).toContain('od 1 do 50 ljudi');
});
it('writes capacity using the captured authoritative revision, not a direct generic column',async()=>{
 await render();input('Koliko ljudi možeš da obezbediš','3');click('Sačuvaj izmene');await settle();
 expect(mockWrite).toHaveBeenCalledWith({zavrsi:false,kapacitetTima:3,capacityRevision:'a'.repeat(64)});
 expect(texts()).not.toContain('Izmene profila su sačuvane i proverene');
 mockRead.mockResolvedValue({...profile,kapacitetTima:3,capacityRevision:'b'.repeat(64)});
 click('Proverite sačuvani profil');await settle();expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
