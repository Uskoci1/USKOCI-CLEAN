import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { elevation, palette, radius, space, touch, type } from '../../theme/tokens';
import { withInter } from '../interFont';

/**
 * `sys` is the one surface screens and components read for colour, type, space, corners, touch and motion (2026-09-24:
 * the `v2` token file with its second motion scale is deleted, and the screens moved that day no longer read
 * `theme/tokens` or `aiFirst`; the sign-in screens and the AI conversation still do, as views of the same values). It
 * may build on the theme scale here, inside the system. A nested corner is geometry, not a value, so it is exported
 * beside `sys`.
 */
export { nested } from '../../theme/tokens';

/**
 * One light system for every screen (PKG-011, redesigned 2026-09-16 against the V5 AI-FIRST reference: white
 * background, deep green as trust, orientation and the primary action, orange as a controlled accent). Since
 * 2026-09-24 the Home drawing's colours live here too (`sys.art`, master design plan: hand-written hex goes into tokens),
 * so this file does restyle it; only the entry sequence (the V4.9 brand intro, `ui/entry`, with its own locked
 * `ENTRY_V49` values) and the mascot keep colours of their own. The Home pin is now the palette orange, no longer the
 * entry orange #FF800A it once copied.
 *
 * Owner correction, 2026-09-25 (R12): clean white canvas and reading surfaces. No mint wash behind conversations,
 * summaries or groups. Icons, photos, strong action colors and readable type supply the color. Neutral wells are
 * limited to controls and selected states; separation comes from space, neutral hairlines and restrained shadows.
 * V28's green/orange accents remain. Error and warning colors still carry meaning beside a label or icon.
 * Text/background contrast is recorded in the R12 report; orange buttons always use dark text, never white.
 *
 * A colour that was written by hand beside this list and sat a hair off one of its values (CIEDE2000 ≤ 2.5, below what
 * reads as a different colour) now uses that value: two colours that nearly agree are worse than one. The ones that are
 * clearly their own colour got a name here instead, so nothing outside the token files spells a colour.
 */
export const sys = {
  color: {
    surface: '#FFFFFF',
    /** Screens and reading groups are white; `wash` is a neutral control/recessed-state surface. */
    ground: '#FFFFFF',
    wash: '#F7F7F7',
    /** Segmented track and icon wells. */
    control: '#E8E8E8',
    iconWell: '#F5F5F5',
    ink: '#202020',
    muted: '#525252',
    green: '#076E4E',
    /** Legacy name: a neutral selection well; the icon, edge or label carries green. */
    greenSoft: '#F3F3F3',
    orange: '#FA8229',
    orangeSoft: '#FFF5E9',
    onOrange: '#30200F',
    /** The label on the one primary action, which is green. */
    onGreen: '#FFFFFF',
    line: '#EBEBEB',
    lineStrong: '#CDCDCD',
    cardLine: '#DEDEDE',
    danger: '#963F34',
    dangerSoft: '#FBECE9',
    warn: '#8A5100',
    warnSoft: '#FFF4DF',
    money: '#087B57',
    skeleton: '#EEEEEE',
    scrim: '#00000066',
    /**
     * The white veil a full-screen step panel lies on over the map (the Zadaci search, Discovery V47): the map still shows
     * through it, the white cards on it are what is read. No blur: there is no blur package, and none is added for this.
     */
    veil: '#FFFFFFE6',
    /** Hairlines on a filled control, and the ring that appears only while listening. */
    greenEdge: '#226B52',
    orangeEdge: '#E57917',
    orangeHalo: '#FFD2A8',
    /** A fact beside its icon on a card (where, when): a step darker than muted, so a scanned list reads. */
    fact: '#404040',
    /** A count that asks for attention, on white: few places left. */
    attentionInk: '#985223',
    /** The words on a waiting chip, which sits on orangeSoft. */
    waitingInk: '#874515',
    /** Orange as words. The action orange fails as text (2.5:1), so a word that must read orange uses this. */
    orangeInk: palette.orangeInk,
    /**
     * Words on a filled green surface that is not the primary action (a chosen day). It has no quiet partner: the old
     * `onDarkMuted` read 2.4:1 on green (it passed only on the retired forest ground), so nothing may say it.
     */
    onDark: palette.onDark,
  },
  /** White conversations; speaker alignment, a quiet edge and the solid own-message fill establish hierarchy. */
  conversation: {
    ground: '#FFFFFF',
    surface: '#FFFFFF',
    summary: '#FFFFFF',
    edge: '#DEDEDE',
    user: '#07543F',
    onUser: '#FFFFFF',
    iconWell: '#F5F5F5',
  },
  /** Public map geography: colors only, independent from the interactive brand markers and their states. */
  map: {
    ground: '#F5F6F7',
    residential: '#EEF0F2',
    park: '#D6EABD',
    woodland: '#BED99C',
    water: '#A8D8EE',
    waterLine: '#76BBD9',
    waterLabel: '#315E74',
    building: '#E1E5E7',
    buildingEdge: '#D3DADF',
    road: '#FFFFFF',
    roadEdge: '#D4DADF',
    path: '#BDCDAA',
    transit: '#B5BEC4',
    boundary: '#A5AFB4',
    label: '#354249',
    roadLabel: '#5B656C',
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
  /**
   * One scale, defined once in `theme/tokens`: 12 for what is touched or sits in a row (control, chip, badge and the
   * primary action alike), 24 for a card, 28 for a sheet. A circle or capsule is `pill`, never half of its own width.
   *
   * `check` (6) is the one corner below that scale: the corner of a checkbox box (22–24 px); nothing but a checkbox uses
   * it. The row corner (12) on a box that small drew a circle, which reads as a radio (card review r3 item 8).
   */
  radius: { ...radius, check: 6 },
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
    /** Money on one line with a compact title (`cardTitleCompact`), as in a place's rows on the map: the same size. */
    priceRow: { fontSize: 16, lineHeight: 21, fontWeight: '700', fontVariant: ['tabular-nums'] } as TextStyle,
    /** The letter standing in for a photo, on a 96px avatar. */
    monogram: { fontSize: 30, lineHeight: 36, fontWeight: '700' } as TextStyle,
    /**
     * The answer in voice mode, read at a glance from arm's length while the thread's own `speech` (16/26) is read up
     * close: the same voice, a step larger.
     */
    speechLarge: { fontSize: 20, lineHeight: 30, fontWeight: '500' } as TextStyle,
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
 * The one card (owner, 2026-09-23: "izgled kartice isti kroz ceo app"). A panel is `card` (20px padding); an item in a
 * list is `cardCompact` (16px padding); both have the card corner. Both are white with a neutral card edge
 * (`cardLine`) and NO shadow (emulator critique B5, 2026-09-24): a card lying on the white screen is drawn by its edge,
 * and a border plus a shadow on every card of a list was two outlines for one thing. With the shadow gone the edge is the
 * card's only outline, so it is `cardLine`, not the faintest `line`, which
 * left list cards and the white Početna tile with almost no visible edge (round 2c). Shadow means "this floats above the
 * screen", so it is kept for what really floats (`floating`: sheets, map controls, the tab bar). Something inside a
 * card is never another card: use spacing and a rule between its sections.
 */
export const card: ViewStyle = { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1,
  borderColor: sys.color.cardLine, padding: 20 };
export const cardCompact: ViewStyle = { ...card, borderRadius: sys.radius.cardCompact, padding: 16 };
/** boxShadow needs Android 9+; minSdk is 24, so the phones before it get an elevation instead. */
const NO_BOX_SHADOW = Platform?.OS === 'android' && typeof Platform?.Version === 'number' && Platform.Version < 28;
/** Neutral lift for floating layers; no green veil on the white canvas. Never on every card in a list. */
export const floating: ViewStyle = NO_BOX_SHADOW ? { elevation: 1 }
  : { boxShadow: '0px 5px 18px rgba(0, 0, 0, 0.063), 0px 1px 2px rgba(0, 0, 0, 0.027)' };
/**
 * The lift of a sheet over the map, in the system's shadow ink (review r3b: it was spelled in each sheet). A `docked`
 * sheet rises from the bottom edge (the Zadaci list), so its shadow falls upwards; a `detached` one floats free above
 * it (the PeekSheet with a pin's card), so its shadow falls below, deeper than `floating` because it covers more.
 */
export const sheetLift = {
  docked: (NO_BOX_SHADOW ? { elevation: 6 } : { boxShadow: '0px -2px 12px rgba(0, 0, 0, 0.08)' }) as ViewStyle,
  detached: (NO_BOX_SHADOW ? { elevation: 6 }
    : { boxShadow: '0px 10px 28px rgba(0, 0, 0, 0.14), 0px 2px 6px rgba(0, 0, 0, 0.06)' }) as ViewStyle,
} as const;
/** The one text field: 52px high, control corners, the strong hairline, body text. A multiline field adds its height. */
export const fieldBox = { minHeight: 52, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control,
  paddingHorizontal: 14, paddingVertical: 12, backgroundColor: sys.color.surface } satisfies ViewStyle;
export const field = { ...fieldBox, ...withInter(sys.type.body), color: sys.color.ink } satisfies TextStyle;
/** A note inside a screen or a card: a flat tint, no border, no shadow. */
export const inset: ViewStyle = { borderRadius: sys.radius.control, padding: 14 };
/**
 * A chosen pill chip (one look over the map and in the search panel): a neutral well with a 2 px
 * green edge, and the caller writes its label in green beside a green tick. Never the green fill:
 * that is the one primary action's. A free chip has a 1 px edge, so a chosen one takes 1 px off its side padding
 * (`CHIP_CHOSEN_INSET`) and its words do not move.
 */
export const chipChosen: ViewStyle = { backgroundColor: sys.color.greenSoft, borderWidth: 2, borderColor: sys.color.green };
export const CHIP_CHOSEN_INSET = 1;

/**
 * The one primary action on a screen: green surface with a white label, as V28 and V41 draw it. The owner, looking at
 * the orange "Oceni saradnju" on his phone (2026-09-23 evening): "nije ove boje … loš fazon". Every other action stays
 * white with a green label; orange is an accent only (the Home publish tile, what waits for you, the map's "+").
 * Pass as `style` to a V2Action; V2Action reads the surface and writes the label in `onGreen`.
 */
export const brandAction: ViewStyle = { backgroundColor: sys.color.green, borderWidth: 0, minHeight: 54, borderRadius: sys.radius.primary };

/**
 * 48px icon control in a quiet well (V5 head icon button). The screen chrome no longer draws it: its arrow, X, profile,
 * bell and "···" are `ChromeIconButton` (ui/system/ScreenChrome, 2026-09-24). The AI conversation's options button is
 * the one place left that still uses this token, until that bar moves onto the chrome.
 */
export const iconButton: ViewStyle = { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };
/**
 * The 48px well a menu row's picture sits in (the "···" sheet). It is a picture box, not a button, and has its own token
 * so that redrawing the icon button never changes the menu.
 */
export const pictureWell: ViewStyle = { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };

