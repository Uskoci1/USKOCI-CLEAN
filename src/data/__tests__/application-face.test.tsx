import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { MojaPrijavaProjekcija, StanjeMojePrijave } from '../../contracts/projections';
import { sys } from '../../ui/system/tokens';

/**
 * The face of my application (owner's step 5c, 2026-09-24): the task card's system with its own purpose, my offer. A
 * status line with a dot and never a coloured card edge; title; where and when; "Tvoja ponuda · ukupno" with the amount
 * in the money colour or a quiet word; the people; my message; and at most ONE foot action, the one the state allows, as a
 * quiet row link beside the body and never a button inside it.
 */
let mockScale = 1;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return key === 'View' ? 'View' : Reflect.get(target, key); } });
});
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/textScale', () => ({ useTextScale: () => mockScale }));
import { ApplicationCard, applicationFoot, applicationStatus, applicationValue, offerPeople, offerSettled } from '../../ui/v2/ApplicationFace';
import { faceStyles } from '../../ui/v2/TaskFace';

const row = (patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({ prijavaId: 'a1', potrebaId: 'n1', potrebaRevizija: 3,
  prijavaRevizija: 3, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Unos ormara', opis: '', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' },
  pokrivaMesta: 2, napomena: 'Donosim trake.', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '20. sep · 10:00–11:00', dogovorId: null,
  promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
/** The row as the server hands each state over: withdrawal only on an open application, a Dogovor only once chosen. */
const inState = (stanje: StanjeMojePrijave, patch: Partial<MojaPrijavaProjekcija> = {}) => row({ stanje,
  mozePovuci: ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(stanje), dogovorId: stanje === 'SELECTED' ? 'g1' : null,
  traziPaznju: stanje === 'SELECTED' || stanje === 'STALE_REVIEW_REQUIRED', ...patch });

let tree: ReactTestRenderer;
const handlers = () => ({ onTask: jest.fn(), onAgreement: jest.fn(), onWithdraw: jest.fn(), onReview: jest.fn() });
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const texts = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter((child): child is string => typeof child === 'string'));
const textNode = (value: string) => tree.root.find(node => node.type === ('T' as React.ElementType) && node.props.children === value);
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const presses = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType));
const frame = () => tree.root.findAll(node => node.type === ('View' as React.ElementType))[0];
beforeEach(() => { mockScale = 1; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

describe('the status line', () => {
  const WORDS: [StanjeMojePrijave, string][] = [['SUBMITTED', 'Poslata'], ['VIEWED', 'Pregledana'], ['SHORTLISTED', 'U užem izboru'],
    ['SELECTED', 'Izabrana'], ['STALE_REVIEW_REQUIRED', 'Potrebna nova provera'], ['WITHDRAWN', 'Povučena'], ['CLOSED', 'Zatvorena']];
  it.each(WORDS)('%s says "%s" first, with a dot, and the card edge is the one hairline of every card', async (state, word) => {
    await render(<ApplicationCard row={inState(state)} {...handlers()} />);
    expect(texts()[0]).toBe(word);
    expect(tree.root.findAllByProps({ testID: 'card-status-dot' })).toHaveLength(1);
    // The selected (or waiting) state is said by the line, never by a green or orange card edge.
    expect(style(frame())).toMatchObject({ borderColor: sys.color.cardLine, borderWidth: 1 });
    expect(style(frame())).not.toHaveProperty('borderLeftColor');
  });

  it('never says "Odbijena" or names the task as closed: CLOSED merges not chosen, expired and a closed task', () => {
    expect(applicationStatus('CLOSED').text).toBe('Zatvorena');
    for (const [state] of WORDS) expect(applicationStatus(state).text).not.toMatch(/Odbijena|Zadatak/);
  });

  it('a chosen application reads green and a waiting one warns once, with the one orange dot in its foot; one that is over is quiet', async () => {
    await render(<ApplicationCard row={inState('SELECTED')} {...handlers()} />);
    expect(style(textNode('Izabrana')).color).toBe(sys.color.green);
    await render(<ApplicationCard row={inState('STALE_REVIEW_REQUIRED')} {...handlers()} />);
    // Review r4 item 6 (was: the status line in warn with an orange dot, and the foot the same again). The status is
    // said once in ink; the foot carries the card's one orange dot and the warn words (R1 A13, B1).
    expect(style(textNode('Potrebna nova provera')).color).toBe(sys.color.ink);
    expect(style(tree.root.findByProps({ testID: 'card-status-dot' })).backgroundColor).toBe(sys.color.ink);
    expect(tree.root.findAll(node => node.type === ('View' as React.ElementType) && style(node).backgroundColor === sys.color.orange)).toHaveLength(1);
    expect(style(textNode('Pregledaj izmene zadatka')).color).toBe(sys.color.warn);
    await render(<ApplicationCard row={inState('WITHDRAWN')} {...handlers()} />);
    expect(style(textNode('Povučena')).color).toBe(sys.color.muted);
  });
});

describe('the one foot action', () => {
  const CASES: [string, MojaPrijavaProjekcija, boolean, string | null][] = [
    ['sent', inState('SUBMITTED'), false, 'Povuci prijavu: Unos ormara'],
    ['viewed', inState('VIEWED'), false, 'Povuci prijavu: Unos ormara'],
    ['shortlisted', inState('SHORTLISTED'), false, 'Povuci prijavu: Unos ormara'],
    ['sent, but the server no longer lets it be withdrawn', inState('SUBMITTED', { mozePovuci: false }), false, null],
    ['chosen, with its Dogovor', inState('SELECTED'), false, 'Otvori Dogovor: Unos ormara'],
    ['chosen, the Dogovor not yet there', inState('SELECTED', { dogovorId: null }), false, null],
    // Review r4 item 1: the spoken name starts with the visible words (WCAG 2.5.3); it was "Pregledaj izmene: …".
    ['waiting for a new check', inState('STALE_REVIEW_REQUIRED'), false, 'Pregledaj izmene zadatka: Unos ormara'],
    ['waiting for a new check, review already open', inState('STALE_REVIEW_REQUIRED'), true, null],
    ['withdrawn', inState('WITHDRAWN'), false, null],
    ['closed', inState('CLOSED'), false, null],
  ];
  it.each(CASES)('%s: the body opens the task, and the foot holds exactly the one action its state allows', async (_name, application, expanded, foot) => {
    await render(<ApplicationCard row={application} expanded={expanded} {...handlers()} />);
    expect(presses().map(node => node.props.accessibilityLabel)).toEqual(['Otvori zadatak: Unos ormara', ...(foot ? [foot] : [])]);
  });

  it('the foot is a sibling of the body, never a target inside it, and each action reaches its own command only', async () => {
    const each = { sent: handlers(), chosen: handlers(), stale: handlers() };
    await render(<ApplicationCard row={inState('SUBMITTED')} {...each.sent} />);
    const [body, foot] = presses();
    expect(body.findAll(node => node.type === ('Press' as React.ElementType))).toHaveLength(1);
    expect(foot.parent).toBe(body.parent);
    await act(async () => foot.props.onPress());
    expect(each.sent.onWithdraw).toHaveBeenCalledTimes(1);
    expect(each.sent.onTask).not.toHaveBeenCalled(); expect(each.sent.onAgreement).not.toHaveBeenCalled();
    await act(async () => body.props.onPress()); expect(each.sent.onTask).toHaveBeenCalledTimes(1);

    await render(<ApplicationCard row={inState('SELECTED')} {...each.chosen} />);
    await act(async () => presses()[1].props.onPress());
    expect(each.chosen.onAgreement).toHaveBeenCalledTimes(1); expect(each.chosen.onWithdraw).not.toHaveBeenCalled();

    await render(<ApplicationCard row={inState('STALE_REVIEW_REQUIRED')} {...each.stale} />);
    await act(async () => presses()[1].props.onPress());
    expect(each.stale.onReview).toHaveBeenCalledTimes(1); expect(each.stale.onWithdraw).not.toHaveBeenCalled();
  });

  it('is a quiet row link on the card\'s white (the waiting one on the wash strip), with 48 px of touch and no fill of its own', async () => {
    await render(<ApplicationCard row={inState('SUBMITTED')} {...handlers()} />);
    const withdraw = presses()[1];
    expect(withdraw.props.style).toBe(faceStyles.footLink);
    expect(style(withdraw)).not.toHaveProperty('backgroundColor');
    expect(style(withdraw).minHeight).toBeGreaterThanOrEqual(48);
    // Review r4 item 7 (was: danger red on every open card). Withdrawing is rare, so the link is quiet ink; the danger
    // colour stays in the question it opens (the screen's ConfirmSheet, tone "danger").
    expect(style(textNode('Povuci prijavu')).color).toBe(sys.color.ink);
    await render(<ApplicationCard row={inState('SELECTED')} {...handlers()} />);
    expect(style(textNode('Otvori Dogovor')).color).toBe(sys.color.green);
    await render(<ApplicationCard row={inState('STALE_REVIEW_REQUIRED')} {...handlers()} />);
    expect(presses()[1].props.style).toBe(faceStyles.ownerFoot);
    expect(style(textNode('Pregledaj izmene zadatka')).color).toBe(sys.color.warn);
  });

  it('while a command runs nothing can be pressed, and the link turns muted instead of fading the card', async () => {
    await render(<ApplicationCard row={inState('SUBMITTED')} disabled {...handlers()} />);
    for (const node of presses()) { expect(node.props.disabled).toBe(true); expect(node.props.accessibilityState).toEqual({ disabled: true }); }
    expect(style(textNode('Povuci prijavu')).color).toBe(sys.color.muted);
    expect(style(frame())).not.toHaveProperty('opacity');
  });

  it('the rule itself: review first for a changed task, a Dogovor only with its id, withdrawal only on the server\'s flag', () => {
    expect(applicationFoot(inState('STALE_REVIEW_REQUIRED', { mozePovuci: true }))).toBe('review');
    expect(applicationFoot(inState('STALE_REVIEW_REQUIRED'), true)).toBeNull();
    expect(applicationFoot(inState('SELECTED', { mozePovuci: true }))).toBe('agreement');
    expect(applicationFoot(inState('SELECTED', { dogovorId: null, mozePovuci: true }))).toBeNull();
    expect(applicationFoot(inState('CLOSED'))).toBeNull();
    expect(applicationFoot(inState('WITHDRAWN'))).toBeNull();
  });
});

describe('my offer', () => {
  it('says "Tvoja ponuda" and the amount in the money colour, weight and tabular figures, its currency kept, "ukupno" under it as a word', async () => {
    await render(<ApplicationCard row={row()} {...handlers()} />);
    expect(texts()).toContain('Tvoja ponuda');
    expect(style(textNode('4.500 RSD'))).toMatchObject({ color: sys.color.money, fontWeight: '700', fontVariant: ['tabular-nums'] });
    // What the amount buys is a word: it never wears the money colour or weight.
    expect(style(textNode('ukupno'))).toMatchObject({ color: sys.color.muted, fontWeight: '500' });
    expect(textNode('ukupno').parent).toBe(textNode('4.500 RSD').parent);
    expect(texts()).toContain('Dolaze 2 osobe');
  });

  it('a missing amount is a quiet word, never drawn as money, and no amount on the card wears the money colour', async () => {
    for (const cena of [{ iznos: 0, valuta: 'RSD', prikaz: '' }, { iznos: Number.NaN, valuta: 'RSD', prikaz: 'NaN RSD' }, { iznos: 3000, valuta: 'RSD', prikaz: ' ' }]) {
      await render(<ApplicationCard row={row({ cena })} {...handlers()} />);
      expect(applicationValue({ cena })).toEqual({ kind: 'unpriced' });
      expect(texts()).toContain('Tvoja ponuda'); expect(texts()).not.toContain('ukupno');
      const word = style(textNode('Cena nije navedena'));
      expect(word.color).toBe(sys.color.muted); expect(word.color).not.toBe(sys.color.money); expect(word.fontWeight).not.toBe('700');
      expect(tree.root.findAll(node => node.type === ('T' as React.ElementType) && style(node).color === sys.color.money)).toHaveLength(0);
    }
  });

  it('the people follow Serbian counts, and my message is shown in quotes in two lines at most', async () => {
    expect(offerPeople(1)).toBe('Dolazi 1 osoba'); expect(offerPeople(3)).toBe('Dolaze 3 osobe'); expect(offerPeople(12)).toBe('Dolazi 12 osoba');
    await render(<ApplicationCard row={row({ napomena: '  Donosim trake.  ' })} {...handlers()} />);
    expect(textNode('„Donosim trake.“').props.numberOfLines).toBe(2);
    await render(<ApplicationCard row={row({ napomena: '   ' })} {...handlers()} />);
    expect(texts().some(text => text.startsWith('„'))).toBe(false);
  });

  // Review r4 item 2: nobody comes for an application that is over, so it says how many it offered, not "Dolaze".
  // Verify r4b item A adds SELECTED: the read carries no Dogovor state, so a chosen offer whose Dogovor is finished
  // cannot say that someone is coming (seen on the emulator); "Otvori Dogovor" holds the live facts.
  it.each([['WITHDRAWN', 'Povučena'], ['CLOSED', 'Zatvorena'], ['SELECTED', 'Izabrana']] as const)('%s says the people it offered, never that they are coming', async (state, word) => {
    expect(offerPeople(2, true)).toBe('2 osobe'); expect(offerPeople(1, true)).toBe('1 osoba');
    expect(offerSettled(state)).toBe(true);
    await render(<ApplicationCard row={inState(state)} {...handlers()} />);
    expect(texts()).toContain('2 osobe');
    expect(texts().some(text => /^Dolaz/.test(text))).toBe(false);
    expect(presses()[0].props.accessibilityValue.text).toBe(`${word}, Liman, Novi Sad, 20. sep · 10:00–11:00, Tvoja ponuda 4.500 RSD ukupno, 2 osobe, tvoja poruka: Donosim trake.`);
  });

  it('every open state still says the people are coming', async () => {
    for (const state of ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED'] as const) {
      expect(offerSettled(state)).toBe(false);
      await render(<ApplicationCard row={inState(state)} {...handlers()} />);
      expect(texts()).toContain('Dolaze 2 osobe');
    }
  });

  it('at large text the amount moves under its words as a whole line on the text column, and the title keeps three lines', async () => {
    mockScale = 1.3;
    await render(<ApplicationCard row={row()} {...handlers()} />);
    const amount = textNode('4.500 RSD');
    expect(style(amount).textAlign).toBe('left');
    // The value's own line starts where the words of every fact line start (16 px drawing + 8 px).
    expect(style(amount.parent!)).toMatchObject({ flexDirection: 'row', marginLeft: 24 });
    expect(style(amount.parent!.parent!).flexDirection).not.toBe('row');
    expect(textNode('Unos ormara').props.numberOfLines).toBe(3);
    mockScale = 1;
    await render(<ApplicationCard row={row()} {...handlers()} />);
    expect(style(textNode('4.500 RSD')).textAlign).toBe('right');
    expect(style(textNode('4.500 RSD').parent!.parent!).flexDirection).toBe('row');
  });
});

it('is heard once: the command name, then status, place, time, the offer, the people and my message', async () => {
  await render(<ApplicationCard row={inState('SELECTED')} {...handlers()} />);
  expect(presses()[0].props.accessibilityValue).toEqual({ text:
    // Verify r4b item A: a chosen offer says the people it offered ("2 osobe"), not "Dolaze 2 osobe".
    'Izabrana, Liman, Novi Sad, 20. sep · 10:00–11:00, Tvoja ponuda 4.500 RSD ukupno, 2 osobe, tvoja poruka: Donosim trake.' });
});
