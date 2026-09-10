import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { NeedLocationReview, WorkerLocation } from '../../contracts/location';

const mockMarkets = [
  { countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn', defaultTimezone: 'Europe/Belgrade' },
  { countryCode: 'BA', productStatus: 'LIVE', defaultCurrencyCode: 'BAM', defaultLanguageTag: 'bs', defaultTimezone: 'Europe/Sarajevo' },
  { countryCode: 'HR', productStatus: 'COMING', defaultCurrencyCode: 'EUR', defaultLanguageTag: 'hr', defaultTimezone: 'Europe/Zagreb' },
];
jest.mock('../marketClientService', () => ({ marketClientService: { list: jest.fn() } }));
jest.mock('../../hooks/useFocusedResource', () => ({ useFocusedResource: () => ({
  data: { ok: true, podatak: mockMarkets }, loading: false, error: false, refresh: jest.fn(),
}) }));

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', CaretDown: 'Icon', Check: 'Icon', LockKey: 'Icon' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../locationClientService', () => ({ workerLocationClientService: { read: jest.fn(), save: jest.fn() } }));
jest.mock('../../hooks/useOwnedEditor', () => ({ useOwnedEditor: jest.fn() }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Button', () => ({ Button: 'Button' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Button' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ResolvedPinMap' }));

import { NeedLocationForm } from '../../ui/location/NeedLocationForm';
import { WorkerLocationForm } from '../../app/(app)/profil/lokacija';

const review = (): NeedLocationReview => ({ accountId: 'account-a', conversationId: 'conversation-a', editable: true,
  confirmed: true, revision: 'revision-a', value: { geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } },
    taskCountryCode: 'RS', exactAddress: 'Privatna ulica 17, stan 2', accessNotes: 'Privatna šifra ulaza 1234' } } as NeedLocationReview);
const location = (): WorkerLocation => ({ accountId: 'account-a', profileId: 'worker-a', revision: 'revision-a',
  operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 25, approximatePosition: { latitude: 45.26, longitude: 19.83 } } as WorkerLocation);

let tree: ReactTestRenderer;
const saveButton = (label = 'Potvrdi i sačuvaj mesto') => tree.root.findByProps({ label });
const confirm = () => tree.root.findByProps({ accessibilityLabel: 'Potvrđujem unetu lokaciju' });
async function openChoice(label: string) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress()); }
async function chooseMode(label: string) {
  if (!tree.root.findAllByProps({ accessibilityLabel: label }).length) {
    const country = ['Srbija', 'Bosna i Hercegovina', 'Hrvatska'].includes(label);
    const field = country ? tree.root.findAllByProps({ accessibilityLabel: 'Država rada' }).length ? 'Država rada' : 'Država Zadatka' : 'Način rada';
    await openChoice(field);
  }
  await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
}
async function edit(label: string, text: string) { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onChangeText(text)); }
async function check() { await act(async () => confirm().props.onPress()); }
async function save(label?: string) { await act(async () => saveButton(label).props.onPress()); }
const text = () => tree.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('actual native Need location form', () => {
  it('keeps private details out of the initial form and preserves edits across disclosure', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Tačna adresa (privatno, opciono)' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Mesto rada — deo grada (opciono)' })).toHaveLength(0);
    await openChoice('Privatni detalji Zadatka');
    await edit('Tačna adresa (privatno, opciono)', 'Sačuvana privatna ispravka');
    await openChoice('Privatni detalji Zadatka'); await openChoice('Privatni detalji Zadatka');
    expect(tree.root.findByProps({ accessibilityLabel: 'Tačna adresa (privatno, opciono)' }).props.value).toBe('Sačuvana privatna ispravka');
    expect(confirm().props.accessibilityState.checked).toBe(false);
    await check(); await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ exactAddress: 'Sačuvana privatna ispravka' }));
  });

  it('requires point confirmation before saving and does not publish the precise point in geography', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await act(async () => tree.root.findByType('ResolvedPinMap' as never).props.onChoose({ latitude: 45.251234, longitude: 19.831234 }));
    act(() => { confirm().props.onPress(); });
    act(() => { saveButton().props.onPress(); });
    expect(onSave).not.toHaveBeenCalled();
    act(() => { tree.root.findByProps({ label: 'Potvrdi tačku: Mesto rada' }).props.onPress(); });
    act(() => { confirm().props.onPress(); });
    act(() => { saveButton().props.onPress(); });
    expect(onSave.mock.calls[0][0].resolvedLocation.points[0]).toMatchObject({ slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234, origin: { kind: 'MANUAL_PIN' } });
    expect(JSON.stringify(onSave.mock.calls[0][0].geography)).not.toMatch(/latitude|longitude|Privatna/);
  });

  it('editing a city and returning to the original text cannot revive confirmed coordinates', async () => {
    const onSave = jest.fn(), base = review();
    const loaded: NeedLocationReview = { ...base, value: { ...base.value, resolvedLocation: { version: 1, binding: { taskCountryCode: 'RS',
      geography: base.value.geography!, exactAddress: base.value.exactAddress }, points: [
      { slot: 'start', latitudeE6: 45251234, longitudeE6: 19831234, origin: { kind: 'MANUAL_PIN' } },
    ] } } };
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    await edit('Mesto rada — grad ili mesto', 'Beograd'); await edit('Mesto rada — grad ili mesto', 'Novi Sad');
    await check(); await save();
    expect(onSave.mock.calls[0][0].resolvedLocation).toBeNull();
    expect(tree.root.findByType('ResolvedPinMap' as never).props.position).toBeNull();
  });
  it('requires an explicit country for historical location without assuming Serbia', async () => {
    const onSave = jest.fn();
    const historical = review();
    await act(async () => { tree = create(<NeedLocationForm review={{ ...historical, value: { ...historical.value, taskCountryCode: null } }} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Država Zadatka' }).props.accessibilityValue.text).toBe('Nije izabrano');
    await check(); await save(); expect(onSave).not.toHaveBeenCalled();
    await chooseMode('Srbija'); await check(); await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ taskCountryCode: 'RS' }));
  });

  it('requires a fresh explicit confirmation even when the loaded server review is confirmed', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    expect(confirm().props.accessibilityState.checked).toBe(false);
    expect(saveButton().props.disabled).toBe(true);
    await save();
    expect(onSave).not.toHaveBeenCalled();
    await check();
    expect(saveButton().props.disabled).toBe(false);
    await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } },
      exactAddress: 'Privatna ulica 17, stan 2', accessNotes: 'Privatna šifra ulaza 1234' }));
  });

  it('remote sends no old geography points, exact address, or access notes', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await check();
    await chooseMode('Na daljinu');
    expect(confirm().props.accessibilityState.checked).toBe(false);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Tačna adresa (privatno, opciono)' })).toHaveLength(0);
    await check(); await save();
    const payload = onSave.mock.calls[0][0];
    expect(payload).toMatchObject({ geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null });
    expect(Object.keys(payload.geography)).toEqual(['mode']);
    expect(JSON.stringify(payload)).not.toContain('Privatna');
  });

  it('editing any private field cancels confirmation before a second save', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await check();
    await openChoice('Privatni detalji Zadatka');
    await edit('Tačna adresa (privatno, opciono)', 'Nova privatna adresa 2');
    expect(confirm().props.accessibilityState.checked).toBe(false);
    await save(); expect(onSave).not.toHaveBeenCalled();
  });

  it('does not send an incomplete route and explains the missing place', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await chooseMode('Od mesta do mesta'); await check(); await save();
    expect(onSave).not.toHaveBeenCalled();
    expect(text()).toContain('Unesite mesto');
    await edit('Odredište — grad ili mesto', 'Beograd');
    await check(); await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ geography: { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad' }, end: { city: 'Beograd' } } }));
  });

  it('switching from stationary to area-based does not submit a hidden starting point', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<NeedLocationForm review={review()} busy={false} uncertain={false} onSave={onSave} />); });
    await chooseMode('Na području');
    await edit('Područje rada — grad ili mesto', 'Beograd');
    await check(); await save();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ geography: { mode: 'AREA_BASED', serviceArea: { city: 'Beograd' } } }));
    expect(onSave.mock.calls[0][0].geography).not.toHaveProperty('start');
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Početna tačka — grad ili mesto' })).toHaveLength(0);
    expect(tree.root.findByProps({ label: 'Dodaj početnu tačku (opciono)' })).toBeTruthy();
  });

  it('shows an existing area-based starting point and removes it only through its explicit control', async () => {
    const onSave = jest.fn(), base = review();
    const loaded: NeedLocationReview = { ...base, value: { ...base.value, geography: {
      mode: 'AREA_BASED', start: { city: 'Novi Sad', area: 'Liman' }, serviceArea: { city: 'Beograd' },
    } } };
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findByProps({ accessibilityLabel: 'Početna tačka — grad ili mesto' }).props.value).toBe('Novi Sad');
    expect(text()).toContain('Liman');
    await openChoice('Početna tačka — dodatni javni opis');
    expect(tree.root.findByProps({ accessibilityLabel: 'Početna tačka — deo grada (opciono)' }).props.value).toBe('Liman');
    await check(); await save();
    expect(onSave.mock.calls[0][0].geography).toEqual(loaded.value.geography);
    await act(async () => tree.root.findByProps({ label: 'Ukloni početnu tačku' }).props.onPress());
    expect(confirm().props.accessibilityState.checked).toBe(false);
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Početna tačka — grad ili mesto' })).toHaveLength(0);
    await check(); await save();
    expect(onSave.mock.calls[1][0].geography).toEqual({ mode: 'AREA_BASED', serviceArea: { city: 'Beograd' } });
  });

  it('preserves confirmed start-only AREA_BASED topology when reopening and confirming its private point', async () => {
    const onSave = jest.fn(), base = review();
    const geography = { mode: 'AREA_BASED' as const, start: { city: 'Novi Sad', area: 'Liman' } };
    const resolvedLocation = { version: 1 as const, binding: { taskCountryCode: 'RS', geography, exactAddress: base.value.exactAddress },
      points: [{ slot: 'start' as const, latitudeE6: 45251234, longitudeE6: 19831234,
        origin: { kind: 'MANUAL_PIN' as const }, address: 'Privatna početna tačka', accessNotes: 'Zvono 2' }] };
    const loaded: NeedLocationReview = { ...base, value: { ...base.value, geography, resolvedLocation } };
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    expect(tree.root.findByType('ResolvedPinMap' as never).props.position).toEqual({ latitude: 45.251234, longitude: 19.831234 });
    expect(text()).not.toContain('Prvo unesite državu i javno mesto');
    act(() => { saveButton().props.onPress(); }); expect(onSave).not.toHaveBeenCalled();
    act(() => { tree.root.findByProps({ label: 'Potvrdi tačku: Polazište' }).props.onPress(); });
    act(() => { confirm().props.onPress(); });
    act(() => { saveButton().props.onPress(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].geography).toEqual(geography);
    expect(onSave.mock.calls[0][0].geography).not.toHaveProperty('serviceArea');
    expect(onSave.mock.calls[0][0].resolvedLocation).toEqual(resolvedLocation);
  });

  it.each(['busy', 'uncertain', 'read-only'] as const)('blocks command submission when %s', async state => {
    const onSave = jest.fn();
    const loaded = review();
    await act(async () => { tree = create(<NeedLocationForm review={loaded} busy={false} uncertain={false} onSave={onSave} />); });
    await check();
    await act(async () => tree.update(<NeedLocationForm review={{ ...loaded, editable: state !== 'read-only' }} busy={state === 'busy'} uncertain={state === 'uncertain'} onSave={onSave} />));
    const button = tree.root.findAll(node => node.type === 'Button' as React.ElementType).find(node => String(node.props.label).includes('lokaciju') || String(node.props.label).includes('sačuvaj mesto'))!;
    expect(button.props.disabled).toBe(true);
    await act(async () => button.props.onPress());
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('actual native Worker location form', () => {
  it('country change clears coordinates and WAITLIST/COMING countries cannot authorize save', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await openChoice('Država rada');
    expect(tree.root.findByProps({ accessibilityLabel: 'Hrvatska' }).props.disabled).toBe(true);
    await chooseMode('Hrvatska'); await check(); await save('Sačuvaj područje rada');
    expect(onSave).not.toHaveBeenCalled();
    await chooseMode('Bosna i Hercegovina');
    expect(confirm().props.accessibilityState.checked).toBe(false);
    await check(); await save('Sačuvaj područje rada');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ operatingCountryCode: 'BA', city: 'Novi Sad', approximatePosition: null }));
  });

  it('requires explicit confirmation and retains coordinates only for the saved city', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await save('Sačuvaj područje rada'); expect(onSave).not.toHaveBeenCalled();
    await check(); await save('Sačuvaj područje rada');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ city: 'Novi Sad', approximatePosition: { latitude: 45.26, longitude: 19.83 } }));
  });

  it('clears old approximate coordinates when the worker enters another city', async () => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await check(); await edit('Grad ili mesto rada', 'Beograd');
    expect(confirm().props.accessibilityState.checked).toBe(false);
    await save('Sačuvaj područje rada'); expect(onSave).not.toHaveBeenCalled();
    await check(); await save('Sačuvaj područje rada');
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ city: 'Beograd', radiusKm: 25, approximatePosition: null }));
  });

  it.each(['0', '201', '1.5', '-1', 'abc'])('rejects invalid radius %s before invoking a command', async radius => {
    const onSave = jest.fn();
    await act(async () => { tree = create(<WorkerLocationForm location={location()} busy={false} uncertain={false} onSave={onSave} />); });
    await edit('Radijus rada u kilometrima', radius); await check(); await save('Sačuvaj područje rada');
    expect(onSave).not.toHaveBeenCalled();
    expect(text()).toContain('ceo broj od 1 do 200');
  });
});
