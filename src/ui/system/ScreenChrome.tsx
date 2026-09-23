import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ArrowLeft, User, X, type Icon } from 'phosphor-react-native';
import { BrandLockup } from '../entry/BrandAssets';
import { Press } from '../Press';
import { T } from '../Text';
import { useReducedMotion } from './motion';
import { iconButton, sys } from './tokens';

/**
 * The one screen chrome (master design plan, 2026-09-24): every screen's top bar is one of three kinds, and all three
 * share one height, one control size, one icon size, one side padding and one title style, so moving from screen to
 * screen never shifts the arrow, the title or the first line of content.
 *
 * - `root`   — the three tabs: the profile on the left, the USKOČI mark centred on the screen, the inbox on the right.
 *              The tab bar already says which part of the app this is, so no section title is drawn; the section's
 *              name reaches a screen reader as the mark's label ("USKOČI, Dogovori").
 * - `detail` — a screen opened from somewhere: the arrow back, the content's name when the content does not already
 *              carry it large, and at most one control on the right (the "···" of rare actions).
 * - `flow`   — one job with one way out: the close X, the flow's name and where you are in it ("Korak 2 od 4").
 *
 * No eyebrow and no sentence that explains where you are (owner, 2026-09-23): a person who opened a task knows they
 * opened a task. `ScreenHeader`, `DetailTopBar` and `ProductHeader` are thin wrappers over this, so every screen that
 * uses them follows without being edited.
 */
export const chrome = {
  /** 48 px controls (sys.touch: important commands are never under 48) with 8 px above and below. */
  minHeight: 64,
  paddingHorizontal: 20,
  paddingVertical: 8,
  gap: 12,
  control: 48,
  icon: 22,
} as const;

/** A 48 px control in the chrome: the arrow, the X, "···", search or a filter. `active` is weight and colour together. */
export function ChromeIconButton({ label, hint, icon: IconComponent, active, disabled = false, onPress, round = false, children }: {
  label: string; hint?: string; icon: Icon;
  /** Set for a toggle (search, filters): shown by weight and colour together, and spoken as selected. */ active?: boolean;
  disabled?: boolean; onPress: () => void;
  /** Round and white, as the tab screens draw their controls beside the round profile and bell. */ round?: boolean;
  children?: ReactNode;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    // A toggle speaks whether it is on; a plain control speaks only whether it can be pressed.
    accessibilityState={active === undefined ? { disabled } : disabled ? { selected: active, disabled } : { selected: active }} disabled={disabled}
    onPress={onPress} haptic={disabled ? 'none' : 'select'} style={[iconButton, round && s.round, active && s.active, disabled && s.disabled]}>
    <IconComponent size={chrome.icon} color={active ? sys.color.green : sys.color.ink} weight={active ? 'fill' : 'regular'} />
    {children}
  </Press>;
}

type RootChrome = {
  variant: 'root';
  /** The section's name, said to a screen reader with the mark; never drawn. */ title: string;
  onProfile: () => void;
  /** At most one screen control, drawn before the bell. */ right?: ReactNode;
  /**
   * The inbox bell. It is handed in by `ScreenHeader` rather than imported here: the detail and flow bars are used by
   * screens whose suites isolate the data layer, and the bell reads the inbox.
   */
  bell: ReactNode;
};
type DetailChrome = {
  variant: 'detail';
  onBack: () => void;
  /** The content's name. Omit it when the content carries its own large title (a task, a person). */ title?: string;
  /** A quiet line under the title: a state, a count. */ subtitle?: string;
  /**
   * Set to show the title only once the content's own title has scrolled away (`useChromeTitleOnScroll`); it fades in
   * over 180 ms, at once under reduced motion. Leave it out and the title is always there.
   */
  titleVisible?: boolean;
  /** Something that stands before the title and belongs to it, as a person's face before their name. */ lead?: ReactNode;
  backLabel?: string; disabled?: boolean;
  /** At most one control, usually "···" for rare actions. */ right?: ReactNode;
};
type FlowChrome = {
  variant: 'flow';
  onClose: () => void;
  title?: string;
  /** Where you are in the flow, "Korak 2 od 4". */ step?: string;
  closeLabel?: string; disabled?: boolean; right?: ReactNode;
};
export type ScreenChromeProps = RootChrome | DetailChrome | FlowChrome;

export function ScreenChrome(props: ScreenChromeProps) {
  if (props.variant === 'root') return <View style={s.bar}>
    <Press accessibilityRole="button" accessibilityLabel="Moj profil" onPress={props.onProfile} haptic="select" style={[iconButton, s.avatar]}>
      <User size={chrome.icon} weight="bold" color={sys.color.green} />
    </Press>
    {/* Centred on the screen, not between the two sides, so it never shifts when the right side holds two controls. */}
    <View pointerEvents="none" style={s.brand}>
      <View accessible accessibilityRole="header" accessibilityLabel={`USKOČI, ${props.title}`}><BrandLockup width={112} /></View>
    </View>
    <View style={s.side}>
      {props.right}
      {props.bell}
    </View>
  </View>;

  if (props.variant === 'flow') return <View style={s.bar}>
    <ChromeIconButton label={props.closeLabel ?? 'Zatvori'} icon={X} disabled={props.disabled} onPress={props.onClose} />
    <View style={s.copy}>
      {props.title ? <T accessibilityRole="header" variant="title" numberOfLines={2} style={s.title}>{props.title}</T> : null}
    </View>
    {props.step ? <T variant="meta" tone="muted" style={s.step}>{props.step}</T> : null}
    {props.right}
  </View>;

  const { title, subtitle, titleVisible } = props;
  return <View style={s.bar}>
    <ChromeIconButton label={props.backLabel ?? 'Nazad'} icon={ArrowLeft} disabled={props.disabled} onPress={props.onBack} />
    {props.lead}
    <View style={s.copy}>
      {title && titleVisible === undefined ? <ChromeTitle title={title} subtitle={subtitle} />
        : title ? <FadingTitle visible={titleVisible!}><ChromeTitle title={title} subtitle={subtitle} /></FadingTitle>
          : subtitle ? <T variant="meta" tone="muted" numberOfLines={1}>{subtitle}</T> : null}
    </View>
    {props.right}
  </View>;
}

function ChromeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <>
    <T accessibilityRole="header" variant="title" numberOfLines={2} style={s.title}>{title}</T>
    {subtitle ? <T variant="meta" tone="muted" numberOfLines={1}>{subtitle}</T> : null}
  </>;
}

/** The scrolled-in title: a short fade and a 4 px rise on a real change only; hidden from a screen reader while unseen. */
function FadingTitle({ visible, children }: { visible: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const shown = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { shown.setValue(visible ? 1 : 0); return; }
    const run = Animated.timing(shown, { toValue: visible ? 1 : 0, duration: sys.motion.toggle,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [visible, reduced, shown]);
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  return <Animated.View testID="chrome-title" accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={{ opacity: shown, transform: [{ translateY }] }}>{children}</Animated.View>;
}

/**
 * The detail chrome's title appears once the content's own title has scrolled past `threshold` (its height, roughly).
 * Pass `onScroll` to the screen's ScrollView with `scrollEventThrottle={16}`; state changes only when the line is crossed.
 */
export function useChromeTitleOnScroll(threshold = 72): { titleVisible: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const [titleVisible, setTitleVisible] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = event.nativeEvent.contentOffset.y > threshold;
    setTitleVisible(current => current === past ? current : past);
  }, [threshold]);
  return { titleVisible, onScroll };
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: chrome.gap, minHeight: chrome.minHeight,
    paddingHorizontal: chrome.paddingHorizontal, paddingVertical: chrome.paddingVertical },
  copy: { flex: 1, minWidth: 0 },
  title: { color: sys.color.ink },
  step: { fontVariant: ['tabular-nums'] },
  avatar: { borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, borderWidth: 1, borderColor: sys.color.line },
  brand: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingVertical: chrome.paddingVertical },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: { borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line },
  active: { backgroundColor: sys.color.greenSoft },
  disabled: { opacity: 0.5 },
});
