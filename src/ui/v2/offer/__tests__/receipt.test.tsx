import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../../../../contracts/projections';
import { ApplicationComposerPresentation, type ApplicationDraft } from '../../ApplicationComposerPresentation';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../../Press', () => ({ Press: 'Press' }));
jest.mock('../../../system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));

const need: PotrebaProjekcija = {
  id: 'inert-task', revizija: 3, naslov: 'Unos ormara', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: 'Fleksibilno',
  opis: '', stanje: 'CEKA_PRIJAVE', uslovi: [], brojPrijava: 0,
  rezimCene: 'OFFERS', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, taskTimezone: 'Europe/Belgrade',
};
const opportunity: PrilikaProjekcija = { ...need, primaNovePrijave: true, statusTekst: 'Otvoren',
  narucilacProfilId: 'inert-profile', narucilacIme: 'Primer', narucilacOcena: null, priblizno: null };
let tree: ReactTestRenderer | undefined;
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

async function receipt(state: 'confirmed' | 'uncertain', note: string) {
  const submit = jest.fn(), change = jest.fn();
  const draft: ApplicationDraft = { price: '4500', people: '2', note, start: null, end: null };
  await act(async () => {
    tree = create(<ApplicationComposerPresentation need={need} opportunity={opportunity} draft={draft}
      change={change} submit={submit} back={jest.fn()} busy={false} pending uncertain={state === 'uncertain'}
      refresh={jest.fn()} error={null} confirmed={state === 'confirmed'} openApplications={jest.fn()} canSubmit />);
  });
  return { submit, change, draft };
}

it.each(['confirmed', 'uncertain'] as const)('shows the exact frozen message in the %s offer receipt without resending or editing it', async state => {
  const { submit, change, draft } = await receipt(state, '  Donosim trake.\nDolazimo nas dvoje.  ');
  const message = tree!.root.findAll(node => String(node.type) === 'T' && node.props.selectable && node.props.children === 'Donosim trake.\nDolazimo nas dvoje.');
  expect(message).toHaveLength(1);
  expect(tree!.root.findAll(node => String(node.type) === 'TextInput')).toHaveLength(0);
  expect(draft.note).toBe('  Donosim trake.\nDolazimo nas dvoje.  ');
  expect(submit).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled();
});

it('says that no message was included instead of inventing one in the confirmed receipt', async () => {
  await receipt('confirmed', '   ');
  expect(tree!.root.findAll(node => String(node.type) === 'T' && node.props.children === 'Bez dodatne poruke.')).toHaveLength(1);
});

it('does not turn an unknown price mode with no amount into a task seeking offers', async () => {
  const unpriced = { ...need, rezimCene: undefined, ponudjenaCena: undefined };
  await act(async () => {
    tree = create(<ApplicationComposerPresentation need={unpriced} opportunity={{ ...opportunity, ...unpriced }}
      draft={{ price: '', people: '1', note: '', start: null, end: null }} change={jest.fn()} submit={jest.fn()}
      back={jest.fn()} busy={false} pending={false} uncertain={false} refresh={jest.fn()} error={null}
      confirmed={false} openApplications={jest.fn()} canSubmit />);
  });
  const words = tree!.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
  expect(words).toContain('Cena nije navedena');
  expect(words).not.toContain('Tražim ponude');
});
