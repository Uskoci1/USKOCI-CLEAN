import { ActivityIndicator, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Check, Crosshair, MagnifyingGlass, Plus, SlidersHorizontal, X, type Icon } from 'phosphor-react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { ChromeIconButton, chrome } from '../../system/ScreenChrome';
import { plural } from '../../system/plural';
import { useTextScale } from '../../system/textScale';
import { CHIP_CHOSEN_INSET, chipChosen, floating, sys } from '../../system/tokens';

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
/** The search pill's own clear button: a full 48 wide, as high as the pill, at its right end. */
const CLEAR_WIDTH = 48;
/** The quick chip's side padding; a chosen chip's 2 px edge takes its extra pixel from it, so the words never move. */
const CHIP_SIDE = sys.space.md;

/**
 * The top of the Zadaci map (Discovery V47; Airbnb's search bar, USKOČI's look). One white search pill says the current
 * search in two lines — where, then when and the other conditions — and opens the search panel. Beside it "Uslovi
 * pretrage" opens the same panel at its conditions and counts how many are on, and "Dodaj zadatak" keeps its orange
 * glyph. Under them one row of quick chips toggles real filters at once; a chosen chip is the one chosen-chip look of the
 * system (pale green, green edge, green words and a tick). The chips fold away when the caller says so (the list at its
 * full height and scrolled); the pill stays.
 *
 * While the list is narrowed to the map's area or to one point, the pill carries its own "×" at its right end, "Prikaži
 * sve zadatke": the way back to every task is where the narrowing is said, not a chip that would appear under the
 * list's count and move the sheet each time the map moves (review of V47). It lies over the pill's end, so the pill is
 * exactly as tall with it as without it.
 */
export function DiscoverySearchBar({ where, conditions, conditionCount, chips, chipsShown, onSearch, onConditions, onNew, onClearWhere,
  onLayout, onChipsHeight, nearby }: {
  /** Line 1: where the search looks. */ where: string;
  /** Line 2: when, and the other conditions (or "Dodaj uslove"). */ conditions: string;
  /** How many conditions are on: the count on "Uslovi pretrage". */ conditionCount: number;
  chips: readonly QuickChip[]; chipsShown: boolean;
  nearby?: { onPress: () => void; busy: boolean; message?: string; onSettings?: () => void };
  onSearch: () => void; onConditions: () => void; onNew?: () => void;
  /** Set while the list is narrowed to the map's area or to one point: the pill's "×" takes that narrowing away. */
  onClearWhere?: () => void;
  /**
   * The bar's lower edge from the top of the map, chips included while they show: where the list sheet's full height
   * stops. It moves up when the chips fold away, so the list then gains their room.
   */
  onLayout: (bottom: number) => void;
  /** The room the row of chips takes, the gap above it included: exactly what the list gains when they fold away. */
  onChipsHeight?: (room: number) => void;
}) {
  const measure = (event: LayoutChangeEvent) => { const { y, height } = event.nativeEvent.layout; onLayout(Math.ceil(y + height)); };
  const measureChips = (event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    if (height > 0) onChipsHeight?.(height + sys.space.sm);
  };
  // Large text: each line of the pill may take two lines rather than be cut off after a few words (at 320 dp).
  const lines = useTextScale() >= 1.3 ? 2 : 1;
  return <View pointerEvents="box-none" style={s.bar} onLayout={measure}>
    <View pointerEvents="box-none" style={s.row}>
      <View style={s.search}>
        <Press accessibilityRole="button" accessibilityLabel="Pretraži zadatke" accessibilityValue={{ text: `${where}, ${conditions}` }}
          accessibilityHint="Otvara pretragu: gde, kada i uslovi." haptic="select" scaleTo={0.98} onPress={onSearch}
          style={[s.pill, onClearWhere && s.pillClearable]}>
          <MagnifyingGlass size={20} color={sys.color.green} />
          <View style={s.lines}>
            <T variant="bodyStrong" style={s.where} numberOfLines={lines}>{where}</T>
            <T variant="meta" tone="muted" numberOfLines={lines}>{conditions}</T>
          </View>
        </Press>
        {onClearWhere ? <Press testID="clear-where" accessibilityRole="button" accessibilityLabel="Prikaži sve zadatke"
          haptic="select" scaleTo={0.94} hitSlop={0} onPress={onClearWhere} style={s.clear}>
          <View style={s.clearCircle}><X size={16} weight="bold" color={sys.color.ink} /></View>
        </Press> : null}
      </View>
      <View style={s.tool}><View style={s.lift} />
        <ChromeIconButton label={conditionCount ? `Uslovi pretrage, ${plural(conditionCount, 'aktivan', 'aktivna', 'aktivnih')}` : 'Uslovi pretrage'}
          icon={SlidersHorizontal} active={conditionCount > 0} onPress={onConditions}>
          {/* Green, not orange: the "+" beside it is the screen's one orange accent (review r3 item 6). */}
          {conditionCount ? <View testID="conditions-badge" style={s.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <T variant="label" style={s.badgeText}>{conditionCount}</T></View> : null}
        </ChromeIconButton>
      </View>
      {/* A deliberate deviation from master plan step 4, which puts the "+" "u zaglavlju liste" (in the list's header;
          review r3 item 14): it stays in the floating row, which B12 allows, because this row is on screen at every
          height of the sheet, while the list's header is only a top line at its lowest height. */}
      {onNew ? <View style={s.tool}><View style={s.lift} />
        <ChromeIconButton label="Dodaj zadatak" hint="Otvara novi Zadatak." icon={AddGlyph} onPress={onNew} />
      </View> : null}
    </View>
    {chipsShown && (chips.length || nearby) ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      accessibilityLabel="Brzi filteri" contentContainerStyle={s.chips} onLayout={measureChips}>
      {nearby ? <Press accessibilityRole="button" accessibilityLabel="U blizini"
        accessibilityHint="Jednom koristi lokaciju da centrira mapu. Ne čuva je i ne menja uslove pretrage."
        accessibilityState={{ disabled: nearby.busy, busy: nearby.busy }} disabled={nearby.busy}
        haptic="select" scaleTo={0.97} hitSlop={0} onPress={nearby.onPress} style={[s.chip, s.nearby]}>
        {nearby.busy ? <ActivityIndicator size="small" color={sys.color.green} /> : <Crosshair size={18} color={sys.color.green} />}
        <T variant="note" style={s.chipText} numberOfLines={1}>U blizini</T>
      </Press> : null}
      {chips.map(chip => <Press key={chip.key} accessibilityRole="button" accessibilityLabel={chip.label} accessibilityState={{ selected: chip.selected }}
        haptic="select" scaleTo={0.97} hitSlop={{ top: sys.space.xs, bottom: sys.space.xs }} onPress={chip.onPress} style={[s.chip, chip.selected && s.chipOn]}>
        {chip.selected ? <Check size={16} weight="bold" color={sys.color.green} /> : null}
        <T variant="note" style={[s.chipText, chip.selected && s.chipTextOn]} numberOfLines={1}>{chip.label}</T>
      </Press>)}
    </ScrollView> : null}
    {nearby?.message ? <View style={s.notice} accessibilityLiveRegion="polite">
      <T variant="note" style={s.noticeText}>{nearby.message}</T>
      {nearby.onSettings ? <Press accessibilityRole="button" accessibilityLabel="Podešavanja lokacije" hitSlop={0}
        onPress={nearby.onSettings} style={s.settings}><T variant="note" style={s.settingsText}>Podešavanja</T></Press> : null}
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  bar: { position: 'absolute', top: BAR_TOP, left: 0, right: 0, gap: sys.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingHorizontal: sys.space.base },
  search: { flex: 1, minWidth: 0 },
  // The search pill: white, a capsule, the one `floating` lift, and two lines of words. Its edge is the card edge: the
  // faintest hairline all but vanished over the map's own light ground.
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingLeft: sys.space.base,
    paddingRight: sys.space.lg, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.cardLine,
    backgroundColor: sys.color.surface, ...floating },
  // The words end where the clear button begins.
  pillClearable: { paddingRight: CLEAR_WIDTH },
  lines: { flex: 1, minWidth: 0 },
  where: { lineHeight: 20, color: sys.color.ink },
  // Over the pill's right end, from its top edge to its bottom edge: never taller than the pill, never under 48 wide.
  clear: { position: 'absolute', top: 0, bottom: 0, right: 0, width: CLEAR_WIDTH, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearCircle: { width: 28, height: 28, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  tool: { width: chrome.control, height: chrome.control },
  // The white disc under a chrome button, centred in its 48 px touch area.
  lift: { position: 'absolute', top: (chrome.control - chrome.circle) / 2, left: (chrome.control - chrome.circle) / 2, width: chrome.circle,
    height: chrome.circle, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, ...floating },
  // It grows with the text size rather than cut its number.
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 20, minHeight: 20, paddingHorizontal: sys.space.xs, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.green, borderWidth: 2, borderColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  badgeText: { letterSpacing: 0, color: sys.color.onGreen, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base, paddingVertical: sys.space.xs },
  // A chip over the map: white with the strong hairline, which is what draws it on the map (no shadow: a lift that the
  // scrolling row cut off at its edges read as a smudge). Chosen, the system's one chosen-chip look.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 40, paddingHorizontal: CHIP_SIDE, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { ...chipChosen, paddingHorizontal: CHIP_SIDE - CHIP_CHOSEN_INSET },
  chipText: { fontWeight: '500', color: sys.color.ink },
  chipTextOn: { color: sys.color.green, fontWeight: '700' },
  nearby: { minHeight: 48 },
  notice: { marginHorizontal: sys.space.base, paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.control, backgroundColor: sys.color.surface, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  noticeText: { color: sys.color.ink, flexGrow: 1, flexBasis: 180 },
  settings: { minHeight: 48, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  settingsText: { color: sys.color.green, fontWeight: '600' },
});
