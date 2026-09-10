import { brandFrame, INTRO_DURATION_MS } from '../../ui/entry/spojBrandMath';
import frames from './fixtures/spoj-brand-reference-frames.json';

// 39 original browser samples, not expected values recomputed by this native implementation.
// Source motion/html-reference-frames.json SHA256: d764da5bffba1cd779bc34b23fb7464cd4da9195fc12cc6f9cae9d114eb46676
const numbers = (value: string) => (value.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? []).map(Number);
it.each(frames)('matches original HTML geometry at $time ms / $phone.width px', expected => {
  const frame = brandFrame(expected.time, expected.phone, expected.logo);
  const mark = numbers(expected.mark);
  [frame.mark.x, frame.mark.y, frame.mark.scale].forEach((value, index) => expect(value).toBeCloseTo(mark[index], 10));
  frame.parts.forEach((part, index) => {
    const sample = expected.parts[index];
    // Browser computed opacity is serialized to four decimal places.
    expect(part.opacity).toBeCloseTo(sample.opacity, 4);
    [part.dx, part.dy, part.cx, part.cy, part.sx, part.sy, -part.cx, -part.cy]
      .forEach((value, n) => expect(value).toBeCloseTo(numbers(sample.transform)[n], 10));
  });
  expect(frame.wordClipWidth).toBeCloseTo(expected.clip, 10);
});
it('provides the exact final state immediately with reduced motion', () => {
  const { phone, logo } = frames[0];
  const final = brandFrame(0, phone, logo, true);
  expect(final).toEqual(brandFrame(INTRO_DURATION_MS, phone, logo));
  expect(final.choices.enabled).toBe(true);
  expect(final.mark.x).toBeCloseTo(42.806, 10);
  expect(final.mark.y).toBeCloseTo(175.496, 10);
  expect(final.mark.scale).toBeCloseTo(.34, 10);
});
it('rejects unmeasured or non-finite geometry', () => {
  const { phone, logo } = frames[0];
  expect(() => brandFrame(0, phone, { ...logo, width: 0 })).toThrow(RangeError);
  expect(() => brandFrame(NaN, phone, logo)).toThrow(RangeError);
});
