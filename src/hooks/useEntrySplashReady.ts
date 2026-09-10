import { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { releaseEntrySplash } from '../bootstrap/entrySplashBootstrap';

export type EntrySplashReadiness = 'pending' | 'ready' | 'skip';

/** A laid-out presentation releases the startup cover; it never controls Auth. */
export function useEntrySplashReady({ enabled = true, waitForScene = false }: {
  enabled?: boolean; waitForScene?: boolean;
} = {}) {
  const [laidOut, setLaidOut] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [readiness, setReadiness] = useState<EntrySplashReadiness>('pending');
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) setLaidOut(true);
  }, []);

  useEffect(() => {
    if (!enabled || !laidOut || (waitForScene && !sceneReady)) return;
    let active = true;
    let settled = false;
    let frame: number | undefined;
    const settle = (value: EntrySplashReadiness) => {
      if (!active || settled) return;
      settled = true;
      clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
      setReadiness(value);
    };
    // A broken native bridge must skip cosmetic motion rather than trap entry.
    // A timeout is never treated as evidence that the animation is visible.
    const timeout = setTimeout(() => settle('skip'), 1000);
    const reveal = async () => {
      try {
        // SDK57 hideAsync requests removal; disable its default 400ms exit fade.
        SplashScreen.setOptions({ duration: 0, fade: false });
        await releaseEntrySplash();
        if (!active || settled) return;
        // The first callback precedes a draw. Start only in the following frame,
        // after the laid-out native view had a chance to be presented.
        frame = requestAnimationFrame(() => {
          if (!active || settled) return;
          frame = requestAnimationFrame(() => settle('ready'));
        });
      } catch {
        settle('skip');
      }
    };
    void reveal();
    return () => {
      active = false;
      clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [enabled, laidOut, sceneReady, waitForScene]);

  return { readiness, onLayout, onSceneReady };
}
