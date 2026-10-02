import { layoutClassFor, type WindowRoom } from '../system/textScale';
import { sys } from '../system/tokens';

/**
 * Where a task card's price may stand beside its title (UI/UX pass 2026-10-02, wave-1 review, item 1.5).
 *
 * The head draws the price BESIDE the title when the title can live in what is left of the row, and under it otherwise. The
 * old gate was two fixed numbers, 42 characters of title and 12 of amount, tuned on 380 dp and wider phones. Item 1.5 then
 * let every phone from 340 dp up draw the designed layout, the owner's (361 dp, text scale 1.15) among them, and there a
 * 24 to 41 character title beside a price gets a column of 110 to 160 dp: a tall head, and a word like "Petrovaradina"
 * broken in the middle. So from 340 dp to 379 dp the gate is decided from the room itself, by measuring the title in the
 * column the price leaves it. From 380 dp up it is the gate it always was, unchanged.
 *
 * The rule below 380 dp: the title sits beside the price only if
 *  - no word of it is wider than the column (nothing breaks mid-word), and
 *  - it takes at most two lines there (a head is then never taller than the stacked head: two lines, 52 dp at scale 1, are
 *    shorter than a one-line title, 8 dp of gap and the price, 60 dp).
 * An amount is never cut by any of this: it keeps its whole width in either layout and the title is what gives way.
 *
 * THE LIMITS OF THE ESTIMATE (it is arithmetic, not a render; only a phone shows a pixel):
 *  - Widths are the advance widths of the bundled Inter Bold (`INTER_BOLD_ADVANCE`, in thousandths of an em), read from
 *    `assets/fonts/inter/Inter-Bold.ttf` and re-checked against the file by `task-card-layout-class.test.tsx`. Kerning is not
 *    read and neither is the negative letter spacing of the title: both only make real text narrower, so the estimate is
 *    on the wide, safe side. A glyph that is not in the table counts as the widest one.
 *  - The size is `sp x text scale`, linear. Android 14+ scales large sizes less than linearly (measured on the HONOR at
 *    1.15: 16 sp became 18.5, 20 sp only about 21.4 to 22), so at a large scale the estimate is again the wide side.
 *  - A price is set at the width of its widest digit (`tabular-nums`), and what it buys ("ukupno", "po osobi") is measured
 *    in Bold, wider than the Medium it is drawn in.
 *  - Lines break at spaces only. Android also breaks after a hyphen, which can only help.
 *  - Calibration: on the HONOR the same estimate for the price "2.000 RSD" (text scale 1.15) came out 14 % wider than the
 *    ink measured on the phone (ink is a little narrower than the advance, 1 to 2 %, so the rest is real), and that is one
 *    price on one phone. So no extra safety margin is added: the model is on the wide side everywhere it is known to
 *    differ from Android, but that is a measurement of one case, not a proof.
 *  - The card's geometry is the one of a list card: 20 dp of list padding, a 1 dp border and 20 dp of body padding on each
 *    side (`TaskCard` body, Moji zadaci's list), and the head's 12 dp gap. A screen that pads its list differently is not
 *    measured here.
 *  - The gate does not look at the window's height or at the person's display size; the text scale is the whole of it.
 */

/** Advance widths of Inter Bold, in thousandths of an em (`hmtx` through `cmap`), for the glyphs a Serbian title or price uses. */
export const INTER_BOLD_ADVANCE: Readonly<Record<string, number>> = {
  a: 581, b: 630, c: 588, d: 630, e: 596, f: 398, g: 632, h: 623, i: 271, j: 271, k: 580, l: 271, m: 913, n: 623, o: 613, p: 630,
  q: 630, r: 407, s: 560, t: 366, u: 623, v: 600, w: 850, x: 580, y: 602, z: 573, č: 588, ć: 588, š: 560, đ: 630, ž: 573,
  A: 747, B: 662, C: 740, D: 722, E: 607, F: 587, G: 750, H: 747, I: 281, J: 584, K: 719, L: 565, M: 932, N: 762, O: 771, P: 648,
  Q: 777, R: 657, S: 655, T: 667, U: 732, V: 747, W: 1038, X: 738, Y: 731, Z: 664, Č: 740, Ć: 740, Š: 655, Đ: 760, Ž: 664,
  '0': 674, '1': 431, '2': 630, '3': 646, '4': 676, '5': 622, '6': 649, '7': 582, '8': 651, '9': 649,
  ' ': 237, '.': 334, ',': 334, '-': 468, '–': 500, '/': 388, '(': 377, ')': 377, ':': 334, ';': 343, '!': 338, '?': 560, "'": 339,
  '"': 552, '+': 679, '&': 672, '%': 1016, '²': 460, '³': 472, '·': 334, '→': 954,
};
/** The widest glyph of the table (W): what a character that is not in it is taken to be. */
const WIDEST = Math.max(...Object.values(INTER_BOLD_ADVANCE));
/** The widest digit (4): every digit of a price, which is set in tabular figures. */
const WIDEST_DIGIT = Math.max(...'0123456789'.split('').map(digit => INTER_BOLD_ADVANCE[digit]));

/** From this window width up the gate is the one it always was; under it the title is measured. */
export const ROOMY_WIDTH = 380;
/** The old gate, kept for 380 dp and up (and for a caller that does not say how much room there is). */
export const BESIDE_MAX_TITLE = 42;
export const BESIDE_MAX_AMOUNT = 12;
/** A title may take this many lines in the column beside a price. */
export const BESIDE_MAX_LINES = 2;

/** The card's own numbers, written once: `TaskFace` draws the head with them and the test reads them back from the render. */
export const HEAD_GAP = 12;
export const TITLE_SIZE = 20;
export const AMOUNT_SIZE = sys.type.priceSmall.fontSize as number;
export const BASIS_SIZE = 12;
/** One side of a list card: list padding, border, body padding. */
export const CARD_SIDE = sys.space.lg + 1 + sys.space.lg;

/** The width of `text` in dp at `size` dp (already multiplied by the text scale). */
export function textWidth(text: string, size: number, tabular = false): number {
  let units = 0;
  for (const character of text) {
    units += tabular && character >= '0' && character <= '9' ? WIDEST_DIGIT : INTER_BOLD_ADVANCE[character] ?? WIDEST;
  }
  return (units / 1000) * size;
}

/** How many lines `title` takes in a column `column` dp wide at `size` dp, and how wide its widest word is. */
export function wrapTitle(title: string, column: number, size: number): { lines: number; longestWord: number } {
  const space = textWidth(' ', size);
  let lines = 1, used = 0, longestWord = 0;
  for (const word of title.trim().split(/\s+/)) {
    const width = textWidth(word, size);
    longestWord = Math.max(longestWord, width);
    if (used === 0) used = width;
    else if (used + space + width <= column) used += space + width;
    else { lines++; used = width; }
  }
  return { lines, longestWord };
}

/** The dp the title has beside a price: the card's row, less the gap and the price block (its widest line). */
export function titleColumn(room: WindowRoom, amount: string, basis: string | null): number {
  const row = room.width - 2 * CARD_SIDE;
  const priceBlock = Math.max(textWidth(amount, AMOUNT_SIZE * room.scale, true), basis ? textWidth(basis, BASIS_SIZE * room.scale) : 0);
  return row - HEAD_GAP - priceBlock;
}

/**
 * Whether the price stands beside the title. `room` is the window the card is drawn in; without it, or from 380 dp up, it
 * is the gate the card always had. A stacked layout class (a window under 340 dp, text scale 1.3 and up) never has the
 * price beside the title, whatever the title is.
 */
export function headBeside(title: string, amount: string, basis: string | null, room?: WindowRoom): boolean {
  if (amount.length > BESIDE_MAX_AMOUNT) return false;
  if (room && layoutClassFor(room.width, room.scale).stacked) return false;
  if (!room || room.width >= ROOMY_WIDTH) return title.length <= BESIDE_MAX_TITLE;
  const column = titleColumn(room, amount, basis);
  if (!(column > 0)) return false;
  const { lines, longestWord } = wrapTitle(title, column, TITLE_SIZE * room.scale);
  return longestWord <= column && lines <= BESIDE_MAX_LINES;
}
