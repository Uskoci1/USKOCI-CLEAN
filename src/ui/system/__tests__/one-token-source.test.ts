import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Platform } from 'react-native';
import { brandAction, card, cardCompact, fieldBox, floating, sys } from '../tokens';
import { palette } from '../../../theme/tokens';

/**
 * One token source and one motion source (2026-09-24). The files below were moved onto `sys` and onto the one
 * reduced-motion store; this guard keeps them there. A colour, a scale value or a reduced-motion read that a screen
 * spells for itself is exactly what made the app speak with several voices, so the check is on the source text.
 */
const repo = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

/** Moved from `theme/tokens`, `aiFirst/tokens` or `v2/tokens` to `sys`. */
const TOKEN_SCOPE = [
  'src/ui/Press.tsx', 'src/ui/Text.tsx', 'src/ui/system/Segmented.tsx', 'src/ui/BuildIdentity.tsx',
  'src/ui/location/ResolvedPinMap.tsx', 'src/ui/media/AuthorizedPhoto.tsx', 'src/ui/media/AgreementPhotoComposer.tsx',
  'src/ui/v2/IntakePresentation.tsx', 'src/app/(app)/pregled-zadatka.tsx', 'src/ui/v2/DiscoveryMap.tsx',
  'src/ui/v2/DiscoveryMap.web.tsx', 'src/ui/v2/icons.tsx',
];
/** Read reduced motion from `ui/system/motion`, never from Reanimated's launch-time value. */
const MOTION_SCOPE = [
  'src/ui/Press.tsx', 'src/ui/v2/DiscoveryMap.tsx', 'src/ui/v2/MarketplacePresentation.tsx', 'src/ui/v2/IntakePresentation.tsx',
  'src/ui/calendar/CalendarControls.tsx', 'src/ui/v2/ApplicationSelectionPresentation.tsx', 'src/ui/system/Appear.tsx',
  'src/hooks/useSystemReducedMotion.ts', 'src/ui/system/motion.ts',
];
/** Held hand-written colours until 2026-09-24. */
const COLOUR_SCOPE = [
  'src/ui/home/HomePresentation.tsx', 'src/ui/home/HomeIllustration.tsx', 'src/ui/system/Detail.tsx', 'src/ui/Text.tsx',
  'src/ui/v2/TaskCard.tsx',
];
const EVERY_SCOPED_FILE = [...new Set([...COLOUR_SCOPE, ...TOKEN_SCOPE, ...MOTION_SCOPE])];

const RAW_HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_])/gi;
const NAMED_COLOUR = /\b(?:fill|stroke|stopColor|color|backgroundColor|borderColor|tintColor|shadowColor)\s*[=:]\s*['"](?:white|black)['"]/g;

it.each(EVERY_SCOPED_FILE)('%s spells no colour of its own (no raw #RRGGBB, no white or black by name)', path => {
  const source = read(path);
  expect(source.match(RAW_HEX) ?? []).toEqual([]);
  expect(source.match(NAMED_COLOUR) ?? []).toEqual([]);
});

it.each(TOKEN_SCOPE)('%s reads tokens only from sys', path => {
  const source = read(path);
  expect(source).not.toMatch(/from\s+'[^']*(?:theme\/tokens|aiFirst\/tokens|v2\/tokens)'/);
  // Inside the v2 and aiFirst folders, './tokens' is the old file of that folder.
  if (/src\/ui\/(?:v2|aiFirst)\//.test(path)) expect(source).not.toMatch(/from\s+'\.\/tokens'/);
});

it.each(MOTION_SCOPE)('%s reads reduced motion from the one store', path => {
  const source = read(path);
  expect(source).not.toMatch(/import[^;]*\buseReducedMotion\b[^;]*from\s+'react-native-reanimated'/);
});

it('the one store never imports Reanimated, so every screen suite can load it', () => {
  expect(read('src/ui/system/motion.ts')).not.toMatch(/react-native-reanimated/);
});

it('the motion scale is the agreed one, and it lives in sys only', () => {
  expect({ press: sys.motion.press, toggle: sys.motion.toggle, enter: sys.motion.enter, exit: sys.motion.exit,
    push: sys.motion.push, camera: sys.motion.camera, stagger: sys.motion.stagger })
    .toEqual({ press: 120, toggle: 180, enter: 240, exit: 160, push: 280, camera: 360, stagger: 40 });
  expect(sys.motion.easeOut).toEqual([0.23, 1, 0.32, 1]);
  // Exit is shorter than entry.
  expect(sys.motion.exit).toBeLessThan(sys.motion.enter);
  expect(read('src/theme/tokens.ts')).not.toMatch(/export const motion\b/);
});

it('every named colour in sys is a real colour value', () => {
  for (const [name, value] of [...Object.entries(sys.color), ...Object.entries(sys.art)]) {
    expect([name, value]).toEqual([name, expect.stringMatching(/^#(?:[0-9A-F]{6}|[0-9A-F]{8})$/)]);
  }
});

// Emulator critique B6 (2026-09-24): 16/17, 20/26 and 9/13 were corners that nearly agree, so a field and the button
// beside it differed by a pixel. Three steps and the capsule; the role names stay and share them.
// Card review r3 item 8 (2026-09-24): the checkbox's 6 was a magic number dressed as a nested corner. It is now the one
// named corner below the scale, `check`, and the scale itself is unchanged.
it('the corner scale is 12 / 24 / 28 / pill, and a control and the primary action share one corner', () => {
  expect(sys.radius).toEqual({ badge: 12, chip: 12, control: 12, primary: 12, cardCompact: 24, card: 24, sheet: 28, pill: 999, check: 6 });
  const { check, ...scale } = sys.radius;
  expect(new Set(Object.values(scale))).toEqual(new Set([12, 24, 28, 999]));
  expect(check).toBe(6);
  // The checkbox is its only reader.
  expect(read('src/ui/v2/MarketplacePresentation.tsx')).toMatch(/borderRadius: sys\.radius\.check/);
  expect(brandAction.borderRadius).toBe(fieldBox.borderRadius);
});

// Emulator critique B5 (2026-09-24): a list card wore a border and a shadow. A card lying on the white screen is drawn
// by its hairline; a shadow says "this floats", and only floating layers keep it.
// Round 2c (verifier vf, should 4): with the shadow gone the edge is the card's only outline, so it is V28's measured card
// edge `cardLine`, not the faintest `line` this pinned before (about 1.17:1 on white, next to no edge at all).
it.each([['card', card], ['cardCompact', cardCompact]] as const)('%s is a hairline card with no shadow', (_name, style) => {
  expect(style).toMatchObject({ borderWidth: 1, borderColor: sys.color.cardLine, backgroundColor: sys.color.surface, borderRadius: 24 });
  for (const key of ['boxShadow', 'elevation', 'shadowColor', 'shadowOpacity', 'shadowRadius', 'shadowOffset']) expect(style).not.toHaveProperty(key);
  expect(floating).toEqual(expect.objectContaining(Platform.OS === 'android' && Number(Platform.Version) < 28 ? { elevation: 1 } : { boxShadow: expect.any(String) }));
});

it('the second motion scale is gone with the v2 token file, and no tone reads below AA on green', () => {
  expect(existsSync(join(repo, 'src/ui/v2/tokens.ts'))).toBe(false);
  // onDarkMuted read 2.4:1 on sys.color.green; it passed only on the retired forest ground.
  expect(sys.color).not.toHaveProperty('onDarkMuted');
  expect(read('src/ui/Text.tsx')).not.toMatch(/'onDarkMuted'|onDarkMuted:/);
  // Round 2c (verifier vf, nit): nothing read the theme palette's copy either, so it is gone there too.
  expect(palette).not.toHaveProperty('onDarkMuted');
});
