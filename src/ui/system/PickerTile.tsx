import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { FactArt } from './FactArt';
import { Pictogram, type PictogramKind } from './Pictogram';
import { Press } from '../Press';
import { T } from '../Text';
import { useTextScale } from './textScale';
import { sys } from './tokens';

/**
 * How a grid lays its tiles out: side by side in two columns, or one per row as a list (a narrow screen or large text,
 * where two columns would break a label mid-word). A tile outside a grid is a grid tile.
 */
type PickerLayout = 'grid' | 'list';
const Layout = createContext<PickerLayout>('grid');

/**
 * One choice in a picker grid (the picker level of the design system, 2026-09-23): a large pictogram, one clear label,
 * a big touch target. Two tiles sit side by side. Unselected is a soft neutral well without a border; selected is the
 * green selection (soft green, a 1.5 green edge and a check); disabled is dimmed with its reason written under the label.
 * The border is always 1.5 wide (transparent when unselected), so choosing never shifts the layout.
 *
 * `medium` (2026-09-24, the worker profile's quick picks) is the same tile a step smaller, for a grid of sixteen: a 44 px
 * picture and a 15 px label. Inside a one-column grid every tile becomes a 64 px row: the picture at 40, the label
 * beside it and the check at the row's end. The spoken role, label and state are the same in every layout.
 */
export function PickerTile({ kind, label, selected, disabled = false, reason, mode = 'multiple', size = 'large', onPress }: {
  kind: PictogramKind; label: string; selected: boolean; disabled?: boolean;
  /** Why a disabled tile cannot be chosen, in plain words ("Treba vozačka B"). */
  reason?: string;
  /** One answer (radio) or several (checkbox). */
  mode?: 'single' | 'multiple';
  /** `large` for a picker screen's handful of choices; `medium` for a longer grid inside a form. */
  size?: 'large' | 'medium';
  onPress: () => void;
}) {
  const list = useContext(Layout) === 'list', medium = size === 'medium';
  const why = disabled && reason ? reason : null;
  return <Press accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
    accessibilityLabel={why ? `${label}. ${why}` : label}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    haptic={disabled ? 'none' : 'select'} scaleTo={list ? 0.99 : 0.97}
    style={[list ? s.row : [s.tile, medium && s.tileMedium], selected && s.selected, disabled && s.disabled]}>
    {list ? <>
      <Pictogram kind={kind} size={40} disabled={disabled} />
      <View style={s.rowCopy}>
        <T variant="bodyStrong" numberOfLines={2} style={[s.rowLabel, medium && s.labelMedium]}>{label}</T>
        {why ? <T variant="meta" tone="muted" numberOfLines={2}>{why}</T> : null}
      </View>
      {/* The check keeps its place at the row's end, so choosing does not move the label. */}
      <View style={s.rowCheck}>{selected ? <FactArt kind="check" size={20} /> : null}</View>
    </> : <>
      {selected ? <View style={[s.check, medium && s.checkMedium]}><FactArt kind="check" size={medium ? 20 : 22} /></View> : null}
      <Pictogram kind={kind} size={medium ? 44 : 56} disabled={disabled} />
      <T variant="bodyStrong" numberOfLines={2} style={[s.label, medium && s.labelMedium]}>{label}</T>
      {why ? <T variant="meta" tone="muted" numberOfLines={2} style={s.reason}>{why}</T> : null}
    </>}
  </Press>;
}

/**
 * Two columns with the shared gap; children are PickerTiles. `auto` (the default) turns to one column below 360 dp or at
 * text scale 1.3 and above (read rounded: Android reports its Large setting as 1.2999999523).
 */
export function PickerGrid({ children, columns = 'auto' }: { children: ReactNode; columns?: 'auto' | 1 | 2 }) {
  const { width } = useWindowDimensions(), scale = useTextScale();
  const count = columns === 'auto' ? (width < 360 || scale >= 1.3 ? 1 : 2) : columns;
  const layout: PickerLayout = count === 1 ? 'list' : 'grid';
  return <Layout.Provider value={layout}><View style={[s.grid, layout === 'list' && s.list]}>{children}</View></Layout.Provider>;
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  list: { gap: 8 },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 140, borderRadius: sys.radius.card, borderWidth: 1.5, borderColor: 'transparent',
    backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 16 },
  tileMedium: { minHeight: 112, gap: 8, paddingVertical: 12, paddingHorizontal: 8 },
  row: { flexBasis: '100%', flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, gap: 12,
    borderRadius: sys.radius.control, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: sys.color.iconWell },
  selected: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  disabled: { opacity: 0.55 },
  check: { position: 'absolute', top: 10, right: 10 },
  checkMedium: { top: 8, right: 8 },
  label: { color: sys.color.ink, textAlign: 'center', fontSize: 16, lineHeight: 21 },
  labelMedium: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: sys.color.ink, textAlign: 'left', fontSize: 16, lineHeight: 21 },
  rowCheck: { width: 20, alignItems: 'center' },
  reason: { textAlign: 'center' },
});
