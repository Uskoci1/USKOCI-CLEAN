import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
import {
  REVIEW_COMMENT_COUNTER_FROM, REVIEW_COMMENT_NOTICE, ReviewCommentField, commentCounter, type ReviewCommentFieldView,
} from '../ReviewCommentField';
import { REVIEW_COMMENT_CLIP_LINES, ReviewCommentText, isLongComment } from '../ReviewCommentText';
import { sys } from '../../system/tokens';

/**
 * The comment field of the rating screen, and the one component that draws a comment anywhere (the receipt and the profile):
 * a collapsed quiet row that keeps the stars-only path as short as it is today, an open field with its counter, and a plain,
 * bounded, never-interpreted text.
 */
let tree: ReactTestRenderer;
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')) as string[];
const input = () => tree.root.findAllByType(TextInput)[0];
const view = (patch: Partial<ReviewCommentFieldView> = {}): ReviewCommentFieldView => ({ value: '', open: false, editable: true, maxLength: 500, count: 0,
  invalid: false, onOpen: jest.fn(), onChange: jest.fn(), ...patch });
const draw = async (field: ReviewCommentFieldView) => { await act(async () => { tree = create(<ReviewCommentField field={field} />); }); };
afterEach(async () => { await act(async () => tree?.unmount()); });

describe('collapsed: one quiet row, so a stars-only rating is as short as it is today', () => {
  it('offers the comment as one optional row and no field', async () => {
    const field = view(); await draw(field);
    const row = tree.root.findByProps({ accessibilityLabel: 'Dodaj komentar' });
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityHint).toContain('Nije obavezno');
    expect(texts()).toContain('Dodaj komentar'); expect(texts()).toContain('Nije obavezno');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(texts()).not.toContain(REVIEW_COMMENT_NOTICE);
    act(() => row.props.onPress());
    expect(field.onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('open: the field, the notice, the counter', () => {
  it('draws a multi-line field with a Serbian label and no row', async () => {
    await draw(view({ open: true, value: 'Odlično.', count: 8 }));
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj komentar' })).toHaveLength(0);
    expect(input().props).toMatchObject({ multiline: true, value: 'Odlično.', editable: true, accessibilityLabel: 'Komentar o saradnji' });
    expect(input().props.maxLength).toBe(1000);
    expect(texts()).toContain('Komentar'); expect(texts()).toContain('Nije obavezno');
  });

  it('says once, before it is sent, that everybody sees the comment on the reviewed person\'s profile with the rating, the name and the photo, and that it is final', async () => {
    await draw(view({ open: true }));
    expect(texts().filter(text => text === REVIEW_COMMENT_NOTICE)).toHaveLength(1);
    expect(REVIEW_COMMENT_NOTICE).toBe('Komentar vide svi na profilu osobe koju ocenjuješ, uz tvoju ocenu, ime i fotografiju. Posle slanja se ne menja.');
    // Plain words in the "ti" voice: no word server, no technical term, and no promise about star-only reviews (README items 6, 16 and 17).
    expect(REVIEW_COMMENT_NOTICE.toLowerCase()).not.toMatch(/server|agregat|anonim|privatn/);
  });

  it('is not said while the field is closed, so the stars-only rating carries no extra sentence', async () => {
    await draw(view());
    expect(texts().filter(text => text.includes('Posle slanja'))).toHaveLength(0);
  });

  it('the keyboard rises when the person opens the field, and not when the field comes back already open (a resume, a remount)', async () => {
    const focus = () => (input() as unknown as { instance: { focus: jest.Mock } }).instance.focus;
    await draw(view());
    await act(async () => { tree.update(<ReviewCommentField field={view({ open: true })} />); });
    expect(focus()).toHaveBeenCalledTimes(1);
    focus().mockClear();
    // Closed again and opened again is another opening; staying open while the text changes is not.
    await act(async () => { tree.update(<ReviewCommentField field={view({ open: true, value: 'x', count: 1 })} />); });
    expect(focus()).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
    await draw(view({ open: true, value: 'Tekst koji je vec tu.', count: 21 }));
    expect(focus()).not.toHaveBeenCalled();
  });

  it('hands every change to the screen, and nothing else', async () => {
    const field = view({ open: true }); await draw(field);
    act(() => input().props.onChangeText('Novi tekst'));
    expect(field.onChange).toHaveBeenCalledWith('Novi tekst');
  });

  it('is not editable while the review is being sent or frozen', async () => {
    await draw(view({ open: true, value: 'x', editable: false }));
    expect(input().props.editable).toBe(false);
  });

  it.each([
    [0, null], [399, null], [REVIEW_COMMENT_COUNTER_FROM, 'Još 100 znakova'], [450, 'Još 50 znakova'], [498, 'Još 2 znaka'], [499, 'Još 1 znak'],
    [500, 'Još 0 znakova'], [501, 'Skrati za 1 znak'], [502, 'Skrati za 2 znaka'], [530, 'Skrati za 30 znakova'],
  ])('the counter at %i code points: %s', async (count, line) => {
    expect(commentCounter(count, 500)).toBe(line);
    await draw(view({ open: true, count }));
    if (line === null) expect(tree.root.findAllByProps({ accessibilityLiveRegion: 'polite' })).toHaveLength(0);
    else {
      expect(texts()).toContain(line);
      expect(tree.root.findAllByProps({ accessibilityLiveRegion: 'polite' }).length).toBeGreaterThan(0);
    }
  });

  it('marks a text the server would refuse with the danger edge, and an ordinary one with the strong rule', async () => {
    await draw(view({ open: true, invalid: true }));
    expect(StyleSheet.flatten(input().props.style).borderColor).toBe(sys.color.danger);
    await act(async () => { tree.update(<ReviewCommentField field={view({ open: true, invalid: false })} />); });
    expect(StyleSheet.flatten(input().props.style).borderColor).not.toBe(sys.color.danger);
  });

  it('never writes below 12 px', async () => {
    await draw(view({ open: true }));
    expect(StyleSheet.flatten(input().props.style).fontSize).toBeGreaterThanOrEqual(12);
    for (const variant of ['body', 'bodyStrong', 'note', 'meta', 'heading']) expect(sys.type[variant as keyof typeof sys.type].fontSize).toBeGreaterThanOrEqual(12);
  });
});

describe('a comment as it is drawn, here and on the profile', () => {
  const textNode = () => tree.root.findAll(node => String(node.type) === 'T' && node.children.length === 1 && typeof node.children[0] === 'string'
    && !['Prikaži ceo komentar', 'Prikaži manje'].includes(node.children[0] as string))[0];
  const drawText = async (text: string) => { await act(async () => { tree = create(<ReviewCommentText text={text} />); }); };

  it('a short comment is drawn whole, with no limit and no control', async () => {
    await drawText('Sve je bilo odlično.');
    expect(textNode().props.numberOfLines).toBeUndefined();
    expect(tree.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0);
  });

  it.each([['a long text', 'a'.repeat(300)], ['many short lines', 'a\nb\nc\nd\ne\nf']])('%s is clipped to a bounded height and can be opened and closed', async (_name, text) => {
    expect(isLongComment(text)).toBe(true);
    await drawText(text);
    expect(textNode().props.numberOfLines).toBe(REVIEW_COMMENT_CLIP_LINES);
    const open = tree.root.findByProps({ accessibilityLabel: 'Prikaži ceo komentar' });
    expect(open.props.accessibilityState).toMatchObject({ expanded: false });
    await act(async () => open.props.onPress());
    expect(textNode().props.numberOfLines).toBeUndefined();
    const close = tree.root.findByProps({ accessibilityLabel: 'Prikaži manje' });
    expect(close.props.accessibilityState).toMatchObject({ expanded: true });
    await act(async () => close.props.onPress());
    expect(textNode().props.numberOfLines).toBe(REVIEW_COMMENT_CLIP_LINES);
  });

  it('a text of 200 characters or less that fits the five lines is never clipped, so nothing is ever hidden without a control', () => {
    expect(isLongComment('a'.repeat(200))).toBe(false);
    expect(isLongComment('a'.repeat(201))).toBe(true);
    // Five lines fit the clip exactly: the control would open to the very same words, so it is not offered. A sixth line is.
    expect(isLongComment('a\nb\nc\nd\ne')).toBe(false);
    expect(isLongComment('a\nb\nc\nd\ne\nf')).toBe(true);
    expect(REVIEW_COMMENT_CLIP_LINES).toBe(5);
  });

  it('is plain text: the exact characters, no links, no markdown, not selectable, no detected data', async () => {
    const raw = 'Vidi https://primer.rs **podebljano** [veza](x) <b>t</b> 011/123-456';
    await drawText(raw);
    const node = textNode();
    expect(node.children).toEqual([raw]);
    expect(node.props.selectable).toBe(false);
    expect(node.props.dataDetectorType).toBe('none');
    expect(node.props.onPress).toBeUndefined();
    expect(node.props.onLongPress).toBeUndefined();
    expect(tree.root.findAll(candidate => typeof candidate.props?.href === 'string' || candidate.props?.accessibilityRole === 'link')).toHaveLength(0);
  });
});
