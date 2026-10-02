import { REVIEW_COMMENT_BUILT, reviewCommentBuilt } from '../reviewCommentGate';

/**
 * D12 (the optional written comment with the star rating): the client talks to the v2 review functions only in a build compiled
 * with ONE flag. Any other value, a missing value or a look-alike keeps the legacy review pair byte for byte, so a build that
 * meets a backend without the package never asks for a comment and never draws a field for it. Same pattern as the EX-04 gates.
 */
describe('the build flag of the written review comment', () => {
  const original = process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT; else process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT = original;
  });

  it('is on for exactly the compiled value', () => {
    expect(REVIEW_COMMENT_BUILT).toBe('1');
    expect(reviewCommentBuilt('1')).toBe(true);
  });

  it.each([undefined, null, '', '0', 'true', 'TRUE', ' 1', '1 ', 'on', 1, true, false])('is off for %p', value => {
    expect(reviewCommentBuilt(value)).toBe(false);
  });

  it('reads the build environment when no value is given, and is off by default (Jest, web, every build before the backend has the package)', () => {
    delete process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT;
    expect(reviewCommentBuilt()).toBe(false);
    process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT = '1';
    expect(reviewCommentBuilt()).toBe(true);
    process.env.EXPO_PUBLIC_D12_REVIEW_COMMENT = 'yes';
    expect(reviewCommentBuilt()).toBe(false);
  });
});
