import { useWindowDimensions } from 'react-native';

/**
 * The text size the person chose, rounded to hundredths. Android hands its font scale over as a float, so its
 * "Large" setting arrives as 1.2999999523 and a layout keyed on `fontScale >= 1.3` never switched there (seen on the
 * emulator, 2026-09-24: Početna kept its tiles side by side and wrapped them to four lines). Read the scale through
 * this helper, never compare the raw value against a step.
 */
export function roundTextScale(fontScale: number): number {
  return Number.isFinite(fontScale) && fontScale > 0 ? Math.round(fontScale * 100) / 100 : 1;
}

/** The rounded text scale of the current window. */
export function useTextScale(): number {
  return roundTextScale(useWindowDimensions().fontScale);
}
