import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Check, Crosshair, DotsThree, MagnifyingGlass, Plus, SlidersHorizontal, X, type Icon } from 'phosphor-react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { ChromeIconButton, chrome } from '../../system/ScreenChrome';
import { plural } from '../../system/plural';
import { layoutClassFor, roundTextScale, type WindowRoom } from '../../system/textScale';
import { CHIP_CHOSEN_INSET, chipChosen, sys } from '../../system/tokens';

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
 * pretrage" opens the same panel at its conditions and counts how many are on. The adjacent menu preserves secondary
 * destinations without another header (a standalone caller may instead offer its publication shortcut).
 * At ordinary width/text size, search, Filter and More share one surface as sibling controls. Large text or an
 * insufficient summary budget keeps the full-width search and separate toolbar. One white scrolling rail holds the
 * real quick filters; only selected choices have a well and tick. Folding removes that rail, never search/tools.
 *
 * While the list is narrowed to the map's area or to one point, the pill carries its own "×" at its right end, "Prikaži
 * sve zadatke": the way back to every task is where the narrowing is said, not a chip that would appear under the
 * list's count and move the sheet each time the map moves (review of V47). It lies over the pill's end, so the pill is
 * exactly as tall with it as without it.
 */
export function DiscoverySearchBar({ where, conditions, conditionCount, chips, chipsShown, onSearch, onConditions, onNew, onMore, onClearWhere,
  onLayout, onChipsHeight, nearby, layoutRoom }: {
  /** Line 1: where the search looks. */ where: string;
  /** Line 2: when, and the other conditions (or "Dodaj uslove"). */ conditions: string;
  /** How many conditions are on: the count on "Uslovi pretrage". */ conditionCount: number;
  chips: readonly QuickChip[]; chipsShown: boolean;
  /** Existing parent window measurement; this component adds no Dimensions subscription. */
  layoutRoom?: WindowRoom;
  nearby?: { onPress: () => void; busy: boolean; message?: string; onSettings?: () => void };
  onSearch: () => void; onConditions: () => void; onNew?: () => void;
  /** Secondary account/publication entries share one menu so the map does not need a second header. */
  onMore?: () => void;
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
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const scale = roundTextScale(layoutRoom?.scale ?? 1);
  const width = measuredWidth === null ? layoutRoom?.width ?? 0 : Math.min(measuredWidth, layoutRoom?.width ?? measuredWidth);
  // Keep a real text budget after BOTH 48dp controls, clear-where and the search icon. The badge may grow.
  const badgeRoom = conditionCount ? Math.max(20, String(conditionCount).length * sys.type.label.fontSize * scale + 2 * sys.space.xs) : 0;
  const filterRoom = conditionCount ? 20 + sys.space.xs + badgeRoom + 2 * sys.space.sm : chrome.control;
  const toolsRoom = filterRoom + (onMore || onNew ? sys.space.xs + chrome.control : 0);
  const searchFixedRoom = sys.space.base + 22 + sys.space.md + (onClearWhere ? CLEAR_WIDTH : sys.space.sm);
  const summaryRoom = width - 2 * sys.space.base - 2 - 4 - toolsRoom - searchFixedRoom;
  const compact = !!layoutRoom && !layoutClassFor(width, scale).stacked && summaryRoom >= 96 * scale;
  const measure = (event: LayoutChangeEvent) => {
    const { y, height, width: actualWidth } = event.nativeEvent.layout;
    if (Number.isFinite(actualWidth) && actualWidth > 0) setMeasuredWidth(current => current === actualWidth ? current : actualWidth);
    onLayout(Math.ceil(y + height));
  };
  const measureChips = (event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    // The toolbar remains when chips fold. Return the rail's measured height and the bar's gap.
    // Never feed a folded zero back.
    if (height > 0) onChipsHeight?.(height + sys.space.sm);
  };
  const tools = <>
    <Press accessibilityRole="button" accessibilityLabel={conditionCount ? `Uslovi pretrage, ${plural(conditionCount, 'aktivan', 'aktivna', 'aktivnih')}` : 'Uslovi pretrage'}
        accessibilityState={{ selected: conditionCount > 0 }} haptic="select" hitSlop={0} onPress={onConditions}
        style={[s.filter, compact && s.filterCompact, conditionCount > 0 && s.filterOn]}>
        <SlidersHorizontal size={20} weight="bold" color={sys.color.ink} />
        {!compact ? <T variant="note" style={s.filterText}>Filteri</T> : null}
        {conditionCount ? <View testID="conditions-badge" style={s.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <T variant="label" style={s.badgeText}>{conditionCount}</T></View> : null}
      </Press>
    {onMore ? <View style={s.tool}>
      <ChromeIconButton label="Još mogućnosti" hint="Objava zadatka, profil i obaveštenja." icon={DotsThree} quiet onPress={onMore} />
    </View> : onNew ? <View style={s.tool}>
      <ChromeIconButton label="Dodaj zadatak" hint="Otvara novi Zadatak." icon={AddGlyph} quiet onPress={onNew} />
    </View> : null}
  </>;
  const quickFilters = chipsShown && (chips.length || nearby) ? <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
    accessibilityLabel="Brzi filteri" style={s.fullRail}
    contentContainerStyle={[s.chips, s.chipsFullWidth]} onLayout={measureChips}>
    {nearby ? <Press accessibilityRole="button" accessibilityLabel="U blizini"
      accessibilityHint="Jednom koristi lokaciju da centrira mapu. Ne čuva je i ne menja uslove pretrage."
      accessibilityState={{ disabled: nearby.busy, busy: nearby.busy }} disabled={nearby.busy}
      haptic="select" scaleTo={0.97} hitSlop={0} onPress={nearby.onPress} style={[s.chip, s.nearby]}>
      {nearby.busy ? <ActivityIndicator size="small" color={sys.color.ink} /> : <Crosshair size={18} color={sys.color.ink} />}
      <T variant="note" style={s.chipText} numberOfLines={1}>U blizini</T>
    </Press> : null}
    {chips.map(chip => <Press key={chip.key} accessibilityRole="button" accessibilityLabel={chip.label} accessibilityState={{ selected: chip.selected }}
      haptic="select" scaleTo={0.97} hitSlop={0} onPress={chip.onPress} style={[s.chip, chip.selected && s.chipOn]}>
      {chip.selected ? <Check size={16} weight="bold" color={sys.color.ink} /> : null}
      <T variant="note" style={[s.chipText, chip.selected && s.chipTextOn]} numberOfLines={1}>{chip.label}</T>
    </Press>)}
  </ScrollView> : null;
  return <View pointerEvents="box-none" style={s.bar} onLayout={measure}>
    <View testID="discovery-search-row" pointerEvents="box-none" style={s.row}>
      <View style={s.searchSurface}>
      <View style={s.search}>
        <Press accessibilityRole="button" accessibilityLabel="Pretraži zadatke" accessibilityValue={{ text: `${where}, ${conditions}` }}
          accessibilityHint="Otvara pretragu: gde, kada i uslovi." haptic="select" scaleTo={0.98} onPress={onSearch}
          style={[s.pill, s.pillWide, onClearWhere && s.pillClearable]}>
          <MagnifyingGlass size={22} weight="bold" color={sys.color.ink} />
          <View style={s.lines}>
            {/* Same current summary, two lines; full values remain spoken and available in the search panel. */}
            <T variant="bodyStrong" style={s.where} numberOfLines={1}>{where}</T>
            <T variant="meta" tone="muted" numberOfLines={1}>{conditions}</T>
          </View>
        </Press>
        {onClearWhere ? <Press testID="clear-where" accessibilityRole="button" accessibilityLabel="Prikaži sve zadatke"
          haptic="select" scaleTo={0.94} hitSlop={0} onPress={onClearWhere} style={s.clear}>
          <View style={s.clearCircle}><X size={16} weight="bold" color={sys.color.ink} /></View>
        </Press> : null}
      </View>
      {compact ? <View testID="discovery-search-tools" style={s.toolCluster}>{tools}</View> : null}
      </View>
    </View>
    {!compact ? <View testID="discovery-search-tools" pointerEvents="box-none" style={s.row}>
      <View style={[s.toolCluster, s.toolClusterWide]}>{tools}</View>
    </View> : null}
    {quickFilters}
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
  // One lifted surface owns the search and its controls. The map no longer carries three competing white discs.
  searchSurface: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingRight: 4,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line,
    ...sys.elevation.soft },
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, paddingLeft: sys.space.base,
    paddingRight: sys.space.sm, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface },
  // The words end where the clear button begins.
  pillClearable: { paddingRight: CLEAR_WIDTH },
  pillWide: { borderRadius: sys.radius.card },
  fullRail: { flexGrow: 0, alignSelf: 'stretch', marginHorizontal: sys.space.base,
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  lines: { flex: 1, minWidth: 0 },
  where: { lineHeight: 20, color: sys.color.ink },
  // Over the pill's right end, from its top edge to its bottom edge: never taller than the pill, never under 48 wide.
  clear: { position: 'absolute', top: 0, bottom: 0, right: 0, width: CLEAR_WIDTH, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  clearCircle: { width: 28, height: 28, borderRadius: sys.radius.pill, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  tool: { width: chrome.control, height: chrome.control },
  toolCluster: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  toolClusterWide: { flex: 1, justifyContent: 'space-between' },
  filter: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48,
    paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.lineStrong },
  filterCompact: { minWidth: chrome.control, paddingHorizontal: sys.space.sm, gap: sys.space.xs,
    borderWidth: 0, borderRadius: sys.radius.control, backgroundColor: 'transparent' },
  filterOn: { backgroundColor: sys.color.wash, borderColor: sys.color.ink },
  filterText: { color: sys.color.ink, fontWeight: '600' },
  // It grows with the text size rather than cut its number.
  badge: { minWidth: 20, minHeight: 20, paddingHorizontal: sys.space.xs, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.ink, alignItems: 'center', justifyContent: 'center' },
  badgeText: { letterSpacing: 0, color: sys.color.onGreen, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base, paddingVertical: sys.space.xs },
  chipsFullWidth: { paddingHorizontal: sys.space.xs, paddingVertical: 0 },
  // One rail surface gives every label contrast over the map. Only selected filters receive their own inset.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 48, paddingHorizontal: CHIP_SIDE, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent' },
  chipOn: { ...chipChosen, borderColor: sys.color.ink, paddingHorizontal: CHIP_SIDE - CHIP_CHOSEN_INSET },
  chipText: { fontWeight: '500', color: sys.color.ink },
  chipTextOn: { color: sys.color.ink, fontWeight: '600' },
  nearby: { minHeight: 48 },
  notice: { marginHorizontal: sys.space.base, paddingHorizontal: sys.space.md, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.control, backgroundColor: sys.color.surface, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  noticeText: { color: sys.color.ink, flexGrow: 1, flexBasis: 180 },
  settings: { minHeight: 48, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  settingsText: { color: sys.color.ink, fontWeight: '600' },
});
