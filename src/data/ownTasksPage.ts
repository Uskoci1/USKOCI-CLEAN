import type { PotrebaProjekcija } from '../contracts/projections';
import type { MarketplaceView, OwnedTaskCounts } from './marketplaceView';
import { record, timestamp, uuid } from './serverReceipt';

/**
 * EX-04 S1 (A09 Moji zadaci). The server's own sets of my tasks, one keyset page at a time: the three tabs (Aktivni, Nacrti, Istorija), all of them,
 * and the tasks that wait for my choice. Every item of a page IS the `rpc_read_task` document the whole-list read returns, so the card, the price
 * basis and the selectable count are the ones `mapNeed` already reads; `sortAt` is the keyset value. Pure and React-free: the pager, the service and
 * the fake source share it.
 */
export type OwnTasksScope = 'ALL' | 'ACTIVE' | 'DRAFTS' | 'HISTORY' | 'WAITING';
export type OwnTasksCursor = { at: string; id: string };
export type OwnTasksPageRequest = { scope: OwnTasksScope; limit: number; cursor: OwnTasksCursor | null };
export type OwnTasksPage = {
  items: PotrebaProjekcija[]; hasMore: boolean;
  /** The five counts of the sets, only on the first page of a read; a later page never carries them. */
  counts: OwnedTaskCounts | null;
  /** Where the next page starts: the last item of this one. Null on an empty page. */
  cursor: OwnTasksCursor | null; asOf: string };

/** The server accepts 1..100; thirty cards are a few screens of this list. */
export const OWN_TASKS_PAGE_LIMIT = 30;
/** One validated task document of a page: the `rpc_read_task` document plus the keyset value. */
export type OwnTaskDocument = Record<string, unknown> & { id: string; sortAt: string };
const SCOPES: readonly OwnTasksScope[] = ['ALL', 'ACTIVE', 'DRAFTS', 'HISTORY', 'WAITING'];
export const isOwnTasksScope = (value: unknown): value is OwnTasksScope => SCOPES.includes(value as OwnTasksScope);

/**
 * The set the person is looking at, in the server's words. "Treba moja radnja" narrows to the tasks that wait for my choice, which are active by
 * definition, so a draft or a closed set with it is empty by rule and nothing is read (null).
 */
export function ownTasksScope(view: Pick<MarketplaceView, 'section' | 'attention'>): OwnTasksScope | null {
  if (view.attention) return view.section === 'drafts' || view.section === 'history' ? null : 'WAITING';
  return view.section === 'active' ? 'ACTIVE' : view.section === 'drafts' ? 'DRAFTS' : view.section === 'history' ? 'HISTORY' : 'ALL';
}
/** Search and the price filter are refinements of the loaded set: while one is on, the rest of the set is read so the answer is complete. */
export const ownTasksRefined = (view: Pick<MarketplaceView, 'query' | 'price'>): boolean => view.query.trim() !== '' || view.price !== 'all';

const COUNT_KEYS = ['total', 'active', 'drafts', 'history', 'waiting'] as const;

/**
 * Strict: anything that does not add up is no answer, never a short or a guessed one. The documents are mapped by the caller's `map` (the one
 * `mapNeed` the whole-list read uses), so an invalid task document makes the page invalid and is never skipped.
 */
export function decodeOwnTasksPage(raw: unknown, request: Pick<OwnTasksPageRequest, 'limit' | 'cursor'>, map: (document: any) => PotrebaProjekcija):
  (OwnTasksPage & { documents: OwnTaskDocument[] }) | null {
  const data = record(raw);
  if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean' || !timestamp(data.asOf) || data.items.length > request.limit
      || (data.hasMore && data.items.length !== request.limit)) return null;
  let counts: OwnedTaskCounts | null = null;
  if (request.cursor === null) {
    const c = record(data.counts);
    if (!c || !COUNT_KEYS.every(key => Number.isSafeInteger(c[key]) && (c[key] as number) >= 0)) return null;
    const n = c as Record<typeof COUNT_KEYS[number], number>;
    // The three tabs partition my tasks, and what waits for my choice is active.
    if (n.active + n.drafts + n.history !== n.total || n.waiting > n.active) return null;
    counts = { total: n.total, active: n.active, waiting: n.waiting, drafts: n.drafts, history: n.history };
  } else if (data.counts !== null && data.counts !== undefined) return null;
  const items: PotrebaProjekcija[] = [], documents: OwnTaskDocument[] = [], seen = new Set<string>();
  for (const value of data.items) {
    const document = record(value);
    if (!document || !uuid(document.id) || !timestamp(document.sortAt) || seen.has(document.id.toLowerCase())) return null;
    seen.add(document.id.toLowerCase());
    try { items.push(map(document)); } catch { return null; }
    documents.push(document as OwnTaskDocument);
  }
  // A page that promises more and gives none could never advance.
  if (data.hasMore && items.length === 0) return null;
  const last = documents[documents.length - 1];
  return { items, documents, hasMore: data.hasMore, counts, asOf: data.asOf,
    cursor: last ? { at: last.sortAt, id: last.id } : null };
}
