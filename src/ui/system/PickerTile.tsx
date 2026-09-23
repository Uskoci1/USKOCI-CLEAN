import { StyleSheet, View } from 'react-native';
import { FactArt } from './FactArt';
import { Pictogram, type PictogramKind } from './Pictogram';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from './tokens';

/**
 * One choice in a picker grid (the picker level of the design system, 2026-09-23): a large pictogram, one clear label,
 * a big touch target. Two tiles sit side by side. Unselected is a soft neutral well without a border; selected is the
 * green selection (soft green, a 1.5 green edge and a check); disabled is dimmed with its reason written under the label.
 * The border is always 1.5 wide (transparent when unselected), so choosing never shifts the layout.
 */
export function PickerTile({ kind, label, selected, disabled = false, reason, mode = 'multiple', onPress }: {
  kind: PictogramKind; label: string; selected: boolean; disabled?: boolean;
  /** Why a disabled tile cannot be chosen, in plain words ("Treba vozačka B"). */
  reason?: string;
  /** One answer (radio) or several (checkbox). */
  mode?: 'single' | 'multiple';
  onPress: () => void;
}) {
  return <Press accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
    accessibilityLabel={reason && disabled ? `${label}. ${reason}` : label}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    haptic={disabled ? 'none' : 'select'} scaleTo={0.97} style={[s.tile, selected && s.selected, disabled && s.disabled]}>
    {selected ? <View style={s.check}><FactArt kind="check" size={22} /></View> : null}
    <Pictogram kind={kind} size={56} disabled={disabled} />
    <T variant="bodyStrong" numberOfLines={2} style={s.label}>{label}</T>
    {disabled && reason ? <T variant="meta" tone="muted" numberOfLines={2} style={s.reason}>{reason}</T> : null}
  </Press>;
}

/** Two columns with the shared gap; children are PickerTiles. */
export function PickerGrid({ children }: { children: React.ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 140, borderRadius: sys.radius.card, borderWidth: 1.5, borderColor: 'transparent',
    backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 16 },
  selected: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  disabled: { opacity: 0.55 },
  check: { position: 'absolute', top: 10, right: 10 },
  label: { color: sys.color.ink, textAlign: 'center', fontSize: 16, lineHeight: 21 },
  reason: { textAlign: 'center' },
});
