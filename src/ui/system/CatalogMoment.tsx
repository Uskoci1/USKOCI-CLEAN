import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { CatalogArt } from './CatalogArt';

const support = require('../../../assets/catalog27/support.app32.json');
type Playback = { event: number };

/**
 * Source trial only, used by the .dev gallery. Each monotonically increasing event belongs to
 * one explicit presentation. Hidden/reduced/background events are consumed, never queued.
 * Rest and cancellation use the matching PNG; animation completion has no command callback.
 */
export function CatalogMoment({ event = null, focused, muted = false }: {
  event?: number | null; focused: boolean; muted?: boolean;
}) {
  const reduced = useSystemReducedMotion();
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');
  const [playback, setPlayback] = useState<Playback | null>(null);
  const consumed = useRef<number | null>(null);
  useEffect(() => {
    let live = true;
    const subscription = AppState.addEventListener('change', state => {
      if (!live) return;
      setForeground(state === 'active');
      if (state !== 'active') setPlayback(null);
    });
    return () => { live = false; subscription.remove(); };
  }, []);
  const admitted = focused && foreground && !reduced && !muted;
  useLayoutEffect(() => {
    if (event !== consumed.current) {
      consumed.current = event;
      setPlayback(event !== null && admitted ? { event } : null);
    } else if (!admitted) setPlayback(null);
  }, [event, admitted]);
  const current = admitted && playback?.event === event ? playback : null;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    pointerEvents="none" style={s.frame}>
    {current ? <LottieView key={current.event} source={support} autoPlay loop={false} style={s.frame}
      onAnimationFinish={() => setPlayback(value => value === current ? null : value)}
      onAnimationFailure={() => setPlayback(value => value === current ? null : value)} />
      : <CatalogArt kind="support" muted={muted} />}
  </View>;
}

const s = StyleSheet.create({ frame: { width: 32, height: 32, flexShrink: 0 } });
