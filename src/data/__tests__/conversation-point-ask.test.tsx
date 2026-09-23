import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import type { ConfirmedLocationPoint, NeedLocationReview } from '../../contracts/location';
import { pointsMissing } from '../../lib/location';
import { ConversationPointAsk } from '../../ui/location/ConversationPointAsk';
import { LocationPointEditor } from '../../ui/location/LocationPointEditor';

/**
 * The conversation asks for the map point, and the ask saves only a fully confirmed set.
 *
 * `need.resolved_location` is the one fact publishing cannot do without and the AI may neither
 * be required nor permitted to produce, so before this the only bridge was a long form that
 * three real drafts never completed. These tests pin the two things that make the new route
 * trustworthy: the ask appears exactly when a point is missing, and nothing is written until
 * every required point has been confirmed by hand.
 */

const CONVERSATION = '22222222-2222-4222-8222-222222222222';
const route = { mode: 'POINT_TO_POINT' as const, start: { city: 'Novi Sad', area: 'Lenke Dunđerski' },
  end: { city: 'Petrovaradin', area: 'Petrovaradinska tvrđava' } };

describe('pointsMissing', () => {
  it('counts the points a topology requires and the ones already confirmed', () => {
    expect(pointsMissing(route, null)).toEqual({ done: 0, total: 2 });
    expect(pointsMissing(route, { points: [{ slot: 'start' }] })).toEqual({ done: 1, total: 2 });
    expect(pointsMissing(route, { points: [{ slot: 'start' }, { slot: 'end' }] })).toEqual({ done: 2, total: 2 });
  });

  it('asks for nothing when the work is remote', () => {
    expect(pointsMissing({ mode: 'REMOTE' }, null)).toEqual({ done: 0, total: 0 });
  });

  it('counts a stationary task as one point', () => {
    expect(pointsMissing({ mode: 'STATIONARY', start: { city: 'Novi Sad' } }, null)).toEqual({ done: 0, total: 1 });
  });

  it('counts every stop on a multi-stop route', () => {
    const geography = { mode: 'MULTI_STOP', start: { city: 'A' }, waypoints: [{ city: 'B' }, { city: 'C' }], end: { city: 'D' } };
    expect(pointsMissing(geography, null)).toEqual({ done: 0, total: 4 });
  });

  it('ignores a confirmed point for a slot the topology no longer has', () => {
    // A route that lost its destination must not look finished because an old end point survives.
    expect(pointsMissing({ mode: 'STATIONARY', start: { city: 'Novi Sad' } },
      { points: [{ slot: 'end' }] })).toEqual({ done: 0, total: 1 });
  });

  it('survives junk instead of a topology or a point set', () => {
    expect(pointsMissing(null, null)).toEqual({ done: 0, total: 0 });
    expect(pointsMissing('Novi Sad', 7)).toEqual({ done: 0, total: 0 });
    expect(pointsMissing(route, { points: 'nope' })).toEqual({ done: 0, total: 2 });
    expect(pointsMissing(route, { points: [null, 3, { slot: 'start' }] })).toEqual({ done: 1, total: 2 });
  });
});

const mockRead = jest.fn(), mockSave = jest.fn();
jest.mock('../locationClientService', () => ({
  needLocationClientService: { read: (...args: unknown[]) => mockRead(...args), save: (...args: unknown[]) => mockSave(...args) },
}));
const resolverDouble = { search: jest.fn(), reverse: jest.fn(), cancel: jest.fn() };
const mockProductionResolver = jest.fn(() => resolverDouble);
jest.mock('../productionLocationResolver', () => ({
  createProductionLocationResolver: () => mockProductionResolver(),
}));
// The point editor reaches the native map; this suite is about the ask, not the map.
jest.mock('../../ui/location/LocationPointEditor', () => ({
  LocationPointEditor: () => null,
}));
// The harness cannot load reanimated, which Press pulls in. Same explicit mocks the other
// screen suites in this directory use.
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));

const review = (points: ConfirmedLocationPoint[] = []): NeedLocationReview => ({
  accountId: '11111111-1111-4111-8111-111111111111', conversationId: CONVERSATION,
  editable: true, confirmed: false, revision: 'a'.repeat(64),
  value: { taskCountryCode: 'RS', geography: route, exactAddress: 'Lenke Dunđerski 11, Novi Sad',
    accessNotes: null, ...(points.length ? { resolvedLocation: { version: 1, points,
      binding: { taskCountryCode: 'RS', geography: route, exactAddress: 'Lenke Dunđerski 11, Novi Sad' } } } : {}) },
});
const point = (slot: 'start' | 'end'): ConfirmedLocationPoint => ({
  slot, latitudeE6: 45_255_000, longitudeE6: 19_845_000, origin: { kind: 'MANUAL_PIN' },
});

describe('the conversation point ask', () => {
  let tree: ReactTestRenderer | undefined;
  beforeEach(() => {
    mockRead.mockReset(); mockSave.mockReset();
    mockRead.mockResolvedValue({ ok: true, podatak: review() });
    mockSave.mockResolvedValue({ ok: true, podatak: { saved: true, idempotentReplay: false, review: review([point('start'), point('end')]) } });
  });
  afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

  const mount = async (onSaved = jest.fn(), onClose = jest.fn()) => {
    await act(async () => { tree = create(<ConversationPointAsk conversationId={CONVERSATION} onSaved={onSaved} onClose={onClose} />); });
    return { onSaved, onClose };
  };
  const editor = () => tree!.root.findByType(LocationPointEditor);

  it('reads the location review for its own conversation', async () => {
    await mount();
    expect(mockRead).toHaveBeenCalledWith(CONVERSATION);
  });

  it('asks for the first missing point and seeds it with the address already known', async () => {
    await mount();
    expect(editor().props.slot).toBe('start');
    expect(editor().props.initialQuery).toBe('Lenke Dunđerski 11, Novi Sad');
    expect(editor().props.autoLocate).toBe(true);
  });

  it('hands the editor a resolver that can actually reach the search endpoint', async () => {
    // Without one the editor builds an unconfigured resolver, which answers
    // PROVIDER_ACTIVATION_BLOCKED without a request: the seeded lookup never leaves the device,
    // no pin is placed, and the map opens on half the world. That is what shipped in
    // pkg022-b9231a3 and what this pins closed.
    await mount();
    expect(mockProductionResolver).toHaveBeenCalled();
    expect(editor().props.resolver).toBe(resolverDouble);
  });

  it('writes nothing until every required point is confirmed', async () => {
    await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    expect(mockSave).not.toHaveBeenCalled();
    // The second slot is now the one being asked for, seeded from its own public place.
    expect(editor().props.slot).toBe('end');
    expect(editor().props.initialQuery).toBe('Petrovaradinska tvrđava, Petrovaradin');
  });

  it('saves both points as one explicitly confirmed value and reports back', async () => {
    const { onSaved } = await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    await act(async () => { editor().props.onConfirm(point('end')); });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const command = mockSave.mock.calls[0][0];
    expect(command).toMatchObject({ conversationId: CONVERSATION, expectedRevision: 'a'.repeat(64), confirmed: true });
    expect(command.value.resolvedLocation.points.map((item: ConfirmedLocationPoint) => item.slot)).toEqual(['start', 'end']);
    // The binding carries the topology the points were resolved against, not a new one.
    expect(command.value.resolvedLocation.binding).toEqual({ taskCountryCode: 'RS', geography: route,
      exactAddress: 'Lenke Dunđerski 11, Novi Sad' });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('starts from the point already confirmed and asks only for the rest', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: review([point('start')]) });
    await mount();
    expect(editor().props.slot).toBe('end');
    await act(async () => { editor().props.onConfirm(point('end')); });
    expect(mockSave.mock.calls[0][0].value.resolvedLocation.points).toHaveLength(2);
  });

  it('does not offer the map for a conversation that can no longer be edited', async () => {
    mockRead.mockResolvedValue({ ok: true, podatak: { ...review(), editable: false } });
    await mount();
    expect(tree!.root.findAllByType(LocationPointEditor)).toHaveLength(0);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('reports a failed save instead of claiming the place was kept', async () => {
    mockSave.mockResolvedValue({ ok: false, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED', poruka: 'Server nije potvrdio mesto.' });
    const { onSaved } = await mount();
    await act(async () => { editor().props.onConfirm(point('start')); });
    await act(async () => { editor().props.onConfirm(point('end')); });
    expect(onSaved).not.toHaveBeenCalled();
    const text = tree!.root.findAll(node => String(node.type) === 'T')
      .flatMap(node => node.children.filter((child): child is string => typeof child === 'string')).join(' ');
    expect(text).toContain('Server nije potvrdio mesto.');
  });

  it('after a failed save the same points can be sent again, and a reload asks before it replaces them', async () => {
    // Review of 2026-09-23: the failed state had no "Sačuvaj ponovo" (the review was dropped), and its "Pokušaj ponovo"
    // re-read the server over the pins the person had just placed.
    mockSave.mockResolvedValueOnce({ ok: false, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED', poruka: 'Server nije potvrdio mesto.' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await mount();
      await act(async () => { editor().props.onConfirm(point('start')); });
      await act(async () => { editor().props.onConfirm(point('end')); });
      const reads = mockRead.mock.calls.length;
      await act(async () => { tree!.root.findByProps({ label: 'Učitaj sačuvano mesto' }).props.onPress(); });
      expect(alert).toHaveBeenCalledWith('Učitaj sačuvano mesto?', expect.any(String), expect.any(Array));
      expect(mockRead).toHaveBeenCalledTimes(reads);
      await act(async () => { tree!.root.findByProps({ label: 'Sačuvaj ponovo' }).props.onPress(); });
      expect(mockSave).toHaveBeenCalledTimes(2);
      expect(mockSave.mock.calls[1][0].value.resolvedLocation.points).toEqual(mockSave.mock.calls[0][0].value.resolvedLocation.points);
    } finally { alert.mockRestore(); }
  });
});
