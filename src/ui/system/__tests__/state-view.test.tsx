import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('../motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { StateView } from '../StateView';
import { SkeletonCard, SkeletonList } from '../Skeleton';
import { V2Action } from '../../v2/V2Action';
import { brandAction } from '../tokens';

/**
 * Empty, loading, error and offline in one look (master design plan, 2026-09-24): a picture in a soft well, one title,
 * one sentence, at most one green action and one quiet one — or, while reading, the placeholders and one sentence.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const texts = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(child => typeof child === 'string');
/** FactArt is memoised, so its drawing is found by what it was asked to draw. */
const pictures = () => tree.root.findAll(node => typeof node.type !== 'string' && typeof node.props.kind === 'string' && typeof node.props.size === 'number');
const art = () => pictures()[0];
const role = (value: string) => tree.root.findAll(node => typeof node.type === 'string' && node.props.accessibilityRole === value);
const actions = () => tree.root.findAllByType(V2Action);

it('says an empty list with its picture, a heading, one sentence and the one way forward', async () => {
  const makeTask = jest.fn(), all = jest.fn();
  await render(<StateView art="tasks" title="Nema aktivnih zadataka" body="Nacrti i završeni zadaci su u svojim prikazima."
    primary={{ label: 'Napravi novi Zadatak', onPress: makeTask }} quiet={{ label: 'Prikaži sve moje zadatke', onPress: all }} />);
  expect(art().props).toMatchObject({ kind: 'tasks', size: 56, muted: false });
  expect(texts()).toEqual(['Nema aktivnih zadataka', 'Nacrti i završeni zadaci su u svojim prikazima.', 'Napravi novi Zadatak', 'Prikaži sve moje zadatke']);
  expect(role('header').map(node => node.props.children)).toEqual(['Nema aktivnih zadataka']);
  const [primary, quiet] = actions();
  expect(StyleSheet.flatten(primary.props.style)).toMatchObject({ backgroundColor: brandAction.backgroundColor });
  expect(quiet.props.kind).toBe('quiet');
  await act(async () => primary.props.onPress()); await act(async () => quiet.props.onPress());
  expect(makeTask).toHaveBeenCalledTimes(1); expect(all).toHaveBeenCalledTimes(1);
});

it('draws the picture in a soft 80 px well', async () => {
  await render(<StateView title="Još nemaš Dogovor" />);
  const well = art().parent!;
  expect(flat(well)).toMatchObject({ width: 80, height: 80 });
  expect(art().props.kind).toBe('tasks');
});

it('draws nothing to press when the screen offers nothing', async () => {
  await render(<StateView art="agreements" title="Još nemaš Dogovor" />);
  expect(actions()).toHaveLength(0);
});

it('announces a read that failed as an alert, with the picture gone grey', async () => {
  const retry = jest.fn();
  await render(<StateView kind="error" art="agreements" title="Dogovore trenutno nije moguće učitati" body="Proveri internet vezu i pokušaj ponovo."
    primary={{ label: 'Pokušaj ponovo', onPress: retry }} />);
  expect(art().props).toMatchObject({ kind: 'agreements', muted: true });
  expect(role('alert').map(node => node.props.children)).toEqual(['Dogovore trenutno nije moguće učitati']);
  expect(role('header')).toHaveLength(0);
  expect(actions().map(action => action.props.label)).toEqual(['Pokušaj ponovo']);
});

it('says "no connection" the same way, with its own quiet picture when the screen names none', async () => {
  await render(<StateView kind="offline" title="Nema internet veze" body="Kada se veza vrati, pokušaj ponovo." />);
  expect(art().props).toMatchObject({ kind: 'info', muted: true });
  expect(role('alert')).toHaveLength(1);
});

it('while reading shows the placeholders in the shape of what is coming and one quiet sentence, and nothing to press', async () => {
  await render(<StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 2, rows: 2 }} primary={{ label: 'Ne', onPress: () => {} }} />);
  expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 2, rows: 2 });
  expect(texts()).toEqual(['Učitavamo Dogovore…']);
  expect(actions()).toHaveLength(0);
  expect(pictures()).toHaveLength(0);
});

// Verifier r3b vc, nit 4: only a task list waits in the task card's shape, with the person's 32 px picture in its foot.
// Every other card (a Prijava, a Dogovor, a detail, legal documents, the export) waits in the plain shape, with no person.
it('waits in the task card\'s shape only where a task list says so; every other card waits plain, with no person', async () => {
  const avatars = () => tree.root.findAll(node => typeof node.type === 'string' && flat(node).width === 32 && flat(node).height === 32);
  await render(<SkeletonCard />);
  expect(avatars()).toHaveLength(0);
  await act(async () => tree.update(<SkeletonCard variant="task" />));
  expect(avatars()).toHaveLength(1);
  await act(async () => tree.update(<StateView kind="loading" title="Učitavamo zadatke…" skeleton={{ variant: 'task' }} />));
  expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 3, variant: 'task' });
  expect(avatars()).toHaveLength(3);
  await act(async () => tree.update(<StateView kind="loading" title="Učitavamo Dogovore…" skeleton={{ count: 2, rows: 2 }} />));
  expect(avatars()).toHaveLength(0);
});
