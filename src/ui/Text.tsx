import { Text as RNText, type TextProps } from 'react-native';
import { palette, type as typeScale } from '../theme/tokens';

type Variant = keyof typeof typeScale;
type Tone = 'ink' | 'muted' | 'onDark' | 'onDarkMuted' | 'orange' | 'onOrange' | 'danger' | 'success';

const tones: Record<Tone, string> = {
  ink: palette.ink,
  muted: palette.inkMuted,
  onDark: palette.onDark,
  onDarkMuted: palette.onDarkMuted,
  orange: palette.orangeInk, // tekst uvek orangeInk; #FF7908 kao tekst pada na 2.51
  onOrange: palette.onOrange,
  danger: palette.danger,
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
      style={[
        typeScale[variant],
        { color: tones[tone] },
        balance ? { textAlign: 'left' } : null,
        style,
      ]}
    />
  );
}
