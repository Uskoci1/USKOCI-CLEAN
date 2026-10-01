import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import type { ApplicationCounts } from '../myApplicationsView';
import type { OwnApplicationsPage, OwnApplicationsPageRequest } from '../ownApplicationsPage';
import { createOwnApplicationsPager } from '../ownApplicationsPager';

/**
 * EX-04 S2 (B10): what the applications pager adds to the generic one (the generic rules are proved by the S1 tests of the same code): an application is known by its
 * `prijavaId`, the cursor carries its rank, a screen that owns its read activates the pager and asks `reload` (which answers whether the page is fresh and on screen), and a
 * command that moves an application between sections drops the sets that are not shown.
 */
const COUNTS: ApplicationCounts = { total: 6, attention: 1, active: 3, finished: 2 };
const application = (id: string) => ({ prijavaId: id, naslov: `Prijava ${id}` }) as unknown as MojaPrijavaProjekcija;
const page = (ids: string[], hasMore: boolean, counts: ApplicationCounts | null = null, rank: 0 | 1 | 2 = 1): OwnApplicationsPage => ({
  items: ids.map(application), hasMore, counts, asOf: '2026-10-01T08:00:00.000000+00:00',
  cursor: ids.length ? { at: `t-${ids[ids.length - 1]}`, id: ids[ids.length - 1], rank } : null });
const ids = (state: { items: readonly MojaPrijavaProjekcija[] }) => state.items.map(item => item.prijavaId);
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness() {
  const calls: { request: OwnApplicationsPageRequest; resolve: (value: OwnApplicationsPage) => void; reject: (error: Error) => void }[] = [];
  const readPage = jest.fn((request: OwnApplicationsPageRequest) => new Promise<OwnApplicationsPage>((resolve, reject) => { calls.push({ request, resolve, reject }); }));
  let current = true, time = 10_000_000;
  const pager = createOwnApplicationsPager({ readPage, isCurrent: () => current, now: () => time });
  return { pager, calls, readPage, setCurrent: (value: boolean) => { current = value; }, advance: (ms: number) => { time += ms; },
    answer: async (index: number, value: OwnApplicationsPage) => { calls[index].resolve(value); await settle(); },
    fail: async (index: number) => { calls[index].reject(new Error('OWN_APPLICATIONS_PAGE_UNAVAILABLE')); await settle(); } };
}

test('an application is known by its prijavaId: the next page never repeats one, and asks from the last one with its rank', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.start();
  expect(h.calls[0].request).toEqual({ scope: 'ALL', limit: 30, cursor: null });
  await h.answer(0, page(['a', 'b'], true, COUNTS));
  void h.pager.loadMore();
  expect(h.calls[1].request).toEqual({ scope: 'ALL', limit: 30, cursor: { at: 't-b', id: 'b', rank: 1 } });
  await h.answer(1, page(['b', 'c'], false, null, 2));
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
  await h.answer(0, page(['a'], false, COUNTS));
  await expect(first).resolves.toBe(true);
  expect(h.pager.snapshot()).toMatchObject({ loading: false, counts: COUNTS }); expect(ids(h.pager.snapshot())).toEqual(['a']);
});

test('a first page that failed is a reload that says so; what was on screen stays, and an empty screen turns into an error', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  const first = h.pager.reload('auto'); await h.fail(0);
  await expect(first).resolves.toBe(false); expect(h.pager.snapshot()).toMatchObject({ error: true, loading: false });
  const again = h.pager.reload('auto'); await h.answer(1, page(['a'], false, COUNTS)); await expect(again).resolves.toBe(true);
  const failing = h.pager.reload('keep'); await h.fail(2);
  await expect(failing).resolves.toBe(false); expect(h.pager.snapshot()).toMatchObject({ error: false }); expect(ids(h.pager.snapshot())).toEqual(['a']);
});

test('a reload that a blur, a background, another account or a newer read retired answers false and changes nothing', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  const stopped = h.pager.reload('auto'); h.pager.stop(); await h.answer(0, page(['a'], false, COUNTS));
  await expect(stopped).resolves.toBe(false); expect(ids(h.pager.snapshot())).toEqual([]);
  h.pager.activate();
  const first = h.pager.reload('auto'), second = h.pager.reload('keep');
  await h.answer(1, page(['old'], false, COUNTS)); await h.answer(2, page(['new'], false, COUNTS));
  await expect(first).resolves.toBe(false); await expect(second).resolves.toBe(true); expect(ids(h.pager.snapshot())).toEqual(['new']);
  const another = h.pager.reload('keep'); h.setCurrent(false); await h.answer(3, page(['of-a'], false, COUNTS));
  await expect(another).resolves.toBe(false); expect(ids(h.pager.snapshot())).toEqual(['new']);
});

test('reload "auto" is what focus does: a set held and fresh is shown at once and re-read to the depth loaded, an old one loads as if new; "keep" starts from the top', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  const first = h.pager.reload('auto'); await h.answer(0, page(['a', 'b'], true, COUNTS)); await first;
  void h.pager.loadMore(); await h.answer(1, page(['c'], false));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
  h.advance(60_000);
  const silent = h.pager.reload('auto');
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']); expect(h.pager.snapshot().refreshing).toBe(true);
  expect(h.calls[2].request.cursor).toBeNull();
  await h.answer(2, page(['a', 'b'], true, COUNTS)); expect(h.calls[3].request.cursor).toEqual({ at: 't-b', id: 'b', rank: 1 });
  await h.answer(3, page(['c'], false)); await silent;
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
  h.advance(10 * 60_000);
  void h.pager.reload('auto'); expect(h.pager.snapshot()).toMatchObject({ items: [], loading: true });
  const top = h.pager.reload('keep'); expect(h.calls[h.calls.length - 1].request.cursor).toBeNull(); void top;
});

test('a command that moved an application drops the sets that are not shown; the shown one stays, and each dropped one is read as new when asked for', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  const all = h.pager.reload('auto'); await h.answer(0, page(['a', 'b'], false, COUNTS)); await all;
  h.pager.setScope('ATTENTION'); await h.answer(1, page(['a'], false, COUNTS, 0));
  h.pager.setScope('ALL');
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b']);
  await h.answer(2, page(['a', 'b'], false, COUNTS));   // the quiet re-read of the set that came back
  h.pager.forgetOtherSets();
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b']);
  h.pager.setScope('ATTENTION');
  expect(h.pager.snapshot()).toMatchObject({ items: [], loading: true });   // not the stale set: it is read as new
  expect(h.calls[h.calls.length - 1].request).toEqual({ scope: 'ATTENTION', limit: 30, cursor: null });
});

test('the rest of the shown set is read without being asked while a destination must be found, and not once it is off', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate(); h.pager.ensureComplete(true);
  const first = h.pager.reload('auto'); await h.answer(0, page(['a'], true, COUNTS)); await first;
  expect(h.calls).toHaveLength(2); await h.answer(1, page(['b'], true));
  expect(h.calls).toHaveLength(3); h.pager.ensureComplete(false);
  await h.answer(2, page(['c'], true)); expect(h.calls).toHaveLength(3);
  expect(ids(h.pager.snapshot())).toEqual(['a', 'b', 'c']);
});

test('a destination that must be found stops the reading the moment it is on screen: not one page more, checked before every page', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  const hasTarget = (items: readonly MojaPrijavaProjekcija[]) => items.some(item => item.prijavaId === 'target');
  h.pager.ensureComplete(true, hasTarget);
  const first = h.pager.reload('auto'); await h.answer(0, page(['a'], true, COUNTS)); await first;
  expect(h.calls).toHaveLength(2);
  await h.answer(1, page(['target', 'b'], true));
  expect(ids(h.pager.snapshot())).toEqual(['a', 'target', 'b']); expect(h.calls).toHaveLength(2);   // met: the next page is not read
  h.pager.ensureComplete(true, hasTarget); expect(h.calls).toHaveLength(2);   // asking again changes nothing while it is on screen
  h.pager.ensureComplete(true); expect(h.calls).toHaveLength(3);   // a plain "read everything" has no stop
});

test('a destination already on the first page reads nothing more; one that never comes reads to the end of the set and then stops', async () => {
  const h = harness();
  h.pager.setScope('ALL'); h.pager.activate();
  h.pager.ensureComplete(true, items => items.some(item => item.prijavaId === 'a'));
  const first = h.pager.reload('auto'); await h.answer(0, page(['a'], true, COUNTS)); await first;
  expect(h.calls).toHaveLength(1);
  const other = harness();
  other.pager.setScope('ALL'); other.pager.activate();
  other.pager.ensureComplete(true, items => items.some(item => item.prijavaId === 'ghost'));
  const read = other.pager.reload('auto'); await other.answer(0, page(['a'], true, COUNTS)); await read;
  await other.answer(1, page(['b'], false)); expect(other.calls).toHaveLength(2);
  expect(ids(other.pager.snapshot())).toEqual(['a', 'b']); expect(other.pager.snapshot().hasMore).toBe(false);
});
