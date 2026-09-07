import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SvgXml } from 'react-native-svg';
import { brandSvg } from './brandSvg';
import { splashTracks, SPLASH_DURATION_MS, type Frame } from './figmaSplashTracks';

const curves: Record<string, (t: number) => number> = {
  'ease-out': Easing.bezierFn(0, 0, 0.58, 1),
  'ease-in-out': Easing.bezierFn(0.42, 0, 0.58, 1),
  'cubic-bezier(0.5, 0, 0.5, 1)': Easing.bezierFn(0.5, 0, 0.5, 1),
  'cubic-bezier(0.25, 1, 0.5, 1)': Easing.bezierFn(0.25, 1, 0.5, 1),
  'cubic-bezier(0.16, 1, 0.3, 1)': Easing.bezierFn(0.16, 1, 0.3, 1),
  'cubic-bezier(0.22, 0.6, 0.36, 1)': Easing.bezierFn(0.22, 0.6, 0.36, 1),
};

// One shared UI-runtime clock keeps the twelve Figma nodes in the same cohort.
// The production intro plays once; its looping Figma preview is not a loading state.
function sample(frames: Frame[] | undefined, time: number, axis: number, fallback: number): number {
  'worklet';
  if (!frames?.length) return fallback;
  if (time <= frames[0].t) return frames[0].values[axis];
  for (let i = 1; i < frames.length; i++) {
    if (time > frames[i].t) continue;
    const a = frames[i - 1], b = frames[i];
    let t = (time - a.t) / (b.t - a.t);
    if (a.values[axis] === b.values[axis]) return a.values[axis];
    const ease = curves[a.easing];
    if (ease) t = ease(t);
    return a.values[axis] + (b.values[axis] - a.values[axis]) * t;
  }
  return frames[frames.length - 1].values[axis];
}

function MotionNode({ id, time, bounds, children }: {
  id: string; time: SharedValue<number>; bounds: readonly number[]; children: ReactNode;
}) {
  const tracks = splashTracks[id];
  const animated = useAnimatedStyle(() => {
    const t = time.get();
    return {
      opacity: sample(tracks.opacity, t, 0, 1),
      transform: [
        { translateX: sample(tracks.translate, t, 0, 0) },
        { translateY: sample(tracks.translate, t, 1, 0) },
        { scaleX: sample(tracks.scale, t, 0, 1) },
        { scaleY: sample(tracks.scale, t, 1, 1) },
        { rotate: `${sample(tracks.rotate, t, 0, 0)}rad` },
      ],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: bounds[0], top: bounds[1], width: bounds[2], height: bounds[3] }, animated]}>{children}</Animated.View>;
}

const mark = [
  ['15:491', 'entry-mark-0', 96.64952, 157.76620, 85.75324, 25.11050],
  ['15:493', 'entry-mark-1', 118.91685, 95.22816, 40.74465, 60.16967],
  ['15:495', 'entry-mark-2', 0, 0, 73.90841, 75.32996],
  ['15:497', 'entry-mark-3', 207.03856, 0, 72.96145, 75.32996],
  ['15:499', 'entry-mark-4', 94.75478, 259.15366, 39.32310, 31.74294],
  ['15:501', 'entry-mark-5', 1.42137, 85.75319, 179.08589, 205.14331],
  ['15:503', 'entry-mark-6', 116.54833, 85.75319, 161.08244, 180.03360],
] as const;
const words = [
  ['15:506', 'entry-word-0', 142.496, 184.5, 139, 87, 0.792, 19.24, 138, 53],
  ['15:507', 'entry-word-1', 287.496, 184.5, 46, 87, 1.008, 19.744, 44, 52],
  ['15:508', 'entry-word-2', 336.496, 184.5, 18, 87, 2.016, 20.248, 14, 51],
  ['15:509', 'entry-word-3', 301.496, 191.5, 18, 10, -2.7502, -2.75005, 24, 16],
] as const;

export function BrandScene({ animate = false, paused = false, onComplete }: { animate?: boolean; paused?: boolean; onComplete?: () => void }) {
  const time = useSharedValue(animate || paused ? 0 : SPLASH_DURATION_MS);
  useEffect(() => {
    if (!animate) { time.set(paused ? 0 : SPLASH_DURATION_MS); return; }
    time.set(0);
    time.set(withTiming(SPLASH_DURATION_MS, { duration: SPLASH_DURATION_MS, easing: Easing.linear }, finished => {
      if (finished && onComplete) scheduleOnRN(onComplete);
    }));
    return () => cancelAnimation(time);
  }, [animate, paused, onComplete, time]);
  return <View pointerEvents="none" accessible accessibilityRole="image" accessibilityLabel="USKOČI" style={styles.scene}>
    <MotionNode id="15:490" time={time} bounds={[55, 200, 280, 290.89658]}>
      {mark.map(([id, svg, ...bounds]) => <MotionNode key={id} id={id} time={time} bounds={bounds}>
        <SvgXml xml={brandSvg[svg]} width="100%" height="100%" />
      </MotionNode>)}
    </MotionNode>
    {words.map(([id, svg, x, y, w, h, dx, dy, sw, sh]) => <MotionNode key={id} id={id} time={time} bounds={[x, y, w, h]}>
      <View style={{ position: 'absolute', left: dx, top: dy }}><SvgXml xml={brandSvg[svg]} width={sw} height={sh} /></View>
    </MotionNode>)}
  </View>;
}

/** Crops the final frame, preserving the owner's exact outlined wordmark. */
export function BrandLockup({ width = 156 }: { width?: number }) {
  return <View style={{ width, height: width * 104 / 320, overflow: 'hidden' }}>
    <View style={{ width: 390, height: 844, transformOrigin: 'top left', transform: [{ scale: width / 320 }, { translateX: -39 }, { translateY: -174 }] }}>
      <BrandScene />
    </View>
  </View>;
}
const styles = StyleSheet.create({ scene: { width: 390, height: 844 } });
