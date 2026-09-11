import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useFrameCallback, useSharedValue, withTiming, type FrameCallback, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { G, Path } from 'react-native-svg';
import { brandParts, brandWords } from './spojBrandData';
import { BRAND_PARTS, brandFrame, INTRO_DURATION_MS, type Box } from './spojBrandMath';

const AnimatedG = Animated.createAnimatedComponent(G);
const PHONE = { x: 0, y: 0, width: 390, height: 844 };
const LOGO = { x: 43, y: 185, width: 304, height: 98.8 };

/** One UI-runtime clock for the exact executable V2 rIntroFrame timeline. */
export function useBrandClock(animate: boolean, paused: boolean, onComplete?: () => void,
  onVisibleFrame?: (sourceTimeMs: number) => void) {
  const time = useSharedValue(animate || paused ? 0 : INTRO_DURATION_MS);
  const firstVisibleTimestamp = useSharedValue<number | null>(null);
  const frameDelivered = useSharedValue(false);
  const uiOwner = useSharedValue(0);
  const lifetime = useRef({ active: false, owner: 0 });
  const observerRef = useRef<FrameCallback | null>(null);
  const deliverVisible = useCallback((owner: number, sourceTimeMs: number) => {
    if (!lifetime.current.active || lifetime.current.owner !== owner) return;
    lifetime.current.active = false;
    observerRef.current?.setActive(false);
    onVisibleFrame?.(sourceTimeMs);
  }, [onVisibleFrame]);
  const observer = useFrameCallback(frame => {
    if (frameDelivered.get()) return;
    // Use the actual source tracks, not a guessed delay. At exactly 40ms the
    // first arms still have opacity zero. Geometry does not alter their opacity.
    const sourceTime = time.get();
    const visible = brandFrame(sourceTime, PHONE, LOGO).parts.some(part => part.opacity > 0);
    if (!visible) { firstVisibleTimestamp.set(null); return; }
    const previous = firstVisibleTimestamp.get();
    if (previous === null) { firstVisibleTimestamp.set(frame.timestamp); return; }
    // A later UI frame follows the draw opportunity for the preceding nonzero
    // artwork. A React layout, shared-value write or two JS RAFs is insufficient.
    if (frame.timestamp <= previous) return;
    frameDelivered.set(true);
    scheduleOnRN(deliverVisible, uiOwner.get(), sourceTime);
  }, false);
  observerRef.current = observer;
  useEffect(() => {
    const owner = lifetime.current.owner + 1;
    const active = !!onVisibleFrame && !paused;
    lifetime.current = { active, owner };
    uiOwner.set(owner); firstVisibleTimestamp.set(null); frameDelivered.set(false);
    observer.setActive(active);
    return () => { lifetime.current.active = false; observer.setActive(false); };
  }, [animate, paused, onVisibleFrame, observer, uiOwner, firstVisibleTimestamp, frameDelivered]);
  useEffect(() => {
    if (!animate) { time.set(paused ? 0 : INTRO_DURATION_MS); return; }
    time.set(0);
    time.set(withTiming(INTRO_DURATION_MS, { duration: INTRO_DURATION_MS, easing: Easing.linear }, finished => {
      if (finished && onComplete) scheduleOnRN(onComplete);
    }));
    return () => cancelAnimation(time);
  }, [animate, paused, onComplete, time]);
  return time;
}

function BrandPart({ index, time, phone, logo }: { index: number; time: SharedValue<number>; phone: Box; logo: Box }) {
  const props = useAnimatedProps(() => {
    const f = brandFrame(time.get(), phone, logo).parts[index];
    // Native SVG's column-major matrix preserves the HTML transform order.
    return { opacity: f.opacity, matrix: [f.sx, 0, 0, f.sy, f.dx + f.cx * (1 - f.sx), f.dy + f.cy * (1 - f.sy)] };
  });
  return <G transform={`translate(${BRAND_PARTS[index][0]} ${BRAND_PARTS[index][1]})`}>
    <AnimatedG animatedProps={props}>{brandParts[index].map((path, key) => <Path key={key} {...path} />)}</AnimatedG>
  </G>;
}

/** Measured phone and logo boxes share coordinates; no raster or font substitution. */
export function BrandArtwork({ time, phone, logo }: { time: SharedValue<number>; phone: Box; logo: Box }) {
  const markProps = useAnimatedProps(() => {
    const f = brandFrame(time.get(), phone, logo).mark;
    return { opacity: 1, matrix: [f.scale, 0, 0, f.scale, f.x, f.y] };
  });
  const k = logo.width / 320;
  const wordStyle = useAnimatedStyle(() => {
    const frame = brandFrame(time.get(), phone, logo);
    return { width: frame.wordClipWidth * k, opacity: frame.wordOpacity };
  });
  return <View style={{ width: phone.width, height: phone.height }} pointerEvents="none" accessible={false}>
    <Svg width={phone.width} height={phone.height} viewBox={`0 0 ${phone.width} ${phone.height}`} style={StyleSheet.absoluteFill} accessible={false}>
      <G transform={`translate(${logo.x - 39 * k} ${logo.y - 174 * k}) scale(${k})`}>
        <AnimatedG animatedProps={markProps}><G transform="rotate(.40107046 140 145.44829)">
          {BRAND_PARTS.map((_, index) => <BrandPart key={index} index={index} time={time} phone={phone} logo={logo} />)}
        </G></AnimatedG>
      </G>
    </Svg>
    {/* The source clip (138,170,225,108) in the same transformed logo space.
        A native view clips fixed-size SVG artwork; only its viewport changes on
        the UI thread, independently of dynamic SVG Defs/ClipPath invalidation. */}
    <Animated.View testID="entry-word-reveal" collapsable={false} pointerEvents="none" accessible={false}
      style={[{ position: 'absolute', left: logo.x + 99 * k, top: logo.y - 4 * k,
        height: 108 * k, overflow: 'hidden' }, wordStyle]}>
      <Svg width={225 * k} height={108 * k} viewBox="138 170 225 108" style={{ flexShrink: 0 }} accessible={false}>
        {brandWords.map((word, index) => <G key={index} transform={word.transform}>{word.paths.map((path, key) => <Path key={key} {...path} />)}</G>)}
      </Svg>
    </Animated.View>
  </View>;
}

export function BrandScene({ animate = false, paused = false, onComplete }: { animate?: boolean; paused?: boolean; onComplete?: () => void }) {
  const time = useBrandClock(animate, paused, onComplete);
  return <BrandArtwork time={time} phone={PHONE} logo={LOGO} />;
}

export { BrandLockup, BrandMark } from './BrandAssets';
