import type { PotrebaProjekcija } from '../contracts/projections';
import type { OwnedTaskCounts } from './marketplaceView';
import { OWN_TASKS_PAGE_LIMIT, type OwnTasksCursor, type OwnTasksPage, type OwnTasksPageRequest, type OwnTasksScope } from './ownTasksPage';

/**
 * EX-04 S1 (A09 Moji zadaci): the one owner of the paged read of my own tasks. React-free and clock-injected, so every rule below is a plain test.
 *
 * - One set per scope (Aktivni, Nacrti, Istorija, Svi, Treba moja radnja), kept while the screen lives: coming back to a tab shows what it had and
 *   re-reads quietly, exactly as `createFocusedResource` does for a whole list. The app leaving the foreground forgets everything (the recents photograph).
 * - A read belongs to one epoch (focus), one set and one version of it. A page that started before the first page replaced the set, before a blur, a
 *   background or a change of account is discarded: an old cursor never meets a new set ("Insert/update tokom listanja ne prihvata stari cursor").
 * - A page never duplicates a task; a task seen twice stays where it was first seen.
 * - The five counts come with the first page of ANY scope and are the only counts there are: the tab badge never counts what happens to be loaded.
 * - Returning to a screen re-reads as many pages as were loaded (bounded), so the reading position survives; a pull-to-refresh starts again from the top.
 * - `ensureComplete(true)` reads the rest of the set, one page at a time up to a bound, for as long as a search or a price filter refines it: a refinement
 *   of an incomplete set would answer wrongly.
 * - A first page that fails shows an error only when nothing is on screen; a later page that fails keeps the list and asks for a retry at its foot.
 */
export type OwnTasksPageReader = (request: OwnTasksPageRequest) => Promise<OwnTasksPage>;
export type OwnTasksPagerState = {
  scope: OwnTasksScope | null;
  items: readonly PotrebaProjekcija[];
  /** The server's counts of the five sets; null until some first page answered. */
  counts: OwnedTaskCounts | null;
  /** The first page of the shown set has not answered yet and nothing is on screen. */
  loading: boolean;
  /** The first page is being read again while the set stays on screen. */
  refreshing: boolean;
  /** The first page failed and nothing is on screen. */
  error: boolean;
  hasMore: boolean; loadingMore: boolean; moreError: boolean;
};

type SetState = {
  items: PotrebaProjekcija[]; ids: Set<string>; cursor: OwnTasksCursor | null; hasMore: boolean; pages: number;
  loaded: boolean; loadedAt: number; version: number;
  firstToken: number; firstFlight: boolean; firstError: boolean;
  moreToken: number; moreFlight: boolean; moreError: boolean;
};
type Options = { readPage: OwnTasksPageReader; isCurrent: () => boolean; now?: () => number; limit?: number; maxPages?: number; reloadPages?: number };

/** Coming back to a tab after this long loads it as if for the first time (the same bound as every focused list). */
export const OWN_TASKS_STALE_MS = 5 * 60_000;
const EMPTY: readonly PotrebaProjekcija[] = Object.freeze([]);

export function createOwnTasksPager(options: Options) {
  const { readPage, isCurrent, now = Date.now, limit = OWN_TASKS_PAGE_LIMIT, maxPages = 50, reloadPages = 5 } = options;
  const sets = new Map<OwnTasksScope, SetState>();
  const listeners = new Set<() => void>();
  let scope: OwnTasksScope | null = null, counts: OwnedTaskCounts | null = null, complete = false, active = false, epoch = 0;
  let state: OwnTasksPagerState = build();

  function ensure(key: OwnTasksScope): SetState {
    let set = sets.get(key);
    if (!set) { set = { items: [], ids: new Set(), cursor: null, hasMore: false, pages: 0, loaded: false, loadedAt: 0, version: 0,
      firstToken: 0, firstFlight: false, firstError: false, moreToken: 0, moreFlight: false, moreError: false }; sets.set(key, set); }
    return set;
  }
  function build(): OwnTasksPagerState {
    const set = scope ? sets.get(scope) : undefined;
    if (!scope) return { scope, items: EMPTY, counts, loading: false, refreshing: false, error: false, hasMore: false, loadingMore: false, moreError: false };
    if (!set) return { scope, items: EMPTY, counts, loading: true, refreshing: false, error: false, hasMore: false, loadingMore: false, moreError: false };
    return { scope, items: set.items, counts, loading: !set.loaded && !set.firstError, refreshing: set.loaded && set.firstFlight,
      error: !set.loaded && set.firstError, hasMore: set.loaded && set.hasMore, loadingMore: set.moreFlight, moreError: set.moreError };
  }
  function show() { state = build(); listeners.forEach(listener => listener()); }
  function merge(set: SetState, incoming: readonly PotrebaProjekcija[]) {
    const fresh = incoming.filter(item => !set.ids.has(item.id));
    if (!fresh.length) return;
    fresh.forEach(item => set.ids.add(item.id));
    set.items = [...set.items, ...fresh];
  }

  /** The first page of a set. `load` shows nothing until it answers, `keep` is a pull-to-refresh, `silent` is a return to the screen. */
  async function readFirst(key: OwnTasksScope, how: 'load' | 'keep' | 'silent'): Promise<void> {
    if (!active || !isCurrent()) return;
    const set = ensure(key), token = ++set.firstToken, captured = epoch;
    if (how === 'load' && set.loaded) { set.items = []; set.ids = new Set(); set.cursor = null; set.hasMore = false; set.pages = 0; set.loaded = false; }
    const depth = how === 'silent' ? Math.min(Math.max(set.pages, 1), reloadPages) : 1;
    const current = () => active && epoch === captured && set.firstToken === token && isCurrent();
    set.firstFlight = true; set.firstError = false; show();
    try {
      let page = await readPage({ scope: key, limit, cursor: null });
      if (!current()) return;
      const firstCounts = page.counts, collected: PotrebaProjekcija[] = [...page.items];
      let cursor = page.cursor, hasMore = page.hasMore, pages = 1;
      while (pages < depth && hasMore && cursor) {
        page = await readPage({ scope: key, limit, cursor });
        if (!current()) return;
        collected.push(...page.items); cursor = page.cursor ?? cursor; hasMore = page.hasMore; pages += 1;
      }
      const ids = new Set<string>(), items = collected.filter(item => !ids.has(item.id) && !!ids.add(item.id));
      Object.assign(set, { items, ids, cursor, hasMore, pages, loaded: true, loadedAt: now(), moreError: false, moreFlight: false });
      set.version += 1; set.moreToken += 1;
      if (firstCounts) counts = firstCounts;
    } catch {
      if (!current()) return;
      // What is on screen is the last thing the server said; only an empty screen turns into an error.
      if (!set.loaded) set.firstError = true;
    } finally {
      if (set.firstToken === token && captured === epoch) { set.firstFlight = false; show(); pump(); }
    }
  }

  /** The next page of a set, from the cursor of its last item. */
  async function readMore(key: OwnTasksScope): Promise<void> {
    const set = sets.get(key);
    if (!active || !isCurrent() || !set || !set.loaded || !set.hasMore || set.moreFlight || set.firstFlight || !set.cursor) return;
    const token = ++set.moreToken, version = set.version, captured = epoch;
    const live = () => active && epoch === captured && set.moreToken === token && set.version === version && isCurrent();
    set.moreFlight = true; set.moreError = false; show();
    try {
      const page = await readPage({ scope: key, limit, cursor: set.cursor });
      if (!live()) return;
      merge(set, page.items);
      set.cursor = page.cursor ?? set.cursor; set.hasMore = page.hasMore; set.pages += 1;
    } catch {
      if (live()) set.moreError = true;
    } finally {
      if (set.moreToken === token && captured === epoch && set.version === version) { set.moreFlight = false; show(); pump(); }
    }
  }
  /** While a refinement is on, the rest of the shown set is read, one page at a time, until it is complete or the bound is reached. */
  function pump() {
    if (!complete || !active || !scope) return;
    const set = sets.get(scope);
    if (set && set.loaded && set.hasMore && !set.moreFlight && !set.firstFlight && !set.moreError && set.pages < maxPages) void readMore(scope);
  }

  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Focus: what the sets already hold is shown at once and read again quietly; a set older than the bound loads as if new. */
    start() {
      active = true;
      if (!isCurrent()) { epoch += 1; sets.clear(); counts = null; show(); return; }
      if (scope) {
        const set = sets.get(scope);
        void readFirst(scope, set && set.loaded && now() - set.loadedAt < OWN_TASKS_STALE_MS ? 'silent' : 'load');
      } else show();
    },
    /** Blur: reads in flight are retired; what the sets hold stays. */
    stop() {
      active = false; epoch += 1;
      for (const set of sets.values()) { set.firstFlight = false; set.moreFlight = false; }
      show();
    },
    /** The app leaves the foreground: the recents photograph must not hold somebody's tasks. */
    forget() {
      active = false; epoch += 1; sets.clear(); counts = null; show();
    },
    /** The set the person is looking at (null: nothing to read). A set already held is shown at once and read again quietly. */
    setScope(next: OwnTasksScope | null) {
      if (next === scope) return;
      scope = next;
      if (next && active) { const set = sets.get(next); void readFirst(next, set && set.loaded ? 'silent' : 'load'); }
      show();
    },
    /** Pull-to-refresh: the first page again, from the top; the set stays on screen while it is read. */
    refresh(): Promise<void> { return scope ? readFirst(scope, 'keep') : Promise.resolve(); },
    /** The next page; after a failed one, the same call is the retry. */
    loadMore(): Promise<void> {
      if (!scope) return Promise.resolve();
      const set = sets.get(scope);
      if (set?.moreError) { set.moreError = false; show(); }
      return readMore(scope);
    },
    ensureComplete(on: boolean) { complete = on; pump(); },
  };
}
export type OwnTasksPager = ReturnType<typeof createOwnTasksPager>;
