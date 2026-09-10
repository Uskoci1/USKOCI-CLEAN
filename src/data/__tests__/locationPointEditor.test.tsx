import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { LocationPointEditor } from '../../ui/location/LocationPointEditor';
import { createConfiguredLocationResolver, type ConfiguredLocationResolution } from '../configuredLocationResolver';

let mockFocused = true;
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../ui/Button', () => ({ Button: 'Button' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/location/LocationControls', () => ({ LocationField: 'LocationField', locationStyles: { card: {} } }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PinMap' }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});

type Props = React.ComponentProps<typeof LocationPointEditor>;
let tree: ReactTestRenderer;
let props: Props;
const candidate = { label: 'Synthetic private candidate', countryCode: 'RS', position: { latitude: 44.123456, longitude: 20.654321 },
  origin: { kind: 'PROVIDER_CANDIDATE' as const, providerHint: 'approved-provider', candidateHint: 'candidate-1' } };
const proposals: ConfiguredLocationResolution = { status: 'PROPOSALS', candidates: [candidate], requiresConfirmation: true };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const configured = (result: ConfiguredLocationResolution = proposals) => ({ search: jest.fn().mockResolvedValue(result), cancel: jest.fn() });
const buttons = () => tree.root.findAllByType('Button' as React.ElementType);
const button = (label: string) => buttons().find(node => node.props.label === label)!;
const field = (suffix: string) => tree.root.findAllByType('LocationField' as React.ElementType).find(node => node.props.label.endsWith(suffix))!;
const map = () => tree.root.findByType('PinMap' as React.ElementType);
const text = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const press = async (label: string) => { await act(async () => { void button(label).props.onPress(); }); };
const change = async (suffix: string, value: string) => { await act(async () => field(suffix).props.onChangeText(value)); };
async function render(overrides: Partial<Props> = {}) {
  props = { slot: 'start', title: 'Početak', countryCode: 'RS', scopeKey: 'account-incarnation-A/start/1', disabled: false,
    onInvalidate: jest.fn(), onConfirm: jest.fn(), ...overrides };
  await act(async () => { tree = create(<LocationPointEditor {...props} />); });
}
async function update(overrides: Partial<Props> = {}) {
  props = { ...props, ...overrides }; await act(async () => tree.update(<LocationPointEditor {...props} />));
}
beforeEach(() => { mockFocused = true; jest.clearAllMocks(); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('prefills a visible query without automatic lookup and honestly shows unavailable activation', async () => {
  await render({ initialQuery: 'Novi Sad' });
  expect(field('pronađi mesto').props.value).toBe('Novi Sad');
  expect(text()).not.toContain('Pretraga mesta još nije aktivirana');expect(props.onInvalidate).not.toHaveBeenCalled();
  await press('Pronađi na mapi');
  expect(text()).toContain('Pretraga mesta još nije aktivirana');expect(map().props.position).toBeNull();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it('uses the real configured adapter and emits a provider pin only on explicit confirmation, without autofilling address', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, redirected: false, json: async () => ({ candidates: [{
    label: candidate.label, countryCode: 'RS', position: candidate.position, providerHint: candidate.origin.providerHint, candidateId: candidate.origin.candidateHint,
  }] }) });
  const resolver = createConfiguredLocationResolver({ endpoint: 'https://approved.test.invalid/search', providerHint: 'approved-provider' }, fetcher);
  await render({ resolver });
  await change('privatna adresa (opciono)', 'Manually typed private address');
  await change('pronađi mesto', 'Explicitly submitted place');expect(fetcher).not.toHaveBeenCalled();
  await press('Pronađi na mapi');
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ countryCode: 'RS', text: 'Explicitly submitted place' });
  expect(map().props.position).toBeNull();expect(props.onConfirm).not.toHaveBeenCalled();
  await press(`Izaberi predlog: ${candidate.label}`);
  expect(map().props.position).toEqual(candidate.position);
  expect(field('privatna adresa (opciono)').props.value).toBe('Manually typed private address');
  expect(props.onConfirm).not.toHaveBeenCalled();expect(text()).toContain('Izmena tačke još nije potvrđena');
  const confirm = button('Potvrdi tačku: Početak').props.onPress;
  await act(async () => { confirm(); confirm(); });
  expect(props.onConfirm).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 44123456, longitudeE6: 20654321,
    origin: candidate.origin, address: 'Manually typed private address' });
});

it.each(['UNAVAILABLE', 'PROVIDER_ACTIVATION_BLOCKED', 'INVALID_QUERY'] as const)('shows the %s state without inventing a candidate', async status => {
  await render({ resolver: configured({ status }), initialQuery: 'Place' });await press('Pronađi na mapi');
  expect(text()).toContain(status === 'UNAVAILABLE' ? 'Predlozi trenutno nisu dostupni' : status === 'INVALID_QUERY'
    ? 'Unesite mesto i proverite izabranu državu' : 'Pretraga mesta još nije aktivirana');
  expect(map().props.position).toBeNull();expect(button('Potvrdi tačku: Početak').props.disabled).toBe(true);
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it('allows explicit retry after an error and shows a truthful empty result', async () => {
  const resolver = configured({ status: 'UNAVAILABLE' });
  resolver.search.mockResolvedValueOnce({ status: 'UNAVAILABLE' }).mockResolvedValueOnce({ status: 'PROPOSALS', candidates: [], requiresConfirmation: true });
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  expect(resolver.search).toHaveBeenCalledTimes(1);await press('Pokušaj ponovo');
  expect(resolver.search).toHaveBeenCalledTimes(2);expect(text()).toContain('Nema predloga za uneti tekst');
  expect(map().props.position).toBeNull();
});

it('shows loading and ignores a late result after explicit cancellation even if the injected resolver ignores cancel', async () => {
  const result = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValue(result.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  expect(text()).toContain('Tražimo predloge');expect(button('Tražimo mesto…').props.disabled).toBe(true);
  await press('Otkaži pretragu');
  await act(async () => result.resolve(proposals));
  expect(buttons().some(node => node.props.label.startsWith('Izaberi predlog'))).toBe(false);expect(map().props.position).toBeNull();
});

it('text edits retire the selected candidate and reject its retained confirmation callback', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  await press(`Izaberi predlog: ${candidate.label}`);const oldConfirm = button('Potvrdi tačku: Početak').props.onPress;
  await change('pronađi mesto', 'Different place');
  await act(async () => oldConfirm());expect(props.onConfirm).not.toHaveBeenCalled();expect(map().props.position).toBeNull();
});

it('editing private text invalidates pending lookup and an unconfirmed provider pin', async () => {
  const pending = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValueOnce(pending.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  await change('privatna adresa (opciono)', 'Another private address');await act(async () => pending.resolve(proposals));
  expect(buttons().some(node => node.props.label.startsWith('Izaberi predlog'))).toBe(false);
  await press('Pronađi na mapi');await press(`Izaberi predlog: ${candidate.label}`);
  await change('privatne napomene za pristup (opciono)', 'Private note');expect(map().props.position).toBeNull();
  expect(button('Potvrdi tačku: Početak').props.disabled).toBe(true);
});

it('a map move changes the proposed origin to MANUAL_PIN and keeps private fields explicitly entered by the user', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');await press(`Izaberi predlog: ${candidate.label}`);
  await act(async () => map().props.onChoose({ latitude: 45.123456, longitude: 19.654321 }));
  await change('privatne napomene za pristup (opciono)', 'Manual access note');
  await press('Potvrdi tačku: Početak');
  expect(props.onConfirm).toHaveBeenCalledWith({ slot: 'start', latitudeE6: 45123456, longitudeE6: 19654321,
    origin: { kind: 'MANUAL_PIN' }, accessNotes: 'Manual access note' });
});

it('rejects a retained candidate click after cancellation without restoring its position', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  const retained = button(`Izaberi predlog: ${candidate.label}`).props.onPress;await press('Otkaži pretragu');
  await act(async () => retained());expect(map().props.position).toBeNull();expect(props.onConfirm).not.toHaveBeenCalled();
});

it('A-B-A account/point scopes cannot revive old candidates or selected-pin confirmation', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  const retainedCandidate = button(`Izaberi predlog: ${candidate.label}`).props.onPress;
  await press(`Izaberi predlog: ${candidate.label}`);const retainedConfirm = button('Potvrdi tačku: Početak').props.onPress;
  await update({ scopeKey: 'account-B/end/1', slot: 'end' });await update({ scopeKey: 'account-incarnation-A/start/1', slot: 'start' });
  await act(async () => { retainedCandidate(); retainedConfirm(); });
  expect(map().props.position).toBeNull();expect(props.onConfirm).not.toHaveBeenCalled();
});

it('country changes discard a pending result from the old country', async () => {
  const result = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValue(result.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');await update({ countryCode: 'BA' });
  await act(async () => result.resolve(proposals));
  expect(buttons().some(node => node.props.label.startsWith('Izaberi predlog'))).toBe(false);expect(map().props.position).toBeNull();
});

it('blur/refocus clears candidates and prevents retained clicks and confirmation', async () => {
  await render({ resolver: configured(), initialQuery: 'Place' });await press('Pronađi na mapi');
  const retained = button(`Izaberi predlog: ${candidate.label}`).props.onPress;
  await press(`Izaberi predlog: ${candidate.label}`);const oldConfirm = button('Potvrdi tačku: Početak').props.onPress;
  mockFocused = false;await update();expect(map().props.disabled).toBe(true);
  mockFocused = true;await update();
  await act(async () => { retained(); oldConfirm(); });
  expect(map().props.position).toBeNull();expect(field('pronađi mesto').props.value).toBe('');expect(props.onConfirm).not.toHaveBeenCalled();
});

it('a temporary disabled state invalidates an in-flight lookup before the editor is enabled again', async () => {
  const result = deferred<ConfiguredLocationResolution>(), resolver = configured();resolver.search.mockReturnValue(result.promise);
  await render({ resolver, initialQuery: 'Place' });await press('Pronađi na mapi');
  await update({ disabled: true });await update({ disabled: false });await act(async () => result.resolve(proposals));
  expect(buttons().some(node => node.props.label.startsWith('Izaberi predlog'))).toBe(false);expect(map().props.position).toBeNull();
});
