import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { MojaPrijavaProjekcija, NeedDetailProjection } from '../../contracts/projections';
import type { MarketplaceItem } from '../marketplaceView';
import { sys } from '../../ui/system/tokens';
import { LARGE_TEXT_SCALE, NARROW_WIDTH, layoutClassFor } from '../../ui/system/textScale';
import { AMOUNT_SIZE, BESIDE_MAX_AMOUNT, BESIDE_MAX_LINES, BESIDE_MAX_TITLE, CARD_SIDE, HEAD_GAP, INTER_BOLD_ADVANCE, ROOMY_WIDTH, TITLE_SIZE,
  headBeside, textWidth, titleColumn } from '../../ui/v2/cardHeadFit';

/**
 * UI/UX pass, item 1.5 (2026-10-02): the task card and my application's face stack their head, foot and offer ONLY in the
 * resilience cases (`useLayoutClass().stacked`: a window under 340 dp, or text scale 1.3 and up). Before, TaskCard stacked
 * under 380 dp, so on the owner's 361 dp phone the designed layout was never drawn.
 *
 * What this file pins:
 *  1. the evidence that the owner's phone is a `compact` window (the precondition of the item), as arithmetic;
 *  2. which layout each card draws at 320 / 339 / 340 / 361 / 390 / 411 dp and at text scale 1 / 1.15 / 1.3;
 *  3. that what a screen reader hears (`taskSpoken`, `applicationSpoken`, the commands) is the same in every layout;
 *  4. that no amount is cut in the baseline layout, by structure (it keeps its width, never `numberOfLines`) and by a
 *     measured-text estimate from the bundled Inter files. Its limits are named where it is computed;
 *  5. (wave-1 review, MAJOR) that the head puts the price beside the title on a 340 to 379 dp phone only when the title
 *     fits the column the price leaves it, measured with the same Inter widths: no word breaks mid-word, the title takes
 *     two lines at most, the head is never taller than the stacked one. 380 dp and up keep the old gate unchanged.
 */
let mockScale = 1, mockWidth = 411;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: mockWidth, height: 900, scale: 2, fontScale: mockScale });
    return key === 'View' ? 'View' : Reflect.get(target, key);
  } });
});
jest.mock('react-native-reanimated', () => {
  const base = jest.requireActual('../../../__mocks__/react-native-reanimated.js'), React = require('react');
  return { ...base, ReduceMotion: { System: 'system' },
    useSharedValue: (value: number) => {
      const ref = React.useRef(null);
      if (!ref.current) { const box = { value, get: () => box.value, set: (next: number) => { box.value = next; } }; ref.current = box; }
      return ref.current;
    },
    useAnimatedStyle: (factory: () => object) => factory() };
});
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));
jest.mock('phosphor-react-native', () => ({ CaretRight: 'CaretRight', CaretDown: 'CaretDown', Lightning: 'Lightning' }));
import { TaskCard } from '../../ui/v2/TaskCard';
import { ApplicationCard } from '../../ui/v2/ApplicationFace';

const needs = (patch: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection['zahtevi'] => ({ vestine: [], alati: [], vozila: [], dozvole: [],
  bitniUslovi: null, iskustvoGodina: null, potvrdjenIdentitet: false, ...patch });
const detail = (zahtevi: Partial<NeedDetailProjection['zahtevi']> = {}): NeedDetailProjection =>
  ({ kategorija: 'Krečenje', geografija: null, rezimLokacije: 'STATIONARY', zahtevi: needs(zahtevi) });
/** A stranger's task, the kind the Zadaci list is made of: a person, an amount, a place, a time, a vehicle. */
const task = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'need-1', naslov: 'Farbanje dnevne sobe', podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: '24. sep · 17:00', statusTekst: 'Otvoren', uslovi: ['Krečenje'], pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 },
  priblizno: null, narucilacProfilId: 'profile-1', narucilacIme: 'Nikola Petrović', narucilacOcena: '4,8', narucilacBrojOcena: 12,
  rezimCene: 'MY_PRICE', osnovaCene: 'TOTAL', ponudjenaCena: { iznos: 5500, valuta: 'RSD', prikaz: '5.500 RSD' },
  detalji: detail({ vozila: ['Kombi'] }), urgency: { level: 'HITNO', expiresAt: '2099-01-01T00:00:00Z' }, ...patch }) as MarketplaceItem;
/** My own task with applications waiting: no person, a note or a waiting line, the count at the end. */
const mine = (patch: Record<string, unknown> = {}): MarketplaceItem => ({ id: 'mine-1', revizija: 1, naslov: 'Montaža dve police', opis: '', stanje: 'CEKA_PRIJAVE',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: '25. sep · 10:00', podrucjeTekst: 'Grbavica, Novi Sad', uslovi: ['Montaža'],
  brojPrijava: 4, brojPrijavaZaIzbor: 3, rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  detalji: detail(), ...patch }) as MarketplaceItem;
const application = (patch: Partial<MojaPrijavaProjekcija> = {}): MojaPrijavaProjekcija => ({ prijavaId: 'a1', potrebaId: 'n1', potrebaRevizija: 3,
  prijavaRevizija: 3, prijavaVerzija: 1, stanje: 'SUBMITTED', naslov: 'Unos ormara', opis: '', cena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' },
  pokrivaMesta: 2, napomena: 'Donosim trake.', podrucjeTekst: 'Liman, Novi Sad', vremeTekst: '20. sep · 10:00–11:00', dogovorId: null,
  promenjenaPotreba: false, mozePovuci: true, traziPaznju: false, ...patch });
const handlers = () => ({ onTask: jest.fn(), onAgreement: jest.fn(), onWithdraw: jest.fn(), onReview: jest.fn() });

let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => act(async () => { tree = create(element); });
const T_ = 'T' as React.ElementType, VIEW = 'View' as React.ElementType, PRESS = 'Press' as React.ElementType;
const textNode = (value: string) => tree.root.find(node => node.type === T_ && node.props.children === value);
const style = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};
const presses = () => tree.root.findAll(node => node.type === PRESS);
const spoken = () => presses().map(node => [node.props.accessibilityLabel, node.props.accessibilityValue?.text ?? null, node.props.accessibilityHint ?? null]);
/** The foot of the brief (the hairline row with the person and the places): a row, or a column when stacked. */
const briefFoot = () => tree.root.find(node => node.type === VIEW && style(node).borderTopWidth === 1 && style(node).paddingTop === sys.space.md);
beforeEach(() => { mockScale = 1; mockWidth = 411; });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

/** A window and a text scale: what a phone is to the layout. */
const WINDOWS: readonly [width: number, scale: number, stacked: boolean][] = [
  [411, 1, false], [411, 1.15, false], [390, 1, false], [390, 1.15, false], [361.14, 1, false], [361.14, 1.15, false],
  [340, 1, false], [340, 1.15, false], [339.9, 1, true], [320, 1, true],
  [411, 1.3, true], [361.14, 1.3, true], [361.14, 1.2999999523, true], [340, 1.3, true], [320, 1.3, true],
];

describe('the owner\'s phone is a compact window, not a stacked one', () => {
  // Evidence for the precondition of item 1.5 ("if the HONOR's real font scale is already 1.3 or more, this changes
  // nothing"). It is NOT 1.3. Everything below is read from `w5_zadaci.png` (HONOR VKP-NX9, 2026-10-02 00:29, 1264 x 2728 px)
  // and from the code that drew it; the repo's earlier receipts (R16 2026-09-25 and R17-R19, "existing font scale 1.15
  // unchanged"; DEVICE_CHECK 2026-09-22) say the same.
  //  Pixels per dp: the Zadaci list pads its cards 20 dp (`DiscoveryPresentation` list) and the card's left edge is at
  //  x = 70 px; the "Mapa" pill is `minHeight: 48` and is 168 px high. Both give 3.5 px per dp, i.e. 560 dpi.
  //  Window: 1264 / 3.5 = 361.1 dp.
  //  Text scale: the capital P of the 16 sp fact line "Petrovaradin" (Inter Medium, cap height 1490/2048 = 0.7275 em) is 47 px
  //  high. The scales it would have: 1.0 -> 40.7 px, 1.15 -> 46.9 px, 1.3 -> 53.0 px. 47 px is 1.15.
  //  A second, independent witness: `ApplicationFace` stacks its offer only from 1.3 up, and "Moje prijave" on the same
  //  phone (new_mp_sve.png) draws "Tvoja ponuda" beside the amount, so that screen was not at 1.3 either.
  const PX_PER_DP = 560 / 160;
  const CAP_EM = 1490 / 2048;
  const capPx = (sp: number, scale: number) => sp * PX_PER_DP * CAP_EM * scale;

  it('1264 px at 560 dpi is 361 dp, and 47 px of cap height at 16 sp is the 1.15 text scale', () => {
    expect(1264 / PX_PER_DP).toBeCloseTo(361.14, 2);
    expect(70 / PX_PER_DP).toBe(20); expect(168 / PX_PER_DP).toBe(48);
    const measured = 47;
    const nearest = [1, 1.15, 1.3].reduce((best, scale) => Math.abs(capPx(16, scale) - measured) < Math.abs(capPx(16, best) - measured) ? scale : best);
    expect(nearest).toBe(1.15);
    expect(capPx(16, 1.0)).toBeCloseTo(40.7, 1); expect(capPx(16, 1.15)).toBeCloseTo(46.9, 1); expect(capPx(16, 1.3)).toBeCloseTo(53.0, 1);
  });

  it('so its layout class is compact (not stacked) at 1.15, and large only from 1.3', () => {
    expect(layoutClassFor(1264 / PX_PER_DP, 1.15)).toMatchObject({ cls: 'compact', stacked: false });
    expect(layoutClassFor(1264 / PX_PER_DP, 1.3)).toMatchObject({ cls: 'large', stacked: true });
    expect(NARROW_WIDTH).toBe(340); expect(LARGE_TEXT_SCALE).toBe(1.3);
  });
});

describe('the task card stacks only in the resilience cases', () => {
  it.each(WINDOWS)('width %s dp, text scale %s: stacked = %s', async (width, scale, stacked) => {
    mockWidth = width; mockScale = scale;
    await render(<TaskCard item={task({ naslov: 'Montaža police' })} onOpen={jest.fn()} />);
    // The title sits beside the amount (it takes the rest of the row) in the designed layout, and has the whole width when
    // stacked. A short title: whether a LONG one fits beside the price depends on the room, and is pinned further down.
    expect(style(textNode('Montaža police')).flex === 1).toBe(!stacked);
    // The person and the places are one row in the designed layout, and two when stacked.
    expect(style(briefFoot()).flexDirection).toBe(stacked ? 'column' : 'row');
  });

  it.each(WINDOWS)('my own task, width %s dp, text scale %s: the note and the count share a row unless stacked', async (width, scale, stacked) => {
    mockWidth = width; mockScale = scale;
    await render(<TaskCard item={mine({ brojPrijavaZaIzbor: 0 })} onOpen={jest.fn()} />);
    expect(style(briefFoot()).flexDirection).toBe(stacked ? 'column' : 'row');
    expect(textNode('0/2')).toBeTruthy();
  });

  it('a long title, a word instead of an amount or a long amount still stack the head, in every layout (the card\'s own rule, unchanged)', async () => {
    mockWidth = 361.14; mockScale = 1.15;
    const longTitle = 'Prevoz i prenos 4 torbe sa Petrovaradina do centra Novog Sada';
    await render(<TaskCard item={task({ naslov: longTitle })} onOpen={jest.fn()} />);
    expect(style(textNode(longTitle)).flex).toBeUndefined();
    await act(async () => tree.update(<TaskCard item={task({ rezimCene: 'OFFERS' })} onOpen={jest.fn()} />));
    expect(style(textNode('Farbanje dnevne sobe')).flex).toBeUndefined();
    await act(async () => tree.update(<TaskCard item={task({ ponudjenaCena: { iznos: 1250000, valuta: 'RSD', prikaz: '1.250.000 RSD' } })} onOpen={jest.fn()} />));
    expect(style(textNode('Farbanje dnevne sobe')).flex).toBeUndefined();
  });
});

describe('my application\'s face stacks its offer only in the resilience cases', () => {
  it.each(WINDOWS)('width %s dp, text scale %s: stacked = %s', async (width, scale, stacked) => {
    mockWidth = width; mockScale = scale;
    await render(<ApplicationCard row={application()} {...handlers()} />);
    const amount = textNode('4.500 RSD');
    expect(style(amount).textAlign).toBe(stacked ? 'left' : 'right');
    expect(style(amount.parent!.parent!).flexDirection === 'row').toBe(!stacked);
    expect(textNode('Unos ormara').props.numberOfLines).toBe(stacked ? 3 : 2);
  });

  it('the gallery can still force the large layout on a roomy phone, and the phone\'s class decides when nothing is forced', async () => {
    mockWidth = 411; mockScale = 1;
    await render(<ApplicationCard row={application()} large {...handlers()} />);
    expect(style(textNode('4.500 RSD')).textAlign).toBe('left');
    await act(async () => tree.update(<ApplicationCard row={application()} large={false} {...handlers()} />));
    expect(style(textNode('4.500 RSD')).textAlign).toBe('right');
  });
});

describe('what a screen reader hears does not depend on the layout', () => {
  const HEARD_TASK = 'HITNO, 5.500 RSD ukupno, Liman, Novi Sad, 24. sep · 17:00, Potrebno vozilo: Kombi, 0 od 2 mesta popunjeno, Nikola Petrović, ocena 4,8, 12 ocena';
  const HEARD_MINE = '2.000 RSD po osobi, Grbavica, Novi Sad, 25. sep · 10:00, 0 od 2 mesta popunjeno, 3 prijave čekaju izbor';
  const HEARD_APPLICATION = 'Poslata, Liman, Novi Sad, 20. sep · 10:00–11:00, Tvoja ponuda 4.500 RSD ukupno, Dolaze 2 osobe, tvoja poruka: Donosim trake.';

  it.each(WINDOWS)('width %s dp, text scale %s: the command name and every word are the same sentence', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    await render(<TaskCard item={task()} onOpen={jest.fn()} />);
    expect(spoken()).toEqual([['Otvori priliku Farbanje dnevne sobe', HEARD_TASK, null]]);
    await act(async () => tree.update(<TaskCard item={mine()} onOpen={jest.fn()} />));
    expect(spoken()).toEqual([['Otvori Zadatak Montaža dve police', HEARD_MINE, null]]);
    await act(async () => tree.update(<TaskCard item={mine()} onOpen={jest.fn()} onApplications={jest.fn()} />));
    expect(spoken()).toEqual([['Otvori Zadatak Montaža dve police', HEARD_MINE.replace(', 3 prijave čekaju izbor', ''), null],
      ['3 prijave čekaju izbor, Montaža dve police', null, 'Otvara prijave za izbor.']]);
    await act(async () => tree.update(<ApplicationCard row={application()} {...handlers()} />));
    expect(spoken()).toEqual([['Otvori zadatak: Unos ormara', HEARD_APPLICATION, null], ['Povuci prijavu: Unos ormara', null, 'Pre povlačenja te pitamo da potvrdiš.']]);
  });
});

/* ------------------------------------------------------------------------------------------- no amount is cut */

/**
 * Real advance widths of the bundled Inter (`assets/fonts/inter`, a TrueType reader of `head`, `hhea`, `hmtx` and `cmap`
 * only: no dependency, nothing from the network). THE LIMITS of what is computed from it:
 *  - Kerning and the `tnum` substitution (GPOS/GSUB) are not read. Digits are all set at the widest digit advance, which is
 *    what `tabular-nums` does to a column of figures, so an amount is estimated at its widest, never narrower.
 *  - The size is `sp x text scale`, linear. Android 14+ scales large sizes less than linearly (measured on the HONOR at
 *    1.15: 16 sp x 1.154 but 20 sp x ~1.07-1.10), so the estimate is the wider, safe side.
 *  - letterSpacing (negative on amounts) is ignored: again the wider side.
 *  - Padding, border and gap are the code's own numbers (`DiscoveryPresentation` list 20, card border 1, body 20 / 16).
 *    A screen that pads its list differently is not measured here.
 *  - It is arithmetic, not a render: only a phone shows a pixel. 340 dp at 1.15 and 1.29 is the tightest compact window.
 */
type Face = { upm: number; advance: (character: string) => number };
const font = (file: string): Face => {
  const bytes = readFileSync(join(__dirname, '../../../assets/fonts/inter', file));
  const tables: Record<string, number> = {};
  for (let table = 0; table < bytes.readUInt16BE(4); table++) tables[bytes.toString('latin1', 12 + table * 16, 16 + table * 16)] = bytes.readUInt32BE(20 + table * 16);
  const upm = bytes.readUInt16BE(tables.head + 18), metrics = bytes.readUInt16BE(tables.hhea + 34);
  const advanceOf = (glyph: number) => bytes.readUInt16BE(tables.hmtx + 4 * Math.min(glyph, metrics - 1));
  let format12 = -1, format4 = -1;
  for (let sub = 0; sub < bytes.readUInt16BE(tables.cmap + 2); sub++) {
    const at = tables.cmap + bytes.readUInt32BE(tables.cmap + 8 + 8 * sub), format = bytes.readUInt16BE(at);
    if (format === 12) format12 = at; else if (format === 4 && format4 < 0) format4 = at;
  }
  const glyphOf = (code: number): number => {
    if (format12 >= 0) {
      for (let group = 0; group < bytes.readUInt32BE(format12 + 12); group++) {
        const at = format12 + 16 + 12 * group, first = bytes.readUInt32BE(at);
        if (code >= first && code <= bytes.readUInt32BE(at + 4)) return bytes.readUInt32BE(at + 8) + code - first;
      }
      return 0;
    }
    const segments = bytes.readUInt16BE(format4 + 6) / 2, ends = format4 + 14, starts = ends + 2 * segments + 2, deltas = starts + 2 * segments, ranges = deltas + 2 * segments;
    for (let segment = 0; segment < segments; segment++) {
      if (code > bytes.readUInt16BE(ends + 2 * segment)) continue;
      const start = bytes.readUInt16BE(starts + 2 * segment);
      if (code < start) return 0;
      const range = bytes.readUInt16BE(ranges + 2 * segment), delta = bytes.readInt16BE(deltas + 2 * segment);
      if (range === 0) return (code + delta) & 0xffff;
      const glyph = bytes.readUInt16BE(ranges + 2 * segment + range + 2 * (code - start));
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
  return { upm, advance: character => advanceOf(glyphOf(character.codePointAt(0)!)) };
};
const BOLD = font('Inter-Bold.ttf'), MEDIUM = font('Inter-Medium.ttf');
/** The width of `text` in dp at `size` sp and `scale`, with every digit as wide as the widest. */
const widthDp = (face: Face, text: string, size: number, scale: number) => {
  const widest = Math.max(...[...'0123456789'].map(face.advance));
  return [...text].reduce((sum, character) => sum + (/\d/.test(character) ? widest : face.advance(character)), 0) / face.upm * size * scale;
};

describe('no amount is cut in the designed (compact) layout', () => {
  const COMPACT_WINDOWS = WINDOWS.filter(([, , stacked]) => !stacked);
  const WIDTHS = [340, 361, 390, 411], SCALES = [1, 1.15, 1.29];
  // The widest amount the head puts beside the title: `CardHead` stacks above 12 characters, and a price is "N RSD".
  const WIDEST_BESIDE_TITLE = '888.888 RSD';
  // A task card in a list: 20 dp list padding, 1 dp border, 20 dp body padding (14 for `compact`), each side.
  const taskContent = (width: number) => width - 2 * 20 - 2 * 1 - 2 * 20;
  const HEAD_GAP = 12;
  // An application: 20 dp list padding, 1 dp border, 16 dp body padding.
  const applicationContent = (width: number) => width - 2 * 20 - 2 * 1 - 2 * 16;
  const OFFER_GAP = 12;

  it('the widest amount beside a title is never wider than the row, at 340, 361, 390 and 411 dp and text scale 1, 1.15 and 1.29', () => {
    expect(WIDEST_BESIDE_TITLE.length).toBeLessThanOrEqual(12);
    for (const width of WIDTHS) for (const scale of SCALES) {
      const amount = widthDp(BOLD, WIDEST_BESIDE_TITLE, 20, scale);
      expect([width, scale, amount <= taskContent(width) - HEAD_GAP]).toEqual([width, scale, true]);
    }
  });

  it('and the title keeps a column of at least 80 dp (about six letters a line) up to text scale 1.15, so a long title wraps instead of squeezing the amount', () => {
    for (const width of WIDTHS) for (const scale of [1, 1.15]) {
      const column = taskContent(width) - HEAD_GAP - widthDp(BOLD, WIDEST_BESIDE_TITLE, 20, scale);
      expect([width, scale, column >= 80]).toEqual([width, scale, true]);
    }
  });

  it('my offer: the amount and the words "Tvoja ponuda" fit one row (the amount never wraps or shrinks), at every compact width', () => {
    // The amount is `valueStyles.amount`, 17 sp bold; the words are a 24 dp drawing slot, 8 dp, and one 16 sp word per line
    // (they may take two lines), so the room the words need is the widest single word.
    for (const width of WIDTHS) for (const scale of [1, 1.15]) {
      const amount = widthDp(BOLD, '999.999 RSD', 17, scale);
      const words = 24 + 8 + widthDp(MEDIUM, 'ponuda', 16, scale);
      expect([width, scale, amount + OFFER_GAP + words <= applicationContent(width)]).toEqual([width, scale, true]);
    }
  });

  it.each(COMPACT_WINDOWS)('rendered at %s dp, text scale %s: the amount keeps its whole width and is never truncated', async (width, scale) => {
    mockWidth = width; mockScale = scale;
    // A short title that stays beside even the widest price here; a longer one is stacked (and the amount then has the row).
    await render(<TaskCard item={task({ naslov: 'Šetanje psa', ponudjenaCena: { iznos: 888888, valuta: 'RSD', prikaz: WIDEST_BESIDE_TITLE } })} onOpen={jest.fn()} />);
    const amount = textNode(WIDEST_BESIDE_TITLE);
    expect(amount.props.numberOfLines).toBeUndefined();
    expect(style(amount.parent!)).toMatchObject({ flexShrink: 0 }); expect(style(amount.parent!)).not.toHaveProperty('maxWidth');
    expect(style(textNode('Šetanje psa'))).toMatchObject({ flex: 1, minWidth: 0 });
    await act(async () => tree.update(<ApplicationCard row={application({ cena: { iznos: 999999, valuta: 'RSD', prikaz: '999.999 RSD' } })} {...handlers()} />));
    const offer = textNode('999.999 RSD');
    expect(offer.props.numberOfLines).toBeUndefined();
    expect(style(offer.parent!)).toMatchObject({ flexShrink: 0 });
  });
});

describe('the two faces ask the one layout class, not the window', () => {
  it.each(['src/ui/v2/TaskCard.tsx', 'src/ui/v2/ApplicationFace.tsx'])('%s reads useLayoutClass and neither the window width nor a text-scale step', path => {
    const source = readFileSync(join(__dirname, '../../..', path), 'utf8');
    expect(source).toMatch(/useLayoutClass\(\)/);
    expect(source).not.toMatch(/useWindowDimensions|Dimensions\.get/);
    expect(source).not.toMatch(/useTextScale\(\)\s*>=|width\s*<\s*3\d\d/);
  });
});

/* ------------------------------------------------------------------------- the price beside the title only where it fits */

/**
 * Wave-1 review, MAJOR 1: the head's gate (title over 42 characters, or an amount over 12, stacks) was tuned for 380 dp and
 * up, and item 1.5 applied it unchanged from 340 dp, where the title column beside a price is 110 to 160 dp: a tall head and
 * "Petrovaradina" broken in the middle. Below 380 dp the gate now measures the title in the column the price leaves it
 * (`cardHeadFit.ts`). The tests below are PROPERTIES, not copies of the rule: for every width, text scale, title and amount
 * of a grid they compute their own ground truth from the bundled Inter files (a second, independent wrap written here,
 * no slack, the real digit widths of a title) and demand that whenever the card puts the price beside the title, the truth
 * says no word breaks, the title takes at most two lines and the head is not taller than the stacked one. The estimate's
 * limits are in the header of `cardHeadFit.ts`; what they are NOT: a render. Only a phone shows a pixel.
 */
describe('the price stands beside the title only where the title fits the column it leaves', () => {
  /** A title's width: proportional digits (a title is not set in tabular figures), unlike a price. */
  const titleWidth = (text: string, size: number, scale: number) => [...text].reduce((sum, character) => sum + BOLD.advance(character), 0) / BOLD.upm * size * scale;
  /** An independent greedy wrap at spaces: its lines, and whether any one word is wider than the column (it would break). */
  const wrap = (title: string, column: number, scale: number) => {
    let lines = 1, used = 0, broken = false;
    const space = titleWidth(' ', 20, scale);
    for (const word of title.split(' ')) {
      const width = titleWidth(word, 20, scale);
      if (width > column) broken = true;
      if (used === 0) used = width; else if (used + space + width <= column) used += space + width; else { lines++; used = width; }
    }
    return { lines, broken };
  };
  const TITLES = ['Montaža police', 'Farbanje dnevne sobe', 'Pomoć pri nošenju ormara', 'Čišćenje stana posle renoviranja', 'Prevoz nameštaja do Petrovaradina',
    'Električar za zamenu osigurača', 'Selidba garsonjere sa liftom u Novom Sadu', 'Krečenje stana od 80 m² u belo', 'Popravka mašine za veš', 'Dostava paketa',
    'Šetanje psa', 'Bašta: košenje trave', 'Sastavljanje IKEA kreveta', 'Pomoć oko selidbe', 'Čuvanje dece uveče', 'Postavljanje laminata u dnevnoj sobi',
    'Zamena slavine', 'Odvoz građevinskog šuta', 'Hitna popravka vodovoda', 'Instalacija klima uređaja', 'Prenos klavira na treći sprat bez lifta',
    'Nešto', 'Samoprijavljivanje'];
  const PRICES: [amount: string, basis: string | null][] = [['500 RSD', null], ['5.500 RSD', 'ukupno'], ['12.000 RSD', 'po osobi'],
    ['120.000 RSD', 'ukupno'], ['888.888 RSD', 'po osobi']];
  const SNUG_WIDTHS = [340, 345, 350, 361.14, 370, 379.9], SCALES = [1, 1.1, 1.15, 1.2, 1.29];

  it('is, for every width, text scale, title and price, never wrong when it says beside: no broken word, two lines at most, no taller head', () => {
    let beside = 0, total = 0;
    const wrong: string[] = [];
    for (const width of SNUG_WIDTHS) for (const scale of SCALES) for (const [amount, basis] of PRICES) for (const title of TITLES) {
      total++;
      if (!headBeside(title, amount, basis, { width, scale })) continue;
      beside++;
      const content = width - 2 * CARD_SIDE;
      const priceBlock = Math.max(widthDp(BOLD, amount, AMOUNT_SIZE, scale), basis ? widthDp(MEDIUM, basis, 12, scale) : 0);
      const column = content - HEAD_GAP - priceBlock;
      const beside_ = wrap(title, column, scale), stacked = wrap(title, content, scale);
      const lineHeight = 26 * scale;
      const besideHeight = Math.max(beside_.lines * lineHeight, (26 + (basis ? 16 : 0)) * scale), stackedHeight = stacked.lines * lineHeight + 8 + lineHeight;
      const label = `${width} dp x${scale} "${title}" + ${amount}`;
      if (beside_.broken || beside_.lines > BESIDE_MAX_LINES || besideHeight > stackedHeight + 0.001 || column <= 0) wrong.push(label);
    }
    expect(wrong).toEqual([]);
    // Not vacuous: it does put a price beside a title in a good share of the grid, and keeps the long ones stacked.
    expect(beside).toBeGreaterThan(total * 0.2);
    expect(beside).toBeLessThan(total * 0.8);
  });

  it('on the owner\'s phone (361 dp, text scale 1.15) keeps the short titles beside a price and stacks the ones that would break or tower', () => {
    const room = { width: 1264 / (560 / 160), scale: 1.15 };
    for (const title of ['Montaža police', 'Farbanje dnevne sobe', 'Dostava paketa', 'Šetanje psa', 'Nešto']) {
      expect([title, headBeside(title, '5.500 RSD', 'ukupno', room)]).toEqual([title, true]);
    }
    // The review's examples: the 33-character title took four lines with "Petrovaradina" broken; the 32-character one with a
    // six-digit price five lines with "renoviranja" broken; the 41-character one four lines against two stacked.
    for (const [title, amount] of [['Prevoz nameštaja do Petrovaradina', '5.500 RSD'], ['Čišćenje stana posle renoviranja', '120.000 RSD'],
      ['Selidba garsonjere sa liftom u Novom Sadu', '5.500 RSD'], ['Pomoć pri nošenju ormara', '12.000 RSD'], ['Prenos klavira na treći sprat bez lifta', '2.000 RSD']]) {
      expect([title, amount, headBeside(title, amount, 'ukupno', room)]).toEqual([title, amount, false]);
    }
  });

  it('measures the room the price actually leaves: a longer price leaves the same title less, and a narrower window less again', () => {
    const phone = { width: 361.14, scale: 1.15 };
    expect(titleColumn(phone, '120.000 RSD', 'ukupno')).toBeLessThan(titleColumn(phone, '5.500 RSD', 'ukupno'));
    expect(titleColumn({ width: 340, scale: 1.15 }, '5.500 RSD', 'ukupno')).toBeLessThan(titleColumn(phone, '5.500 RSD', 'ukupno'));
    expect(titleColumn({ width: 361.14, scale: 1.29 }, '5.500 RSD', 'ukupno')).toBeLessThan(titleColumn(phone, '5.500 RSD', 'ukupno'));
    // A title that fits at ordinary text can need the stacked head at the larger one.
    expect(headBeside('Farbanje dnevne sobe', '5.500 RSD', 'ukupno', { width: 340, scale: 1 })).toBe(true);
    expect(headBeside('Farbanje dnevne sobe', '5.500 RSD', 'ukupno', { width: 340, scale: 1.15 })).toBe(false);
  });

  it('keeps 380 dp and up exactly as it was: 42 characters of title and 12 of amount, whatever the title is made of', () => {
    expect([ROOMY_WIDTH, BESIDE_MAX_TITLE, BESIDE_MAX_AMOUNT, BESIDE_MAX_LINES]).toEqual([380, 42, 12, 2]);
    for (const width of [380, 390, 411, 428]) for (const scale of [1, 1.15, 1.29]) {
      for (let titleLength = 1; titleLength <= 60; titleLength++) for (let amountLength = 4; amountLength <= 14; amountLength++) {
        const title = 'W'.repeat(titleLength), amount = '1'.repeat(amountLength);
        expect([width, scale, titleLength, amountLength, headBeside(title, amount, 'ukupno', { width, scale })])
          .toEqual([width, scale, titleLength, amountLength, titleLength <= 42 && amountLength <= 12]);
      }
    }
    // A caller that does not say how much room there is gets the same old gate (the pin's card, a gallery).
    expect(headBeside('x'.repeat(42), '1'.repeat(12), null)).toBe(true);
    expect(headBeside('x'.repeat(43), '1'.repeat(5), null)).toBe(false);
    expect(headBeside('x'.repeat(5), '1'.repeat(13), null)).toBe(false);
  });

  it('is fully stacked under 340 dp and from text scale 1.3 up, whatever the title and the price', () => {
    for (const room of [{ width: 320, scale: 1 }, { width: 339.9, scale: 1 }, { width: 340, scale: 1.3 }, { width: 411, scale: 1.3 }, { width: 361.14, scale: 1.2999999523 },
      { width: 320, scale: 1.3 }]) {
      for (const title of TITLES) for (const [amount, basis] of PRICES) {
        expect([room, title, amount, headBeside(title, amount, basis, room)]).toEqual([room, title, amount, false]);
      }
    }
  });

  /**
   * First look of the wave-1 build on the HONOR (2026-10-02, window 7): Moji zadaci and Zadaci both showed the price "2.000 RSD"
   * on its own line UNDER a two-line green title, and the question was whether the head gate should have put it beside. The
   * answer is in numbers, from the same Inter widths and the independent wrap above:
   *   - "Dostava punjača do Petrovaradina" (32 characters): in the column the price leaves it on a 361 dp phone the title takes
   *     THREE lines at text scale 1 (161 dp) and 1.15 (145 dp), and at 1.15 "Petrovaradina" (159 dp) is wider than the column and
   *     would break mid-word. The stacked head is two lines and the price under it. So stacking is the right answer there, not a
   *     defect. Where there is room (411 dp at scale 1 and 1.15) the same card does put the price beside it.
   *   - the 62-character title takes five to six lines beside a price at 361 dp and four to five at 411: always stacked.
   */
  describe('the two real cards of the first look', () => {
    const FIRST = ['Dostava punjača do Petrovaradina', '2.000 RSD', 'ukupno'] as const;
    const SECOND = ['Prevoz i prenos 4 torbe sa Petrovaradina do centra Novog Sada', '2.000 RSD', 'ukupno'] as const;
    const grid = (): [width: number, scale: number][] => [320, 361.14, 411].flatMap(width => [1, 1.15, 1.3].map(scale => [width, scale] as [number, number]));
    /** What the card must draw, cell by cell: stacked by class under 340 dp and from 1.3 up, measured from 340 to 379 dp, the old gate from 380. */
    const BESIDE_FIRST = new Set(['411/1', '411/1.15']);
    const column = (amount: string, basis: string, width: number, scale: number) =>
      width - 2 * CARD_SIDE - HEAD_GAP - Math.max(widthDp(BOLD, amount, AMOUNT_SIZE, scale), widthDp(MEDIUM, basis, 12, scale));
    const lines = (title: string, width: number, scale: number, available: number) => {
      let used = 0, count = 1, widest = 0;
      const space = titleWidth(' ', 20, scale);
      for (const word of title.split(' ')) {
        const length = titleWidth(word, 20, scale); widest = Math.max(widest, length);
        if (used === 0) used = length; else if (used + space + length <= available) used += space + length; else { count++; used = length; }
      }
      return { count, widest };
    };

    it.each(grid())('at %s dp, text scale %s: the first title is beside its price only in the cells that have the room, the second never', (width, scale) => {
      const key = `${Math.round(width)}/${scale}`;
      expect([key, headBeside(FIRST[0], FIRST[1], FIRST[2], { width, scale })]).toEqual([key, BESIDE_FIRST.has(key)]);
      expect([key, headBeside(SECOND[0], SECOND[1], SECOND[2], { width, scale })]).toEqual([key, false]);
    });

    it('on the owner\'s phone (361 dp, 1.15) the title would break a word or take three lines beside the price, so the stacked head is right', () => {
      const phone = { width: 361.14, scale: 1.15 };
      const available = column(FIRST[1], FIRST[2], phone.width, phone.scale);
      expect(titleColumn(phone, FIRST[1], FIRST[2])).toBeCloseTo(available, 0);
      expect(available).toBeCloseTo(145, 0);
      const beside = lines(FIRST[0], phone.width, phone.scale, available), stacked = lines(FIRST[0], phone.width, phone.scale, phone.width - 2 * CARD_SIDE);
      // "Petrovaradina" alone is wider than the column; beside the price it breaks, and the title takes three lines (two at most are allowed).
      expect(beside.widest).toBeGreaterThan(available); expect(beside.widest).toBeCloseTo(158.8, 0);
      expect(beside.count).toBe(3); expect(beside.count).toBeGreaterThan(BESIDE_MAX_LINES);
      // Stacked it is the two lines the owner saw, with the price on its own line under them.
      expect(stacked.count).toBe(2);
      expect(headBeside(FIRST[0], FIRST[1], FIRST[2], phone)).toBe(false);
    });

    it('at ordinary text (361 dp, 1.0) the column is 161 dp and the title still takes three lines beside the price: stacked as well', () => {
      const phone = { width: 361.14, scale: 1 };
      const available = column(FIRST[1], FIRST[2], phone.width, phone.scale);
      expect(available).toBeCloseTo(161, 0);
      expect(lines(FIRST[0], phone.width, phone.scale, available)).toMatchObject({ count: 3 });
      expect(headBeside(FIRST[0], FIRST[1], FIRST[2], phone)).toBe(false);
    });

    it('where there is room (411 dp, 1.15) the same card draws the price beside its title, in two lines', async () => {
      const phone = { width: 411, scale: 1.15 };
      expect(lines(FIRST[0], phone.width, phone.scale, column(FIRST[1], FIRST[2], phone.width, phone.scale)).count).toBe(2);
      mockWidth = phone.width; mockScale = phone.scale;
      await render(<TaskCard item={task({ naslov: FIRST[0], rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: FIRST[1] } })} onOpen={jest.fn()} />);
      expect(style(textNode(FIRST[0]))).toMatchObject({ flex: 1, minWidth: 0 });
    });

    it('the Zadaci list\'s compact card never asks the gate (R21, 2026-09-27, "Full-width compact title and value"): its head stacks whatever the room, a short title included', async () => {
      // This is a design decision of the Zadaci list, not the retuned gate: the wave-1 review recorded it ("Zadaci is not affected"). If
      // the owner wants the price beside a short title there too, this is the line to change (`large || compact` in TaskCard) and the
      // gate must then be given the compact card's own side padding (14 dp, not 20): its row is 12 dp wider than Moji zadaci's.
      mockWidth = 411; mockScale = 1;
      await render(<TaskCard item={task({ naslov: 'Montaža police' })} compact onOpen={jest.fn()} />);
      expect(style(textNode('Montaža police')).flex).toBeUndefined();
      await act(async () => tree.update(<TaskCard item={task({ naslov: 'Montaža police' })} onOpen={jest.fn()} />));
      expect(style(textNode('Montaža police')).flex).toBe(1);
    });
  });

  it('draws it on the card: the owner\'s phone keeps a short title beside the price and stacks the long and the tall ones', async () => {
    mockWidth = 361.14; mockScale = 1.15;
    await render(<TaskCard item={task({ naslov: 'Farbanje dnevne sobe' })} onOpen={jest.fn()} />);
    expect(style(textNode('Farbanje dnevne sobe'))).toMatchObject({ flex: 1, minWidth: 0 });
    for (const naslov of ['Prevoz nameštaja do Petrovaradina', 'Selidba garsonjere sa liftom u Novom Sadu', 'Pomoć pri nošenju ormara']) {
      await act(async () => tree.update(<TaskCard item={task({ naslov })} onOpen={jest.fn()} />));
      expect([naslov, style(textNode(naslov)).flex]).toEqual([naslov, undefined]);
    }
    await act(async () => tree.update(<TaskCard item={task({ naslov: 'Čišćenje stana posle renoviranja', ponudjenaCena: { iznos: 120000, valuta: 'RSD', prikaz: '120.000 RSD' } })} onOpen={jest.fn()} />));
    expect(style(textNode('Čišćenje stana posle renoviranja')).flex).toBeUndefined();
    // A narrower window or a larger text size moves the line: the same title that was beside is now stacked.
    mockWidth = 340; mockScale = 1.15;
    await act(async () => tree.update(<TaskCard item={task({ naslov: 'Farbanje dnevne sobe' })} onOpen={jest.fn()} />));
    expect(style(textNode('Farbanje dnevne sobe')).flex).toBeUndefined();
    mockWidth = 340; mockScale = 1;
    await act(async () => tree.update(<TaskCard item={task({ naslov: 'Farbanje dnevne sobe' })} onOpen={jest.fn()} />));
    expect(style(textNode('Farbanje dnevne sobe'))).toMatchObject({ flex: 1 });
  });

  it('draws 380 dp and up as before: a 40-character title beside its price, a 43-character one stacked', async () => {
    const forty = 'Prenos klavira na treći sprat bez lifta', fortyThree = 'Prenos klavira na treći sprat bez lifta i dizalice';
    for (const [width, scale] of [[380, 1], [390, 1.15], [411, 1], [411, 1.29]]) {
      mockWidth = width; mockScale = scale;
      await render(<TaskCard item={task({ naslov: forty })} onOpen={jest.fn()} />);
      expect([width, scale, style(textNode(forty)).flex]).toEqual([width, scale, 1]);
      await act(async () => tree.update(<TaskCard item={task({ naslov: fortyThree })} onOpen={jest.fn()} />));
      expect([width, scale, style(textNode(fortyThree)).flex]).toEqual([width, scale, undefined]);
      await act(async () => tree.unmount());
    }
  });

  it('draws 320 dp and text scale 1.3 fully stacked, for any title: the price has its own row', async () => {
    for (const [width, scale] of [[320, 1], [339.9, 1], [361.14, 1.3], [411, 1.3]]) {
      mockWidth = width; mockScale = scale;
      await render(<TaskCard item={task({ naslov: 'Montaža police' })} onOpen={jest.fn()} />);
      expect([width, scale, style(textNode('Montaža police')).flex]).toEqual([width, scale, undefined]);
      expect(textNode('5.500 RSD').props.numberOfLines).toBeUndefined();
      await act(async () => tree.unmount());
    }
  });

  it('keeps what a screen reader hears the same whichever way the head is drawn', async () => {
    const heard = (width: number, scale: number, naslov: string) => async () => {
      mockWidth = width; mockScale = scale;
      await render(<TaskCard item={task({ naslov })} onOpen={jest.fn()} />);
      const value = presses()[0].props.accessibilityValue.text as string;
      await act(async () => tree.unmount());
      return value;
    };
    const beside = await heard(361.14, 1.15, 'Šetanje psa')(), stacked = await heard(320, 1, 'Šetanje psa')();
    expect(beside).toBe(stacked);
    expect(beside).toContain('5.500 RSD ukupno');
  });

  it('writes the card\'s own numbers once: the estimate measures the sizes, the gap and the padding the card really draws', async () => {
    mockWidth = 361.14; mockScale = 1.15;
    await render(<TaskCard item={task({ naslov: 'Šetanje psa' })} onOpen={jest.fn()} />);
    const title = textNode('Šetanje psa');
    expect(style(title).fontSize).toBe(TITLE_SIZE);
    expect(style(textNode('5.500 RSD')).fontSize).toBe(AMOUNT_SIZE);
    expect(style(title.parent!).gap).toBe(HEAD_GAP);
    expect(style(presses()[0]).padding).toBe(sys.space.lg);
    expect(style(tree.root.findAll(node => node.type === VIEW)[0])).toMatchObject({ borderWidth: 1, padding: 0 });
    const list = readFileSync(join(__dirname, '../../ui/v2/MarketplacePresentation.tsx'), 'utf8');
    expect(list).toMatch(/list:\s*\{\s*paddingHorizontal:\s*20\b/);
    expect(CARD_SIDE).toBe(20 + 1 + sys.space.lg);
  });

  it('knows the width of every glyph it measures: the table is the bundled font, not a copy that drifted', () => {
    for (const [character, units] of Object.entries(INTER_BOLD_ADVANCE)) {
      expect([character, Math.abs(Math.round(BOLD.advance(character) / BOLD.upm * 1000) - units) <= 1]).toEqual([character, true]);
    }
    // And it has every letter of the Serbian Latin alphabet in both cases, the digits and the space.
    for (const character of 'abcdefghijklmnoprstuvzčćšđžABCDEFGHIJKLMNOPRSTUVZČĆŠĐŽ0123456789 ') expect([character, character in INTER_BOLD_ADVANCE]).toEqual([character, true]);
    // The estimate measures like the reader above, apart from the digits of a price (tabular: all as wide as the widest).
    expect(textWidth('Farbanje dnevne sobe', 20)).toBeCloseTo(titleWidth('Farbanje dnevne sobe', 20, 1), 0);
    expect(textWidth('5.500 RSD', 20, true)).toBeCloseTo(widthDp(BOLD, '5.500 RSD', 20, 1), 0);
    // A glyph that is not in the table is taken as wide as the widest, never as nothing.
    expect(textWidth('ß', 20)).toBeGreaterThanOrEqual(textWidth('W', 20));
  });
});
