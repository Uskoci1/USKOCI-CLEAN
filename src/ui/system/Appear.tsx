import { useRef, type ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { sys } from './tokens';
import { useReducedMotion } from './motion';

/**
 * A row arriving in a list.
 *
 * The rule the app follows, from `DESIGN_SKILLS.md`: motion is feedback, never decoration. A card
 * that was already there when the screen opened has nothing to tell you by sliding in, and replaying
 * the whole list on every pull-to-refresh is exactly the churn that rule forbids. So each row
 * animates once, the first time this screen ever sees its id, and never again — a refresh that
 * returns the same rows is silent, and a genuinely new row is the only thing that moves.
 *
 * `useAppear()` belongs to the list, not to the row: it holds what that list has already shown.
 */
export function useAppear() {
  const seen = useRef<Set<string>>(new Set());
  const settled = useRef(false);
  // One object for the life of the list, so a memoised renderItem can depend on it directly (2026-09-23).
  const api = useRef<{ settle(keys: readonly string[]): void; isNew(key: string): boolean } | null>(null);
  if (!api.current) api.current = {
    /** Call once per render pass, before the rows, with the keys the list is about to draw. */
    settle(keys: readonly string[]) {
      if (settled.current || !keys.length) return;
      settled.current = true;
      // The first list a screen draws is not an arrival; it is what was already there.
      keys.forEach(key => seen.current.add(key));
    },
    isNew(key: string) {
      if (seen.current.has(key)) return false;
      seen.current.add(key);
      return true;
    },
  };
  return api.current;
}

/** The stagger step (`sys.motion.stagger`) is per row, and stops at six: past that it is a wait, not a rhythm. */
export function Appear({ index = 0, animate = true, children, style }: {
  index?: number; animate?: boolean; children: ReactNode; style?: object;
}) {
  const reduced = useReducedMotion();
  return <Animated.View style={style}
    entering={reduced || !animate ? undefined
      : FadeInDown.duration(sys.motion.enter).delay(Math.min(index, 6) * sys.motion.stagger)}>
    {children}
  </Animated.View>;
}
