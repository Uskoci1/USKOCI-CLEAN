import { Text as RNText, type TextProps } from 'react-native';
import { palette, type as typeScale } from '../theme/tokens';
import { withInter } from './interFont';
import { loadInterWeb } from './loadInterWeb';
import { sys } from './system/tokens';

loadInterWeb();

type Variant = keyof typeof typeScale;
type Tone = 'ink' | 'muted' | 'onDark' | 'onDarkMuted' | 'orange' | 'onOrange' | 'danger' | 'success';

/**
 * Every word in the app is coloured here, so this is where the app has one voice or several.
 * It had several: text was drawn in the older forest ink #0E3D37 while every card, control and
 * surface around it was built for #183A30. Two greens one shade apart, side by side on every
 * screen, is most of why the product read as unfinished rather than as a decision.
 *
 * The light tones now come from `sys`, which is the direction the owner recorded. The dark ones
 * stay in `palette`: `sys` describes white surfaces only, and the recovery screen and dark
 * headers still need ink that survives on forest. The orange stays `orangeInk` too — the action
 * orange is a surface colour and fails as text at 2.51, which is a fact about eyes, not a style.
 */
const tones: Record<Tone, string> = {
  ink: sys.color.ink,
  muted: sys.color.muted,
  onDark: palette.onDark,
  onDarkMuted: palette.onDarkMuted,
  orange: palette.orangeInk,
  onOrange: sys.color.onOrange,
  danger: sys.color.danger,
  success: palette.success,
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
