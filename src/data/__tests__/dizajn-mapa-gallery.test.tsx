import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { discoveryShown, initialMarketplaceView, pinPlaces, publicPoint, type MarketplaceView } from '../marketplaceView';
import type { DiscoveryPresentationProps } from '../../ui/v2/DiscoveryPresentation';

let mockPackage: string | undefined = 'rs.uskoci.dev';
let mockParams: { count?: unknown; detail?: unknown } = {};
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/v2/DiscoveryPresentation', () => ({ DiscoveryPresentation: 'Discovery' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
import Gallery from '../../app/dizajn-mapa';

let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Gallery />); });
const discovery = () => tree.root.findByType('Discovery' as React.ElementType).props as DiscoveryPresentationProps;
const press = async (label: string) => act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
const words = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
beforeEach(() => { mockPackage = 'rs.uskoci.dev'; mockParams = {}; jest.clearAllMocks(); mockRouter.canGoBack.mockReturnValue(true); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test.each([undefined, 'rs.uskoci', 'rs.uskoci.app.dev', 'other.dev'])(
  'does not mount the map or fixture dataset outside the exact internal package (%s)', async packageName => {
    mockPackage = packageName; mockParams = { count: '1000' }; await render();
    expect(tree.root.findAllByType('Discovery' as React.ElementType)).toHaveLength(0);
    expect(words()).toContain('Nije dostupno.');
  },
);

test.each([{ count: '1001' }, { count: '01' }, { count: ['1000'] }, { count: '1', detail: '1' },
  { count: '1000', detail: '1000' }, { count: '1000', detail: '-1' }, { count: '1000', detail: '02' }, { detail: ['0'] }])(
  'rejects malformed or out-of-range scene input before rendering Discovery: %j', async params => {
    mockParams = params; await render();
    expect(tree.root.findAllByType('Discovery' as React.ElementType)).toHaveLength(0);
    expect(words()).toContain('Nepoznat prikaz galerije.');
  },
);

test('one-row entry uses the real component with a public point, no image resource and only local callbacks', async () => {
  mockParams = { count: '1' }; await render();
  const p = discovery(), row = p.items[0];
  expect(p.items).toHaveLength(1); expect(publicPoint(row)).not.toBeNull();
  expect(p.loading).toBe(false); expect(p.error).toBe(false);
  expect(row).toMatchObject({ narucilacAvatarId: null, narucilacOcena: null, narucilacBrojOcena: null });
  expect(p.relations?.relation(row.id)).toEqual({ kind: 'NONE' });
  await act(async () => { p.onProfile(); p.onRefresh(); });
  expect(mockRouter.push).not.toHaveBeenCalled(); expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(words()).toContain('DEV · 1 zadatak · bez baze');
});

test('1,000 deterministic rows cover real local filtering/cluster shapes without media, profiles or invented review scores', async () => {
  mockParams = { count: '1000' }; await render();
  const rows = discovery().items;
  expect(rows).toHaveLength(1000); expect(new Set(rows.map(row => row.id)).size).toBe(1000);
  expect(rows.filter(row => publicPoint(row))).toHaveLength(800);
  expect(rows.filter(row => row.detalji?.rezimLokacije === 'REMOTE')).toHaveLength(100);
  expect(rows.filter(row => !publicPoint(row) && row.detalji?.rezimLokacije !== 'REMOTE')).toHaveLength(100);
  expect([...pinPlaces(rows).values()].some(place => place.ids.length > 1)).toBe(true);
  expect(rows.some(row => row.naslov.length > 80)).toBe(true);
  expect(rows.every(row => 'narucilacAvatarId' in row && row.narucilacAvatarId === null
    && row.narucilacOcena === null && row.narucilacBrojOcena === null)).toBe(true);
  const view: MarketplaceView = { ...initialMarketplaceView(), mode: 'map', area: [19.79, 45.20, 19.89, 45.30] };
  const local = discoveryShown(rows, view, undefined);
  expect(local.inArea).toHaveLength(400); expect(local.withoutPoint).toHaveLength(200); expect(local.listed).toHaveLength(600);
  expect(discoveryShown(rows, { ...view, area: [18.8, 42.9, 22.5, 46] }, undefined).listed).toHaveLength(1000);
  const remote = { ...view, where: 'remote' as const, place: 'Novi Sad', pinPlace: 'stale-local-point' };
  expect(discoveryShown(rows, remote, undefined).listed).toHaveLength(100);
  await act(async () => tree.unmount()); await render();
  expect(discovery().items).toEqual(rows);
});

test('opening a row pushes only its bounded local detail; filters/camera/scroll stay in the retained gallery', async () => {
  mockParams = { count: '1000' }; await render();
  const before = discovery(), selected = before.items[731];
  const kept: MarketplaceView = { ...before.view, query: 'Prenos', sheet: 'full', listOffset: 1240,
    viewport: { center: [19.84, 45.25], zoom: 12, bounds: [19.79, 45.20, 19.89, 45.30] } };
  await act(async () => before.onView(kept));
  await act(async () => discovery().onOpen(selected));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/dizajn-mapa', params: { count: '1000', detail: '731' } });
  expect(discovery().view).toEqual(kept);
  expect(discovery().items).toBe(before.items);
  await act(async () => discovery().onOpen({ ...selected, id: 'not-a-gallery-row' }));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  mockParams = { count: '1000', detail: '731' };
  await act(async () => tree.update(<Gallery />));
  expect(tree.root.findAllByType('Discovery' as React.ElementType)).toHaveLength(0);
  expect(words()).toContain(selected.naslov); expect(words()).toContain('LOKALNI PROBNI DETALJ');
  await press('Nazad na probnu mapu'); expect(mockRouter.back).toHaveBeenCalledTimes(1);
  mockRouter.canGoBack.mockReturnValue(false); await press('Nazad na probnu mapu');
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/dizajn-mapa', params: { count: '1000' } });
});

test('has a local safe exit and no direct backend/provider/media dependency or remote fixture source', async () => {
  await render(); mockRouter.canGoBack.mockReturnValue(false); await press('Izađi iz galerije');
  expect(mockRouter.replace).toHaveBeenCalledWith('/dizajn-tabla');
  const code = readFileSync(resolve(__dirname, '../../app/dizajn-mapa.tsx'), 'utf8');
  expect(code).not.toMatch(/(?:import|require).*?(?:supabase|ClientService|AuthorizedPhoto|expo-location|fetch|https?:)/i);
  expect(code).not.toMatch(/\b(?:fetch|rpc|invoke)\s*\(/);
});
