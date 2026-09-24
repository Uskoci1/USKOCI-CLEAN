import { Text as RNText, type TextProps } from 'react-native';
import { withInter } from './interFont';
import { loadInterWeb } from './loadInterWeb';
import { sys } from './system/tokens';

loadInterWeb();

const typeScale = sys.type;
type Variant = keyof typeof typeScale;
type Tone = 'ink' | 'muted' | 'onDark' | 'orange' | 'onOrange' | 'onGreen' | 'green' | 'danger' | 'success';

/**
 * Every word in the app is coloured here, so this is where the app has one voice or several.
 * It had several: text was drawn in the older forest ink while every card, control and surface
 * around it was built for a different green. Two greens one shade apart, side by side on every
 * screen, is most of why the product read as unfinished rather than as a decision.
 *
 * Every tone now comes from `sys` (2026-09-24), the one token surface. Words on a filled green
 * surface are `onDark`; there is no quieter partner, because the old `onDarkMuted` read 2.4:1 on
 * green and passed only on the retired forest ground. The orange is `orangeInk`:
 * the action orange is a surface colour and fails as text at 2.51, a fact about eyes, not a style.
 * `success` was the last of the near-greens — a hair off the action green, below what reads as a
 * different colour — so it is now that green: a confirmation and a chosen thing speak one green.
 */
const tones: Record<Tone, string> = {
  ink: sys.color.ink,
  muted: sys.color.muted,
  onDark: sys.color.onDark,
  orange: sys.color.orangeInk,
  onOrange: sys.color.onOrange,
  onGreen: sys.color.onGreen,
  green: sys.color.green,
  danger: sys.color.danger,
  success: sys.color.green,
};

type Props = TextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Za naslove — sprečava usamljenu reč u poslednjem redu. */
  balance?: boolean;
};

/**
 * Sav tekst ide kroz ovo. Razlog: referenca je imala tekst od 7px,
 * uključujući labelu na dugmetu. Ovde najmanja veličina je 12px i
 * ne postoji način da se slučajno ode ispod.
 */
export function T({ variant = 'body', tone = 'ink', balance, style, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={withInter([
        typeScale[variant],
        { color: tones[tone] },
        balance ? { textAlign: 'left' } : null,
        style,
      ])}
    />
  );
}
