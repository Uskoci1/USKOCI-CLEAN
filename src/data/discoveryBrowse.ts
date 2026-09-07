import type { PrilikeCursor, PrilikeStrana, PrilikeStranaUpit } from '../contracts/discovery';
import type { PrilikaProjekcija } from '../contracts/projections';

export type DiscoveryBrowseState = {
  items: PrilikaProjekcija[];
  nextCursor: PrilikeCursor | null;
  initialized: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: 'refresh' | 'more' | null;
};

type CursorOrder = { cursor: PrilikeCursor; milliseconds: number; subMillisecond: number };

/** Compare the PostgreSQL ordering key, not its timezone spelling or rounded milliseconds. */
function cursorOrder(value: unknown): CursorOrder {
  const invalid = () => new Error('Discovery cursor is invalid');
  if (!value || typeof value !== 'object') throw invalid();
  const raw = value as PrilikeCursor;
  if (typeof raw.id !== 'string' || raw.id.length !== 36
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.id)
    || typeof raw.createdAt !== 'string') throw invalid();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(raw.createdAt);
  if (!match || match[0].length !== raw.createdAt.length) throw invalid();
  const [, year, month, day, hour, minute, second, fraction = '', zone, zoneHour = '0', zoneMinute = '0'] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1]
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || Number(zoneHour) > 23 || Number(zoneMinute) > 59) throw invalid();
  const microseconds = fraction.padEnd(6, '0');
  // Give Date.parse its standard three-digit fraction; retain the remaining
  // three digits separately instead of multiplying an epoch beyond safe integer precision.
  const milliseconds = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.${microseconds.slice(0, 3)}${zone}`);
  if (!Number.isSafeInteger(milliseconds)) throw invalid();
  return { cursor: { createdAt: raw.createdAt, id: raw.id.toLowerCase() }, milliseconds,
    subMillisecond: Number(microseconds.slice(3)) };
}

function advances(next: CursorOrder, requested: CursorOrder): boolean {
  if (next.milliseconds !== requested.milliseconds) return next.milliseconds < requested.milliseconds;
  if (next.subMillisecond !== requested.subMillisecond) return next.subMillisecond < requested.subMillisecond;
  return next.cursor.id < requested.cursor.id;
}

/** Read-only account-owned page window. A return refresh rebuilds the same window atomically. */
export function createDiscoveryBrowse(load: (query: PrilikeStranaUpit) => Promise<PrilikeStrana>, isCurrent: () => boolean) {
  let state: DiscoveryBrowseState = { items: [], nextCursor: null, initialized: false, refreshing: false, loadingMore: false, error: null };
  let active = false, generation = 0, pageCount = 1;
  let pending: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: DiscoveryBrowseState) => { state = next; listeners.forEach(listener => listener()); };
  const unique = (items: PrilikaProjekcija[]) => [...new Map(items.map(item => [item.id, item])).values()];

  async function page(cursor: PrilikeCursor | undefined, controller: AbortController): Promise<PrilikeStrana> {
    let onAbort: (() => void) | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(() => {
          if (controller.signal.aborted) throw new Error('Discovery read cancelled');
          return load({ cursor, limit: 30, signal: controller.signal });
        }),
        new Promise<never>((_, reject) => {
          onAbort = () => reject(new Error('Discovery read cancelled'));
          controller.signal.addEventListener('abort', onAbort, { once: true });
          if (controller.signal.aborted) onAbort();
        }),
      ]);
    } finally {
      if (onAbort) controller.signal.removeEventListener('abort', onAbort);
    }
  }

  async function run(more: boolean) {
    if (!active || !isCurrent() || pending || (more && !state.nextCursor)) return;
    const request = ++generation;
    const controller = new AbortController(); pending = controller;
    // One budget for the entire atomic refresh window, not another 20s per page.
    const expiresAt = Date.now() + 20000;
    const timer = setTimeout(() => controller.abort(), 20000);
    const withinBudget = () => {
      if (Date.now() >= expiresAt) controller.abort();
      if (controller.signal.aborted) throw new Error('Discovery read cancelled or timed out');
    };
    const owns = () => active && request === generation && isCurrent();
    publish({ ...state, refreshing: !more, loadingMore: more, error: null });
    try {
      let cursor = more ? state.nextCursor ?? undefined : undefined;
      let items = more ? state.items : [];
      let next: PrilikeCursor | null = null, pages = 0;
      const wanted = more ? 1 : pageCount;
      for (; pages < wanted; pages++) {
        withinBudget();
        const requested = cursor ? cursorOrder(cursor) : null;
        const result = await page(requested?.cursor, controller);
        if (!owns()) return;
        withinBudget();
        const returned = result.nextCursor === null ? null : cursorOrder(result.nextCursor);
        if (returned && requested && !advances(returned, requested)) throw new Error('Discovery cursor did not advance');
        next = returned?.cursor ?? null;
        items = unique([...items, ...result.items]);
        if (!next) { pages++; break; }
        cursor = next;
      }
      if (owns()) {
        pageCount = more ? pageCount + pages : Math.max(1, pages);
        publish({ items, nextCursor: next, initialized: true, refreshing: false, loadingMore: false, error: null });
      }
    } catch {
      if (owns()) publish({ ...state, refreshing: false, loadingMore: false, error: more ? 'more' : 'refresh' });
    } finally { clearTimeout(timer); if (request === generation) pending = null; }
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { active = true; void run(false); },
    stop() { active = false; generation++; pending?.abort(); pending = null; },
    refresh: () => run(false),
    loadMore: () => run(true),
  };
}
