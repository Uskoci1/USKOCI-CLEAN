import { sys } from '../system/tokens';

/**
 * The conversation surface, expressed in the one system rather than beside it.
 *
 * This file used to carry its own copies: the same colours to the character, but a card at 23px
 * where the system says 22, and its own text steps a pixel or two off the scale. Values that
 * nearly agree are worse than values that differ, because nothing lines up and nothing looks
 * deliberate. Everything below is now a view onto `sys`, so the conversation cannot drift from
 * the rest of the app again.
 *
 * `composer` is the one shape the system had no name for. It is the system's control radius,
 * not a fourth number.
 */
export const aiFirst = {
  color: {
    surface: sys.color.surface,
    ink: sys.color.ink,
    muted: sys.color.muted,
    green: sys.color.green,
    orange: sys.color.orange,
    line: sys.color.line,
    wash: sys.color.wash,
    warm: sys.color.orangeSoft,
    danger: sys.color.danger,
    money: sys.color.money,
    cardLine: sys.color.cardLine,
    lineStrong: sys.color.lineStrong,
    iconWell: sys.color.iconWell,
    greenSoft: sys.color.greenSoft,
    greenEdge: sys.color.greenEdge,
    orangeEdge: sys.color.orangeEdge,
    orangeHalo: sys.color.orangeHalo,
  },
  radius: {
    card: sys.radius.card,
    compactCard: sys.radius.cardCompact,
    composer: sys.radius.control,
    primary: sys.radius.primary,
    chip: sys.radius.chip,
  },
  text: {
    title: sys.type.title,
    card: sys.type.cardTitle,
    body: sys.type.body,
    meta: sys.type.meta,
    money: sys.type.price,
  },
} as const;
