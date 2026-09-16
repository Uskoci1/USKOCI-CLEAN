import type { TextStyle, ViewStyle } from 'react-native';
import { elevation, motion, radius, space, touch, type } from '../../theme/tokens';

/**
 * PKG-011 coherent presentation tokens — one light system for every inner screen.
 *
 * Owner direction (2026-09-13 DESIGN_SKILLS, 2026-09-16 PKG-011 decisions): white
 * surfaces, USKOČI green as trust/orientation, orange as a precise action signal
 * (never body text), ink #183A30, quiet copy #586B62. The entry/HOME/mascot keep
 * their own locked assets; this file never restyles them.
 *
 * Every text/background pair below was checked for WCAG AA (≥ 4.5:1):
 * ink on surface 12.5 · muted on surface 5.7 · muted on ground 5.2 · green on
 * surface 6.4 · green on greenSoft 5.6 · ink on orange 5.1 (white on orange is
 * 2.4 — a defect, so action text on orange is always ink) · danger on
 * dangerSoft 6.0 · warn on warnSoft 5.9 · money on surface 7.8.
 */
export const sys = {
  color: {
    surface: '#FFFFFF',
    ground: '#F3F7F4',
    control: '#E8EFEB',
    ink: '#183A30',
    muted: '#586B62',
    green: '#176B55',
    greenSoft: '#E6F2ED',
    orange: '#FF850F',
    orangeSoft: '#FFF6EC',
    onOrange: '#183A30',
    line: '#E3EBE6',
    lineStrong: '#C9D6CF',
    danger: '#963F34',
    dangerSoft: '#FBECE9',
    warn: '#8A5100',
    warnSoft: '#FFF4DF',
    money: '#205C45',
    skeleton: '#E4ECE7',
    scrim: '#183A3066',
  },
  radius: { chip: 12, control: 14, card: 18, sheet: 24, pill: radius.pill },
  space,
  type: {
    ...type,
    /** Money and counts use tabular figures so columns and cards line up. */
    price: { fontSize: 23, lineHeight: 29, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] } as TextStyle,
    cardTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.35 } as TextStyle,
  },
  motion,
  touch,
  elevation,
} as const;

/** The one brand action on a screen: orange surface with ink text. Pass as `style` to a secondary V2Action. */
export const brandAction: ViewStyle = { backgroundColor: sys.color.orange, borderWidth: 0, minHeight: 50 };

export const intentLabel = (intent: 'narucilac' | 'uskocer') => intent === 'narucilac' ? 'Meni treba' : 'Ja mogu';
export const intentTitle = (intent: 'narucilac' | 'uskocer') => intent === 'narucilac' ? 'MENI TREBA' : 'JA MOGU';
