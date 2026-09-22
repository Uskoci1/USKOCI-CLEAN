import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../ui/system/tokens';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
import { SettingsAction, SettingsGroup, SettingsInfo, SettingsIntro, SettingsPanel, SettingsRow, SettingsScreen, SettingsText } from '../../ui/settings/SettingsPresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
const brand = () => presses().filter(node => JSON.stringify(node.props.style).includes(sys.color.orange)).map(node => node.props.accessibilityLabel);
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('a settings screen has a spoken header, rows with label, hint and chevron, panels and exactly one brand action', async () => {
  const back = jest.fn(), open = jest.fn(), primary = jest.fn();
  await act(async () => { tree = create(<SettingsScreen title="Privatnost i podaci" onBack={back} footer={<SettingsAction label="Zatvori nalog" onPress={primary} />}>
    <SettingsIntro kicker="Tvoji podaci" title="Šta je javno, šta ostaje tvoje">Kratko objašnjenje.</SettingsIntro>
    <SettingsGroup title="Nalog i podaci">
      <SettingsRow label="Izvoz podataka" detail="Zahtev i preuzimanje svoje kopije." onPress={open} />
      <SettingsRow label="Blokirani korisnici" detail="Tvoja blokiranja." onPress={open} last />
    </SettingsGroup>
    <SettingsPanel><SettingsText variant="heading">Rokovi čuvanja</SettingsText><SettingsInfo title="Poruke">Čuvaju se 12 meseci.</SettingsInfo></SettingsPanel>
    <SettingsAction label="Osveži" kind="secondary" onPress={open} />
  </SettingsScreen>); });
  const copy = texts();
  expect(copy).toContain('Privatnost i podaci'); expect(copy).toContain('Tvoji podaci'); expect(copy).toContain('Nalog i podaci'); expect(copy).toContain('Čuvaju se 12 meseci.');
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.accessibilityRole === 'header' && node.children.includes('Privatnost i podaci'))).toBe(true);
  const row = byLabel('Izvoz podataka'); expect(row.props.accessibilityRole).toBe('button'); expect(row.props.accessibilityHint).toBe('Zahtev i preuzimanje svoje kopije.');
  await act(async () => row.props.onPress()); expect(open).toHaveBeenCalledTimes(1);
  expect(brand()).toEqual(['Zatvori nalog']);
  await act(async () => byLabel('Nazad').props.onPress()); expect(back).toHaveBeenCalledTimes(1);
  expect(copy).not.toMatch(/[A-ZŠĐČĆŽ]{4,}/);
});
