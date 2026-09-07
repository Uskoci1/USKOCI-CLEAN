import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { ENTRY_LOGO, ENTRY_TIMING, ENTRY_WINDOWS } from './entryReferenceData';

const CITY_IMAGE = require('../../../assets/generated/uskoci-entry-city.webp');
const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

type Keyframe = {
  readonly t: number;
  readonly s: readonly number[];
  readonly o?: readonly number[] | null;
  readonly i?: readonly number[] | null;
};

type LogoLayer = (typeof ENTRY_LOGO.slojevi)[number];
type WindowLight = (typeof ENTRY_WINDOWS)[number];

const END_MS = (ENTRY_TIMING.END_FRAME / ENTRY_TIMING.FR) * 1000;
const FLY_START = END_MS + ENTRY_TIMING.HOLD;
const USABLE = FLY_START + ENTRY_TIMING.FLIGHT;
const WORD_START = FLY_START + 360;
const TOTAL = USABLE + 900;
const FRAME_MS = 1000 / 60;

function clamp(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function soft(t: number) {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function out(t: number) {
  t = clamp(t);
  return 1 - Math.pow(1 - t, 3);
}

function bezierValue(x1: number, y1: number, x2: number, y2: number, t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let u = 0.5;
  let x = 0;
  for (let k = 0; k < 24; k += 1) {
    u = (lo + hi) / 2;
    const mt = 1 - u;
    x = 3 * mt * mt * u * x1 + 3 * mt * u * u * x2 + u * u * u;
    if (x < t) lo = u;
    else hi = u;
  }
  const m = 1 - u;
  return 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u;
}

function sample(kf: readonly Keyframe[], frame: number, count: number) {
  if (kf.length === 1) return kf[0].s.slice(0, count) as number[];
  for (let i = 0; i < kf.length - 1; i += 1) {
    const a = kf[i];
    const b = kf[i + 1];
    if (frame <= a.t) return a.s.slice(0, count) as number[];
    if (frame < b.t) {
      const raw = (frame - a.t) / (b.t - a.t);
      const eased = a.o && a.i ? bezierValue(a.o[0], a.o[1], a.i[0], a.i[1], raw) : raw;
      const result: number[] = [];
      for (let j = 0; j < count; j += 1) {
        const va = a.s[j] ?? 0;
        const vb = b.s[j] ?? va;
        result.push(va + (vb - va) * eased);
      }
      return result;
    }
  }
  return kf[kf.length - 1].s.slice(0, count) as number[];
}

function LogoLayerView({ layer, timeMs }: { layer: LogoLayer; timeMs: number }) {
  const frame = Math.min(ENTRY_TIMING.END_FRAME, (timeMs / 1000) * ENTRY_TIMING.FR);
  const p = sample(layer.p as readonly Keyframe[], frame, 2);
  const s = sample(layer.s as readonly Keyframe[], frame, 2);
  const o = sample(layer.o as readonly Keyframe[], frame, 1);
  const r = sample(layer.r as readonly Keyframe[], frame, 1);
  const a = layer.a;

  let transform = `translate(${p[0].toFixed(2)},${p[1].toFixed(2)})`;
  if (r[0]) transform += ` rotate(${r[0].toFixed(2)})`;
  transform += ` scale(${(s[0] / 100).toFixed(4)},${(s[1] / 100).toFixed(4)})`;
  transform += ` translate(${(-a[0]).toFixed(2)},${(-a[1]).toFixed(2)})`;

  return (
    <G opacity={o[0] / 100} transform={transform}>
      {layer.oblici.map((shape, index) => (
        <Path
          key={`${layer.nm}-${index}`}
          d={shape.d}
          fill={shape.fill || 'none'}
          opacity={shape.opacity ?? 1}
          stroke={shape.stroke || undefined}
          strokeWidth={shape.strokeW || undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </G>
  );
}

function WindowLightView({ light, index, timeMs }: { light: WindowLight; index: number; timeMs: number }) {
  const u = clamp((timeMs - ENTRY_TIMING.CITY_WAKE - light.kasni * 0.72) / 600);
  const fade = u * u * (3 - 2 * u);
  const breath = 1 + 0.025 * Math.sin(timeMs / (880 + (index % 5) * 70) + light.faza);
  const cap = 0.78 + (index % 4) * 0.045;
  const opacity = Math.min(cap, fade * breath * cap);
  const tones = ['#FFDDA3', '#F7C77B', '#FFE8B7', '#EFC071'] as const;
  const core = tones[index % tones.length];

  return (
    <G opacity={opacity}>
      <Circle
        cx={light.cx}
        cy={light.cy}
        r={light.pin ? 6.4 : 4.2}
        fill="url(#wide)"
        opacity={light.pin ? 0.3 : 0.18}
      />
      <Circle
        cx={light.cx}
        cy={light.cy}
        r={light.pin ? 2.8 : 2}
        fill="url(#near)"
        opacity={light.pin ? 0.46 : 0.32}
      />
      <Rect
        x={light.cx - light.w / 2}
        y={light.cy - light.h / 2}
        width={light.w}
        height={light.h}
        rx={0.28}
        fill={core}
        opacity={light.pin ? 0.92 : 0.72 + (index % 4) * 0.055}
      />
    </G>
  );
}

function OrangeGradient() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="entryOrange" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF9028" />
          <Stop offset="1" stopColor="#FF7A00" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#entryOrange)" />
    </Svg>
  );
}

export function ReferenceEntryHero({
  onSignIn,
  onRequester,
  onWorker,
}: {
  onSignIn: () => void;
  onRequester: () => void;
  onWorker: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [timeMs, setTimeMs] = useState(0);
  const [fontsLoaded] = useFonts({
    UskociRounded: require('../../../assets/generated/uskoci-rounded.ttf'),
  });

  const layoutScale = Math.min(width / 360, height / 640);
  const headlineSize = useMemo(() => Math.min(34, Math.max(27, height * 0.048)), [height]);

  useEffect(() => {
    let frameId = 0;
    let start = 0;
    let lastPaint = -FRAME_MS;

    const tick = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = Math.min(TOTAL, timestamp - start);
      if (elapsed - lastPaint >= FRAME_MS || elapsed >= TOTAL) {
        lastPaint = elapsed;
        setTimeMs(elapsed);
      }
      if (elapsed < TOTAL) frameId = requestAnimationFrame(tick);
    };

    setTimeMs(0);
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const flight = soft((timeMs - FLY_START) / ENTRY_TIMING.FLIGHT);
  const join = out((timeMs - WORD_START) / ENTRY_TIMING.WORD_JOIN);
  const markSize = lerp(ENTRY_TIMING.MARK0, ENTRY_TIMING.MARK1, flight);
  const markX = lerp(180, 20 + ENTRY_TIMING.MARK1 / 2 + insets.left / layoutScale, flight);
  const markY = lerp(258, 42 + insets.top / layoutScale, flight);
  const brandFontSize = lerp(ENTRY_TIMING.MARK1 * 0.83, ENTRY_TIMING.MARK1 * 0.8, flight) * layoutScale;
  const visualRight = 0.3571953125;
  const opticalGap = 0.8;
  const revealShift = (1 - join) * 9 * layoutScale;
  const homeProgress = soft((timeMs - USABLE) / ENTRY_TIMING.HOME_FADE);
  const homeReady = timeMs >= USABLE;

  const markStyle = {
    width: markSize * layoutScale,
    height: markSize * layoutScale,
    left: (markX - markSize / 2) * layoutScale,
    top: (markY - markSize / 2) * layoutScale,
  } as const;

  const wordStyle = {
    left: (markX + markSize * visualRight + opticalGap) * layoutScale,
    top: (markY + 2.8) * layoutScale,
    opacity: join * soft((flight - 0.32) / 0.68),
    transform: [{ translateX: -revealShift }, { translateY: -brandFontSize * 0.52 }],
  } as const;

  const wordTextStyle = {
    fontSize: brandFontSize,
    lineHeight: brandFontSize,
    letterSpacing: -0.6 * layoutScale,
  } as const;

  return (
    <View style={styles.root}>
      <Image source={CITY_IMAGE} resizeMode="cover" style={ABSOLUTE_FILL} />

      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width={width}
        height={height}
        viewBox="0 0 360 640"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <RadialGradient id="wide">
            <Stop offset="0" stopColor="#FFD89A" stopOpacity={0.28} />
            <Stop offset="0.42" stopColor="#FFB45E" stopOpacity={0.13} />
            <Stop offset="1" stopColor="#FF9A32" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="near">
            <Stop offset="0" stopColor="#FFF0C8" stopOpacity={0.72} />
            <Stop offset="0.52" stopColor="#FFD08A" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#FFAA55" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {ENTRY_WINDOWS.map((light, index) => (
          <WindowLightView
            key={`${light.cx}-${light.cy}-${index}`}
            light={light}
            index={index}
            timeMs={timeMs}
          />
        ))}
      </Svg>

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: homeProgress }]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0E3D37" stopOpacity={0} />
              <Stop offset="0.34" stopColor="#0E3D37" stopOpacity={0} />
              <Stop offset="0.66" stopColor="#0E3D37" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#0E3D37" stopOpacity={0.86} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#veil)" />
        </Svg>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.home,
          { opacity: homeProgress, transform: [{ translateY: (1 - homeProgress) * 14 }] },
        ]}
      >
        <View style={[styles.topbar, { top: insets.top, left: insets.left, right: insets.right }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Prijavi se"
            disabled={!homeReady}
            onPress={onSignIn}
            hitSlop={6}
            style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
          >
            <Text style={styles.signInText}>Prijavi se</Text>
          </Pressable>
        </View>

        <View style={[styles.center, { top: height * 0.29 }]}>
          <Text style={[styles.headline, { fontSize: headlineSize, lineHeight: headlineSize * 1.17 }]}>
            Čovek tamo{`\n`}gde Vi niste.
          </Text>
        </View>

        <View style={[styles.bottom, { bottom: 24 + insets.bottom, left: 24 + insets.left, right: 24 + insets.right }]}>
          <Pressable
            accessibilityRole="button"
            disabled={!homeReady}
            onPress={onRequester}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <OrangeGradient />
            <Text style={styles.primaryText}>Treba mi neko</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!homeReady}
            onPress={onWorker}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Želim da uskočim</Text>
          </Pressable>
          <Text style={styles.legal}>Uslovi korišćenja · Politika privatnosti</Text>
        </View>
      </View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.mark, markStyle]}>
          <View style={styles.markGlow} />
          <Svg width="100%" height="100%" viewBox="0 0 512 512">
            {ENTRY_LOGO.slojevi.map((layer) => (
              <LogoLayerView key={layer.nm} layer={layer} timeMs={timeMs} />
            ))}
          </Svg>
        </View>

        {fontsLoaded ? (
          <View style={[styles.word, wordStyle]}>
            <Text style={[styles.wordBase, styles.wordIvory, wordTextStyle]}>SKO</Text>
            <Text style={[styles.wordBase, styles.wordOrange, wordTextStyle]}>ČI</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0E3D37',
  },
  home: {
    ...ABSOLUTE_FILL,
    zIndex: 10,
  },
  topbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 60,
    paddingTop: 12,
    paddingRight: 20,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  signIn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  signInText: {
    color: '#F8EBD7',
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headline: {
    color: '#F8EBD7',
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  bottom: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    gap: 12,
  },
  primary: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7A00',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryText: {
    color: '#082D29',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondary: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8EBD7',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secondaryText: {
    color: '#082D29',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  legal: {
    color: 'rgba(248,235,215,0.70)',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 14,
    paddingTop: 2,
  },
  mark: {
    position: 'absolute',
    zIndex: 20,
    shadowColor: '#031F1C',
    shadowOpacity: 0.16,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 9 },
  },
  markGlow: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '8%',
    bottom: '8%',
    borderRadius: 999,
    backgroundColor: 'rgba(248,235,215,0.045)',
  },
  word: {
    position: 'absolute',
    flexDirection: 'row',
    zIndex: 20,
  },
  wordBase: {
    fontFamily: 'UskociRounded',
    fontWeight: '700',
    includeFontPadding: false,
  },
  wordIvory: {
    color: '#F8EBD7',
  },
  wordOrange: {
    color: '#FF7908',
  },
  pressed: {
    transform: [{ scale: 0.975 }],
  },
});
