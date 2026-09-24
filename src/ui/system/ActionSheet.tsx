import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet } from '../product/ProductSheet';
import { FactArt, type FactArtKind } from './FactArt';
import { pictureWell, sys } from './tokens';

export type SheetAction = {
  key: string;
  /** What the action does, as a command: "Prijavi ili blokiraj", "Otkaži Dogovor". */
  label: string;
  icon: FactArtKind;
  onPress: () => void;
  /** Ends, removes or reports something. Always drawn last and in the danger colour, whatever order it was given in. */
  destructive?: boolean;
  disabled?: boolean;
  /** Said by a screen reader after the label, when the label alone does not say what happens. */
  hint?: string;
  /**
   * One quiet line under the label, for what a sighted person needs before choosing and the label cannot say ("Postojeći
   * Dogovori se otkazuju zasebno." beside a task that can no longer be cancelled as a whole). A screen reader hears it as
   * the hint, followed by the row's own hint when it has one, so what is on screen is never left unsaid. Not for
   * decoration: most rows have none.
   */
  subtitle?: string;
};

/** Destructive actions go last; everything else keeps the order the screen chose. */
export function orderActions(actions: readonly SheetAction[]): SheetAction[] {
  return [...actions.filter(action => !action.destructive), ...actions.filter(action => action.destructive)];
}

/**
 * The "···" menu: a list of labelled actions, each with its FactArt picture. The chosen action runs once the sheet has
 * gone, so a navigation or a new sheet never starts underneath this one.
 */
export function ActionSheet({ title, label = 'Radnje', actions, onClose, reduced }: {
  /** A visible title, only when the menu is about something the screen does not already name. */
  title?: string;
  /** What assistive technology calls the menu when it has no visible title. */
  label?: string;
  actions: readonly SheetAction[];
  onClose: () => void;
  reduced?: boolean;
}) {
  const chosen = useRef<SheetAction | null>(null);
  const closed = useCallback(() => { const action = chosen.current; chosen.current = null; onClose(); action?.onPress(); }, [onClose]);
  const ordered = orderActions(actions);
  const firstDestructive = ordered.findIndex(action => action.destructive);
  // The sheet's own name sits on a container a screen reader skips, so an untitled menu carries it where it is read. A
  // titled one does not repeat it: the visible heading is read right before the menu, and saying it twice is noise.
  return <ProductSheet title={title} label={label} reduced={reduced} onClose={closed} backdropHint="Zatvara meni bez izbora.">
    {dismiss => <View accessibilityRole="menu" accessibilityLabel={title ? undefined : label} style={s.list}>
      {ordered.map((action, index) => <View key={action.key}>
        {index > 0 && index === firstDestructive ? <View style={s.rule} /> : null}
        <Press accessibilityRole="menuitem" accessibilityLabel={action.label} accessibilityHint={[action.subtitle, action.hint].filter(Boolean).join(' ') || undefined}
          accessibilityState={{ disabled: !!action.disabled }} disabled={action.disabled}
          haptic={action.disabled ? 'none' : action.destructive ? 'medium' : 'select'}
          onPress={() => { if (action.disabled || chosen.current) return; chosen.current = action; dismiss(); }}
          style={[s.row, action.disabled && s.disabled]}>
          <View style={[pictureWell, action.destructive && s.dangerWell]}>
            <FactArt kind={action.icon} size={28} muted={action.destructive || action.disabled} /></View>
          {action.subtitle ? <View style={s.copy}>
            <T variant="bodyStrong" style={[s.ink, action.destructive && s.danger]}>{action.label}</T>
            <T variant="note" tone="muted">{action.subtitle}</T>
          </View> : <T variant="bodyStrong" style={[s.label, action.destructive && s.danger]}>{action.label}</T>}
        </Press>
      </View>)}
    </View>}
  </ProductSheet>;
}

/** The row's inset and the gap after its picture; the rule before the destructive group starts where the labels do. */
const ROW_INSET = sys.space.xs, ROW_GAP = sys.space.md;
const s = StyleSheet.create({
  list: { gap: sys.space.xs, paddingBottom: sys.space.xs },
  row: { minHeight: (pictureWell.height as number) + 2 * ROW_INSET, flexDirection: 'row', alignItems: 'center', gap: ROW_GAP,
    paddingVertical: ROW_INSET, paddingHorizontal: ROW_INSET, borderRadius: sys.radius.control },
  dangerWell: { backgroundColor: sys.color.dangerSoft },
  label: { flex: 1, color: sys.color.ink },
  // A row with a subtitle: the label and its quiet line, one under the other, in the label's place.
  copy: { flex: 1, minWidth: 0, gap: 2 },
  ink: { color: sys.color.ink },
  danger: { color: sys.color.danger },
  disabled: { opacity: 0.45 },
  rule: { height: 1, backgroundColor: sys.color.line, marginVertical: sys.space.sm,
    marginLeft: ROW_INSET + (pictureWell.width as number) + ROW_GAP },
});
