import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let known: boolean | null = null;

/**
 * System "reduce motion" preference without a reanimated import. Shared system
 * components (sheets, transitions) are reached by route screens whose tests
 * isolate the native animation runtime, so they read the OS preference through
 * AccessibilityInfo and remember the last answer for the next mount.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(known ?? false);
  useEffect(() => {
    let alive = true;
    // A platform (or a test double) without the API simply means "not reduced"; it never takes the screen down.
    try {
      AccessibilityInfo?.isReduceMotionEnabled?.()?.then(value => { known = value; if (alive && value !== reduced) setReduced(value); })?.catch(() => undefined);
    } catch { /* not available here */ }
    let subscription: { remove(): void } | undefined;
    try {
      subscription = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', value => { known = value; if (alive) setReduced(value); });
    } catch { /* not available here */ }
    return () => { alive = false; subscription?.remove?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return reduced;
}
