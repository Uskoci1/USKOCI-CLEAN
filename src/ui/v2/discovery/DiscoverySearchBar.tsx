import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { MagnifyingGlass, Plus, SlidersHorizontal, type Icon } from 'phosphor-react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { plural } from '../../system/plural';
import { floating, sys } from '../../system/tokens';

/** A quick chip over the map: one existing filter, toggled at once, without opening the search. */
export type QuickChip = { key: string; label: string; selected: boolean; onPress: () => void };

/**
 * "Dodaj zadatak" is the chrome's one icon button with an orange glyph on white: an accent, never an orange fill (B12).
 * The glyph is the only thing that says what the control is, so it is the orange that reads (`orangeInk`, 5.3:1 on
 * white), not the action orange's edge (2.97:1, under the 3:1 a control needs; review r3 item 2).
 */
const AddGlyph: Icon = ({ size }) => <Plus size={size} weight="bold" color={sys.color.orangeInk} />;
/** The bar's distance from the top of the map. */
const BAR_TOP = sys.space.md;

/**
 * The top of the Zadaci map (Discovery V47; Airbnb's search bar, USKOČI's look). One white search pill says the current
 * search in two lines — where, then when and the other conditions — and opens the search panel. Beside it "Uslovi
 * pretrage" opens the same panel at its conditions and counts how many are on, and "Dodaj zadatak" keeps its orange
 * glyph. Under them one row of quick chips toggles real filters at once; a chosen chip is a green outline with a green
 * label. The chips fold away when the caller says so (the list at its full height and scrolled); the pill stays.
 */
export function DiscoverySearchBar({ where, conditions, conditionCount, chips, chipsShown, onSearch, onConditions, onNew, onLayout }: {
  /** Line 1: where the search looks. */ where: string;
  /** Line 2: when, and the other conditions (or "Dodaj uslove"). */ conditions: string;
  /** How many conditions are on: the count on "Uslovi pretrage". */ conditionCount: number;
  chips: readonly QuickChip[]; chipsShown: boolean;
  onSearch: () => void; onConditions: () => void; onNew?: () => void;
  /**
   * The bar's lower edge from the top of the map, chips included while they show: where the list sheet's full height
   * stops. It moves up when the chips fold away, so the list then gains their room.
   */
  onLayout: (bottom: number) => void;
}) {
  const measure = (event: LayoutChangeEvent) => { const { y, height } = event.nativeEvent.layout; onLayout(Math.ceil(y + height)); };
  return <View pointerEvents="box-none" style={s.bar} onLayout={measure}>
    <View pointerEvents="box-none" style={s.row}>
      <Press accessibilityRole="button" accessibilityLabel="Pretraži zadatke" accessibilityValue={{ text: `${where}, ${conditions}` }}
        accessibilityHint="Otvara pretragu: gde, kada i uslovi." haptic="select" scaleTo={0.98} onPress={onSearch} style={s.pill}>
        <MagnifyingGlass size={20} color={sys.color.green} />
        <View style={s.lines}>
          <T style={s.where} numberOfLines={1}>{where}</T>
          <T style={s.conditions} numberOfLines={1}>{conditions}</T>
        </View>
      </Press>
      <View style={s.tool}><View style={s.lift} />
        <ChromeIconButton label={conditionCount ? `Uslovi pretrage, ${plural(conditionCount, 'aktivan', 'aktivna', 'aktivnih')}` : 'Uslovi pretrage'}
          icon={SlidersHorizontal} active={conditionCount > 0} onPress={onConditions}>
          {/* Green, not orange: the "+" beside it is the screen's one orange accent (review r3 item 6). */}
          {conditionCount ? <View testID="conditions-badge" style={s.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <T style={s.badgeText}>{conditionCount}</T></View> : null}
        </ChromeIconButton>
      </View>
      {/* A deliberate deviation from master plan step 4, which puts the "+" "u zaglavlju liste" (in the list's header;
          review r3 item 14): it stays in the floating row, which B12 allows, because this row is on screen at every
          height of the sheet, while the list's header is only a top line at its lowest height. */}
      {onNew ? <View style={s.tool}><View style={s.lift} />
        <ChromeIconButton label="Dodaj zadatak" hint="Otvara novi Zadatak." icon={AddGlyph} onPress={onNew} />
      </View> : null}
    </View>
    {chipsShown && chips.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      accessibilityLabel="Brzi filteri" contentContainerStyle={s.chips}>
      {chips.map(chip => <Press key={chip.key} accessibilityRole="button" accessibilityLabel={chip.label} accessibilityState={{ selected: chip.selected }}
        haptic="select" scaleTo={0.97} hitSlop={{ top: 4, bottom: 4 }} onPress={chip.onPress} style={[s.chip, chip.selected && s.chipOn]}>
        <T style={[s.chipText, chip.selected && s.chipTextOn]} numberOfLines={1}>{chip.label}</T>
      </Press>)}
    </ScrollView> : null}
  </View>;
}

const s = StyleSheet.create({
  bar: { position: 'absolute', top: BAR_TOP, left: 0, right: 0, gap: sys.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingHorizontal: sys.space.base },
  // The search pill: white, a capsule, the one `floating` lift, and two lines of words.
  pill: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingLeft: sys.space.base,
    paddingRight: sys.space.lg, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line,
    backgroundColor: sys.color.surface, ...floating },
  lines: { flex: 1, minWidth: 0 },
  where: { ...sys.type.bodyStrong, lineHeight: 20, color: sys.color.ink },
  conditions: { ...sys.type.meta, color: sys.color.muted },
  tool: { width: 48, height: 48 },
  lift: { position: 'absolute', top: 2, left: 2, width: 44, height: 44, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, ...floating },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.green, borderWidth: 2, borderColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, lineHeight: 14, fontWeight: '700', letterSpacing: 0, color: sys.color.onGreen, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', gap: sys.space.sm, paddingHorizontal: sys.space.base, paddingVertical: sys.space.xs },
  // A chip over the map: white with the hairline; chosen, a green outline and a green label (never a fill: the fill is
  // the one primary action's).
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    backgroundColor: sys.color.surface, ...floating },
  chipOn: { borderColor: sys.color.green, borderWidth: 2, paddingHorizontal: 13 },
  chipText: { ...sys.type.meta, fontSize: 14, color: sys.color.ink },
  chipTextOn: { color: sys.color.green, fontWeight: '700' },
});
