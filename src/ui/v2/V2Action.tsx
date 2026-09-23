import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Check } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { useReducedMotion } from '../system/motion';
import { brandAction, sys } from '../system/tokens';

/** How long the confirmed check stays before the button says its label alone again. */
export const ACTION_SUCCESS_MS = 1200;
/** Every action's touch target: an important command is never under 48 px. */
export const ACTION_MIN_HEIGHT = 48;

/**
 * The one action of the app (master design plan, 2026-09-24: `V2Action` keeps its name, the old `Button` is gone).
 * Reuses existing UI-thread press feedback, system reduced motion and haptics.
 *
 * Kinds: primary = strong ink surface; secondary = white with a line; quiet = green text (a link-like action);
 * destructive = danger text. The one brand action on a screen is a secondary with `brandAction` style: the green
 * surface with a white label. Every other action is white with a green label (the forensic analysis's one rule for
 * buttons).
 *
 * States, each said to the eye and to a screen reader:
 * - disabled: a quiet wash with the label in muted ink, readable (5.0:1), never a faded ghost of the live button;
 * - loading: the button keeps its colour and its words, a spinner stands before them, it cannot be pressed twice and
 *   is spoken as busy;
 * - success: a check before the label for 1.2 s, only when the caller says the write is CONFIRMED (never on press);
 * - error: a danger outline and the caller's message right under the button, announced as an alert.
 * Every action is at least 48 px high; the primary 54, as `brandAction`.
 */
export function V2Action({ label, accessibilityLabel, onPress, disabled = false, kind = 'secondary', icon, style, compact = false,
  loading = false, success = false, error }: {
  label: string; onPress: () => void; disabled?: boolean;
  /** Row context for assistive technology without repeating the task title on the visible action. */
  accessibilityLabel?: string;
  kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode; style?: StyleProp<ViewStyle>;
  /** Smaller type for a secondary control that must not compete with the content. The
   *  touch target keeps its full minimum height, so it is no harder to hit. */
  compact?: boolean;
  /** The write this action started is in flight. */ loading?: boolean;
  /** The caller has the server's confirmation of the write; the check shows once, for 1.2 s. */ success?: boolean;
  /** Why the last attempt did not go through, in the caller's words; drawn under the button. */ error?: string | null;
}) {
  const onBrand = StyleSheet.flatten(style)?.backgroundColor === brandAction.backgroundColor;
  const confirmed = useConfirmed(success && !loading);
  const inactive = disabled || loading;
  // Loading is the button at work, not a button that cannot be used: it keeps its own colour.
  const resting = disabled && !loading;
  const filled = onBrand || kind === 'primary' || kind === 'secondary';
  const color = resting ? sys.color.muted : onBrand ? sys.color.onGreen : kind === 'primary' ? sys.color.surface
    : kind === 'destructive' ? sys.color.danger : sys.color.green;
  const lead = loading ? <ActivityIndicator size="small" color={color} /> : confirmed ? <ConfirmedCheck color={color} /> : icon;
  return <>
    <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={loading ? { disabled: true, busy: true } : { disabled }}
      onPress={onPress} disabled={inactive} haptic={inactive ? 'none' : kind === 'primary' ? 'light' : 'select'}
      style={[{ minHeight: kind === 'primary' ? 54 : ACTION_MIN_HEIGHT, borderRadius: sys.radius.control,
        paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, gap: sys.space.sm,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: kind === 'primary' ? sys.color.ink : kind === 'secondary' ? sys.color.surface : 'transparent',
        borderWidth: kind === 'secondary' ? 1 : 0, borderColor: sys.color.lineStrong }, style,
        resting && filled ? s.restingFilled : null, error ? s.errorEdge : null]}>
      {lead}<T variant={compact ? 'meta' : 'action'} style={{ flexShrink: 1, textAlign: 'center', color }}>{label}</T>
    </Press>
    {error ? <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</T> : null}
  </>;
}

/** True for `ACTION_SUCCESS_MS` after `success` turns on; a caller that keeps it on does not keep the check. */
function useConfirmed(success: boolean): boolean {
  const [shown, setShown] = useState(success);
  useEffect(() => {
    if (!success) { setShown(false); return; }
    setShown(true);
    const timer = setTimeout(() => setShown(false), ACTION_SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [success]);
  return shown;
}

/** The check settles in with a short scale on a real confirmation; under reduced motion it is simply there. */
function ConfirmedCheck({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.6)).current;
  useEffect(() => {
    if (reduced) { scale.setValue(1); return; }
    const run = Animated.timing(scale, { toValue: 1, duration: sys.motion.toggle, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [reduced, scale]);
  return <Animated.View testID="action-confirmed" style={{ transform: [{ scale }] }}><Check size={20} weight="bold" color={color} /></Animated.View>;
}

const s = StyleSheet.create({
  restingFilled: { backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  errorEdge: { borderWidth: 2, borderColor: sys.color.danger },
});
