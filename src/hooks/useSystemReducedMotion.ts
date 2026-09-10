import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Reanimated supplies the startup snapshot; native events keep it current. */
export function useSystemReducedMotion() {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let active = true, revision = 0;
    const refresh = () => {
      const request = ++revision;
      void AccessibilityInfo.isReduceMotionEnabled().then(value => {
        if (active && request === revision) setReduced(value);
      }).catch(() => {});
    };
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      revision++;
      if (active) setReduced(value);
    });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    refresh();
    return () => { active = false; revision++; preference.remove(); foreground.remove(); };
  }, []);
  return reduced;
}
