import type { PotrebaProjekcija } from '../../contracts/projections';
import type { OwnedTaskCounts } from '../marketplaceView';
import type { OwnTasksPage, OwnTasksPageRequest } from '../ownTasksPage';
import { createOwnTasksPager, OWN_TASKS_STALE_MS } from '../ownTasksPager';

/**
 * EX-04 S1 (A09): every rule of the one owner of the paged read of my own tasks. The reader is a hand-resolved promise, so each test says exactly
 * which answer arrives when: a page that arrives after the set it belongs to was replaced, after a scope change, a blur, a background or another
 * account must change nothing.
 */
const COUNTS: OwnedTaskCounts = { total: 7, active: 4, waiting: 2, drafts: 1, history: 2 };
const task = (id: string) => ({ id, naslov: `Zadatak ${id}` }) as unknown as PotrebaProjekcija;
const page = (ids: string[], hasMore: boolean, counts: OwnedTaskCounts | null = null): OwnTasksPage => ({
  items: ids.map(task), hasMore, counts, asOf: '2026-10-01T08:00:00.000000+00:00',
  cursor: ids.length ? { at: `t-${ids[ids.length - 1]}`, id: ids[ids.length - 1] } : null });
const ids = (state: { items: readonly PotrebaProjekcija[] }) => state.items.map(item => item.id);
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness(overrides: Record<string, unknown> = {}) {
  const calls: { request: OwnTasksPageRequest; resolve: (value: OwnTasksPage) => void; reject: (error: Error) => void }[] = [];
  const readPage = jest.fn((request: OwnTasksPageRequest) => new Promise<OwnTasksPage>((resolve, reject) => { calls.push({ request, resolve, reject }); }));
  let current = true, time = 10_000_000;
  const pager = createOwnTasksPager({ readPage, isCurrent: () => current, now: () => time, ...overrides });
  return { pager, calls, readPage, setCurrent: (value: boolean) => { current = value; }, advance: (ms: number) => { time += ms; },
    answer: async (index: number, value: OwnTasksPage) => { calls[index].resolve(value); await settle(); },
    fail: async (index: number) => { calls[index].reject(new Error('OWN_TASKS_PAGE_UNAVAILABLE')); await settle(); } };
}

test('nothing is read until the screen is focused; focus reads the first page of the scope asked for', async () => {
  const h = harness();
  h.pager.setScope('ACTIVE');
  expect(h.readPage).not.toHaveBeenCalled();
  expect(h.pager.snapshot()).toMatchObject({ scope: 'ACTIVE', loading: true, items: [], counts: null });
  h.pager.start();
  expect(h.calls).toHaveLength(1); expect(h.calls[0].request).toEqual({ scope: 'ACTIVE', limit: 30, cursor: null });
  await h.answer(0, page(['a', 'b'], true, COUNTS));
  expect(h.pager.snapshot()).toMatchObject({ loading: false, error: false, hasMore: true, counts: COUNTS });
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b']);
});

test('the next page starts at the last task, is appended without a duplicate, and carries no counts', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); await h.answer(0, page(['a', 'b'], true, COUNTS));
  void h.pager.loadMore();
  expect(h.calls[1].request).toEqual({ scope: 'ALL', limit: 30, cursor: { at: 't-b', id: 'b' } });
  expect(h.pager.snapshot().loadingMore).toBe(true);
  await h.answer(1, page(['b', 'c', 'd'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c', 'd']);
  expect(h.pager.snapshot()).toMatchObject({ hasMore: false, loadingMore: false, moreError: false, counts: COUNTS });
  void h.pager.loadMore(); expect(h.calls).toHaveLength(2);
});

test('a page is asked for once: loading more while one is in flight, or past the end, reads nothing', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start();
  void h.pager.loadMore(); expect(h.calls).toHaveLength(1);
  await h.answer(0, page(['a'], true, COUNTS));
  void h.pager.loadMore(); void h.pager.loadMore(); void h.pager.loadMore();
  expect(h.calls).toHaveLength(2);
});

test('each scope is its own set: a set already held is shown at once and read again quietly', async () => {
  const h = harness();
  h.pager.setScope('ACTIVE'); h.pager.start(); await h.answer(0, page(['a'], false, COUNTS));
  h.pager.setScope('DRAFTS');
  expect(h.pager.snapshot()).toMatchObject({ scope: 'DRAFTS', loading: true, items: [] });
  await h.answer(1, page(['d1'], false, COUNTS));
  h.pager.setScope('ACTIVE');
  expect(h.pager.snapshot()).toMatchObject({ scope: 'ACTIVE', loading: false, refreshing: true }); expect(ids(h.pager.snapshot())).toEqual(['a']);
  expect(h.calls[2].request.scope).toBe('ACTIVE');
  await h.answer(2, page(['a', 'z'], false, COUNTS));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'z']); expect(h.pager.snapshot().refreshing).toBe(false);
});

test('a first page that arrives for a scope no longer shown never replaces what is shown', async () => {
  const h = harness();
  h.pager.setScope('ACTIVE'); h.pager.start();
  h.pager.setScope('HISTORY');
  await h.answer(1, page(['h1'], false, COUNTS));
  await h.answer(0, page(['late'], false, COUNTS));
  expect(h.pager.snapshot().scope).toBe('HISTORY'); expect(ids(h.pager.snapshot())).toEqual(['h1']);
});

test('a next page that began before the first page replaced the set is discarded: an old cursor never meets the new set', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); await h.answer(0, page(['a', 'b'], true, COUNTS));
  void h.pager.loadMore();                      // call 1: the old cursor
  void h.pager.refresh();                        // call 2: the first page again
  await h.answer(2, page(['n', 'a', 'b'], true, COUNTS));
  await h.answer(1, page(['x', 'y'], false));    // the old page arrives last
  expect(ids(h.pager.snapshot())).toEqual(['n', 'a', 'b']);
  expect(h.pager.snapshot()).toMatchObject({ hasMore: true, loadingMore: false });
  void h.pager.loadMore(); expect(h.calls[3].request.cursor).toEqual({ at: 't-b', id: 'b' });
});

test('pull-to-refresh keeps the set on screen while it reads, starts again from the top, and a failed one keeps what was there', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); await h.answer(0, page(['a', 'b'], true, COUNTS));
  void h.pager.loadMore(); await h.answer(1, page(['c'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
  void h.pager.refresh();
  expect(h.pager.snapshot()).toMatchObject({ refreshing: true, loading: false }); expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
  expect(h.calls[2].request.cursor).toBeNull();
  await h.fail(2);
  expect(h.pager.snapshot()).toMatchObject({ refreshing: false, error: false }); expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
  void h.pager.refresh(); await h.answer(3, page(['n', 'a'], true, { ...COUNTS, total: 8 }));
  expect(ids(h.pager.snapshot())).toEqual(['n', 'a']); expect(h.pager.snapshot().counts?.total).toBe(8);
});

test('a first page that fails shows an error only while nothing is on screen, and the same refresh retries it', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); await h.fail(0);
  expect(h.pager.snapshot()).toMatchObject({ error: true, loading: false, items: [] });
  void h.pager.refresh();
  expect(h.pager.snapshot()).toMatchObject({ error: false, loading: true });
  await h.answer(1, page(['a'], false, COUNTS));
  expect(h.pager.snapshot()).toMatchObject({ error: false, loading: false }); expect(ids(h.pager.snapshot())).toEqual(['a']);
});

test('a next page that fails keeps the list, says so at its foot, and the same call retries it', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); await h.answer(0, page(['a'], true, COUNTS));
  void h.pager.loadMore(); await h.fail(1);
  expect(h.pager.snapshot()).toMatchObject({ moreError: true, loadingMore: false, hasMore: true, error: false }); expect(ids(h.pager.snapshot())).toEqual(['a']);
  void h.pager.loadMore();
  expect(h.pager.snapshot()).toMatchObject({ moreError: false, loadingMore: true });
  expect(h.calls[2].request.cursor).toEqual({ at: 't-a', id: 'a' });
  await h.answer(2, page(['b'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b']);
});

test('while a refinement is on, the rest of the set is read one page at a time; an error stops it until the retry; turning it off stops it', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); h.pager.ensureComplete(true);
  await h.answer(0, page(['a'], true, COUNTS));
  expect(h.calls).toHaveLength(2); await h.answer(1, page(['b'], true));
  expect(h.calls).toHaveLength(3); await h.fail(2);
  expect(h.pager.snapshot().moreError).toBe(true); expect(h.calls).toHaveLength(3);
  void h.pager.loadMore(); await h.answer(3, page(['c'], true));
  expect(h.calls).toHaveLength(5); h.pager.ensureComplete(false);
  await h.answer(4, page(['d'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c', 'd']); expect(h.pager.snapshot().hasMore).toBe(false);
});

test('reading the rest of a set is bounded', async () => {
  const h = harness({ maxPages: 3 });
  h.pager.setScope('ALL'); h.pager.start(); h.pager.ensureComplete(true);
  await h.answer(0, page(['a'], true, COUNTS)); await h.answer(1, page(['b'], true)); await h.answer(2, page(['c'], true));
  expect(h.calls).toHaveLength(3); expect(h.pager.snapshot()).toMatchObject({ hasMore: true, loadingMore: false });
  void h.pager.loadMore(); expect(h.calls).toHaveLength(4);
});

test('a blur retires what is in flight and keeps what is held; the next focus reads again quietly', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); await h.answer(0, page(['a'], true, COUNTS));
  void h.pager.loadMore(); h.pager.stop();
  expect(h.pager.snapshot()).toMatchObject({ loadingMore: false }); expect(ids(h.pager.snapshot())).toEqual(['a']);
  await h.answer(1, page(['late'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a']);
  h.pager.start(); expect(h.pager.snapshot().refreshing).toBe(true);
  expect(h.calls[2].request.cursor).toBeNull();
  await h.answer(2, page(['a', 'b'], false, COUNTS)); expect(ids(h.pager.snapshot())).toEqual(['a', 'b']);
});

test('the app leaving the foreground forgets every set and every count', async () => {
  const h = harness();
  h.pager.setScope('ACTIVE'); h.pager.start(); await h.answer(0, page(['a'], false, COUNTS));
  h.pager.forget();
  expect(h.pager.snapshot()).toMatchObject({ items: [], counts: null, loading: true });
  h.pager.start();
  expect(h.pager.snapshot()).toMatchObject({ items: [], loading: true });
  await h.answer(1, page(['b'], false, COUNTS)); expect(ids(h.pager.snapshot())).toEqual(['b']);
});

test('an answer for another account, or after the account changed, publishes nothing', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); h.setCurrent(false);
  await h.answer(0, page(['secret'], false, COUNTS));
  expect(h.pager.snapshot().items).toEqual([]); expect(h.pager.snapshot().counts).toBeNull();
  h.pager.start(); expect(h.pager.snapshot()).toMatchObject({ items: [], counts: null });
  void h.pager.loadMore(); void h.pager.refresh(); expect(h.calls).toHaveLength(1);
});

test('coming back reads as many pages as were loaded, bounded, and swaps them in one step so the reading position survives', async () => {
  const h = harness({ reloadPages: 2 });
  h.pager.setScope('ALL'); h.pager.start(); await h.answer(0, page(['a', 'b'], true, COUNTS));
  void h.pager.loadMore(); await h.answer(1, page(['c', 'd'], true));
  void h.pager.loadMore(); await h.answer(2, page(['e', 'f'], false));
  h.pager.stop(); h.pager.start();
  expect(h.calls[3].request.cursor).toBeNull();
  await h.answer(3, page(['n', 'a'], true, COUNTS));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);     // still the old set until every page of the depth has answered
  expect(h.calls[4].request.cursor).toEqual({ at: 't-a', id: 'a' });
  await h.answer(4, page(['b', 'c'], true));
  expect(ids(h.pager.snapshot())).toEqual(['n', 'a', 'b', 'c']);
  expect(h.pager.snapshot()).toMatchObject({ hasMore: true, refreshing: false });
});

test('a set older than the bound loads as if new instead of showing what it had', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start(); await h.answer(0, page(['a'], false, COUNTS));
  h.pager.stop(); h.advance(OWN_TASKS_STALE_MS + 1); h.pager.start();
  expect(h.pager.snapshot()).toMatchObject({ loading: true, items: [] });
  await h.answer(1, page(['b'], false, COUNTS)); expect(ids(h.pager.snapshot())).toEqual(['b']);
});

test('the empty set (a draft or closed set narrowed to what waits for me) reads nothing and is not loading', async () => {
  const h = harness();
  h.pager.setScope(null); h.pager.start();
  expect(h.readPage).not.toHaveBeenCalled();
  expect(h.pager.snapshot()).toMatchObject({ scope: null, loading: false, error: false, hasMore: false, items: [] });
  h.pager.setScope('WAITING'); expect(h.calls).toHaveLength(1);
  await h.answer(0, page(['w'], false, COUNTS));
  h.pager.setScope(null); expect(h.pager.snapshot()).toMatchObject({ items: [], loading: false });
});

test('the counts are the first page of any scope; a later page and a failed read never change them', async () => {
  const h = harness();
  h.pager.setScope('DRAFTS'); h.pager.start(); await h.answer(0, page(['d'], true, COUNTS));
  void h.pager.loadMore(); await h.answer(1, page(['e'], false));
  expect(h.pager.snapshot().counts).toEqual(COUNTS);
  h.pager.setScope('HISTORY'); await h.fail(2);
  expect(h.pager.snapshot().counts).toEqual(COUNTS);
  h.pager.refresh(); await h.answer(3, page(['h'], false, { ...COUNTS, waiting: 0 }));
  expect(h.pager.snapshot().counts?.waiting).toBe(0);
});

test('the snapshot is one stable object between changes and every change tells the listeners once', async () => {
  const h = harness(), listener = jest.fn();
  const unsubscribe = h.pager.subscribe(listener);
  h.pager.setScope('ALL'); h.pager.start();
  const before = h.pager.snapshot(); expect(h.pager.snapshot()).toBe(before);
  const notified = listener.mock.calls.length; await h.answer(0, page(['a'], false, COUNTS));
  expect(listener.mock.calls.length).toBeGreaterThan(notified); expect(h.pager.snapshot()).not.toBe(before);
  unsubscribe(); const quiet = listener.mock.calls.length; h.pager.forget(); expect(listener.mock.calls.length).toBe(quiet);
});
