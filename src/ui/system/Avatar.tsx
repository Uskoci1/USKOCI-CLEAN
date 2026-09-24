import { memo } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import { T } from '../Text';
import { FactArt } from './FactArt';
import { sys } from './tokens';

/** Three sizes: a row inside a card (32), a list row or bar (40), a person's own header (56). */
export type AvatarSize = 32 | 40 | 56;

const LETTERS: Record<AvatarSize, TextStyle> = {
  32: { fontSize: 12, lineHeight: 16 },
  40: { fontSize: 15, lineHeight: 20 },
  56: { fontSize: 20, lineHeight: 26 },
};
const GLYPH: Record<AvatarSize, number> = { 32: 20, 40: 24, 56: 32 };

/**
 * The one stand-in for a person's photo (2026-09-24): a round green-soft disc with their initials, or a drawn person when
 * there is no name to take letters from. Pass `inicijali(name)` from `lib/inicijali`; an empty string or null draws the
 * person, so a missing name never becomes letters that belong to nobody.
 *
 * The disc is decoration: the person's name always stands beside it, so a screen reader hears the name once, not the
 * name and then its letters. The letters keep their size under a larger text setting, because they must stay inside
 * the disc and say nothing the name beside them does not.
 */
function AvatarBase({ initials, size = 40 }: { initials: string | null | undefined; size?: AvatarSize }) {
  const letters = initials?.trim() || null;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={[s.disc, { width: size, height: size }]}>
    {letters ? <T variant="label" maxFontSizeMultiplier={1} numberOfLines={1} style={[s.letters, LETTERS[size]]}>{letters}</T>
      : <FactArt kind="person" size={GLYPH[size]} />}
  </View>;
}

export const Avatar = memo(AvatarBase);

const s = StyleSheet.create({
  disc: { borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letters: { color: sys.color.green, fontWeight: '700', letterSpacing: 0, textAlign: 'center' },
});
