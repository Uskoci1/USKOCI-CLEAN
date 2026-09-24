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

// Since 2026-09-24 availability and the work area are summary rows that open their own editors: no switch, no dead fields.
it.each(['android', 'ios'])('renders the actual V2 form and keyboard boundary on %s, retaining true availability and comma-containing terms', async platform => {
  mockPlatform = platform; await render();
  expect(texts()).toContain('Status „Mogu odmah“ je uključen'); expect(texts()).toContain('Novi Sad · 20 km');
  expect(tree.root.findAll(node => String(node.type) === 'Switch')).toHaveLength(0);
  expect(texts()).toContain('Prevoz, utovar');
  expect(texts()).toContain('Nije oznaka HITNO niti dozvola za push obaveštenja.');
  expect(tree.root.findByType('KeyboardAvoidingView' as any).props.behavior).toBe(platform === 'ios' ? 'padding' : 'height');
  // The tab bar is hidden on this flow since 2026-09-23, so the screen owns its bottom inset.
  expect(tree.root.findByType('SafeAreaView' as any).props.edges).toEqual(['top', 'bottom']);
  expect(mockWrite).not.toHaveBeenCalled();
});
it('a successfully absent profile starts with truthful empty values and the primary action saves the first draft before activation', async () => {
  mockRead.mockResolvedValueOnce(null).mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
  expect(texts()).toContain('Status „Mogu odmah“ je isključen'); expect(texts()).toContain('Nije podešeno');
  expect(control('Koliko ljudi možeš da obezbediš').props.editable).toBe(false);
  click('Sačuvaj profil'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false });
  expect(texts()).toContain('Profil je sačuvan i provereno učitan');
  expect(control('Koliko ljudi možeš da obezbediš').props.editable).toBe(true);
  expect(control('Proveri i aktiviraj profil')).toBeTruthy();
});
it('read failure offers retry without constructing a false/15km draft', async () => {
  mockRead.mockRejectedValueOnce(new Error('private diagnostic')); await render();
  expect(texts()).toContain('Profil nije učitan'); expect(texts()).not.toContain('private diagnostic');
  expect(tree.root.findAllByProps({ label: 'Dostupnost' })).toHaveLength(0);
  click('Ponovo učitaj profil'); await settle(); expect(texts()).toContain('Status „Mogu odmah“ je uključen');
});
it('location is read-only here and routes to the area editor', async () => {
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Grad ili mesto rada' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Radijus rada (km)' })).toHaveLength(0);
  expect(texts()).toContain('Novi Sad · 20 km');
  click('Područje rada'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/lokacija');
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
  expect(texts()).toContain('Zemun · 20 km');
  expect(mockRouter.back).not.toHaveBeenCalled();
});
it('activation remains unconfirmed while the server still reports DRAFT and never navigates on transport success alone', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
  click('Proveri i aktiviraj profil'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: true });
  expect(texts()).not.toContain('Profil je aktivan. Sačuvani podaci');
  expect(control('Pogledaj sačuvani profil')).toBeTruthy(); expect(mockRouter.back).not.toHaveBeenCalled();
  mockRead.mockResolvedValue(profile); click('Pogledaj sačuvani profil'); await settle();
  expect(texts()).toContain('Profil je aktivan. Sačuvani podaci su potvrđeni'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('a missing required skill prevents activation but permits an explicitly saved draft', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', vestine: [] }); await render();
  // PKG-005 progressive CTA: activation is not offered until the basics exist; the primary action guides to the missing skill.
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
  click('Dopuni osnovne podatke'); expect(texts()).toContain('bar jednu veštinu'); expect(mockWrite).not.toHaveBeenCalled();
  click('Sačuvaj kao nacrt'); await settle(); expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false });
  expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
it('an ACTIVE readback with concurrently changed visible activation facts is not confirmed as the reviewed profile', async () => {
  mockRead.mockResolvedValueOnce({ ...profile, stanje: 'DRAFT' }).mockResolvedValue({ ...profile, vestine: ['Druga usluga'] });
  await render(); click('Proveri i aktiviraj profil'); await settle();
  expect(texts()).not.toContain('Profil je aktivan. Sačuvani podaci su potvrđeni');
  expect(control('Pogledaj sačuvani profil')).toBeTruthy();
  expect(texts()).toContain('Prevoz, utovar');
});
it('unknown outcome preserves the immutable command and requires readback before explicit retry', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'TIMEOUT', poruka: 'raw upstream' });
  await render(); input('Ime na radnom profilu', 'Novo ime'); const oldInput = control('Ime na radnom profilu').props.onChangeText;
  const oldSave = control('Sačuvaj izmene').props.onPress;
  click('Sačuvaj izmene'); await settle(); act(() => { oldSave(); oldInput('Kasniji tekst'); });
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(control('Ime na radnom profilu').props.value).toBe('Novo ime');
  expect(control('Ime na radnom profilu').props.editable).toBe(false); expect(texts()).not.toContain('raw upstream');
  click('Pogledaj sačuvani profil'); await settle(); act(() => oldSave()); expect(mockWrite).toHaveBeenCalledTimes(1);
  click('Ponovi isto čuvanje'); await settle(); expect(mockWrite).toHaveBeenCalledTimes(2);
  expect(mockWrite.mock.calls[1][0]).toEqual(mockWrite.mock.calls[0][0]);
});
it('fresh mismatching readback permits explicit editing without silently dropping the attempted draft', async () => {
  mockWrite.mockResolvedValue({ ok: false, kod: 'REFUSED', poruka: 'no' }); await render();
  input('Ime na radnom profilu', 'Moj nacrt'); click('Sačuvaj izmene'); await settle();
  click('Pogledaj sačuvani profil'); await settle(); click('Uredi unos posle provere');
  expect(control('Ime na radnom profilu').props.value).toBe('Moj nacrt'); expect(control('Ime na radnom profilu').props.editable).toBe(true);
});
it('optional resources preserve exact items and refuse to silently lose an unadded item', async () => {
  await render(); input('Nova stavka: Alat i oprema', 'Merdevine');
  click('Sačuvaj izmene'); expect(mockWrite).not.toHaveBeenCalled(); expect(texts()).toContain('još nije dodata');
  click('Dodaj: Alat i oprema'); input('Nova stavka: Vozila', 'Automobil'); click('Dodaj: Vozila');
  click('Sačuvaj izmene'); await settle();
  expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, alati: ['Bušilica', 'Merdevine'], vozila: ['Kombi', 'Automobil'] });
  expect(mockWrite.mock.calls[0][0]).not.toHaveProperty('licence'); expect(mockWrite.mock.calls[0][0]).not.toHaveProperty('vestine');
});
it('availability is a read-only summary that links to its revision-bound writer', async () => {
  await render(); expect(tree.root.findAll(node => String(node.type) === 'Switch')).toHaveLength(0);
  expect(texts()).toContain('Status „Mogu odmah“ je uključen');
  click('Dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  expect(mockWrite).not.toHaveBeenCalled();
});
it.each(['account'])('retires retained callbacks and late reads across %s changes', async change => {
  await render(); input('Ime na radnom profilu', 'Unos starog naloga'); const oldSave = control('Sačuvaj izmene').props.onPress;
  let late!: (value: unknown) => void; mockRead.mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
  if (change === 'account') mockRevision += 2;
  await act(async () => tree.update(<Profile />)); act(() => oldSave()); expect(mockWrite).not.toHaveBeenCalled();
  await act(async () => late({ ...profile, ime: 'Aktuelni nalog' }));
  expect(control('Ime na radnom profilu').props.value).toBe('Aktuelni nalog'); expect(texts()).not.toContain('Unos starog naloga');
});
// Owner decision 1 (2026-09-19): the app has no global mode. This used to be a row of the table above.
it('a flip of the retired app mode keeps the typed draft and lets the retained save run', async () => {
  await render(); input('Ime na radnom profilu', 'Unos koji ostaje'); const oldSave = control('Sačuvaj izmene').props.onPress;
  mockIntent = 'narucilac'; await act(async () => tree.update(<Profile />));
  expect(control('Ime na radnom profilu').props.value).toBe('Unos koji ostaje');
  await act(async () => oldSave()); expect(mockWrite).toHaveBeenCalledTimes(1);
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
  await act(async () => jest.advanceTimersByTime(65_000)); expect(control('Pogledaj sačuvani profil')).toBeTruthy();
  await act(async () => late({ ok: true, podatak: null })); expect(mockRead).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledTimes(1); expect(texts()).not.toContain('Izmene profila su sačuvane');
});
it('owned related settings navigation avoids losing a dirty draft and suspended profiles cannot request activation', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' }); await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Proveri i aktiviraj profil' })).toHaveLength(0);
  click('Dostupnost'); expect(mockRouter.navigate).toHaveBeenCalledWith('/profil/dostupnost');
  input('Ime na radnom profilu', 'Lokalna izmena'); click('Područje rada');
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1); expect(texts()).toContain('Sačuvaj unos pre otvaranja');
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
 click('Pogledaj sačuvani profil');await settle();expect(texts()).toContain('Izmene profila su sačuvane i proverene');
});
// A draft profile is not merely incomplete: private.dispatch_cheap_candidate_admitted requires
// profile_status = 'ACTIVE', so while it is a draft nothing is offered at all. Saying only
// "dopunite pre prijave" left the owner's own business account invisible to every task while
// looking like a small omission. The consequence is stated, not implied.
it('says a draft profile is offered nothing, not merely that it is incomplete', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' });
  await render();
  expect(texts()).toContain('Radni profil je još nacrt');
  expect(texts()).toContain('zadaci ti se ne nude');
});

it('says the same about a suspended profile, and nothing at all about an active one', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' });
  await render();
  expect(texts()).toContain('Dok traje suspenzija, zadaci ti se ne nude.');
  await act(async () => tree.unmount());
  mockRead.mockResolvedValue(profile);
  await render();
  expect(texts()).toContain('Profil je aktivan');
  expect(texts()).not.toContain('zadaci ti se ne nude');
});

// Quick picks (2026-09-24): a picture inserts its catalog label as the same free text a person could type.
describe('quick picks', () => {
  it('a term already on the list reads as chosen, and the picture removes it', async () => {
    await render(); click('Brzi izbor vozila');
    expect(control('Kombi').props.accessibilityState).toEqual({ checked: true, disabled: false });
    click('Kombi'); click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, vozila: [] });
  });
  it('a picture adds its label after the terms already there', async () => {
    await render(); click('Brzi izbor vozila'); click('Automobil'); click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, vozila: ['Kombi', 'Automobil'] });
  });
  it('a typed spelling of the same term reads as chosen and is removed by the picture', async () => {
    mockRead.mockResolvedValue({ ...profile, vozila: ['kombi'] }); await render(); click('Brzi izbor vozila');
    expect(control('Kombi').props.accessibilityState.checked).toBe(true);
    click('Kombi'); click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, vozila: [] });
  });
  it('a full list refuses a new picture and says why, and keeps its field closed', async () => {
    const full = Array.from({ length: 50 }, (_, i) => 'Vozilo ' + (i + 1));
    mockRead.mockResolvedValue({ ...profile, vozila: full }); await render(); click('Brzi izbor vozila');
    const tile = control('Kombi. Najviše 50 stavki');
    expect(tile.props.accessibilityState).toEqual({ checked: false, disabled: true });
    act(() => tile.props.onPress());
    expect(control('Nova stavka: Vozila').props.editable).toBe(false); expect(texts()).toContain('Najviše 50 stavki.');
    click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false });
  });
});

describe('team size stepper', () => {
  it('a plus writes the next number through the captured revision', async () => {
    await render(); expect(control('Manje ljudi').props.disabled).toBe(true);
    click('Više ljudi'); expect(control('Koliko ljudi možeš da obezbediš').props.value).toBe('2');
    click('Sačuvaj izmene'); await settle();
    expect(mockWrite).toHaveBeenCalledWith({ zavrsi: false, kapacitetTima: 2, capacityRevision: 'a'.repeat(64) });
  });
  it('stops at 50', async () => {
    mockRead.mockResolvedValue({ ...profile, kapacitetTima: 50 }); await render();
    expect(control('Više ljudi').props.disabled).toBe(true); expect(control('Manje ljudi').props.disabled).toBe(false);
  });
  it('is locked until the first save gives the profile a capacity revision', async () => {
    mockRead.mockResolvedValue(null); await render();
    expect(control('Više ljudi').props.disabled).toBe(true); expect(control('Manje ljudi').props.disabled).toBe(true);
    expect(control('Koliko ljudi možeš da obezbediš').props.editable).toBe(false);
    expect(texts()).toContain('Sačuvaj profil da bi se broj ljudi potvrdio.');
  });
  // Review of step 9 (2026-09-24): a typed 51 to 999 read as no number, so minus was grey and plus jumped to 1.
  it('reads a typed number above 50 as that number: minus brings it to 50 and plus stays grey', async () => {
    await render(); input('Koliko ljudi možeš da obezbediš', '75');
    expect(control('Više ljudi').props.disabled).toBe(true); expect(control('Manje ljudi').props.disabled).toBe(false);
    click('Manje ljudi'); expect(control('Koliko ljudi možeš da obezbediš').props.value).toBe('50');
  });
});

// Review of step 9 (2026-09-24): the support row is not a setting, so a dirty draft gets its own sentence.
it('asks to save a dirty draft before writing to support, in words about support', async () => {
  mockRead.mockResolvedValue({ ...profile, stanje: 'SUSPENDED' }); await render();
  input('Ime na radnom profilu', 'Lokalna izmena'); click('Piši podršci');
  expect(mockRouter.navigate).not.toHaveBeenCalled(); expect(texts()).toContain('Sačuvaj unos pre nego što pišeš podršci.');
  expect(texts()).not.toContain('Sačuvaj unos pre otvaranja drugog podešavanja.');
});

describe('activation checklist', () => {
  it('names what a draft is missing, item by item', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', vestine: [] }); await render();
    expect(control('Ime i bar jedna veština: nedostaje')).toBeTruthy();
    expect(control('Područje rada: spremno')).toBeTruthy(); expect(control('Kapacitet tima: spremno')).toBeTruthy();
    expect(texts()).not.toContain('Sve je spremno za aktivaciju.');
  });
  it('says a complete draft is ready', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
    expect(texts()).toContain('Sve je spremno za aktivaciju.'); expect(control('Proveri i aktiviraj profil')).toBeTruthy();
  });
  // Review of step 9 (2026-09-24): the three checks passed while the primary still had to load the capacity revision.
  it('says ready only when the primary is the activation itself', async () => {
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT', capacityRevision: undefined }); await render();
    expect(control('Učitaj kapacitet profila')).toBeTruthy();
    expect(texts()).not.toContain('Sve je spremno za aktivaciju.');
    expect(texts()).toContain('Kapacitet profila još nije učitan.'); expect(texts()).not.toContain('Sačuvaj profil da bi se broj ljudi potvrdio.');
    await act(async () => tree.unmount());
    mockRead.mockResolvedValue({ ...profile, stanje: 'DRAFT' }); await render();
    input('Ime na radnom profilu', 'Ana Petrović');
    expect(control('Sačuvaj izmene')).toBeTruthy(); expect(texts()).not.toContain('Sve je spremno za aktivaciju.');
  });
});
