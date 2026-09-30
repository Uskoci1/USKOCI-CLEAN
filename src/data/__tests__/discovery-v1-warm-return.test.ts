import { createDiscoveryV1WarmReturn, DISCOVERY_V1_WARM_RETURN_MS } from '../discoveryV1WarmReturn';

// EX-03 warm return (owner approval 2026-09-30): what the Zadaci route keeps of a screen that left, for the next screen of the same account. The holder knows nothing about
// Discovery: it parks anything that can detach, say whether its picture is still warm and retire. It is the route's own object, so it goes with the route (sign-out, account change).
const VIEW: any = {}, SOURCE = {};
const fake = (over: Record<string, unknown> = {}): any => ({ detach: jest.fn(() => true), warm: jest.fn(() => true), retire: jest.fn(), ...over });
let now = 1_000_000;
const holder = () => createDiscoveryV1WarmReturn<any>(() => now);
beforeEach(() => { now = 1_000_000; });

it('a parked coordinator is offered to the next screen of the same key and source until it is claimed', () => {
  const h = holder(), kept = fake();
  h.park('k', SOURCE, kept);
  expect(kept.detach).toHaveBeenCalledTimes(1);
  now += 90_000;
  expect(h.candidate('k', SOURCE, VIEW)).toEqual({ coordinator: kept, ageMs: 90_000 });
  expect(kept.warm).toHaveBeenCalledWith(VIEW);
  h.claim(kept);
  expect(h.candidate('k', SOURCE, VIEW)).toBeNull();
  expect(kept.retire).not.toHaveBeenCalled();
});

it('another account key, another source, a picture that is no longer warm, or one older than the window is not offered', () => {
  const h = holder(), kept = fake();
  h.park('k', SOURCE, kept);
  expect(h.candidate('other', SOURCE, VIEW)).toBeNull();
  expect(h.candidate('k', {}, VIEW)).toBeNull();
  kept.warm.mockReturnValueOnce(false);
  expect(h.candidate('k', SOURCE, VIEW)).toBeNull();
  now += DISCOVERY_V1_WARM_RETURN_MS;
  expect(h.candidate('k', SOURCE, VIEW)).not.toBeNull();       // the window includes its end
  now += 1;
  expect(h.candidate('k', SOURCE, VIEW)).toBeNull();
  now = 500_000;                                                // a clock that went backwards proves nothing either
  expect(h.candidate('k', SOURCE, VIEW)).toBeNull();
});

it('a coordinator that cannot be kept is retired at once, and a newer park retires the older one', () => {
  const h = holder(), bad = fake({ detach: jest.fn(() => false) });
  h.park('k', SOURCE, bad);
  expect(bad.retire).toHaveBeenCalledTimes(1);
  expect(h.candidate('k', SOURCE, VIEW)).toBeNull();
  const older = fake(), newer = fake();
  h.park('k', SOURCE, older);
  h.park('k', SOURCE, newer);
  expect(older.retire).toHaveBeenCalledTimes(1);
  expect(h.candidate('k', SOURCE, VIEW)?.coordinator).toBe(newer);
});

it('parking the same coordinator again keeps it, and renews its time', () => {
  const h = holder(), kept = fake();
  h.park('k', SOURCE, kept);
  now += 200_000;
  h.park('k', SOURCE, kept);
  expect(kept.detach).toHaveBeenCalledTimes(1);
  expect(kept.retire).not.toHaveBeenCalled();
  now += 200_000;
  expect(h.candidate('k', SOURCE, VIEW)?.ageMs).toBe(200_000);
});

it('discard retires the parked coordinator unless it is the one a screen is about to take', () => {
  const h = holder(), kept = fake();
  h.park('k', SOURCE, kept);
  h.discard(kept);
  expect(kept.retire).not.toHaveBeenCalled();
  h.discard(fake());
  expect(kept.retire).toHaveBeenCalledTimes(1);
  expect(h.candidate('k', SOURCE, VIEW)).toBeNull();
  h.discard();                                                  // nothing parked: nothing to do
});

it('dispose retires what is parked and everything parked later; reopen lets the holder keep again', () => {
  const h = holder(), kept = fake(), late = fake();
  h.park('k', SOURCE, kept);
  h.dispose();
  expect(kept.retire).toHaveBeenCalledTimes(1);
  h.park('k', SOURCE, late);
  expect(late.retire).toHaveBeenCalledTimes(1);
  expect(late.detach).not.toHaveBeenCalled();
  expect(h.candidate('k', SOURCE, VIEW)).toBeNull();
  h.reopen();
  const again = fake();
  h.park('k', SOURCE, again);
  expect(again.retire).not.toHaveBeenCalled();
  expect(h.candidate('k', SOURCE, VIEW)?.coordinator).toBe(again);
});
