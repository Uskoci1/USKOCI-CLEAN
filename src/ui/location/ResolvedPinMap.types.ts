/** Presentation only: this pair is a candidate until the containing form confirms it. */
export type ResolvedPinPosition = Readonly<{ latitude: number; longitude: number }>;
export type ResolvedPinMapProps = Readonly<{
  position: ResolvedPinPosition | null;
  onChoose: (position: ResolvedPinPosition) => void;
  disabled?: boolean;
  /** Account incarnation + reviewed point/input identity; never sent to the map SDK. */
  scopeKey: string;
  /** Worker base / public approximation: only two-decimal positions are displayed or emitted. */
  coarse?: boolean;
}>;

// Public style configuration reused from the reviewed PR67 renderer. No address,
// account identifier, geocoder query or provider credential is included in this URL.
export const RESOLVED_PIN_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export function displayedPinPosition(value: ResolvedPinPosition | null, coarse = false): ResolvedPinPosition | null {
  if (!value || typeof value.latitude !== 'number' || typeof value.longitude !== 'number'
    || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)
    || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180) return null;
  return coarse ? { latitude: Number(value.latitude.toFixed(2)), longitude: Number(value.longitude.toFixed(2)) }
    : { latitude: value.latitude, longitude: value.longitude };
}
