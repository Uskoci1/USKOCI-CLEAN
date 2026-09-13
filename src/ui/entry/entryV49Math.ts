/** V4.9 s37Layout + final V396 wrapper, s37IntroParts and s39SeamIntro.
 * Only geometry/motion is ported. Native owns text measurements, insets and auth.
 */
export const ENTRY_V49 = { green: '#286F60', orange: '#FF800A', ink: '#143D35', duration: 760 } as const;
const clamp = (v: number, min: number, max: number) => { 'worklet'; return Math.min(max, Math.max(min, v)); };
const phase = (t: number, a: number, b: number) => { 'worklet'; return clamp((t - a) / (b - a), 0, 1); };
const cubic = (p: number) => { 'worklet'; return 1 - (1 - p) ** 3; };
const smooth = (p: number) => { 'worklet'; return p * p * (3 - 2 * p); };

export function entryV49Layout(width: number, viewportHeight: number, fontScale = 1,
  measured: { brand?: number; copy?: number; note?: number; footer?: number } = {}, safeTop = 0, safeBottom = 0) {
  const large = fontScale > 1.3, unit = width / 540;
  const compact = !large && width <= 430 && viewportHeight < width * 2.03;
  const half = width / 2, gutter = clamp(width * .036, 12, 26), edge = clamp(width * .019, 7, 14);
  const photoW = half - 2 * edge, noteW = photoW * (compact ? .82 : .85);
  const brandW = width * .74, padY = clamp(15 * unit, 10.5, 20) - (compact ? 2 : 0), padX = clamp(19 * unit, 14, 27);
  const authoredBrandY = clamp(width * .087 - (compact ? 8 : 0), 24, 62);
  const brandY = Math.max(safeTop, authoredBrandY);
  const logoW = brandW - 2 * (padX + 1), logoH = logoW * 104 / 320;
  const tagSize = clamp(22 * unit, 18, 29), sloganGap = clamp(8 * unit, 6, 11);
  const brandH = measured.brand ?? (2 * (padY + 1) + logoH + sloganGap + tagSize * 2.4 * fontScale + 1);
  const titleSize = large ? 17 : clamp(33 * unit, 24, 43), bodySize = clamp(13.2 * unit, 12, 17);
  const copyGap = clamp(11 * unit, 8, 14) - (compact ? 2 : 0);
  const copyH = measured.copy ?? (titleSize * (large ? 2.2 : 2.11) * fontScale + copyGap + (large ? 38 : bodySize * 2.8 * fontScale));
  const copyY = brandY + brandH + clamp(18 * unit, 12, 24) - (compact ? 3 : 0);
  let photoY = copyY + copyH + (compact ? 10 : clamp(22 * unit, 16, 29));
  const noteH = Math.max(measured.note ?? (large ? 10 * fontScale * 1.27 * 3 : noteW * 107 / 248.56), noteW * .44);
  const noteGap = compact ? 10 : clamp(17 * unit, 12, 23), footGap = compact ? 10 : clamp(17 * unit, 14, 24);
  const footH = large ? 112 : compact ? 88 : 92;
  // Insets translate/extend the authored composition; they must not change the
  // photograph crop. Reserve the bottom inset in scroll content, not photoH.
  const topShift = brandY - authoredBrandY;
  const baseH = Math.max(viewportHeight, Math.ceil(photoY - topShift + photoW * (compact ? 1.4 : 1.48) + noteGap + noteH + footGap + footH)) + topShift;
  let photoH = baseH - photoY - noteGap - noteH - footGap - footH;
  const motionPhotoH = photoH;
  let noteY = photoY + photoH + noteGap, footY = noteY + noteH + footGap;
  // Apply the final authored correction once, never cumulatively on layout.
  if (width >= 360) { photoY -= 4; photoH += 12; noteY += 8; footY += 8; }
  // The HTML footer protrudes 8px. Native scroll content includes it and the
  // device's real bottom inset so both auth actions remain reachable.
  const height = Math.max(viewportHeight, footY + Math.max(footH, measured.footer ?? 0) + safeBottom);
  return { width, height, half, large, compact, gutter, edge, photoW, photoH, motionPhotoH, photoY, noteY, noteW, noteH,
    copyY, copyH, titleSize, bodySize, copyGap, arrowY: clamp(24 * unit, 17, 32),
    brandW, brandH, brandY, padX, padY, radius: clamp(27 * unit, 21, 36), logoW, logoH, tagSize, sloganGap, footY, footH };
}
export type EntryV49Layout = ReturnType<typeof entryV49Layout>;

export function entryV49Intro(timeMs: number, reduced = false) {
  'worklet';
  const t = reduced ? 4400 : Math.max(0, timeMs);
  const cp = cubic(phase(t, 3840, 4210)), ph = cubic(phase(t, 3730, 4270)), qp = cubic(phase(t, 4020, 4380));
  return { copy: { opacity: cp, y: 6 * (1 - cp) }, photo: { opacity: ph, y: 8 * (1 - ph) },
    note: { opacity: qp, y: 3 * (1 - qp) }, seam: smooth(phase(t, 3970, 4400)) };
}

export function entryV49Intent(timeMs: number, width: number, photoHeight: number) {
  'worklet';
  const p = clamp(timeMs / ENTRY_V49.duration, 0, 1), q = smooth(phase(p, 0, .82));
  const scale = 1 + .08 * smooth(phase(p, .13, .83)), open = smooth(phase(p, .86, 1));
  return { fillTravel: width / 2 * q, sceneTravel: width / 4 * q, seamOpacity: 1 - smooth(phase(p, .65, .86)),
    photoScale: scale, photoY: -4 * q, copyY: -8 * q, noteY: photoHeight * (scale - 1) - 4 * q,
    noteOpacity: 1 - .4 * smooth(phase(p, .68, .90)), otherOpacity: 1 - smooth(phase(p, .08, .53)),
    // The final .s36-choosing .entryfoot !important rule wins over the older JS fade.
    footerOpacity: 0, doorwayOpen: open, doorwayRadius: 28 * (1 - open) };
}
