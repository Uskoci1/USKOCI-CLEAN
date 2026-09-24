import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('../motion', () => ({ useReducedMotion: () => false }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));

import { PillComposer, PillNote } from '../PillComposer';
import { T } from '../../Text';
import { sys } from '../tokens';

/**
 * The pill of Poruke, the AI conversation and the Q&A thread (round 6). The r6 emulator critique measured a line above
 * the capsule ("Odgovor na") 8 dp short of the page gutter: the area insets 12, the page 20. The line takes the step
 * itself, so the capsule keeps its 12 and an empty `above` costs no caller any air.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const flat = (style: unknown): ViewStyle => StyleSheet.flatten(style as StyleProp<ViewStyle>) ?? {};
const pill = (above?: React.ReactNode) => <PillComposer value="" onChange={() => {}} label="Tekst poruke" placeholder="Napiši poruku…"
  sendLabel="Pošalji poruku" canSend={false} reason="Upiši poruku pre slanja." onSend={() => {}} above={above} />;

it('a note above the pill lands on the page gutter while the capsule keeps the area inset', async () => {
  await act(async () => { tree = create(pill(<PillNote>Prvobitna poruka</PillNote>)); });
  const note = tree.root.findAllByType(T).find(node => node.props.children === 'Prvobitna poruka')!;
  expect(flat(note.props.style).paddingHorizontal).toBe(sys.space.sm);
  const area = tree.root.findAll(node => typeof node.type === 'string' && flat(node.props.style).paddingHorizontal === sys.space.md);
  expect(area).toHaveLength(1);
  expect(sys.space.md + sys.space.sm).toBe(sys.space.lg);
});

it('an empty fragment above the pill adds no element, so the capsule sits where it did', async () => {
  await act(async () => { tree = create(pill(<>{null}{false}</>)); });
  const area = tree.root.findAll(node => typeof node.type === 'string' && flat(node.props.style).paddingHorizontal === sys.space.md)[0];
  // The capsule is the area's only child: nothing stands before it to take the area's gap.
  expect(area.children).toHaveLength(1);
});

it('a grey send says why through its hint and a danger note is an alert', async () => {
  await act(async () => { tree = create(pill(<PillNote tone="danger" alert>Poruka je duža od 2.000 znakova.</PillNote>)); });
  const send = tree.root.findAll(node => typeof node.type !== 'string' && node.props.accessibilityLabel === 'Pošalji poruku')[0];
  expect(send.props.disabled).toBe(true);
  expect(send.props.accessibilityHint).toBe('Upiši poruku pre slanja.');
  const note = tree.root.findAllByType(T).find(node => node.props.children === 'Poruka je duža od 2.000 znakova.')!;
  expect(note.props.accessibilityRole).toBe('alert');
  expect(note.props.tone).toBe('danger');
});
