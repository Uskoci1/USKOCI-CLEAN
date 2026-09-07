import { Children, type ReactElement } from 'react';
import { readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TabLayout from '../src/app/(app)/_layout';
import { useUloga } from '../src/store/uloga';

// Component configuration tests, not rendered Android/Router or device proof.
jest.mock('expo-router', () => {
  const Tabs = () => null;
  Tabs.Screen = () => null;
  return { Tabs };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: jest.fn() }));
jest.mock('../src/store/uloga', () => ({ useUloga: jest.fn() }));
jest.mock('phosphor-react-native', () => ({
  House: () => null, Package: () => null, Plus: () => null, Handshake: () => null,
  User: () => null, PaperPlaneTilt: () => null, MapTrifold: () => null,
}));

type ScreenProps = { name: string; options: { href?: string | null; title?: string } };
const detailRoutes = [
  'pregled-nacrta', 'profil/radnik', 'potrebe/[id]/kandidati',
  'potrebe/[id]/pregled', 'prilike/[id]', 'prilike/[id]/prijava',
];

function configuration(role: 'narucilac' | 'uskocer' = 'narucilac', bottom = 0) {
  jest.mocked(useUloga).mockReturnValue(role);
  jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 24, left: 0, right: 0, bottom });
  const layout = TabLayout();
  const screens = (Children.toArray(layout.props.children) as ReactElement<ScreenProps>[])
    .map((screen) => screen.props);
  return { screens, options: layout.props.screenOptions };
}

function visibleNames(role: 'narucilac' | 'uskocer') {
  return configuration(role).screens.filter((screen) => screen.options.href !== null)
    .map((screen) => screen.name);
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path)
      : entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' ? [path] : [];
  });
}

describe('canonical five-tab layout and system navigation clearance', () => {
  it('retains the exact five Requester destinations in order', () => {
    expect(visibleNames('narucilac')).toEqual(['index', 'potrebe', 'nova', 'dogovori', 'profil']);
  });

  it('retains the exact five Worker destinations in order', () => {
    expect(visibleNames('uskocer')).toEqual(['index', 'moje-prijave', 'prilike', 'dogovori', 'profil']);
  });

  it.each(['narucilac', 'uskocer'] as const)('keeps detail routes registered but hidden for %s', (role) => {
    const { screens } = configuration(role);
    for (const name of detailRoutes) {
      const matches = screens.filter((screen) => screen.name === name);
      expect(matches).toHaveLength(1);
      expect(matches[0].options.href).toBeNull();
    }
  });

  it('covers every existing leaf route so Router cannot append unnamed extra tabs', () => {
    const directory = resolve(__dirname, '../src/app/(app)');
    const files = routeFiles(directory).map((path) => relative(directory, path)
      .replace(/\\/g, '/').replace(/\.tsx$/, '')).sort();
    expect(configuration().screens.map((screen) => screen.name).sort()).toEqual(files);
  });

  it('preserves the zero-inset layout dimensions and no-slide navigation', () => {
    const { options } = configuration();
    expect(options.animation).toBe('none');
    expect(options.tabBarStyle.height).toBe(84);
    expect(options.tabBarStyle.paddingBottom).toBe(18);
  });

  it.each([18, 24, 34, 48, 64])('reserves the %s-point bottom inset without shrinking controls', (bottom) => {
    const style = configuration('narucilac', bottom).options.tabBarStyle;
    expect(style.paddingBottom).toBeGreaterThanOrEqual(bottom);
    expect(style.height - style.paddingBottom).toBe(66);
    expect(style.paddingTop).toBe(8);
  });

  it('does not change the registered route inventory on workspace switching', () => {
    expect(configuration('narucilac').screens.map((screen) => screen.name))
      .toEqual(configuration('uskocer').screens.map((screen) => screen.name));
  });
});
