import type { TextStyle, ViewStyle } from 'react-native';
import { elevation, motion, radius, space, touch, type } from '../../theme/tokens';

/**
 * One light system for every inner screen (PKG-011, redesigned 2026-09-16 against
 * the V5 AI-FIRST reference: white background, deep green as trust and
 * orientation, orange as the single action signal, ink #183A30, quiet copy
 * #586B62, cards with a soft V4.9 shadow instead of a wireframe outline).
 * The entry/HOME/mascot keep their own locked assets; this file never restyles them.
 *
 * Every text/background pair below was checked for WCAG AA (≥ 4.5:1):
 * ink on surface 12.5 · muted on surface 5.7 · green on surface 6.4 · green on
 * greenSoft 5.6 · ink on orange 5.1 (white on orange is 2.4 — a defect, so action
 * text on orange is always ink) · danger on dangerSoft 6.0 · warn on warnSoft 5.9 ·
 * money on surface 7.8.
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
    ink: '#183A30',
    muted: '#586B62',
    green: '#176B55',
    greenSoft: '#E6F2ED',
    orange: '#FF850F',
    orangeSoft: '#FFF6EC',
    onOrange: '#183A30',
    line: '#E3EBE6',
    lineStrong: '#C9D6CF',
    cardLine: '#DCE8DF',
    danger: '#963F34',
    dangerSoft: '#FBECE9',
    warn: '#8A5100',
    warnSoft: '#FFF4DF',
    money: '#205C45',
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

/** The one brand action on a screen: orange surface with ink text. Pass as `style` to a secondary V2Action. */
export const brandAction: ViewStyle = { backgroundColor: sys.color.orange, borderWidth: 0, minHeight: 54, borderRadius: sys.radius.primary };

/** 44px icon control in a quiet well (V5 head icon button). */
export const iconButton: ViewStyle = { width: 44, height: 44, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };

