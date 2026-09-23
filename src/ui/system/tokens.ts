import type { TextStyle, ViewStyle } from 'react-native';
import { elevation, motion, radius, space, touch, type } from '../../theme/tokens';

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
 * ink on orangeSoft 14.2 · danger on dangerSoft 6.0 · warn on warnSoft 5.9.
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
  motion,
  touch,
  elevation,
} as const;

/** A card resting on the white screen: soft shadow, hairline, 22px corners, 20px padding. */
export const card: ViewStyle = { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1,
  borderColor: sys.color.cardLine, padding: 20, ...sys.elevation.soft };
export const cardCompact: ViewStyle = { ...card, borderRadius: sys.radius.cardCompact, padding: 16 };

/**
 * The one primary action on a screen: green surface with a white label, as V28 and V41 draw it. The owner, looking at
 * the orange "Oceni saradnju" on his phone (2026-09-23 evening): "nije ove boje … loš fazon". Every other action stays
 * white with a green label; orange is an accent only (the Home publish tile, what waits for you, the map's "+").
 * Pass as `style` to a V2Action; V2Action reads the surface and writes the label in `onGreen`.
 */
export const brandAction: ViewStyle = { backgroundColor: sys.color.green, borderWidth: 0, minHeight: 54, borderRadius: sys.radius.primary };

/** 44px icon control in a quiet well (V5 head icon button). */
export const iconButton: ViewStyle = { width: 44, height: 44, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };

