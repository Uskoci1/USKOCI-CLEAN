import type { KandidatProjekcija } from '../../contracts/projections';
import type { CandidatesCounts, CandidatesPage, CandidatesPageRequest } from '../candidatesPage';
import { createCandidatesPager } from '../candidatesPager';

/**
 * EX-04 S4 (A11): what the candidate pager adds to the generic one (the generic rules are proved by the S1 and S2 tests of the same code): an application is known by its `prijavaId`, the
 * cursor is its keyset value (`at`, `id`), there is one set, a screen that owns its read activates the pager and asks `reload`, and the rest of the set is read, one page at a time, only
 * while a refinement (the order by price, the comparison) asks for it.
 */
const candidate = (id: string) => ({ prijavaId: id, ime: `Osoba ${id}` }) as unknown as KandidatProjekcija;
const page = (ids: string[], hasMore: boolean, total: number | null = null): CandidatesPage => ({
  items: ids.map(candidate), hasMore, counts: total === null ? null : { total }, asOf: '2026-10-01T08:00:00.000000+00:00',
  cursor: ids.length ? { at: `2026-09-2${ids.length}T10:00:00+00:00`, id: ids[ids.length - 1] } : null });
const ids = (state: { items: readonly KandidatProjekcija[] }) => state.items.map(item => item.prijavaId);
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness() {
  const calls: { request: CandidatesPageRequest; resolve: (value: CandidatesPage) => void; reject: (error: Error) => void }[] = [];
  const readPage = jest.fn((request: CandidatesPageRequest) => new Promise<CandidatesPage>((resolve, reject) => { calls.push({ request, resolve, reject }); }));
  let current = true, time = 10_000_000;
  const pager = createCandidatesPager({ readPage, isCurrent: () => current, now: () => time });
  return { pager, calls, readPage, setCurrent: (value: boolean) => { current = value; }, advance: (ms: number) => { time += ms; },
    answer: async (index: number, value: CandidatesPage) => { calls[index].resolve(value); await settle(); },
    fail: async (index: number) => { calls[index].reject(new Error('CANDIDATE_PAGE_UNAVAILABLE')); await settle(); } };
}
const COUNTS: CandidatesCounts = { total: 4 };

test('a candidate is known by its prijavaId: the next page asks from the last one with its keyset value and the page limit, and never repeats one', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start();
  expect(h.calls[0].request).toMatchObject({ limit: 50, cursor: null });
  await h.answer(0, page(['a', 'b'], true, 4));
  void h.pager.loadMore();
  expect(h.calls[1].request).toMatchObject({ limit: 50, cursor: { at: '2026-09-22T10:00:00+00:00', id: 'b' } });
  await h.answer(1, page(['b', 'c'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
  expect(h.pager.snapshot()).toMatchObject({ hasMore: false, counts: COUNTS });
});

test('a screen that owns its read activates the pager: nothing is read until reload asks, and reload says whether the first page is fresh and on screen', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  expect(h.readPage).not.toHaveBeenCalled();
  expect(h.pager.snapshot()).toMatchObject({ scope: 'ALL', loading: true, items: [] });
  const first = h.pager.reload('auto');
  expect(h.calls).toHaveLength(1);
  await h.answer(0, page(['a'], false, 1));
  await expect(first).resolves.toBe(true);
  expect(h.pager.snapshot()).toMatchObject({ loading: false, counts: { total: 1 } }); expect(ids(h.pager.snapshot())).toEqual(['a']);
});

test('a first page that failed is a reload that says so; what was on screen stays, and an empty screen turns into an error', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  const first = h.pager.reload('auto'); await h.fail(0);
  await expect(first).resolves.toBe(false); expect(h.pager.snapshot()).toMatchObject({ error: true, loading: false });
  const again = h.pager.reload('auto'); await h.answer(1, page(['a'], false, 1)); await expect(again).resolves.toBe(true);
  const failing = h.pager.reload('keep'); await h.fail(2);
  await expect(failing).resolves.toBe(false); expect(h.pager.snapshot()).toMatchObject({ error: false }); expect(ids(h.pager.snapshot())).toEqual(['a']);
});

test('the rest of the set is read, a page at a time, only while a refinement asks for it, and not one page more once the set is complete', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  void h.pager.reload('auto'); await h.answer(0, page(['a', 'b'], true, 5));
  expect(h.calls).toHaveLength(1);   // nothing is read for a person who only looks
  h.pager.ensureComplete(true);
  expect(h.calls).toHaveLength(2); expect(h.calls[1].request.cursor).toMatchObject({ id: 'b' });
  await h.answer(1, page(['c', 'd'], true));
  expect(h.calls).toHaveLength(3); expect(h.calls[2].request.cursor).toMatchObject({ id: 'd' });
  await h.answer(2, page(['e'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c', 'd', 'e']); expect(h.pager.snapshot().hasMore).toBe(false);
  expect(h.calls).toHaveLength(3);
});

test('turning the refinement off stops the reading of the rest: the page in flight lands, no further one is asked for', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  void h.pager.reload('auto'); await h.answer(0, page(['a'], true, 4));
  h.pager.ensureComplete(true); expect(h.calls).toHaveLength(2);
  h.pager.ensureComplete(false);
  await h.answer(1, page(['b'], true));
  expect(h.calls).toHaveLength(2); expect(ids(h.pager.snapshot())).toEqual(['a', 'b']); expect(h.pager.snapshot().hasMore).toBe(true);
});

test('a page that fails while the rest is read keeps what is on screen, stops the reading and is retried by the same call that loads more', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  void h.pager.reload('auto'); await h.answer(0, page(['a'], true, 3));
  h.pager.ensureComplete(true); await h.fail(1);
  expect(h.pager.snapshot()).toMatchObject({ moreError: true, loadingMore: false, error: false }); expect(ids(h.pager.snapshot())).toEqual(['a']);
  expect(h.calls).toHaveLength(2);   // a failed page does not make the reading of the rest loop
  void h.pager.loadMore(); await h.answer(2, page(['b', 'c'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
});

test('another account, a blur and the app leaving the foreground retire what is in flight and never show an old cursor to a new set', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  void h.pager.reload('auto'); await h.answer(0, page(['a'], true, 4));
  void h.pager.loadMore();
  h.setCurrent(false);
  await h.answer(1, page(['z'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a']);   // the page of another moment was discarded
  h.setCurrent(true); h.pager.forget();
  expect(h.pager.snapshot()).toMatchObject({ items: [], counts: null });
});
