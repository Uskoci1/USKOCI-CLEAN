import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { elevation, palette, radius, space, touch, type } from '../../theme/tokens';

/**
 * `sys` is the one surface screens and components read for colour, type, space, corners, touch and motion (2026-09-24:
 * the older `theme/tokens`, `aiFirst` and `v2` token files are no longer read by a screen). It may build on the theme
 * scale here, inside the system; nothing outside it imports that scale directly. A nested corner is geometry, not a
 * value, so it is exported beside `sys`.
 */
export { nested } from '../../theme/tokens';

/**
 * One light system for every inner screen (PKG-011, redesigned 2026-09-16 against
 * the V5 AI-FIRST reference: white background, deep green as trust and
 * orientation, orange as the single action signal, cards with a soft V4.9 shadow
 * instead of a wireframe outline). The entry/HOME/mascot keep their own locked
 * assets; this file never restyles them.
 *
 * Colours are the owner's V28 prototype as it renders (decision 2026-09-22, "identičan izgled";
 * V28's colours, icons and navigation are the ones to keep). Measured from computed styles at
 * 412 px: ink #202723 (screen titles), muted #5E6D64, action green #076E4E (primary button with
 * white text, large price), card price #087B57, pale green #EFF6F0 (selected tab), orange #FA8229
 * with dark ink #30200F ("+"), orange-soft #FFF5E9, hairline #EBEEEA, card edge #D8DED7.
 *
 * Every text/background pair below was checked for WCAG AA (≥ 4.5:1):
 * ink on surface 15.3 · muted on surface 5.5 · muted on greenSoft 5.0 · muted on wash 5.0 ·
 * green on surface 6.3 · white on green 6.3 · green on greenSoft 5.7 · money on surface 5.3 ·
 * onOrange on orange 6.2 (white on orange is 2.5 — a defect, so text on orange is always dark) · onGreen on green 6.3 ·
 * ink on orangeSoft 14.2 · danger on dangerSoft 6.0 · warn on warnSoft 5.9 · fact on surface 6.6 · attentionInk on
 * surface 5.9 · waitingInk on orangeSoft 6.7 · orangeInk on surface 5.3 · onDark on green 5.7.
 *
 * A colour that was written by hand beside this list and sat a hair off one of its values (CIEDE2000 ≤ 2.5, below what
 * reads as a different colour) now uses that value: two colours that nearly agree are worse than one. The ones that are
 * clearly their own colour got a name here instead, so nothing outside the token files spells a colour.
 */
export const sys = {
  color: {
    surface: '#FFFFFF',
    /** Screens are white; `wash` is the only grouped-area tint. */
    ground: '#FFFFFF',
    wash: '#F2F7F4',
    /** Segmented track and icon wells. */
    control: '#E6EDE8',
    iconWell: '#F4F7F5',
    ink: '#202723',
    muted: '#5E6D64',
    green: '#076E4E',
    greenSoft: '#EFF6F0',
    orange: '#FA8229',
    orangeSoft: '#FFF5E9',
    onOrange: '#30200F',
    /** The label on the one primary action, which is green. */
    onGreen: '#FFFFFF',
    line: '#EBEEEA',
    lineStrong: '#C9D6CF',
    cardLine: '#D8DED7',
    danger: '#963F34',
    dangerSoft: '#FBECE9',
    warn: '#8A5100',
    warnSoft: '#FFF4DF',
    money: '#087B57',
    skeleton: '#E9F0EC',
    scrim: '#183A3066',
    /** Hairlines on a filled control, and the ring that appears only while listening. */
    greenEdge: '#226B52',
    orangeEdge: '#E57917',
    orangeHalo: '#FFD2A8',
    /** A fact beside its icon on a card (where, when): a step darker than muted, so a scanned list reads. */
    fact: '#4F6157',
    /** A count that asks for attention, on white: few places left. */
    attentionInk: '#985223',
    /** The words on a waiting chip, which sits on orangeSoft. */
    waitingInk: '#874515',
    /** Orange as words. The action orange fails as text (2.5:1), so a word that must read orange uses this. */
    orangeInk: palette.orangeInk,
    /** Words on a filled green or dark surface that is not the primary action (a chosen day), and their quiet partner. */
    onDark: palette.onDark,
    onDarkMuted: palette.onDarkMuted,
  },
  /**
   * Illustration tones: the Home drawing's own greens, paper and spark. Only for pictures, never for words or controls.
   * Where the drawing used a colour a hair off the palette it now uses the palette colour (its ground shadow is iconWell,
   * the back sheet greenSoft, the pin orange); these are the tones that are deliberately its own.
   */
  art: {
    /** The two ends of the green disc's gradient. */
    leafLight: '#24866A',
    leafDeep: '#0D5141',
    paperEdge: '#D8E7DF',
    /** The title line on the paper, and the two quieter lines under it. */
    paperTitle: '#327960',
    paperRule: '#C8DBD0',
    spark: '#FFAD60',
    dot: '#AECDBB',
  },
  /** One scale, defined once in `theme/tokens`. A circle or capsule is `pill`, never half of its own width. */
  radius,
  space,
  type: {
    ...type,
    /** Money and counts use tabular figures so columns and cards line up. */
    price: { fontSize: 23, lineHeight: 28, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] } as TextStyle,
    cardTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.6 } as TextStyle,
    /** The title of a card that is showing itself small, inside a list of other cards. */
    cardTitleCompact: { fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
    /** The one money figure a detail screen is built around. */
    priceLarge: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] } as TextStyle,
    /** Money inside a row that is compared with other rows. */
    priceSmall: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] } as TextStyle,
    /** The letter standing in for a photo, on a 96px avatar. */
    monogram: { fontSize: 30, lineHeight: 36, fontWeight: '700' } as TextStyle,
  },
  /**
   * Motion, in milliseconds. Short, and only on a real change of state: a press, a switch, something arriving or
   * leaving, a screen pushed, the map camera moving. Exit is shorter than entry, and UI never eases in.
   *
   * THE RULE: nothing that states a fact animates. A price, an amount, a time, a place, a count, a status word or a
   * button label appears in its final form — never counted up, cross-faded between values or slid in on its own. What
   * moves is the container that carries it (a row arriving, a sheet opening), and under reduced motion nothing moves
   * at all: read `useReducedMotion` from `ui/system/motion`, the one source for that preference.
   */
  motion: {
    /** Response to a finger. */
    press: 120,
    /** A switch, a chip, a segment. */
    toggle: 180,
    /** Something arriving: a row, a panel, a confirmation. */
    enter: 240,
    exit: 160,
    /** A screen pushed onto the stack. */
    push: 280,
    /** The map camera flying to a place. */
    camera: 360,
    /** The step between rows arriving together; stops after six rows. */
    stagger: 40,
    easeOut: [0.23, 1, 0.32, 1] as const,
    easeInOut: [0.77, 0, 0.175, 1] as const,
    sheet: [0.32, 0.72, 0, 1] as const,
    /** How far a pressed surface gives under the finger. */
    pressScale: 0.97,
    /** Everything under a finger settles on a spring, not a timing curve. */
    spring: { duration: 400, dampingRatio: 0.85 },
    springSheet: { duration: 300, dampingRatio: 0.8 },
  },
  touch,
  elevation,
} as const;

/**
 * The one card (owner, 2026-09-23: "izgled kartice isti kroz ceo app"). A panel is `card` (26px corners, 20px padding);
 * an item in a list is `cardCompact` (20px corners, 16px padding). Both are white with the cardLine hairline and
 * V28's measured two-layer shadow (the TaskCard shadow), so every card on every screen lifts the same way. Something
 * inside a card is never another card: it is a flat tint at control radius.
 */
const cardShadow: ViewStyle = Platform?.OS === 'android' && typeof Platform?.Version === 'number' && Platform.Version < 28
  ? { elevation: 1 } // boxShadow needs Android 9+; minSdk is 24.
  : { boxShadow: '0px 5px 18px rgba(23, 59, 39, 0.063), 0px 1px 2px rgba(23, 59, 39, 0.027)' };
export const card: ViewStyle = { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1,
  borderColor: sys.color.cardLine, padding: 20, ...cardShadow };
export const cardCompact: ViewStyle = { ...card, borderRadius: sys.radius.cardCompact, padding: 16 };
/** The one text field: 52px high, control corners, the strong hairline, body text. A multiline field adds its height. */
export const fieldBox = { minHeight: 52, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control,
  paddingHorizontal: 14, paddingVertical: 12, backgroundColor: sys.color.surface } satisfies ViewStyle;
export const field = { ...fieldBox, ...sys.type.body, color: sys.color.ink } satisfies TextStyle;
/** A note inside a screen or a card: a flat tint, no border, no shadow. */
export const inset: ViewStyle = { borderRadius: sys.radius.control, padding: 14 };

/**
 * The one primary action on a screen: green surface with a white label, as V28 and V41 draw it. The owner, looking at
 * the orange "Oceni saradnju" on his phone (2026-09-23 evening): "nije ove boje … loš fazon". Every other action stays
 * white with a green label; orange is an accent only (the Home publish tile, what waits for you, the map's "+").
 * Pass as `style` to a V2Action; V2Action reads the surface and writes the label in `onGreen`.
 */
export const brandAction: ViewStyle = { backgroundColor: sys.color.green, borderWidth: 0, minHeight: 54, borderRadius: sys.radius.primary };

/**
 * 48px icon control in a quiet well (V5 head icon button). The screen chrome's arrow, X, profile, bell and "···" are all
 * this size (master design plan, 2026-09-24): an important command is never under 48, and one size keeps every bar the
 * same height.
 */
export const iconButton: ViewStyle = { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };

