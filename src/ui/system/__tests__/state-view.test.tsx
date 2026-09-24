import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('../motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { StateView } from '../StateView';
import { SkeletonCard, SkeletonList } from '../Skeleton';
import { V2Action } from '../../v2/V2Action';
import { brandAction, cardCompact, sys } from '../tokens';

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

// Round 6 on the emulator (b4531ef4): the block stood 4 dp past every host's 20 dp gutter and its green action hugged its
// label, while the same command in every footer fills the width. The host pads the gutter; the state pads nothing
// sideways and stretches its children, so the actions take the content width and the 80 px well keeps its own.
it('sits on the host\'s gutter and draws its actions the full width, as every footer primary is drawn', async () => {
  await render(<StateView kind="error" title="Podatke za prijavu trenutno nije moguće učitati." body="Proveri vezu i pokušaj ponovo."
    primary={{ label: 'Pokušaj ponovo', onPress: () => {} }} quiet={{ label: 'Nazad', onPress: () => {} }} />);
  // RN's Jest View is a class around its host node, so the block is found by what it draws, not by counting steps up.
  let block = art().parent!;
  while (flat(block).paddingVertical === undefined) block = block.parent!;
  expect(flat(block)).toMatchObject({ alignItems: 'stretch', paddingVertical: sys.space.xxl });
  expect(flat(block).paddingHorizontal).toBeUndefined();
  const [primary, quiet] = actions();
  expect(StyleSheet.flatten(primary.props.style)).toMatchObject({ backgroundColor: brandAction.backgroundColor, minHeight: brandAction.minHeight });
  for (const action of [primary, quiet]) expect(StyleSheet.flatten(action.props.style)?.alignSelf).toBeUndefined();
  expect(flat(art().parent!)).toMatchObject({ width: 80 });
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

// Review r4 item 3: a retry the screen is already running greys out instead of looking pressable.
it('greys out an action the screen is already at work on, and leaves the other one alone', async () => {
  await render(<StateView kind="error" title="Prijave trenutno nisu dostupne" primary={{ label: 'Pokušaj ponovo', onPress: () => {}, disabled: true }}
    quiet={{ label: 'Nazad', onPress: () => {} }} />);
  const [retry, back] = actions();
  expect(retry.props.disabled).toBe(true);
  expect(back.props.disabled).toBeFalsy();
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

// Round 6 on the emulator (b4531ef4): the Q&A thread, the Izmene terms, the composer's task face and the rating screen
// all waited in a card with a person that never arrived. Each flat screen now waits in its own flat shape, and only the
// publish preview keeps a card, without the foot.
describe('the placeholders of the flat screens', () => {
  const host = (node: ReactTestInstance) => typeof node.type === 'string';
  const frames = () => tree.root.findAll(node => host(node) && flat(node).borderWidth === 1 && flat(node).borderColor === cardCompact.borderColor);
  const avatars = () => tree.root.findAll(node => host(node) && flat(node).width === 32 && flat(node).height === 32);
  const blocks = (size: number) => tree.root.findAll(node => host(node) && flat(node).width === size && flat(node).height === size);

  it.each(['face', 'thread', 'facts', 'person'] as const)('%s draws no card frame and no list person', async variant => {
    await render(<SkeletonCard variant={variant} rows={3} />);
    expect(frames()).toHaveLength(0);
    expect(avatars()).toHaveLength(0);
  });

  it('the preview keeps the compact card with the head and its facts, and nothing under them', async () => {
    await render(<SkeletonCard variant="preview" rows={3} />);
    expect(frames()).toHaveLength(1);
    expect(blocks(16)).toHaveLength(3);
    expect(avatars()).toHaveLength(0);
  });

  it('the face is the same head and facts, bare, over the composer\'s hairline', async () => {
    await render(<SkeletonCard variant="face" rows={3} />);
    const root = tree.root.findAll(host)[0];
    expect(flat(root)).toMatchObject({ borderBottomWidth: 1, paddingBottom: 20 });
    expect(blocks(16)).toHaveLength(3);
  });

  it('a thread item is the question, the answer behind its rule, and a hairline above; the list adds no gap of its own', async () => {
    await render(<SkeletonList count={3} variant="thread" />);
    const items = tree.root.findAll(node => host(node) && flat(node).borderTopWidth === StyleSheet.hairlineWidth);
    expect(items).toHaveLength(3);
    const rules = tree.root.findAll(node => host(node) && flat(node).borderLeftWidth === 3);
    expect(rules).toHaveLength(3);
    expect(flat(tree.root.findAll(host)[0]).gap).toBeUndefined();
  });

  it('the facts are 24 px drawings beside a label and a value, one row per fact', async () => {
    await render(<SkeletonCard variant="facts" rows={3} />);
    expect(blocks(24)).toHaveLength(3);
  });

  it('the person is a 56 px face, five star blanks and the tag pills', async () => {
    await render(<SkeletonCard variant="person" />);
    expect(blocks(56)).toHaveLength(1);
    expect(blocks(40)).toHaveLength(5);
    expect(tree.root.findAll(node => host(node) && flat(node).height === 48 && flat(node).borderRadius === sys.radius.pill)).toHaveLength(4);
  });

  it('the state view forwards the variant to the list', async () => {
    await render(<StateView kind="loading" title="Učitavamo pitanja…" skeleton={{ count: 3, variant: 'thread' }} />);
    expect(tree.root.findByType(SkeletonList).props).toMatchObject({ count: 3, variant: 'thread' });
    expect(frames()).toHaveLength(0);
  });
});
