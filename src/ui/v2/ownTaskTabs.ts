import type { OwnedTaskCounts } from '../../data/marketplaceView';
import { plural, zadataka } from '../system/plural';
import type { SegmentedOption } from '../system/Segmented';
import type { WindowRoom } from '../system/textScale';
import { sys } from '../system/tokens';
import { textWidth } from './cardHeadFit';

/**
 * The tabs of Moji zadaci and what stands on them (UI/UX pass, plan item 8.1, 2026-10-02).
 *
 * The first look of the wave-1 build on the owner's phone (361 dp wide, text scale 1.15) showed "Istorij": the three tabs shared
 * one line with the search and filter buttons, got 209 dp of a 321 dp row, scrolled, and the third label was cut. The tabs now
 * have the whole row and the two controls stand in a toolbar under it (`MarketplacePresentation`). What this file decides is
 * the numbers on the tabs and whether they fit.
 *
 * WHAT STANDS ON A TAB. "Aktivni" carries the count of my tasks that wait for my choice, in the orange of what waits (the
 * colour-meaning table in `tokens.ts`), spoken as it always was. "Nacrti" and "Istorija" carry how many tasks the set holds, in
 * the quiet grey counts of Dogovori. Every number is one the screen already has: the server's counts of a paged build, or the
 * counts of the whole list the other build holds (`ownedTaskCounts`). A set that is empty, and a number that is not known, show
 * nothing: a zero on a badge reads as news, and nothing is invented.
 *
 * WHAT GIVES WAY. A label is never cut for a count. The tabs are drawn in a row `Segmented` spreads over the screen's width, and
 * a count is shown only when the row, as it would then be drawn, fits with `TAB_SLACK` to spare; otherwise the counts of the two
 * sets are left off and the count of what waits stays (it is the one a person acts on). The estimate is arithmetic from the
 * bundled Inter Bold (`cardHeadFit.textWidth`), and its limits are the ones named there: the widths are the wide side (Bold for
 * every tab although only the chosen one is bold, a linear text scale although Android 14+ scales less than linearly), so a row
 * that fits here is expected to fit on the phone with room; it is arithmetic, not a render. When even the labels and the count of
 * what waits do not fit (beyond the tested width/text-size grid), the row is a horizontal
 * scroller (see `MarketplacePresentation`) and scrolls instead of clipping: that is the resilience fallback, never the look.
 */

/** The three sets that are tabs. A fourth, all of them, is reached from an empty state and has no tab. */
export type OwnTaskTab = 'active' | 'drafts' | 'history';
export const OWN_TASK_TABS: readonly { readonly key: OwnTaskTab; readonly label: string }[] = [
  { key: 'active', label: 'Aktivni' }, { key: 'drafts', label: 'Nacrti' }, { key: 'history', label: 'Istorija' },
];

/** One side of the screen: the tab row, the toolbar under it and the list pad 20 dp each side. */
export const SCREEN_SIDE = sys.space.lg;
/** The pill track's 3 dp gap. Each capsule keeps its intrinsic width and grows into the remaining space. */
export const TAB_GAP = 3;
/** What the estimate keeps free of the row before it shows a count: text nodes are rounded up to whole pixels, and it is an estimate. */
export const TAB_SLACK = 4;

/**
 * `Segmented`'s opt-in content-sized pill geometry, held to the render by `moji-zadaci-tabrow.test.tsx`:
 * 8 dp of padding each side of the label, a 6 dp gap to the count, and the count in a pill at least 22 dp wide with 6 dp each side.
 * The track also needs 4 dp of padding at each end. All three complete labels come before optional set counts.
 * The label is `sys.type.tab` and the count `sys.type.label`.
 */
export const TAB_GEOMETRY = { padding: 16, trackPadding: 8, countGap: 6, countMin: 22, countPadding: 12 } as const;
const TAB_SIZE = sys.type.tab.fontSize as number, COUNT_SIZE = sys.type.label.fontSize as number;

type Drawn = { readonly label: string; readonly badge?: number | string };

/** The width of one tab as `Segmented` draws it, in dp, at a text scale. */
function tabWidth({ label, badge }: Drawn, scale: number): number {
  const word = textWidth(label, TAB_SIZE * scale) + TAB_GEOMETRY.padding;
  if (badge === undefined) return word;
  return word + TAB_GEOMETRY.countGap + Math.max(TAB_GEOMETRY.countMin, textWidth(String(badge), COUNT_SIZE * scale) + TAB_GEOMETRY.countPadding);
}

/** The width the tabs need, in dp, with the least space between them. */
export function tabsWidth(tabs: readonly Drawn[], scale: number): number {
  return TAB_GEOMETRY.trackPadding + tabs.reduce((sum, tab) => sum + tabWidth(tab, scale), 0) + Math.max(0, tabs.length - 1) * TAB_GAP;
}

/** The width the tab row has: the window, less what the screen pads on each side. */
export function tabsRoom(room: WindowRoom): number {
  return room.width - 2 * SCREEN_SIDE;
}

/**
 * The tabs with the numbers that stand on them. `counts` is what the screen knows (null when it does not know yet) and `room`
 * the window the row is drawn in.
 */
export function ownTaskTabs(counts: OwnedTaskCounts | null, room: WindowRoom): SegmentedOption<OwnTaskTab>[] {
  const waiting = counts?.waiting ?? 0;
  const base: SegmentedOption<OwnTaskTab>[] = OWN_TASK_TABS.map(tab => tab.key === 'active' && waiting > 0
    ? { ...tab, badge: waiting, badgeLabel: `Za tvoj izbor: ${zadataka(waiting)}`, badgeTone: 'attention' as const } : { ...tab });
  if (!counts) return base;
  const withSets = base.map((tab): SegmentedOption<OwnTaskTab> => tab.key === 'drafts' && counts.drafts > 0
    ? { ...tab, badge: counts.drafts, badgeLabel: plural(counts.drafts, 'nacrt', 'nacrta', 'nacrta') }
    : tab.key === 'history' && counts.history > 0 ? { ...tab, badge: counts.history, badgeLabel: zadataka(counts.history) } : tab);
  return tabsWidth(withSets, room.scale) + TAB_SLACK <= tabsRoom(room) ? withSets : base;
}
