import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet, SHEET_TOUCH } from '../product/ProductSheet';
import { sys } from './tokens';

export type ConfirmRequest = {
  title: string;
  /** One sentence: what will happen, in the words the person reads. */
  message: string;
  confirmLabel: string;
  /** The quiet way out; "Odustani" when left out. `null` for a notice that only informs and has nothing to cancel. */
  cancelLabel?: string | null;
  /** `danger` when confirming ends, withdraws or throws something away: the confirm is drawn in the danger colour. */
  tone?: 'default' | 'danger';
  /** Runs at most once. A returned promise keeps the confirm busy and the sheet open until it settles. The sheet never
   *  reports success or failure itself: the screen that owns the command shows its outcome. */
  onConfirm?: () => void | Promise<unknown>;
  /** Every ending that is not the confirm: the cancel button, Back, a tap outside, a drag down, or the sheet being
   *  retired by its screen. Runs at most once, and never after the confirm. */
  onCancel?: () => void;
};

/**
 * A question asked inside the app instead of a system alert: a title, one sentence, a quiet cancel and ONE confirm.
 * Mounted means open. `onClosed` runs once the sheet is gone (or was taken away by its parent), whatever ended it.
 */
export function ConfirmSheet({ title, message, confirmLabel, cancelLabel = 'Odustani', tone = 'default', onConfirm, onCancel,
  onClosed, reduced }: ConfirmRequest & { onClosed: () => void; reduced?: boolean }) {
  const [busy, setBusy] = useState(false);
  const decided = useRef(false), closed = useRef(false), alive = useRef(true);
  const latest = useRef({ onCancel, onClosed }); latest.current = { onCancel, onClosed };
  const decline = useCallback(() => { if (decided.current) return; decided.current = true; latest.current.onCancel?.(); }, []);
  const ended = useCallback(() => { decline(); if (closed.current) return; closed.current = true; latest.current.onClosed(); }, [decline]);
  // Taken away by its screen (retired, or the branch that drew it is gone): that is not a confirm.
  useEffect(() => { alive.current = true; return () => { alive.current = false; ended(); }; }, [ended]);
  const confirm = (dismiss: () => void) => {
    if (decided.current) return;
    decided.current = true;
    let result: unknown;
    try { result = onConfirm?.(); } catch (error) { dismiss(); throw error; }
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      setBusy(true);
      // Busy until the sheet is gone: the button does not flash back to pressable while it slides away.
      const settle = () => { if (alive.current) dismiss(); };
      (result as PromiseLike<unknown>).then(settle, settle);
      return;
    }
    dismiss();
  };
  const cancel = (dismiss: () => void) => { if (busy || decided.current) return; decline(); dismiss(); };
  const danger = tone === 'danger';
  return <ProductSheet title={title} closeButton={false} dismissible={!busy} reduced={reduced} onClose={ended}
    footer={dismiss => <View style={s.actions}>
      <Press testID="confirm-sheet-confirm" accessibilityRole="button" accessibilityLabel={confirmLabel}
        accessibilityState={{ disabled: busy, busy }} disabled={busy} haptic={busy ? 'none' : danger ? 'medium' : 'light'}
        onPress={() => confirm(dismiss)} style={[s.confirm, danger ? s.danger : s.primary]}>
        {busy ? <ActivityIndicator accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={sys.color.surface} /> : null}
        <T variant="action" style={s.onFilled}>{confirmLabel}</T>
      </Press>
      {cancelLabel === null ? null : <Press testID="confirm-sheet-cancel" accessibilityRole="button" accessibilityLabel={cancelLabel}
        accessibilityState={{ disabled: busy }} disabled={busy} haptic="select" onPress={() => cancel(dismiss)}
        style={[s.cancel, busy && s.faded]}>
        <T variant="action" style={s.quiet}>{cancelLabel}</T>
      </Press>}
    </View>}>
    {() => <T variant="copy" tone="muted">{message}</T>}
  </ProductSheet>;
}

type Held = ConfirmRequest & { id: number };

/**
 * A confirmation asked where `Alert.alert` used to be: `ask` takes the same title, sentence, labels and callbacks, and
 * the screen renders `sheet` anywhere in its tree. The callbacks are the caller's own closures, captured when it asked,
 * so every guard inside them decides exactly as it did before. `close` retires an open question silently (its
 * `onCancel` still runs), for a screen that has just made its own answer stale.
 */
export function useConfirmSheet(options: { reduced?: boolean } = {}): {
  ask: (request: ConfirmRequest) => void; close: () => void; open: boolean; sheet: ReactElement | null;
} {
  const [held, setHeld] = useState<Held | null>(null);
  const next = useRef(0);
  const ask = useCallback((request: ConfirmRequest) => { setHeld({ ...request, id: ++next.current }); }, []);
  const close = useCallback(() => setHeld(null), []);
  let sheet: ReactElement | null = null;
  if (held) {
    const { id, ...request } = held;
    sheet = <ConfirmSheet key={id} {...request} reduced={options.reduced}
      onClosed={() => setHeld(current => current?.id === id ? null : current)} />;
  }
  return { ask, close, open: held !== null, sheet };
}

const s = StyleSheet.create({
  actions: { gap: 4 },
  confirm: { minHeight: 54, borderRadius: sys.radius.primary, paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: sys.color.green },
  danger: { backgroundColor: sys.color.danger },
  onFilled: { color: sys.color.surface, textAlign: 'center', flexShrink: 1 },
  cancel: { minHeight: SHEET_TOUCH, borderRadius: sys.radius.primary, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  faded: { opacity: 0.45 },
  quiet: { color: sys.color.green, textAlign: 'center' },
});
