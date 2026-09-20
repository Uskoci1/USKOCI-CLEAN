import { Children, type ReactElement } from 'react';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import TabLayout from '../src/app/(app)/_layout';

// Component configuration tests, not rendered Android/Router or device proof.
jest.mock('expo-router', () => {
  const Tabs = () => null;
  Tabs.Screen = () => null;
  return { Tabs };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: jest.fn() }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'useWindowDimensions' ? mockDimensions : Reflect.get(target, key) });
});
const mockDimensions = jest.fn();
jest.mock('../src/ui/referenceEntry/ReferenceEntryHero', () => ({ CanonicalMark: () => null }));
jest.mock('phosphor-react-native', () => ({
  House: () => null, Package: () => null, Plus: () => null, Handshake: () => null,
  User: () => null, PaperPlaneTilt: () => null, MapTrifold: () => null,
}));

type ScreenProps = { name: string; options: { href?: string | null; title?: string } };
const detailRoutes = [
  'potrebe', 'moje-prijave', 'moje-aktivnosti', 'profil',
  'pregled-nacrta', 'profil/radnik', 'potrebe/[id]/kandidati',
  'potrebe/[id]/pregled', 'prilike/[id]', 'prilike/[id]/prijava',
];

function configuration(bottom = 0, fontScale = 1) {
  jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 24, left: 0, right: 0, bottom });
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 390, height: 844, scale: 3, fontScale });
  const layout = TabLayout();
  const screens = (Children.toArray(layout.props.children) as ReactElement<ScreenProps>[])
    .map((screen) => screen.props);
  return { screens, options: layout.props.screenOptions };
}

function visible() {
  return configuration().screens.filter((screen) => screen.options.href !== null);
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path)
      : entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' ? [path] : [];
  });
}

describe('V3 one-shell navigation and system navigation clearance', () => {
  // Owner decision 1 (2026-09-19) supersedes the two intent-shaped shells of 2026-09-16: the same
  // account owns tasks, applies to others and holds Dogovori on both sides, under one set of tabs.
  it('exposes Početna, the shared map and Dogovori, in that order, for every account', () => {
    expect(visible().map((screen) => screen.name)).toEqual(['index', 'mapa', 'dogovori']);
    expect(visible().map((screen) => screen.options.title)).toEqual(['Početna', 'Mapa', 'Dogovori']);
  });

  it('keeps Zadaci, Prijave and every detail route registered and reachable, but not as tabs', () => {
    const { screens } = configuration();
    for (const name of detailRoutes) {
      const matches = screens.filter((screen) => screen.name === name);
      expect(matches).toHaveLength(1);
      expect(matches[0].options.href).toBeNull();
    }
  });

  it('hides the tab bar under the screens that are one task with one way out', () => {
    // Owner decision, 2026-09-18. A tap along the bottom edge used to leave an unfinished Zadatak,
    // and the bar was not honest either: these screens are pushed, so no tab was ever current.
    const { screens } = configuration();
    const hidden = screens.filter((screen) => (screen.options as { tabBarStyle?: { display?: string } })
      .tabBarStyle?.display === 'none').map((screen) => screen.name).sort();
    // 2026-09-20: the four spine details join them, for the same reason stated one screen later —
    // each already ends in its own sticky action, and on a phone that action and the tab bar stood
    // on top of each other and cut the task description in half.
    expect(hidden).toEqual(['fotografije-zadatka', 'mesto-zadatka', 'nova', 'potrebe/[id]/kandidati',
      'potrebe/[id]/pregled', 'pregled-zadatka', 'prilike/[id]', 'prilike/[id]/prijava']);
    // The three real tabs keep theirs, and so does every settings screen you can leave freely.
    for (const name of ['index', 'mapa', 'dogovori', 'potrebe', 'moje-prijave', 'profil', 'podrska/index']) {
      const screen = screens.find((candidate) => candidate.name === name)!;
      expect((screen.options as { tabBarStyle?: unknown }).tabBarStyle).toBeUndefined();
    }
  });

  it('covers every existing leaf route so Router cannot append unnamed extra tabs', () => {
    const directory = resolve(__dirname, '../src/app/(app)');
    const files = routeFiles(directory).map((path) => relative(directory, path)
      .replace(/\\/g, '/').replace(/\.tsx$/, '')).sort();
    expect(configuration().screens.map((screen) => screen.name).sort()).toEqual(files);
  });

  it('keeps usable controls above the rounded container clearance and no-slide navigation', () => {
    const { options } = configuration();
    expect(options.animation).toBe('none');
    expect(options.tabBarStyle.height - 2 * options.tabBarStyle.padding).toBeGreaterThanOrEqual(48);
    expect(options.tabBarStyle.marginBottom).toBeGreaterThanOrEqual(12);
  });

  it.each([18, 24, 34, 48, 64])('reserves the %s-point bottom inset without shrinking controls', (bottom) => {
    const style = configuration(bottom).options.tabBarStyle;
    expect(style.marginBottom).toBeGreaterThanOrEqual(bottom);
    expect(style.height - 2 * style.padding).toBeGreaterThanOrEqual(48);
  });

  it('gives enlarged labels more space without consuming the system navigation inset', () => {
    const normal = configuration(34).options.tabBarStyle;
    const large = configuration(34, 2).options.tabBarStyle;
    expect(large.height).toBeGreaterThan(normal.height);
    expect(large.marginBottom).toBeGreaterThanOrEqual(34);
    expect(configuration(34, 2).options.tabBarAllowFontScaling).toBe(true);
  });

  it('has no mode to switch: the shell reads no role store and keys nothing on one', () => {
    // `Tabs key={intent}` remounted every screen under the navigator whenever the mode changed.
    const source = readFileSync(resolve(__dirname, '../src/app/(app)/_layout.tsx'), 'utf8');
    expect(source).not.toMatch(/store\/uloga/);
    expect(source).not.toMatch(/<Tabs\s+key=/);
  });
});
