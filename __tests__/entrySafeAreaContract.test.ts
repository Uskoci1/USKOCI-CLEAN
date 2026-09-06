import { readFileSync } from 'fs';
import { resolve } from 'path';

// Structural regression guards, NOT a replacement for the real Android UI proof.
// The failed run 34058248351 exposed entry controls laid out under system bars.
const source = readFileSync(resolve(__dirname, '../src/ui/referenceEntry/ReferenceEntryHero.tsx'), 'utf8');

describe('reference entry safe-area wiring', () => {
  it('uses the existing device safe-area provider, not fixed status-bar guesses', () => {
    expect(source).toContain("import { useSafeAreaInsets } from 'react-native-safe-area-context';");
    expect(source).toContain('const insets = useSafeAreaInsets();');
  });

  it('keeps the real sign-in target outside top and side system insets', () => {
    expect(source).toContain('style={[styles.topbar, { top: insets.top, left: insets.left, right: insets.right }]}');
    expect(source).toContain('accessibilityLabel="Prijavi se"');
    expect(source).toContain('onPress={onSignIn}');
  });

  it('keeps the existing bottom actions and legal text above navigation insets', () => {
    expect(source).toContain('style={[styles.bottom, { bottom: 24 + insets.bottom, left: 24 + insets.left, right: 24 + insets.right }]}');
    expect(source).toContain('onPress={onRequester}');
    expect(source).toContain('onPress={onWorker}');
  });

  it('aligns the final logo with the safe topbar while preserving its original flight origin', () => {
    expect(source).toContain('lerp(180, 20 + ENTRY_TIMING.MARK1 / 2 + insets.left / layoutScale, flight)');
    expect(source).toContain('lerp(258, 42 + insets.top / layoutScale, flight)');
    expect(source).toContain('<Image source={CITY_IMAGE} resizeMode="cover" style={ABSOLUTE_FILL} />');
  });
});
