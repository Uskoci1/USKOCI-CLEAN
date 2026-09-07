import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { PrilikaProjekcija } from '../../contracts/projections';
import type { DiscoveryBrowseState } from '../discoveryBrowse';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return (props: any) => React.createElement('FlatList', props, props.ListHeaderComponent,
      props.data.length ? props.data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, props.renderItem({ item }))) : props.ListEmptyComponent, props.ListFooterComponent);
    return ['View', 'Text', 'Pressable', 'TextInput', 'ActivityIndicator', 'Modal', 'KeyboardAvoidingView', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('phosphor-react-native', () => ({ ArrowLeft: 'Icon', ListBullets: 'Icon', MagnifyingGlass: 'Icon', MapTrifold: 'Icon', SlidersHorizontal: 'Icon', X: 'Icon', ArrowUpRight: 'Icon', Clock: 'Icon', MapPin: 'Icon', Users: 'Icon' }));
jest.mock('../../ui/discovery/DiscoveryMap', () => ({ DiscoveryMap: 'MapRenderer' }));
import { DiscoveryBody } from '../../ui/discovery/DiscoveryBody';

const physical: PrilikaProjekcija = { id: 'a', naslov: 'Dostava punjača', podrucjeTekst: 'Novi Sad', grad: 'Novi Sad', vremeTekst: 'Danas', statusTekst: 'Otvoren',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, uslovi: [], narucilacProfilId: 'public-a', narucilacIme: 'Ana', narucilacOcena: null,
  priblizno: { lat: 45.25, lng: 19.85 }, executionLocationMode: 'POINT_TO_POINT', rezimCene: 'OFFERS' };
const remote: PrilikaProjekcija = { ...physical, id: 'b', naslov: 'Prevod dokumenta', grad: '', podrucjeTekst: 'Daljinski', executionLocationMode: 'REMOTE',
  priblizno: null, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 1500, valuta: 'RSD', prikaz: '1.500 RSD' } };
const base: DiscoveryBrowseState = { items: [physical, remote], initialized: true, nextCursor: { createdAt: '2026-09-07T01:00:00Z', id: 'cursor' }, refreshing: false, loadingMore: false, error: null };
let renderer: ReactTestRenderer;
let state = base;
const refresh = jest.fn(), loadMore = jest.fn(), onOpen = jest.fn(), onOwn = jest.fn(), onNew = jest.fn();
const textOf = (node: ReactTestInstance): string => node.children.map(child => typeof child === 'string' ? child : textOf(child)).join(' ');
const host = (type: string) => renderer.root.findAll(node => node.type === type);
const button = (name: string) => host('Pressable').find(node => node.props.accessibilityLabel === name || textOf(node).trim() === name)!;
const map = () => renderer.root.findByType('MapRenderer' as React.ElementType);
const body = () => <DiscoveryBody state={state} intent="narucilac" refresh={refresh} loadMore={loadMore} onOpen={onOpen} onOwn={onOwn} onNew={onNew} />;
async function press(name: string) { await act(async () => button(name).props.onPress()); }
beforeEach(async () => { jest.clearAllMocks(); state = base; await act(async () => { renderer = create(body()); }); });
afterEach(async () => { await act(async () => renderer.unmount()); });

it('uses the same real items for list/map, retains remote in list and opens the selected ID', async () => {
  expect(button('Otvorite priliku Prevod dokumenta')).toBeDefined();
  await press('Mapa'); expect(map().props.pins.features.map((feature: any) => feature.properties.id)).toEqual(['a']);
  await act(async () => map().props.onSelect('a'));
  await press('Otvorite priliku Dostava punjača'); expect(onOpen).toHaveBeenCalledWith('a');
  await press('Lista'); expect(button('Otvorite priliku Prevod dokumenta')).toBeDefined();
  await press('Mapa'); expect(map().props.selectedId).toBe('a');
});
it('preserves camera, selection and filters when refreshed data returns after detail Back', async () => {
  await press('Mapa'); await act(async () => { map().props.onSelect('a'); map().props.onViewport({ center: [19.8, 45.2], zoom: 12 }); });
  state = { ...base, refreshing: true }; await act(async () => renderer.update(body()));
  state = { ...base, items: [{ ...physical, statusTekst: 'Promenjen' }, remote] }; await act(async () => renderer.update(body()));
  expect(map().props.viewport).toEqual({ center: [19.8, 45.2], zoom: 12 }); expect(map().props.selectedId).toBe('a');
  expect(textOf(button('Otvorite priliku Dostava punjača'))).toContain('Promenjen');
});
it('search filters both views and does not turn a remote task into a pin', async () => {
  await act(async () => host('TextInput')[0].props.onChangeText('prevod'));
  expect(button('Otvorite priliku Dostava punjača')).toBeUndefined(); expect(textOf(renderer.root).replace(/\s+/g, ' ')).toContain('1 od 2 učitanih zadataka');
  await press('Mapa'); expect(map().props.pins.features).toEqual([]);
  await press('Poništite'); expect(map().props.pins.features).toHaveLength(1);
});
it('cancelled filter edits do not apply; confirmation updates the shared set', async () => {
  await press('Filteri');
  await act(async () => host('TextInput').find(node => node.props.accessibilityLabel === 'Grad ili opština')!.props.onChangeText('Beograd'));
  await act(async () => host('Modal')[0].props.onRequestClose());
  expect(button('Otvorite priliku Dostava punjača')).toBeDefined();
  await press('Filteri'); await press('Daljinski'); await press('Prikažite zadatke');
  expect(button('Otvorite priliku Prevod dokumenta')).toBeDefined(); expect(button('Otvorite priliku Dostava punjača')).toBeUndefined();
});
it('retains readable cards on refresh failure and routes each retry to its own operation', async () => {
  state = { ...base, error: 'refresh' }; await act(async () => renderer.update(body()));
  expect(button('Otvorite priliku Dostava punjača')).toBeDefined(); await press('Pokušajte ponovo'); expect(refresh).toHaveBeenCalledTimes(1);
  state = { ...base, error: 'more' }; await act(async () => renderer.update(body()));
  await press('Pokušajte ponovo'); expect(loadMore).toHaveBeenCalledTimes(1);
});
it('has honest empty, provider escape and own-task destinations for requester exploration', async () => {
  await press('Moji zadaci'); expect(onOwn).toHaveBeenCalledTimes(1);
  await press('Mapa'); await act(async () => map().props.onList()); expect(button('Lista').props.accessibilityState.selected).toBe(true);
  state = { ...base, items: [], nextCursor: null }; await act(async () => renderer.update(body()));
  expect(textOf(renderer.root)).toContain('Za sada nema otvorenih zadataka.');
  await press('Meni treba pomoć'); expect(onNew).toHaveBeenCalledTimes(1);
});
it('keeps the load-more accessible name and busy/disabled states while fetching', async () => {
  state = { ...base, loadingMore: true }; await act(async () => renderer.update(body()));
  expect(button('Učitajte još zadataka').props.accessibilityState).toEqual({ busy: true, disabled: true });
  expect(button('Učitajte još zadataka').props.disabled).toBe(true);
});
