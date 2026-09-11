import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useSystemReducedMotion } from './useSystemReducedMotion';
import type { EntrySplashReadiness } from './useEntrySplashReady';

const KEY = 'uskoci.presentation.intro-seen.v1';
export function useEntryIntro(readiness: EntrySplashReadiness) {
  const reduced = useSystemReducedMotion();
  const [phase, setPhase] = useState<'loading' | 'intro' | 'welcome'>(reduced ? 'welcome' : 'loading');
  const lifetime = useRef(0);
  const mounted = useRef(false);
  const finished = useRef(reduced);
  const finish = useCallback(() => {
    if (!mounted.current || finished.current) return;
    finished.current = true;
    setPhase('welcome');
    void AsyncStorage.setItem(KEY, '1').catch(() => {});
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (reduced) { finish(); setPhase('welcome'); return; }
    const owner = ++lifetime.current;
    let settled = false;
    const settle = (seen: boolean) => {
      if (settled || owner !== lifetime.current || finished.current) return;
      settled = true;
      setPhase(seen ? 'welcome' : 'intro');
    };
    // Cosmetic storage must never block entry, even if its transport hangs.
    const timer = setTimeout(() => settle(true), 500);
    void AsyncStorage.getItem(KEY).then(value => settle(value === '1'), () => settle(true));
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') finish(); });
    return () => { lifetime.current++; clearTimeout(timer); subscription.remove(); };
  }, [finish, reduced]);
  // Prepare and run the original scene beneath the native cover. Its own UI
  // frame acknowledgement releases that cover; waiting for hide here deadlocks
  // that acknowledgement and previously exposed the source's empty t=0 frame.
  const visiblePhase = phase === 'intro' && readiness === 'skip' ? 'welcome' : phase;
  return { phase: visiblePhase, prepared: phase !== 'loading', finish };
}
