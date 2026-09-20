import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useFrameCallback, useSharedValue, withTiming, type FrameCallback, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { G, Path } from 'react-native-svg';
import { brandParts, brandWords } from './spojBrandData';
import { BRAND_PARTS, brandFrame, INTRO_DURATION_MS, type Box } from './spojBrandMath';
import type { EntrySplashReadiness } from '../../hooks/useEntrySplashReady';

const AnimatedG = Animated.createAnimatedComponent(G);
const PHONE = { x: 0, y: 0, width: 390, height: 844 };
const LOGO = { x: 43, y: 185, width: 304, height: 98.8 };

type SplashHandoff = { readiness: EntrySplashReadiness; phone: Box; logo: Box };

/** First integer-ms source sample with an in-viewport, nonzero 8-bit arm.
 * This is preparation, not a claim that Android has displayed a frame. */
export function entryPreparationSourceTime(phone: Box, logo: Box): number {
  const k = logo.width / 320, angle = .40107046 * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let t = 0; t <= INTRO_DURATION_MS; t++) {
    const frame = brandFrame(t, phone, logo);
    const intersects = frame.parts.some((part, index) => {
      if (Math.floor(part.opacity * 255) === 0) return false;
      const [x, y, width, height] = BRAND_PARTS[index];
      const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([px, py]) => {
        const localX = x + part.dx + part.cx * (1 - part.sx) + px * part.sx - 140;
        const localY = y + part.dy + part.cy * (1 - part.sy) + py * part.sy - 145.44829;
        return [logo.x - 39 * k + k * (frame.mark.x + frame.mark.scale * (140 + localX * cos - localY * sin)),
          logo.y - 174 * k + k * (frame.mark.y + frame.mark.scale * (145.44829 + localX * sin + localY * cos))];
      });
      const xs = corners.map(point => point[0]), ys = corners.map(point => point[1]);
      return Math.max(...xs) > phone.x && Math.min(...xs) < phone.x + phone.width &&
        Math.max(...ys) > phone.y && Math.min(...ys) < phone.y + phone.height;
    });
    if (intersects) return t;
  }
  throw new RangeError('Original Entry artwork must intersect its measured viewport.');
}

/** One source clock; the splash handshake holds preparation without spending it. */
export function useBrandClock(animate: boolean, paused: boolean, onComplete?: () => void,
  onPreparedFrame?: (sourceTimeMs: number) => void, handoff?: SplashHandoff) {
  const seed = useMemo(() => handoff && animate && !paused ? entryPreparationSourceTime(handoff.phone, handoff.logo) : null,
    [animate, paused, !!handoff, handoff?.phone.x, handoff?.phone.y, handoff?.phone.width, handoff?.phone.height,
      handoff?.logo.x, handoff?.logo.y, handoff?.logo.width, handoff?.logo.height]);
  const time = useSharedValue(animate || paused ? 0 : INTRO_DURATION_MS);
  const firstVisibleTimestamp = useSharedValue<number | null>(null);
  const frameDelivered = useSharedValue(false);
  const waitingForCover = useSharedValue(false);
  const coverAcknowledged = useSharedValue(false);
  const coverFrameTimestamp = useSharedValue<number | null>(null);
  const uiOwner = useSharedValue(0);
  const lifetime = useRef({ active: false, owner: 0, prepared: false });
  const observerRef = useRef<FrameCallback | null>(null);
  const stopObserver = useCallback((owner: number) => {
    if (lifetime.current.active && lifetime.current.owner === owner) observerRef.current?.setActive(false);
  }, []);
  const deliverPrepared = useCallback((owner: number, sourceTimeMs: number) => {
    if (!lifetime.current.active || lifetime.current.owner !== owner || lifetime.current.prepared) return;
    lifetime.current.prepared = true;
    if (seed === null) stopObserver(owner);
    onPreparedFrame?.(sourceTimeMs);
  }, [onPreparedFrame, seed, stopObserver]);
  const deliverComplete = useCallback((owner: number) => {
    if (lifetime.current.active && lifetime.current.owner === owner) onComplete?.();
  }, [onComplete]);
  const observer = useFrameCallback(frame => {
    const sourceTime = time.get();
    if (!frameDelivered.get()) {
      const prepared = brandFrame(sourceTime, PHONE, LOGO).parts.some(part => part.opacity > 0);
      if (!prepared) { firstVisibleTimestamp.set(null); return; }
      const previous = firstVisibleTimestamp.get();
      if (previous === null) { firstVisibleTimestamp.set(frame.timestamp); return; }
      if (frame.timestamp <= previous) return;
      // Android may suppress OnPreDraw under its cover. This acknowledges only
      // prepared source values; the source clock remains held through RN latency.
      frameDelivered.set(true);
      scheduleOnRN(deliverPrepared, uiOwner.get(), sourceTime);
      return;
    }
    if (!waitingForCover.get() || !coverAcknowledged.get()) return;
    const previous = coverFrameTimestamp.get();
    if (previous === null) { coverFrameTimestamp.set(frame.timestamp); return; }
    if (frame.timestamp <= previous) return;
    waitingForCover.set(false);
    const owner = uiOwner.get();
    // hideAsync is a request acknowledgement, not a removal fence. Preserve the
    // held source state through later UI draw opportunities before continuing.
    time.set(withTiming(INTRO_DURATION_MS, { duration: INTRO_DURATION_MS - sourceTime, easing: Easing.linear }, finished => {
      if (finished) scheduleOnRN(deliverComplete, owner);
    }));
    scheduleOnRN(stopObserver, owner);
  }, false);
  observerRef.current = observer;
  useEffect(() => {
    coverAcknowledged.set(handoff?.readiness === 'ready');
  }, [handoff?.readiness, coverAcknowledged]);
  useEffect(() => {
    const owner = lifetime.current.owner + 1;
    lifetime.current = { active: true, owner, prepared: false };
    uiOwner.set(owner); firstVisibleTimestamp.set(null); frameDelivered.set(false);
    waitingForCover.set(seed !== null); coverFrameTimestamp.set(null);
    time.set(paused ? 0 : animate ? seed ?? 0 : INTRO_DURATION_MS);
    if (animate && !paused && seed === null) {
      time.set(withTiming(INTRO_DURATION_MS, { duration: INTRO_DURATION_MS, easing: Easing.linear }, finished => {
        if (finished) scheduleOnRN(deliverComplete, owner);
      }));
    }
    observer.setActive(!paused && (!!onPreparedFrame || seed !== null));
    return () => { lifetime.current.active = false; observer.setActive(false); cancelAnimation(time); };
  }, [animate, paused, seed, onPreparedFrame, deliverComplete, observer, uiOwner, firstVisibleTimestamp,
    frameDelivered, waitingForCover, coverFrameTimestamp, time]);
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
